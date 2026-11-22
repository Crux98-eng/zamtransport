// Authentication endpoints: registration, login, token refresh,
// logout, password changes, and active-session management.
const bcrypt = require('bcryptjs');
const express = require('express');
const { rateLimit } = require('express-rate-limit');
const prisma = require('../../lib/prisma');
const AppError = require('../../errors/app-error');
const { authenticate, accountMessage } = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const asyncHandler = require('../../utils/async-handler');
const { audit } = require('../../utils/audit');
const { createRefreshToken, hashToken, signAccessToken, verifyRefreshToken } = require('../../utils/tokens');
const { publicUser } = require('../../utils/users');
const notifications = require('../../services/notifications');
const emailService = require('../../services/email');
const emailVerification = require('../../services/email-verification');
const {
  driverRegisterSchema,
  loginSchema,
  passwordChangeSchema,
  refreshSchema,
  registerSchema,
  resendVerificationSchema,
  verifyEmailSchema,
} = require('../../validators/auth');

const router = express.Router();
const clientIp = (request) => request.ip;
const resendVerificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 3,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'Too many verification requests. Please try again later.', code: 'VERIFICATION_RATE_LIMITED' },
});

async function issueSession(db, user, request) {
  const refresh = createRefreshToken(user);
  await db.refreshToken.create({ data: { id: refresh.id, userId: user.id, tokenHash: refresh.tokenHash, expiresAt: refresh.expiresAt, ipAddress: request?.ip, userAgent: request?.get('user-agent')?.slice(0, 500) } });
  return { accessToken: signAccessToken(user), refreshToken: refresh.token };
}

router.post('/register', validate(registerSchema), asyncHandler(async (request, response) => {
  const { fullName, email, phoneNumber, password } = request.body;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new AppError(409, 'An account already exists for this email address.', 'EMAIL_IN_USE');
  const passwordHash = await bcrypt.hash(password, 12);
  const { user, token } = await prisma.$transaction(async (db) => {
    const created = await db.user.create({ data: { fullName, email, phoneNumber: phoneNumber || null, passwordHash, role: 'COMMUTER', status: 'PENDING', emailVerifiedAt: null } });
    const token = await emailVerification.issueToken(db, created.id);
    await audit(db, { targetUserId: created.id, action: 'USER_REGISTERED', ipAddress: clientIp(request) });
    return { user: created, token };
  });
  const delivery = await emailService.sendVerificationEmail(user, user.role, token);
  response.status(201).json({
    success: true,
    message: delivery.accepted
      ? 'Registration received. Check your email to verify your account. If it does not arrive, you can request another link.'
      : 'Registration received, but the email provider did not accept the verification message. Request another email from the verification page.',
    data: { user: publicUser(user), verificationEmailAccepted: delivery.accepted },
  });
}));

router.post('/register/driver', validate(driverRegisterSchema), asyncHandler(async (request, response) => {
  const { fullName, email: address, phoneNumber, password, licenceNumber, licenceExpiry, address: homeAddress } = request.body;
  const existing = await prisma.user.findUnique({ where: { email: address } });
  if (existing) throw new AppError(409, 'An account already exists for this email address.', 'EMAIL_IN_USE');
  const passwordHash = await bcrypt.hash(password, 12);
  const { user, token } = await prisma.$transaction(async (db) => {
    const created = await db.user.create({
      data: { fullName, email: address, phoneNumber: phoneNumber || null, passwordHash, role: 'DRIVER', status: 'PENDING', emailVerifiedAt: null },
    });
    await db.driverProfile.create({
      data: { userId: created.id, licenceNumber, licenceExpiry, address: homeAddress || null },
    });
    const token = await emailVerification.issueToken(db, created.id);
    await audit(db, { targetUserId: created.id, action: 'DRIVER_REGISTERED', ipAddress: clientIp(request) });
    return { user: created, token };
  });
  const delivery = await emailService.sendVerificationEmail(user, user.role, token);
  response.status(201).json({
    success: true,
    message: delivery.accepted
      ? 'Driver application received. Verify your email before administrator review. If the email does not arrive, you can request another link.'
      : 'Driver application received, but the email provider did not accept the verification message. Request another email from the verification page.',
    data: { user: publicUser(user), verificationEmailAccepted: delivery.accepted },
  });
}));

