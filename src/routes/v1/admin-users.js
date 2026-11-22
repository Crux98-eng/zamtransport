const express = require('express');
const prisma = require('../../lib/prisma');
const AppError = require('../../errors/app-error');
const { authenticate, authorize } = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const asyncHandler = require('../../utils/async-handler');
const { audit } = require('../../utils/audit');
const { publicUser } = require('../../utils/users');
const notifications = require('../../services/notifications');
const email = require('../../services/email');
const { profileSchema, rejectSchema, roleSchema, statusSchema } = require('../../validators/auth');

const router = express.Router();
router.use(authenticate, authorize('ADMIN'));

const id = (value) => { const parsed = Number.parseInt(value, 10); if (!Number.isInteger(parsed) || parsed < 1) throw new AppError(400, 'Invalid user ID.', 'VALIDATION_ERROR'); return parsed; };

const ip = (request) => request.ip;

const query = (request) => ({
  page: Math.max(1, Number.parseInt(request.query.page, 10) || 1),
  limit: Math.min(100, Math.max(1, Number.parseInt(request.query.limit, 10) || 20)),
  search: typeof request.query.search === 'string' ? request.query.search.trim() : '',
  dateFrom: request.query.dateFrom ? new Date(request.query.dateFrom) : null,
  dateTo: request.query.dateTo ? new Date(request.query.dateTo) : null,
});

const userWhere = (search, status, dateFrom, dateTo) => ({ ...(status ? { status } : {}), ...(search ? { OR: [{ fullName: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }] } : {}), ...((dateFrom || dateTo) ? { createdAt: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } } : {}) });
async function targetOr404(db, userId) { const user = await db.user.findUnique({ where: { id: userId } }); if (!user) throw new AppError(404, 'User not found.', 'USER_NOT_FOUND'); return user; }
async function activeAdminCount(db) { return db.user.count({ where: { role: 'ADMIN', status: 'ACTIVE' } }); }

router.get('/pending', asyncHandler(async (request, response) => {
  const { page, limit, search, dateFrom, dateTo } = query(request); const where = { ...userWhere(search, 'PENDING', dateFrom, dateTo), emailVerifiedAt: { not: null } };
  const [users, total] = await Promise.all([prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }), prisma.user.count({ where })]);
  response.json({ success: true, data: { users: users.map(publicUser), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } } });
}));

router.patch('/:userId/approve', asyncHandler(async (request, response) => {
  const userId = id(request.params.userId); const user = await prisma.$transaction(async (db) => {
    const target = await targetOr404(db, userId); if (target.status !== 'PENDING') throw new AppError(409, 'Only pending accounts can be approved.', 'INVALID_STATUS_TRANSITION');
    if (!target.emailVerifiedAt) throw new AppError(409, 'The applicant must verify their email before approval.', 'EMAIL_VERIFICATION_REQUIRED');
    const updated = await db.user.update({ where: { id: userId }, data: { status: 'ACTIVE', approvedAt: new Date(), approvedById: request.user.id } });
    await audit(db, { actorId: request.user.id, targetUserId: userId, action: 'ACCOUNT_APPROVED', ipAddress: ip(request) }); return updated;
  });
  const delivery = user.role === 'DRIVER' ? await email.sendDriverApprovalEmail(user) : null;
  await notifications.create({ userId, title: 'Account approved', message: 'Your account has been approved and is now active.', type: 'USER_APPROVAL', dedupeKey: `user:${userId}:approved`, email: false });
  response.json({
    success: true,
    message: delivery && !delivery.accepted ? 'Account approved, but the email provider did not accept the approval email.' : 'Account approved.',
    data: { user: publicUser(user), emailAccepted: delivery?.accepted ?? null },
  });
}));


router.patch('/:userId/reject', validate(rejectSchema), asyncHandler(async (request, response) => {
  const userId = id(request.params.userId); const user = await prisma.$transaction(async (db) => {
    const target = await targetOr404(db, userId); if (target.status !== 'PENDING') throw new AppError(409, 'Only pending accounts can be rejected.', 'INVALID_STATUS_TRANSITION');
    if (!target.emailVerifiedAt) throw new AppError(409, 'The applicant must verify their email before rejection.', 'EMAIL_VERIFICATION_REQUIRED');
    const updated = await db.user.update({ where: { id: userId }, data: { status: 'REJECTED', rejectedAt: new Date(), rejectedById: request.user.id, rejectionReason: request.body.reason || null } });
    await audit(db, { actorId: request.user.id, targetUserId: userId, action: 'ACCOUNT_REJECTED', metadata: request.body.reason ? { reason: request.body.reason } : undefined, ipAddress: ip(request) }); return updated;
  });
  const delivery = user.role === 'DRIVER' ? await email.sendDriverRejectionEmail(user, user.rejectionReason) : null;
  await notifications.create({ userId, title: 'Account rejected', message: 'Your account registration was not approved.', type: 'USER_REJECTION', dedupeKey: `user:${userId}:rejected`, email: false });
  response.json({
    success: true,
    message: delivery && !delivery.accepted ? 'Account rejected, but the email provider did not accept the rejection email.' : 'Account rejected.',
    data: { user: publicUser(user), emailAccepted: delivery?.accepted ?? null },
  });
}));

