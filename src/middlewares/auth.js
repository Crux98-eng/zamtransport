// Authentication and role checks used by protected Express routes.
const prisma = require('../lib/prisma');
const AppError = require('../errors/app-error');
const { verifyAccessToken } = require('../utils/tokens');

async function authenticate(request, _response, next) {
  try {
    // The access token is sent in the Authorization header as "Bearer <token>".
    const value = request.get('authorization');
    if (!value || !value.startsWith('Bearer ')) throw new AppError(401, 'A bearer access token is required.', 'UNAUTHENTICATED');
    const payload = verifyAccessToken(value.slice(7));
    const user = await prisma.user.findUnique({ where: { id: Number(payload.sub) } });
    if (!user) throw new AppError(401, 'Authentication failed.', 'UNAUTHENTICATED');
    if (user.status !== 'ACTIVE') throw new AppError(403, accountMessage(user.status), `ACCOUNT_${user.status}`);
    request.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') return next(new AppError(401, 'Access token has expired.', 'TOKEN_EXPIRED'));
    if (error.name === 'JsonWebTokenError') return next(new AppError(401, 'Invalid access token.', 'INVALID_TOKEN'));
    next(error);
  }
}

function authorize(...roles) {
  return (request, _response, next) => request.user && roles.includes(request.user.role)
    ? next()
    : next(new AppError(403, 'You do not have permission to perform this action.', 'FORBIDDEN'));
}

function accountMessage(status) {
  return ({ PENDING: 'Your account is awaiting administrator approval.', REJECTED: 'Your account registration was rejected.', SUSPENDED: 'Your account is suspended.' })[status] || 'Your account is not active.';
}

module.exports = { accountMessage, authenticate, authorize };
