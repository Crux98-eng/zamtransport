const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const AppError = require('../errors/app-error');

function settings() {
  const { ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET, ACCESS_TOKEN_EXPIRES_IN = '15m', REFRESH_TOKEN_EXPIRES_IN = '7d' } = process.env;
  if (!ACCESS_TOKEN_SECRET || !REFRESH_TOKEN_SECRET) {
    throw new AppError(500, 'Authentication is not configured.', 'AUTH_NOT_CONFIGURED');
  }
  return { ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET, ACCESS_TOKEN_EXPIRES_IN, REFRESH_TOKEN_EXPIRES_IN };
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function signAccessToken(user) {
  const config = settings();
  return jwt.sign({ sub: String(user.id) }, config.ACCESS_TOKEN_SECRET, { expiresIn: config.ACCESS_TOKEN_EXPIRES_IN });
}

function createRefreshToken(user) {
  const config = settings();
  const id = crypto.randomUUID();
  const token = jwt.sign({ sub: String(user.id), jti: id }, config.REFRESH_TOKEN_SECRET, { expiresIn: config.REFRESH_TOKEN_EXPIRES_IN });
  const decoded = jwt.decode(token);
  return { id, token, tokenHash: hashToken(token), expiresAt: new Date(decoded.exp * 1000) };
}

function verifyAccessToken(token) {
  return jwt.verify(token, settings().ACCESS_TOKEN_SECRET);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, settings().REFRESH_TOKEN_SECRET);
}

module.exports = { createRefreshToken, hashToken, signAccessToken, verifyAccessToken, verifyRefreshToken };
