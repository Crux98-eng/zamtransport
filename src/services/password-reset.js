const crypto = require('node:crypto');
const prisma = require('../lib/prisma');
const AppError = require('../errors/app-error');
const { audit } = require('../utils/audit');

const TOKEN_TTL_MS = 30 * 60 * 1000;
const REQUEST_COOLDOWN_MS = 60 * 1000;

function createRawToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function hashPasswordResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function issueToken(db, userId, now = new Date()) {
  const token = createRawToken();
  await db.passwordResetToken.deleteMany({ where: { userId } });
  await db.passwordResetToken.create({
    data: {
      tokenHash: hashPasswordResetToken(token),
      userId,
      expiresAt: new Date(now.getTime() + TOKEN_TTL_MS),
    },
  });
  return token;
}

async function resetPassword(token, passwordHash, { now = new Date(), database = prisma, ipAddress, userAgent } = {}) {
  const tokenHash = hashPasswordResetToken(token);
  return database.$transaction(async (db) => {
    const stored = await db.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!stored || stored.expiresAt <= now) {
      throw new AppError(400, 'This password reset link is invalid or expired. Request a new one.', 'PASSWORD_RESET_INVALID');
    }

    const consumed = await db.passwordResetToken.deleteMany({
      where: { id: stored.id, tokenHash, expiresAt: { gt: now } },
    });
    if (consumed.count !== 1) {
      throw new AppError(400, 'This password reset link is invalid or expired. Request a new one.', 'PASSWORD_RESET_INVALID');
    }

    await db.user.update({
      where: { id: stored.userId },
      data: { passwordHash, passwordResetRequestedAt: null },
    });
    await db.passwordResetToken.deleteMany({ where: { userId: stored.userId } });
    await db.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: now, revokedReason: 'PASSWORD_RESET' },
    });
    await audit(db, {
      actorId: stored.userId,
      targetUserId: stored.userId,
      action: 'PASSWORD_RESET',
      ipAddress,
      userAgent,
    });
    return { userId: stored.userId };
  });
}

module.exports = {
  REQUEST_COOLDOWN_MS,
  TOKEN_TTL_MS,
  createRawToken,
  hashPasswordResetToken,
  issueToken,
  resetPassword,
};
