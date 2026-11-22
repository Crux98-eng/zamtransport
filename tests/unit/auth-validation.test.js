process.env.ACCESS_TOKEN_SECRET = 'a-very-long-test-access-secret-value';
process.env.REFRESH_TOKEN_SECRET = 'a-very-long-test-refresh-secret-value';

const assert = require('node:assert/strict');
const test = require('node:test');
const { driverRegisterSchema, forgotPasswordSchema, registerSchema, resendVerificationSchema, resetPasswordSchema, verifyEmailSchema } = require('../../src/validators/auth');
const { signAccessToken, verifyAccessToken, createRefreshToken, verifyRefreshToken, hashToken } = require('../../src/utils/tokens');

const validRegistration = { fullName: 'Jane Commuter', email: 'JANE@example.com', password: 'Correct-Horse-7!', confirmPassword: 'Correct-Horse-7!' };

test('registration validation normalizes email and accepts a strong password', () => {
  const result = registerSchema.parse(validRegistration);
  assert.equal(result.email, 'jane@example.com');
});

test('registration rejects privileged role and active-status mass assignment', () => {
  assert.throws(() => registerSchema.parse({ ...validRegistration, role: 'ADMIN' }));
  assert.throws(() => registerSchema.parse({ ...validRegistration, status: 'ACTIVE' }));
});

test('registration rejects weak or mismatched passwords', () => {
  assert.throws(() => registerSchema.parse({ ...validRegistration, password: 'short', confirmPassword: 'short' }));
  assert.throws(() => registerSchema.parse({ ...validRegistration, confirmPassword: 'Different-Password-7!' }));
});

test('driver registration validates licence details and rejects role/status assignment', () => {
  const valid = {
    fullName: 'John Driver',
    email: 'DRIVER@example.com',
    password: 'Correct-Horse-7!',
    confirmPassword: 'Correct-Horse-7!',
    licenceNumber: 'ZL-12345',
    licenceExpiry: '2035-01-01',
  };
  assert.equal(driverRegisterSchema.parse(valid).email, 'driver@example.com');
  assert.throws(() => driverRegisterSchema.parse({ ...valid, role: 'ADMIN' }));
  assert.throws(() => driverRegisterSchema.parse({ ...valid, licenceExpiry: '2000-01-01' }));
});

test('verification and resend inputs enforce token shape and normalized email', () => {
  assert.equal(verifyEmailSchema.safeParse({ token: 'A'.repeat(43) }).success, true);
  assert.equal(verifyEmailSchema.safeParse({ token: 'short' }).success, false);
  assert.equal(resendVerificationSchema.parse({ email: 'USER@example.com' }).email, 'user@example.com');
});

test('forgot and reset password inputs are normalized, strong, matched, and token-shaped', () => {
  assert.equal(forgotPasswordSchema.parse({ email: 'USER@example.com' }).email, 'user@example.com');
  const valid = { token: 'A'.repeat(43), password: 'Correct-Horse-7!', confirmPassword: 'Correct-Horse-7!' };
  assert.equal(resetPasswordSchema.safeParse(valid).success, true);
  assert.equal(resetPasswordSchema.safeParse({ ...valid, token: 'short' }).success, false);
  assert.equal(resetPasswordSchema.safeParse({ ...valid, password: 'weak' }).success, false);
  assert.equal(resetPasswordSchema.safeParse({ ...valid, confirmPassword: 'Different-Horse-8!' }).success, false);
});

test('access and refresh tokens carry minimal identity claims', () => {
  const user = { id: 42 };
  const access = signAccessToken(user);
  const refresh = createRefreshToken(user);
  assert.equal(verifyAccessToken(access).sub, '42');
  assert.equal(verifyRefreshToken(refresh.token).sub, '42');
  assert.equal(hashToken(refresh.token).length, 64);
  assert.notEqual(refresh.token, refresh.tokenHash);
});
