const assert = require('node:assert/strict');
const test = require('node:test');
const { driverApprovedEmail, driverRejectedEmail, passwordResetEmail, sendEmail, sendVerificationEmail, verificationEmail } = require('../../src/services/email');
const logger = require('../../src/utils/logger');

test('verification email is branded, responsive, time-limited, and escapes names', () => {
  const message = verificationEmail(
    { fullName: '<script>alert(1)</script>' },
    'COMMUTER',
    'https://transport.example/verify-email?token=abc',
  );
  assert.match(message.html, /ZAMBIA TRANSPORT/);
  assert.match(message.html, /name="viewport"/);
  assert.match(message.html, /expires in 30 minutes/);
  assert.doesNotMatch(message.html, /<script>alert/);
  assert.match(message.text, /https:\/\/transport\.example\/verify-email\?token=abc/);
});

test('driver decision templates include approval login and escaped rejection reason', () => {
  const approved = driverApprovedEmail({ fullName: 'Jane Driver' }, 'https://transport.example/login');
  const rejected = driverRejectedEmail({ fullName: 'Jane Driver' }, '<img src=x onerror=alert(1)>');
  assert.match(approved.html, /approved/);
  assert.match(approved.text, /https:\/\/transport\.example\/login/);
  assert.doesNotMatch(rejected.html, /<img src=x/);
  assert.match(rejected.text, /<img src=x/);
});

test('password reset email is branded, warns about expiry, and escapes account names', () => {
  const message = passwordResetEmail(
    { fullName: '<script>alert(1)</script>' },
    'https://transport.example/reset-password?token=abc',
  );
  assert.match(message.html, /ZAMBIA TRANSPORT/);
  assert.match(message.html, /expires in 30 minutes/);
  assert.doesNotMatch(message.html, /<script>alert/);
  assert.match(message.text, /https:\/\/transport\.example\/reset-password\?token=abc/);
});

test('email sender reports missing provider configuration as not accepted', async (context) => {
  const names = ['RESEND_API_KEY', 'EMAIL_FROM', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_FROM'];
  const saved = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  context.after(() => names.forEach((name) => {
    if (saved[name] === undefined) delete process.env[name];
    else process.env[name] = saved[name];
  }));
  names.forEach((name) => { process.env[name] = ''; });
  const result = await sendEmail({ to: 'test@example.com', subject: 'Test', text: 'Test', purpose: 'unit-test' });
  assert.equal(result.accepted, false);
  assert.equal(result.reason, 'EMAIL_NOT_CONFIGURED');
});

test('Resend requires EMAIL_FROM instead of silently using the SMTP sender', async (context) => {
  const names = ['RESEND_API_KEY', 'EMAIL_FROM', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_FROM'];
  const saved = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  context.after(() => names.forEach((name) => {
    if (saved[name] === undefined) delete process.env[name];
    else process.env[name] = saved[name];
  }));
  process.env.RESEND_API_KEY = 'test-key-not-used';
  process.env.EMAIL_FROM = '';
  process.env.SMTP_FROM = 'legacy@example.com';
  process.env.SMTP_HOST = '';
  process.env.SMTP_PORT = '';

  const result = await sendEmail({ to: 'test@example.com', subject: 'Test', text: 'Test', purpose: 'unit-test' });
  assert.deepEqual(result, { accepted: false, reason: 'EMAIL_FROM_NOT_CONFIGURED' });
});

test('Resend API rejection is not accepted and logs no key or verification token', async (context) => {
  const names = ['RESEND_API_KEY', 'EMAIL_FROM', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_FROM'];
  const saved = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  const savedFetch = global.fetch;
  const savedLoggerError = logger.error;
  const apiKey = 'test-resend-key';
  const verificationToken = 'test-verification-token';
  const errors = [];
  context.after(() => {
    names.forEach((name) => {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    });
    global.fetch = savedFetch;
    logger.error = savedLoggerError;
  });
  process.env.RESEND_API_KEY = apiKey;
  process.env.EMAIL_FROM = 'Zambia Transport <verified@example.com>';
  process.env.SMTP_HOST = '';
  process.env.SMTP_PORT = '';
  global.fetch = async (_url, options) => {
    assert.equal(options.headers.get('authorization'), `Bearer ${apiKey}`);
    return new Response(JSON.stringify({
      name: 'invalid_api_key',
      message: `API key is invalid; rejected ${verificationToken}`,
      statusCode: 401,
    }), { status: 401, headers: { 'content-type': 'application/json' } });
  };
  logger.error = (message, metadata) => errors.push({ message, metadata });

  const result = await sendEmail({
    to: 'test@example.com',
    subject: 'Test',
    html: verificationToken,
    text: verificationToken,
    purpose: 'unit-test',
  });
  const log = JSON.stringify(errors);
  assert.deepEqual(result, { accepted: false, reason: 'DELIVERY_FAILED' });
  assert.equal(errors[0].metadata.statusCode, 401);
  assert.equal(errors[0].metadata.errorName, 'invalid_api_key');
  assert.equal(log.includes(apiKey), false);
  assert.equal(log.includes(verificationToken), false);
});

test('verification links use APP_URL when FRONTEND_URL is not set', async (context) => {
  const names = ['RESEND_API_KEY', 'EMAIL_FROM', 'FRONTEND_URL', 'APP_URL', 'CLIENT_URL'];
  const saved = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  const savedFetch = global.fetch;
  const verificationToken = 'test-verification-token';
  let emailBody;
  context.after(() => {
    names.forEach((name) => {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    });
    global.fetch = savedFetch;
  });
  process.env.RESEND_API_KEY = 'test-resend-key';
  process.env.EMAIL_FROM = 'Zambia Transport <verified@example.com>';
  process.env.FRONTEND_URL = '';
  process.env.APP_URL = 'https://zamtransport-seven.vercel.app/';
  process.env.CLIENT_URL = 'https://api.example.com';
  global.fetch = async (_url, options) => {
    emailBody = JSON.parse(options.body);
    return new Response(JSON.stringify({ id: 'email_test' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const result = await sendVerificationEmail(
    { id: 123, fullName: 'Test Commuter', email: 'commuter@example.com' },
    'COMMUTER',
    verificationToken,
  );
  assert.deepEqual(result, { accepted: true });
  assert.match(emailBody.html, /https:\/\/zamtransport-seven\.vercel\.app\/verify-email\?token=test-verification-token/);
});
