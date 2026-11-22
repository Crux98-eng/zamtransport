const crypto = require('node:crypto');
const prisma = require('../lib/prisma');
const AppError = require('../errors/app-error');
const { audit } = require('../utils/audit');
const TOKEN_TTL_MS = 30 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

function createRawToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function hashVerificationToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function issueToken(db, userId, now = new Date()) {
  const token = createRawToken();
  await db.emailVerificationToken.deleteMany({ where: { userId } });
  await db.emailVerificationToken.create({
    data: {
      tokenHash: hashVerificationToken(token),
      userId,
      expiresAt: new Date(now.getTime() + TOKEN_TTL_MS),
    },
  });
  await db.user.update({ where: { id: userId }, data: { verificationEmailSentAt: now } });
  return token;
}

async function verifyToken(token, now = new Date(), database = prisma) {
  const tokenHash = hashVerificationToken(token);
  return database.$transaction(async (db) => {
    const stored = await db.emailVerificationToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!stored) throw new AppError(400, 'This verification link is invalid or has already been used.', 'VERIFICATION_INVALID');
    if (stored.expiresAt <= now) throw new AppError(400, 'This verification link has expired. Request a new one.', 'VERIFICATION_EXPIRED');
    if (stored.user.emailVerifiedAt || stored.user.status !== 'PENDING' || !['COMMUTER', 'DRIVER'].includes(stored.user.role)) {
      throw new AppError(400, 'This verification link is no longer valid. Request a new one if needed.', 'VERIFICATION_INVALID');
    }

    const consumed = await db.emailVerificationToken.deleteMany({
      where: { id: stored.id, tokenHash, expiresAt: { gt: now } },
    });
    if (consumed.count !== 1) throw new AppError(400, 'This verification link is invalid or has already been used.', 'VERIFICATION_INVALID');

    const status = stored.user.role === 'COMMUTER' ? 'ACTIVE' : 'PENDING';
    const updated = await db.user.updateMany({
      where: { id: stored.userId, emailVerifiedAt: null, status: 'PENDING' },
      data: { emailVerifiedAt: now, status },
    });
    if (updated.count !== 1) throw new AppError(400, 'This verification link is no longer valid.', 'VERIFICATION_INVALID');

    await audit(db, {
      targetUserId: stored.userId,
      action: 'EMAIL_VERIFIED',
      metadata: { role: stored.user.role },
    });
    return { userId: stored.userId, role: stored.user.role, status, email: stored.user.email, fullName: stored.user.fullName };
  });
}

module.exports = { RESEND_COOLDOWN_MS, TOKEN_TTL_MS, createRawToken, hashVerificationToken, issueToken, verifyToken };