async function changeStatus(request, userId, status) { return prisma.$transaction(async (db) => {
  const target = await targetOr404(db, userId); if (target.id === request.user.id) throw new AppError(409, 'You cannot change your own account status.', 'SELF_STATUS_CHANGE_BLOCKED');
  if (status === 'SUSPENDED' || status === 'INACTIVE') {
    if (target.status !== 'ACTIVE') throw new AppError(409, 'Only active accounts can be suspended.', 'INVALID_STATUS_TRANSITION');
    if (target.role === 'ADMIN' && await activeAdminCount(db) <= 1) throw new AppError(409, 'The last active administrator cannot be deactivated.', 'LAST_ADMIN_PROTECTED');
    const updated = await db.user.update({ where: { id: userId }, data: { status, ...(status === 'SUSPENDED' ? { suspendedAt: new Date(), suspendedById: request.user.id } : {}) } });
    await db.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date(), revokedReason: 'ACCOUNT_STATUS_CHANGED' } });
    await audit(db, { actorId: request.user.id, targetUserId: userId, action: status === 'SUSPENDED' ? 'ACCOUNT_SUSPENDED' : 'ACCOUNT_DEACTIVATED', ipAddress: ip(request) }); return updated;
  }
  if (!['SUSPENDED', 'INACTIVE'].includes(target.status)) throw new AppError(409, 'Only suspended or inactive accounts can be reactivated.', 'INVALID_STATUS_TRANSITION');
  const updated = await db.user.update({ where: { id: userId }, data: { status: 'ACTIVE' } });
  await audit(db, { actorId: request.user.id, targetUserId: userId, action: 'ACCOUNT_REACTIVATED', ipAddress: ip(request) }); return updated;
}); }

router.patch('/:userId/suspend', asyncHandler(async (request, response) => { const user = await changeStatus(request, id(request.params.userId), 'SUSPENDED'); await notifications.create({ userId: user.id, title: 'Account suspended', message: 'Your account has been suspended. Contact an administrator for assistance.', type: 'SYSTEM_ALERT', dedupeKey: `user:${user.id}:suspended:${user.suspendedAt?.toISOString()}` }); response.json({ success: true, message: 'Account suspended.', data: { user: publicUser(user) } }); }));
router.patch('/:userId/reactivate', asyncHandler(async (request, response) => { const user = await changeStatus(request, id(request.params.userId), 'ACTIVE'); await notifications.create({ userId: user.id, title: 'Account reactivated', message: 'Your account has been reactivated.', type: 'GENERAL', dedupeKey: `user:${user.id}:reactivated:${user.updatedAt?.toISOString()}` }); response.json({ success: true, message: 'Account reactivated.', data: { user: publicUser(user) } }); }));

router.get('/', asyncHandler(async (request, response) => { const { page, limit, search } = query(request); const where = userWhere(search, request.query.status); const [users, total] = await Promise.all([prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }), prisma.user.count({ where })]); response.json({ success: true, data: { users: users.map(publicUser), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } } }); }));

router.get('/:userId', asyncHandler(async (request, response) => { const user = await targetOr404(prisma, id(request.params.userId)); response.json({ success: true, data: { user: publicUser(user) } }); }));

router.patch('/:userId', validate(profileSchema), asyncHandler(async (request, response) => { const userId = id(request.params.userId); await targetOr404(prisma, userId); const user = await prisma.user.update({ where: { id: userId }, data: request.body }); await audit(prisma, { actorId: request.user.id, targetUserId: userId, action: 'USER_PROFILE_UPDATED', ipAddress: ip(request) }); response.json({ success: true, data: { user: publicUser(user) } }); }));

router.patch('/:userId/role', validate(roleSchema), asyncHandler(async (request, response) => { const userId = id(request.params.userId); const user = await prisma.$transaction(async (db) => { const target = await targetOr404(db, userId); if (target.id === request.user.id) throw new AppError(409, 'You cannot change your own role.', 'SELF_ROLE_CHANGE_BLOCKED'); if (target.role === 'ADMIN' && request.body.role !== 'ADMIN' && target.status === 'ACTIVE' && await activeAdminCount(db) <= 1) throw new AppError(409, 'The last active administrator cannot be demoted.', 'LAST_ADMIN_PROTECTED'); const updated = await db.user.update({ where: { id: userId }, data: { role: request.body.role } }); await audit(db, { actorId: request.user.id, targetUserId: userId, action: 'ROLE_CHANGED', metadata: { from: target.role, to: request.body.role }, ipAddress: ip(request) }); return updated; }); response.json({ success: true, data: { user: publicUser(user) } }); }));
router.patch('/:userId/status', validate(statusSchema), asyncHandler(async (request, response) => { const user = await changeStatus(request, id(request.params.userId), request.body.status); response.json({ success: true, data: { user: publicUser(user) } }); }));

module.exports = router;
