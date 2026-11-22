const assert = require('node:assert/strict');
const test = require('node:test');
const { driverApprovedEmail, driverRejectedEmail, sendEmail, verificationEmail } = require('../../src/services/email');

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