router.post('/verify-email', validate(verifyEmailSchema), asyncHandler(async (request, response) => {
  const result = await emailVerification.verifyToken(request.body.token);
  if (result.role === 'DRIVER') {
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN', status: 'ACTIVE' }, select: { id: true } });
    await Promise.all(admins.map((admin) => notifications.create({
      userId: admin.id,
      title: 'Verified driver application',
      message: `${result.fullName} verified their email and is awaiting driver approval.`,
      type: 'GENERAL',
      dedupeKey: `user:${result.userId}:driver:verified:admin:${admin.id}`,
    })));
  }
  response.json({
    success: true,
    message: result.role === 'DRIVER'
      ? 'Email verified. Your driver application is now awaiting administrator approval.'
      : 'Email verified. Your commuter account is active and ready to use.',
    data: result,
  });
}));

router.post('/resend-verification', resendVerificationLimiter, validate(resendVerificationSchema), asyncHandler(async (request, response) => {
  const genericMessage = 'If an account needs email verification, a verification message will be sent shortly.';
  const user = await prisma.user.findUnique({ where: { email: request.body.email } });
  const now = new Date();
  const cutoff = new Date(now.getTime() - emailVerification.RESEND_COOLDOWN_MS);
  if (!user || !['COMMUTER', 'DRIVER'].includes(user.role) || user.status !== 'PENDING' || user.emailVerifiedAt) {
    return response.json({ success: true, message: genericMessage });
  }

  const result = await prisma.$transaction(async (db) => {
    const claimed = await db.user.updateMany({
      where: {
        id: user.id,
        status: 'PENDING',
        emailVerifiedAt: null,
        OR: [{ verificationEmailSentAt: null }, { verificationEmailSentAt: { lte: cutoff } }],
      },
      data: { verificationEmailSentAt: now },
    });
    if (claimed.count !== 1) return null;
    const token = await emailVerification.issueToken(db, user.id, now);
    return { token };
  });

  if (result) await emailService.sendVerificationEmail(user, user.role, result.token);
  response.json({ success: true, message: genericMessage });
}));

router.post('/login', validate(loginSchema), asyncHandler(async (request, response) => {
  const { email, password } = request.body;
  
  const user = await prisma.user.findUnique({ where: { email } });
  const valid = user && await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    if (user) await audit(prisma, { targetUserId: user.id, action: 'LOGIN_FAILED', ipAddress: clientIp(request), userAgent: request.get('user-agent'), success: false, resourceType: 'User', resourceId: user.id });
    throw new AppError(401, 'Invalid email or password.', 'INVALID_CREDENTIALS');
  }
  if (!user.emailVerifiedAt) throw new AppError(403, 'Verify your email address before signing in.', 'EMAIL_NOT_VERIFIED');
  if (user.status === 'REJECTED' && user.role === 'DRIVER' && user.rejectionReason) {
    throw new AppError(403, `Your driver application was rejected. Reason: ${user.rejectionReason}`, 'ACCOUNT_REJECTED');
  }
  if (user.status !== 'ACTIVE') throw new AppError(403, accountMessage(user.status), `ACCOUNT_${user.status}`);
  const tokens = await prisma.$transaction(async (db) => {
    const result = await issueSession(db, user, request);
    await audit(db, { actorId: user.id, targetUserId: user.id, action: 'LOGIN_SUCCEEDED', ipAddress: clientIp(request), userAgent: request.get('user-agent'), resourceType: 'Session' });
    return result;
  });
  response.json({ success: true, message: 'Login successful.', data: { user: publicUser(user), ...tokens } });
}));

router.post('/refresh', validate(refreshSchema), asyncHandler(async (request, response) => {
  const { refreshToken } = request.body;
  let payload;
  try { payload = verifyRefreshToken(refreshToken); } catch (error) {
    throw new AppError(401, error.name === 'TokenExpiredError' ? 'Refresh token has expired.' : 'Invalid refresh token.', 'INVALID_REFRESH_TOKEN');
  }
  const current = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(refreshToken) }, include: { user: true } });
  if (!current || current.id !== payload.jti || current.expiresAt <= new Date()) throw new AppError(401, 'Refresh token is invalid.', 'INVALID_REFRESH_TOKEN');
  if (current.revokedAt) {
    if (current.replacedByTokenId) await prisma.refreshToken.updateMany({ where: { userId: current.userId, revokedAt: null }, data: { revokedAt: new Date(), revokedReason: 'TOKEN_REUSE_DETECTED' } });
    throw new AppError(401, 'Refresh token has been revoked.', 'REFRESH_TOKEN_REVOKED');
  }
  if (current.user.status !== 'ACTIVE') throw new AppError(403, accountMessage(current.user.status), `ACCOUNT_${current.user.status}`);
  const tokens = await prisma.$transaction(async (db) => {
    const next = createRefreshToken(current.user);
    await db.refreshToken.create({ data: { id: next.id, userId: current.userId, tokenHash: next.tokenHash, expiresAt: next.expiresAt, ipAddress: current.ipAddress, userAgent: current.userAgent } });
    const revoked = await db.refreshToken.updateMany({ where: { id: current.id, revokedAt: null }, data: { revokedAt: new Date(), revokedReason: 'ROTATED', replacedByTokenId: next.id } });
    if (revoked.count !== 1) throw new AppError(401, 'Refresh token has already been used.', 'REFRESH_TOKEN_REUSED');
    await db.refreshToken.update({ where: { id: next.id }, data: { lastUsedAt: new Date() } });
    return { accessToken: signAccessToken(current.user), refreshToken: next.token };
  });
  response.json({ success: true, message: 'Tokens refreshed.', data: tokens });
}));

