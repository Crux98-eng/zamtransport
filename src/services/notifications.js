const prisma = require('../lib/prisma');
const { emitNotification } = require('./socket');
const { sendNotificationEmail } = require('./email');
const logger = require('../utils/logger');

const TYPES = ['USER_APPROVAL', 'USER_REJECTION', 'TRIP_ASSIGNMENT', 'TRIP_BOARDING', 'TRIP_DEPARTURE', 'TRIP_DELAY', 'TRIP_CANCELLATION', 'TRIP_COMPLETION', 'VEHICLE_MAINTENANCE', 'SYSTEM_ALERT', 'GENERAL'];
async function preference(db, userId) { return db.notificationPreference.upsert({ where: { userId }, update: {}, create: { userId } }); }
async function create({ userId, title, message, type = 'GENERAL', dedupeKey, db = prisma }) {
  if (!userId || !TYPES.includes(type)) return null;
  const prefs = await preference(db, userId); const muted = Array.isArray(prefs.mutedTypes) ? prefs.mutedTypes : [];
  if (!prefs.inAppEnabled || muted.includes(type)) return null;
  try {
    const notification = await db.notification.create({ data: { userId, title, message, type, dedupeKey: dedupeKey || null }, include: { user: { select: { id: true, email: true } } } });
    // Defer socket/email until after an enclosing Prisma transaction has returned.
    queueMicrotask(() => { emitNotification(notification); if (prefs.emailEnabled) sendNotificationEmail(notification.user, notification).catch((error) => logger.error('notification email task failed', { error: error.message })); });
    return notification;
  } catch (error) { if (error.code === 'P2002' && dedupeKey) return null; logger.error('notification creation failed', { userId, type, error: error.message }); return null; }
}
module.exports = { TYPES, create, preference };
