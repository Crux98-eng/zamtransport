const { Server } = require('socket.io');
const prisma = require('../lib/prisma');
const { verifyAccessToken } = require('../utils/tokens');

let io;

function publicTripWhere(tripId) {
  return { id: tripId, status: { in: ['SCHEDULED', 'BOARDING', 'IN_PROGRESS', 'DELAYED'] }, route: { is: { status: 'ACTIVE' } } };
}

function attachSocketServer(httpServer) {
  if (io) return io;
  io = new Server(httpServer, { cors: { origin: (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map((value) => value.trim()).filter(Boolean), credentials: false } });
  io.use(async (socket, next) => {
    try {
      const header = socket.handshake.auth?.token || socket.handshake.headers.authorization;
      const token = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : header;
      if (!token) throw new Error('Authentication is required.');
      const payload = verifyAccessToken(token);
      const user = await prisma.user.findUnique({ where: { id: Number(payload.sub) } });
      if (!user || user.status !== 'ACTIVE') throw new Error('Active account required.');
      socket.user = user;
      next();
    } catch (_error) { next(new Error('Unauthorized socket connection.')); }
  });
  io.on('connection', (socket) => {
    socket.join(`notifications:user:${socket.user.id}`);
    if (socket.user.role === 'ADMIN') socket.join('tracking:admin');
    socket.on('tracking:subscribe:trip', async ({ tripId } = {}, done = () => {}) => {
      const id = Number.parseInt(tripId, 10);
      if (!Number.isInteger(id) || id < 1) return done({ ok: false, message: 'Invalid trip ID.' });
      const trip = await prisma.trip.findUnique({ where: { id }, select: { id: true, routeId: true, driverId: true, status: true, route: { select: { status: true } } } });
      const permitted = trip && (socket.user.role === 'ADMIN' || (socket.user.role === 'DRIVER' && trip.driverId === socket.user.id) || (socket.user.role === 'COMMUTER' && publicTripWhere(id).status.in.includes(trip.status) && trip.route.status === 'ACTIVE'));
      if (!permitted) return done({ ok: false, message: 'Not permitted to track this trip.' });
      socket.join(`tracking:trip:${id}`); socket.join(`tracking:route:${trip.routeId}`); done({ ok: true });
    });
    socket.on('tracking:subscribe:route', async ({ routeId } = {}, done = () => {}) => {
      const id = Number.parseInt(routeId, 10);
      if (!Number.isInteger(id) || id < 1) return done({ ok: false, message: 'Invalid route ID.' });
      const route = await prisma.route.findUnique({ where: { id }, select: { status: true } });
      if (!route || (socket.user.role !== 'ADMIN' && route.status !== 'ACTIVE')) return done({ ok: false, message: 'Not permitted to track this route.' });
      if (socket.user.role === 'DRIVER') {
        const assigned = await prisma.trip.findFirst({ where: { routeId: id, driverId: socket.user.id, status: 'IN_PROGRESS' } });
        if (!assigned) return done({ ok: false, message: 'Not permitted to track this route.' });
      }
      socket.join(`tracking:route:${id}`); done({ ok: true });
    });
  });
  return io;
}

function emitLocation(payload) {
  if (!io) return;
  io.to('tracking:admin').emit('vehicle:location:update', payload);
  io.to(`tracking:trip:${payload.tripId}`).emit('vehicle:location:update', payload);
  io.to(`tracking:route:${payload.routeId}`).emit('vehicle:location:update', payload);
}

// Dashboard rooms are restricted to authenticated administrators. Payloads are
// deliberately small so clients can refresh only the affected widget.
function emitDashboard(event, payload = {}) {
  if (!io) return;
  io.to('tracking:admin').emit(event, { ...payload, occurredAt: new Date().toISOString() });
}

function emitNotification(notification) {
  if (!io || !notification) return;
  const payload = { id: notification.id, title: notification.title, message: notification.message, type: notification.type, isRead: notification.isRead, createdAt: notification.createdAt };
  io.to(`notifications:user:${notification.userId}`).emit('notification:new', payload);
  io.to(`notifications:user:${notification.userId}`).emit('notification:unread-count', { delta: 1 });
}

function emitNotificationRead(userId, notificationId, unreadCount) {
  if (!io) return;
  io.to(`notifications:user:${userId}`).emit('notification:read', { notificationId });
  io.to(`notifications:user:${userId}`).emit('notification:unread-count', { count: unreadCount });
}

function getIO() { return io; }

module.exports = { attachSocketServer, emitLocation, emitDashboard, emitNotification, emitNotificationRead, getIO };