router.post('/logout', validate(refreshSchema), asyncHandler(async (request, response) => {
  const session = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(request.body.refreshToken) } });
  const result = await prisma.$transaction(async (db) => {
    const updated = await db.refreshToken.updateMany({ where: { tokenHash: hashToken(request.body.refreshToken), revokedAt: null }, data: { revokedAt: new Date(), revokedReason: 'LOGOUT' } });
    if (session) await audit(db, { actorId: session.userId, targetUserId: session.userId, action: 'LOGOUT' });
    return updated;
  });
  response.json({ success: true, message: result.count ? 'Logged out successfully.' : 'Session was already inactive.' });
}));

router.post('/logout-all', authenticate, asyncHandler(async (request, response) => {
  await prisma.$transaction(async (db) => {
    await db.refreshToken.updateMany({ where: { userId: request.user.id, revokedAt: null }, data: { revokedAt: new Date(), revokedReason: 'LOGOUT_ALL' } });
    await audit(db, { actorId: request.user.id, targetUserId: request.user.id, action: 'LOGOUT_ALL', ipAddress: clientIp(request) });
  });
  response.json({ success: true, message: 'All sessions have been revoked.' });
}));

router.get('/sessions', authenticate, asyncHandler(async (request, response) => {
  const sessions = await prisma.refreshToken.findMany({ where: { userId: request.user.id }, select: { id: true, createdAt: true, lastUsedAt: true, expiresAt: true, revokedAt: true, revokedReason: true, ipAddress: true, userAgent: true }, orderBy: { createdAt: 'desc' } });
  response.json({ success: true, data: { sessions } });
}));
router.delete('/sessions/:sessionId', authenticate, asyncHandler(async (request, response) => {
  const result = await prisma.refreshToken.updateMany({ where: { id: request.params.sessionId, userId: request.user.id, revokedAt: null }, data: { revokedAt: new Date(), revokedReason: 'USER_SESSION_REVOKED' } });
  if (!result.count) throw new AppError(404, 'Active session not found.', 'NOT_FOUND');
  await audit(prisma, { actorId: request.user.id, targetUserId: request.user.id, action: 'SESSION_REVOKED', resourceType: 'Session', resourceId: request.params.sessionId, ipAddress: clientIp(request), userAgent: request.get('user-agent') });
  response.status(204).end();
}));
router.delete('/sessions', authenticate, asyncHandler(async (request, response) => {
  const result = await prisma.refreshToken.updateMany({ where: { userId: request.user.id, revokedAt: null }, data: { revokedAt: new Date(), revokedReason: 'LOGOUT_ALL' } });
  await audit(prisma, { actorId: request.user.id, targetUserId: request.user.id, action: 'LOGOUT_ALL', resourceType: 'Session', ipAddress: clientIp(request), userAgent: request.get('user-agent') });
  response.json({ success: true, data: { revoked: result.count } });
}));

router.get('/me', authenticate, asyncHandler(async (request, response) => {
  const user = await prisma.user.findUnique({ where: { id: request.user.id }, include: { driverProfile: true } });
  response.json({ success: true, data: { user: { ...publicUser(user), profile: user.driverProfile } } });
}));

router.post('/change-password', authenticate, validate(passwordChangeSchema), asyncHandler(async (request, response) => {
  const user = await prisma.user.findUnique({ where: { id: request.user.id } });
  if (!user || !(await bcrypt.compare(request.body.currentPassword, user.passwordHash))) throw new AppError(401, 'Current password is incorrect.', 'INVALID_CREDENTIALS');
  const passwordHash = await bcrypt.hash(request.body.newPassword, 12);
  await prisma.$transaction(async (db) => {
    await db.user.update({ where: { id: user.id }, data: { passwordHash } });
    await db.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date(), revokedReason: 'PASSWORD_CHANGED' } });
    await audit(db, { actorId: user.id, targetUserId: user.id, action: 'PASSWORD_CHANGED', ipAddress: clientIp(request) });
  });
  response.json({ success: true, message: 'Password changed. Please log in again.' });
}));

module.exports = router;
