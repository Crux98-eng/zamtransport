const assert = require('node:assert/strict');
const test = require('node:test');
const AppError = require('../../src/errors/app-error');
const {
  hashPasswordResetToken,
  issueToken,
  resetPassword,
  TOKEN_TTL_MS,
} = require('../../src/services/password-reset');

function resetDatabase(userId, token) {
  let storedToken = token;
  const updatedUsers = [];
  const revokedSessions = [];
  const auditEvents = [];
  return {
    updatedUsers,
    revokedSessions,
    auditEvents,
    passwordResetToken: {
      async findUnique({ where }) {
        return storedToken?.tokenHash === where.tokenHash ? { ...storedToken } : null;
      },
      async deleteMany({ where }) {
        if (where.userId !== undefined) {
          if (storedToken?.userId === where.userId) storedToken = null;
          return { count: 1 };
        }
        if (
          storedToken
          && storedToken.id === where.id
          && storedToken.tokenHash === where.tokenHash
          && storedToken.expiresAt > where.expiresAt.gt
        ) {
          storedToken = null;
          return { count: 1 };
        }
        return { count: 0 };
      },
    },
    user: {
      async update({ where, data }) {
        updatedUsers.push({ where, data });
      },
    },
    refreshToken: {
      async updateMany(args) {
        revokedSessions.push(args);
        return { count: 2 };
      },
    },
    auditLog: {
      async create({ data }) {
        auditEvents.push(data);
        return data;
      },
    },
    async $transaction(callback) {
      return callback({
        passwordResetToken: this.passwordResetToken,
        user: this.user,
        refreshToken: this.refreshToken,
        auditLog: this.auditLog,
      });
    },
  };
}

test('password reset tokens store only a hash and expire after 30 minutes', async () => {
  const created = [];
  const database = {
    passwordResetToken: {
      async deleteMany() {},
      async create({ data }) { created.push(data); },
    },
  };
  const now = new Date('2026-01-01T00:00:00Z');
  const token = await issueToken(database, 42, now);

  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(created.length, 1);
  assert.equal(created[0].tokenHash, hashPasswordResetToken(token));
  assert.notEqual(created[0].tokenHash, token);
  assert.equal(created[0].expiresAt.getTime(), now.getTime() + TOKEN_TTL_MS);
});

test('password reset consumes a token, changes the hash, revokes sessions, and audits atomically', async () => {
  const token = 'single-use-reset-token';
  const now = new Date('2026-01-01T00:10:00Z');
  const database = resetDatabase(42, {
    id: 'reset-1',
    userId: 42,
    tokenHash: hashPasswordResetToken(token),
    expiresAt: new Date('2026-01-01T00:30:00Z'),
  });

  const result = await resetPassword(token, 'new-password-hash', {
    now,
    database,
    ipAddress: '203.0.113.1',
    userAgent: 'unit-test',
  });

  assert.deepEqual(result, { userId: 42 });
  assert.deepEqual(database.updatedUsers, [{
    where: { id: 42 },
    data: { passwordHash: 'new-password-hash', passwordResetRequestedAt: null },
  }]);
  assert.deepEqual(database.revokedSessions[0], {
    where: { userId: 42, revokedAt: null },
    data: { revokedAt: now, revokedReason: 'PASSWORD_RESET' },
  });
  assert.equal(database.auditEvents[0].action, 'PASSWORD_RESET');
  assert.equal(database.auditEvents[0].ipAddress, '203.0.113.1');
  await assert.rejects(
    resetPassword(token, 'another-hash', { now, database }),
    { code: 'PASSWORD_RESET_INVALID' },
  );
});

test('expired password reset links are rejected without changing the password', async () => {
  const token = 'expired-reset-token';
  const database = resetDatabase(42, {
    id: 'reset-expired',
    userId: 42,
    tokenHash: hashPasswordResetToken(token),
    expiresAt: new Date('2026-01-01T00:00:00Z'),
  });

  await assert.rejects(
    resetPassword(token, 'new-password-hash', {
      now: new Date('2026-01-01T00:00:01Z'),
      database,
    }),
    (error) => error instanceof AppError && error.code === 'PASSWORD_RESET_INVALID',
  );
  assert.deepEqual(database.updatedUsers, []);
  assert.deepEqual(database.revokedSessions, []);
});
