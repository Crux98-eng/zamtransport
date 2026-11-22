const assert = require('node:assert/strict');
const test = require('node:test');
const AppError = require('../../src/errors/app-error');
const { hashVerificationToken, issueToken, TOKEN_TTL_MS, verifyToken } = require('../../src/services/email-verification');

function verificationDatabase(user, tokenRecord) {
  let token = tokenRecord;
  return {
    user,
    token: () => token,
    emailVerificationToken: {
      async findUnique() { return token ? { ...token, user } : null; },
      async deleteMany({ where }) {
        if (token && token.id === where.id && token.tokenHash === where.tokenHash && token.expiresAt > where.expiresAt.gt) {
          token = null;
          return { count: 1 };
        }
        return { count: 0 };
      },
    },
    userModel: null,
    userTable: {
      async updateMany({ where, data }) {
        if (user.id !== where.id || user.emailVerifiedAt !== null || user.status !== where.status) return { count: 0 };
        Object.assign(user, data);
        return { count: 1 };
      },
    },
    auditLog: { async create() { return {}; } },
    async $transaction(callback) {
      return callback({
        emailVerificationToken: this.emailVerificationToken,
        user: this.userTable,
        auditLog: this.auditLog,
      });
    },
  }
}

function pendingUser(role) {
  return { id: 7, fullName: 'Test Applicant', email: 'applicant@example.com', role, status: 'PENDING', emailVerifiedAt: null };
}

test('verification token issue stores only its hash and expires after 30 minutes', async () => {
  const created = [];
  const database = {
    emailVerificationToken: {
      async deleteMany() {},
      async create({ data }) { created.push(data); },
    },
    user: { async update() {} },
  };
  const now = new Date('2026-01-01T00:00:00Z');
  const token = await issueToken(database, 7, now);
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(created.length, 1);
  assert.equal(created[0].tokenHash, hashVerificationToken(token));
  assert.notEqual(created[0].tokenHash, token);
  assert.equal(created[0].expiresAt.getTime(), now.getTime() + TOKEN_TTL_MS);
});

test('commuter verification activates the account and consumes the token once', async () => {
  const rawToken = 'commuter-token-value';
  const user = pendingUser('COMMUTER');
  const database = verificationDatabase(user, {
    id: 'token-1',
    userId: 7,
    tokenHash: hashVerificationToken(rawToken),
    expiresAt: new Date('2026-01-01T00:30:00Z'),
  });
  const result = await verifyToken(rawToken, new Date('2026-01-01T00:10:00Z'), database);
  assert.equal(result.status, 'ACTIVE');
  assert.equal(user.emailVerifiedAt.toISOString(), '2026-01-01T00:10:00.000Z');
  assert.equal(database.token(), null);
  await assert.rejects(verifyToken(rawToken, new Date('2026-01-01T00:11:00Z'), database), { code: 'VERIFICATION_INVALID' });
});

test('driver verification leaves the application pending for admin approval', async () => {
  const rawToken = 'driver-token-value';
  const user = pendingUser('DRIVER');
  const database = verificationDatabase(user, {
    id: 'token-2',
    userId: 7,
    tokenHash: hashVerificationToken(rawToken),
    expiresAt: new Date('2026-01-01T00:30:00Z'),
  });
  const result = await verifyToken(rawToken, new Date('2026-01-01T00:10:00Z'), database);
  assert.equal(result.status, 'PENDING');
  assert.equal(user.emailVerifiedAt.toISOString(), '2026-01-01T00:10:00.000Z');
});

test('expired verification tokens are rejected without activating the account', async () => {
  const rawToken = 'expired-token-value';
  const user = pendingUser('COMMUTER');
  const database = verificationDatabase(user, {
    id: 'token-3',
    userId: 7,
    tokenHash: hashVerificationToken(rawToken),
    expiresAt: new Date('2026-01-01T00:00:00Z'),
  });
  await assert.rejects(
    verifyToken(rawToken, new Date('2026-01-01T00:00:01Z'), database),
    (error) => error instanceof AppError && error.code === 'VERIFICATION_EXPIRED',
  );
  assert.equal(user.emailVerifiedAt, null);
});
