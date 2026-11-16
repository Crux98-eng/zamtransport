const bcrypt = require('bcryptjs');
const express = require('express');
const jwt = require('jsonwebtoken');
const prisma = require('../../lib/prisma');
const AppError = require('../../errors/app-error');
const { authenticate, accountMessage } = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const asyncHandler = require('../../utils/async-handler');
const { audit } = require('../../utils/audit');
const { createRefreshToken, hashToken, signAccessToken, verifyRefreshToken } = require('../../utils/tokens');
const { publicUser } = require('../../utils/users');
const { loginSchema, passwordChangeSchema, refreshSchema, registerSchema } = require('../../validators/auth');

const router = express.Router();
const clientIp = (request) => request.ip;

async function issueSession(db, user) {
  const refresh = createRefreshToken(user);
  await db.refreshToken.create({ data: { id: refresh.id, userId: user.id, tokenHash: refresh.tokenHash, expiresAt: refresh.expiresAt } });
  return { accessToken: signAccessToken(user), refreshToken: refresh.token };
}

router.post('/register', validate(registerSchema), asyncHandler(async (request, response) => {
  const { fullName, email, phoneNumber, password } = request.body;
  
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new AppError(409, 'An account already exists for this email address.', 'EMAIL_IN_USE');
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.$transaction(async (db) => {
    const created = await db.user.create({ data: { fullName, email, phoneNumber: phoneNumber || null, passwordHash, role: 'COMMUTER', status: 'PENDING' } });
    await audit(db, { targetUserId: created.id, action: 'USER_REGISTERED', ipAddress: clientIp(request) });
    return created;
  });
  response.status(201).json({ success: true, message: 'Registration successful. Your account is awaiting administrator approval.', data: { user: publicUser(user) } });
}));

router.post('/login', validate(loginSchema), asyncHandler(async (request, response) => {
  const { email, password } = request.body;
  const user = await prisma.user.findUnique({ where: { email } });
  const valid = user && await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    if (user) await audit(prisma, { targetUserId: user.id, action: 'LOGIN_FAILED', ipAddress: clientIp(request) });
    throw new AppError(401, 'Invalid email or password.', 'INVALID_CREDENTIALS');
  }
  if (user.status !== 'ACTIVE') throw new AppError(403, accountMessage(user.status), `ACCOUNT_${user.status}`);
  const tokens = await prisma.$transaction(async (db) => {
    const result = await issueSession(db, user);
    await audit(db, { actorId: user.id, targetUserId: user.id, action: 'LOGIN_SUCCEEDED', ipAddress: clientIp(request) });
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
    await db.refreshToken.create({ data: { id: next.id, userId: current.userId, tokenHash: next.tokenHash, expiresAt: next.expiresAt } });
    const revoked = await db.refreshToken.updateMany({ where: { id: current.id, revokedAt: null }, data: { revokedAt: new Date(), revokedReason: 'ROTATED', replacedByTokenId: next.id } });
    if (revoked.count !== 1) throw new AppError(401, 'Refresh token has already been used.', 'REFRESH_TOKEN_REUSED');
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
