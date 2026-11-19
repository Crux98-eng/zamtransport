const express = require('express');
const prisma = require('../../lib/prisma');
const AppError = require('../../errors/app-error');
const { authenticate, authorize } = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const asyncHandler = require('../../utils/async-handler');
const { audit } = require('../../utils/audit');
const schemas = require('../../validators/schedule-trip');
const simulation = require('../../services/simulation');
const { emitDashboard } = require('../../services/socket');
const notifications = require('../../services/notifications');

const adminRouter = express.Router();
const driverRouter = express.Router();
const commuterRouter = express.Router();
const publicRouter = express.Router();

adminRouter.use(authenticate, authorize('ADMIN'));
driverRouter.use(authenticate, authorize('DRIVER'));
commuterRouter.use(authenticate, authorize('COMMUTER'));

const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const activeTripStatuses = ['SCHEDULED', 'BOARDING', 'IN_PROGRESS', 'DELAYED'];
const publicTripStatuses = ['SCHEDULED', 'BOARDING', 'DELAYED'];
const transitions = {
  SCHEDULED: ['BOARDING', 'CANCELLED', 'DELAYED'],
  BOARDING: ['IN_PROGRESS', 'CANCELLED', 'DELAYED'],
  IN_PROGRESS: ['COMPLETED'],
  DELAYED: ['BOARDING', 'IN_PROGRESS'],
  COMPLETED: [],
  CANCELLED: [],
};

const tripInclude = {
  route: { include: { routeStops: { include: { stop: true }, orderBy: { sequence: 'asc' } } } },
  schedule: { include: { days: { orderBy: { dayOfWeek: 'asc' } } } },
  vehicle: true,
  driver: { select: { id: true, fullName: true, email: true, phoneNumber: true } },
  cancelledBy: { select: { id: true, fullName: true } },
  tripAssignments: { include: { vehicle: true, driver: { select: { id: true, fullName: true, email: true } } }, orderBy: { assignedAt: 'desc' } },
  statusHistory: { include: { changedBy: { select: { id: true, fullName: true } } }, orderBy: { createdAt: 'asc' } },
};

function parsedId(value) {
  const result = Number.parseInt(value, 10);
  if (!Number.isInteger(result) || result < 1) throw new AppError(400, 'Invalid ID.', 'VALIDATION_ERROR');
  return result;
}

function pagination(query) {
  return {
    page: Math.max(1, Number.parseInt(query.page, 10) || 1),
    limit: Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 20)),
  };
}

function queryDate(value, name) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new AppError(400, `${name} must be a valid date.`, 'VALIDATION_ERROR');
  return parsed;
}

function pageResponse(items, total, value) {
  return { items, pagination: { page: value.page, limit: value.limit, total, totalPages: Math.ceil(total / value.limit) } };
}

function localDateOnly(value) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function toLusakaInstant(date, time) {
  const source = localDateOnly(date);
  const hour = time.getUTCHours();
  const minute = time.getUTCMinutes();
  const second = time.getUTCSeconds();
  // Africa/Lusaka is UTC+02:00 and has no daylight-saving time.
  return new Date(Date.UTC(source.getUTCFullYear(), source.getUTCMonth(), source.getUTCDate(), hour - 2, minute, second));
}

function dateKey(value) {
  return value.toISOString().slice(0, 10);
}

function lusakaToday() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lusaka', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const get = (type) => Number(parts.find((part) => part.type === type).value);
  return new Date(Date.UTC(get('year'), get('month') - 1, get('day')));
}

function publicSchedule(schedule) {
  return { ...schedule, route: schedule.route && { id: schedule.route.id, name: schedule.route.name, routeCode: schedule.route.routeCode, origin: schedule.route.origin, destination: schedule.route.destination } };
}

function publicTrip(trip) {
  const { driver, cancelledBy, tripAssignments, statusHistory, ...safe } = trip;
  return {
    ...safe,
    route: trip.route && { ...trip.route, routeStops: trip.route.routeStops },
    vehicle: trip.vehicle && { id: trip.vehicle.id, registrationNumber: trip.vehicle.registrationNumber, vehicleName: trip.vehicle.vehicleName, vehicleType: trip.vehicle.vehicleType, capacity: trip.vehicle.capacity },
  };
}

function tripWhere(query, { publicOnly = false, driverId } = {}) {
  const where = {};
  if (query.routeId) where.routeId = parsedId(query.routeId);
  if (query.scheduleId) where.scheduleId = parsedId(query.scheduleId);
  if (query.driverId && !driverId) where.driverId = parsedId(query.driverId);
  if (query.vehicleId) where.vehicleId = parsedId(query.vehicleId);
  if (query.tripStatus) {
    if (!schemas.tripStatuses.includes(query.tripStatus)) throw new AppError(400, 'Invalid trip status.', 'VALIDATION_ERROR');
    where.status = query.tripStatus;
  }
  if (query.tripCode) where.tripCode = { contains: query.tripCode.trim(), mode: 'insensitive' };
  if (query.from || query.to) where.scheduledDeparture = { ...(query.from ? { gte: queryDate(query.from, 'from') } : {}), ...(query.to ? { lte: queryDate(`${query.to}T23:59:59.999Z`, 'to') } : {}) };
  if (driverId) where.driverId = driverId;
  if (publicOnly) {
    where.status = { in: publicTripStatuses };
    where.scheduledDeparture = { ...(where.scheduledDeparture || {}), gte: new Date() };
    where.route = { is: { status: 'ACTIVE' } };
  }
  return where;
}

async function requireRoute(db, routeId, active = false) {
  const route = await db.route.findUnique({ where: { id: routeId } });
  if (!route || (active && route.status !== 'ACTIVE')) throw new AppError(404, active ? 'Active route not found.' : 'Route not found.', 'NOT_FOUND');
  return route;
}

async function requireSchedule(db, scheduleId) {
  const schedule = await db.schedule.findUnique({ where: { id: scheduleId }, include: { days: true, route: true } });
  if (!schedule) throw new AppError(404, 'Schedule not found.', 'NOT_FOUND');
  return schedule;
}

async function requireTrip(db, tripId, include = tripInclude) {
  const trip = await db.trip.findUnique({ where: { id: tripId }, include });
  if (!trip) throw new AppError(404, 'Trip not found.', 'NOT_FOUND');
  return trip;
}

async function notify(db, userId, title, message, type, dedupeKey) {
  if (userId) await notifications.create({ db, userId, title, message, type, dedupeKey });
}

function operationalWindow(trip) {
  return {
    start: trip.actualDeparture || trip.revisedDeparture || trip.scheduledDeparture,
    end: trip.actualArrival || trip.revisedArrival || trip.scheduledArrival,
  };
}

async function validateAssignment(db, trip, driverId, vehicleId) {
  if (['COMPLETED', 'CANCELLED'].includes(trip.status)) throw new AppError(409, 'Completed or cancelled trips cannot be assigned.', 'TRIP_NOT_ASSIGNABLE');
  const [driver, vehicle] = await Promise.all([
    db.user.findFirst({ where: { id: driverId, role: 'DRIVER', status: 'ACTIVE' } }),
    db.vehicle.findUnique({ where: { id: vehicleId } }),
  ]);
  if (!driver) throw new AppError(409, 'Driver must be an active DRIVER account.', 'DRIVER_UNAVAILABLE');
  if (!vehicle || vehicle.status !== 'ACTIVE') throw new AppError(409, 'Vehicle must be active.', 'VEHICLE_UNAVAILABLE');
  const maintenance = await db.maintenanceRecord.findFirst({ where: { vehicleId, status: { in: ['PENDING', 'IN_PROGRESS'] } } });
  if (maintenance) throw new AppError(409, 'Vehicle is under maintenance.', 'VEHICLE_UNDER_MAINTENANCE');

  const linkedAssignments = await db.vehicleAssignment.findMany({ where: { endedAt: null, OR: [{ driverId }, { vehicleId }] } });
  if (linkedAssignments.length && !linkedAssignments.some((item) => item.driverId === driverId && item.vehicleId === vehicleId)) {
    throw new AppError(409, 'Driver and vehicle do not have a compatible active assignment.', 'VEHICLE_DRIVER_ASSIGNMENT_MISMATCH');
  }

  const window = operationalWindow(trip);
  const candidates = await db.trip.findMany({
    where: { id: { not: trip.id }, status: { in: activeTripStatuses }, OR: [{ driverId }, { vehicleId }], scheduledDeparture: { lt: window.end } },
  });
  const conflict = candidates.find((candidate) => {
    const other = operationalWindow(candidate);
    return other.start < window.end && other.end > window.start;
  });
  if (conflict) throw new AppError(409, 'Driver or vehicle has an overlapping trip.', 'TRIP_ASSIGNMENT_CONFLICT');
}

async function assignTrip(db, trip, driverId, vehicleId, actorId) {
  const active = await db.tripAssignment.findFirst({ where: { tripId: trip.id, endedAt: null }, orderBy: { assignedAt: 'desc' } });
  if (active && active.driverId === driverId && active.vehicleId === vehicleId && trip.driverId === driverId && trip.vehicleId === vehicleId) return { changed: false };
  await validateAssignment(db, trip, driverId, vehicleId);
  const now = new Date();
  if (active) await db.tripAssignment.update({ where: { id: active.id }, data: { endedAt: now } });
  await db.trip.update({ where: { id: trip.id }, data: { driverId, vehicleId } });
  await db.tripAssignment.create({ data: { tripId: trip.id, driverId, vehicleId, assignedAt: now } });
  await notify(db, driverId, 'Trip assignment', `You have been assigned to trip ${trip.tripCode || trip.id}.`, 'TRIP_ASSIGNMENT', `trip:${trip.id}:assignment:${driverId}`);
  await audit(db, { actorId, targetUserId: driverId, action: 'TRIP_ASSIGNED', metadata: { tripId: trip.id, vehicleId } });
  return { changed: true };
}

async function createTrip(db, data, actorId) {
  const trip = await db.trip.create({ data });
  const tripCode = trip.tripCode || `TRP-${String(trip.id).padStart(6, '0')}`;
  const result = trip.tripCode ? trip : await db.trip.update({ where: { id: trip.id }, data: { tripCode } });
  await db.tripStatusHistory.create({ data: { tripId: result.id, toStatus: 'SCHEDULED', changedById: actorId || null, reason: 'Trip created' } });
  return result;
}

async function changeStatus(db, trip, status, actorId, options = {}) {
  if (!transitions[trip.status].includes(status)) throw new AppError(409, `Cannot change a ${trip.status} trip to ${status}.`, 'INVALID_STATUS_TRANSITION');
  if (['BOARDING', 'IN_PROGRESS'].includes(status) && (!trip.driverId || !trip.vehicleId)) throw new AppError(409, 'A driver and vehicle must be assigned before boarding or starting a trip.', 'TRIP_ASSIGNMENT_REQUIRED');
  if (status === 'CANCELLED' && !options.reason) throw new AppError(400, 'A cancellation reason is required.', 'CANCELLATION_REASON_REQUIRED');
  const now = new Date();
  const data = { status };
  if (status === 'IN_PROGRESS') data.actualDeparture = now;
  if (status === 'COMPLETED') data.actualArrival = now;
  if (status === 'DELAYED') {
    if (options.reason !== undefined) data.delayReason = options.reason || null;
    if (options.revisedDeparture) data.revisedDeparture = options.revisedDeparture;
    if (options.revisedArrival) data.revisedArrival = options.revisedArrival;
    const delayedDeparture = data.revisedDeparture || trip.actualDeparture || trip.revisedDeparture || trip.scheduledDeparture;
    const delayedArrival = data.revisedArrival || trip.revisedArrival || trip.scheduledArrival;
    if (delayedArrival <= delayedDeparture) throw new AppError(400, 'Revised arrival must be after revised departure.', 'VALIDATION_ERROR');
  }
  if (status === 'CANCELLED') Object.assign(data, { cancellationReason: options.reason, cancelledAt: now, cancelledById: actorId });
  const updated = await db.trip.update({ where: { id: trip.id }, data });
  await db.tripStatusHistory.create({ data: { tripId: trip.id, fromStatus: trip.status, toStatus: status, changedById: actorId, reason: options.reason || null } });
  const messages = { BOARDING: 'is boarding', IN_PROGRESS: 'has departed', COMPLETED: 'has completed', DELAYED: 'has been delayed', CANCELLED: 'has been cancelled' };
  const notificationType = { BOARDING: 'TRIP_BOARDING', IN_PROGRESS: 'TRIP_DEPARTURE', COMPLETED: 'TRIP_COMPLETION', DELAYED: 'TRIP_DELAY', CANCELLED: 'TRIP_CANCELLATION' }[status];
  if (trip.driverId) await notify(db, trip.driverId, 'Trip update', `Trip ${trip.tripCode || trip.id} ${messages[status]}.`, notificationType, `trip:${trip.id}:${status}`);
  await audit(db, { actorId, action: 'TRIP_STATUS_CHANGED', metadata: { tripId: trip.id, fromStatus: trip.status, toStatus: status, reason: options.reason } });
  return updated;
}

async function reconcileSimulation(tripId, status) {
  try {
    if (status === 'IN_PROGRESS') await simulation.start(tripId);
    if (status === 'COMPLETED') await simulation.complete(tripId);
    if (status === 'CANCELLED') await simulation.stop(tripId, 'TRIP_CANCELLED');
  } catch (error) {
    // The lifecycle change is already committed. Keep it valid and make a failed
    // simulation visible to operators instead of rolling a trip back.
    console.error(`Could not reconcile tracking simulation for trip ${tripId}:`, error.message);
  }
}

function datesBetween(start, end) {
  const result = [];
  for (let date = localDateOnly(start); date <= end; date = new Date(date.getTime() + 86400000)) result.push(new Date(date));
  return result;
}

// Schedule management
adminRouter.post('/schedules', validate(schemas.scheduleCreateSchema), asyncHandler(async (request, response) => {
  const { days, routeId, departureTime, ...data } = request.body;
  const schedule = await prisma.$transaction(async (db) => {
    await requireRoute(db, routeId, true);
    const created = await db.schedule.create({ data: { ...data, routeId, departureTime: new Date(`1970-01-01T${departureTime}Z`), days: { create: [...new Set(days)].map((dayOfWeek) => ({ dayOfWeek })) }, }, include: { route: true, days: true } });
    await audit(db, { actorId: request.user.id, action: 'SCHEDULE_CREATED', metadata: { scheduleId: created.id, routeId } });
    return created;
  });
  response.status(201).json({ success: true, data: { schedule: publicSchedule(schedule) } });
}));

adminRouter.get('/schedules', asyncHandler(async (request, response) => {
  const value = pagination(request.query); const where = {};
  if (request.query.routeId) where.routeId = parsedId(request.query.routeId);
  if (request.query.status) {
    if (!['ACTIVE', 'INACTIVE'].includes(request.query.status)) throw new AppError(400, 'Invalid schedule status.', 'VALIDATION_ERROR');
    where.status = request.query.status;
  }
  if (request.query.search) where.OR = [{ description: { contains: request.query.search.trim(), mode: 'insensitive' } }, { route: { is: { name: { contains: request.query.search.trim(), mode: 'insensitive' } } } }];
  const [schedules, total] = await Promise.all([prisma.schedule.findMany({ where, include: { route: true, days: true, _count: { select: { trips: true } } }, orderBy: { createdAt: 'desc' }, skip: (value.page - 1) * value.limit, take: value.limit }), prisma.schedule.count({ where })]);
  response.json({ success: true, data: { schedules, pagination: pageResponse([], total, value).pagination } });
}));

adminRouter.get('/schedules/:id', asyncHandler(async (request, response) => {
  const schedule = await prisma.schedule.findUnique({ where: { id: parsedId(request.params.id) }, include: { route: true, days: true, trips: { orderBy: { scheduledDeparture: 'desc' }, take: 25 } } });
  if (!schedule) throw new AppError(404, 'Schedule not found.', 'NOT_FOUND');
  response.json({ success: true, data: { schedule } });
}));

adminRouter.patch('/schedules/:id', validate(schemas.schedulePatchSchema), asyncHandler(async (request, response) => {
  const scheduleId = parsedId(request.params.id);
  const schedule = await prisma.$(async (db) => {
    const current = await requireSchedule(db, scheduleId);
    const input = request.body;
    const effectiveFrom = input.effectiveFrom || current.effectiveFrom;
    const effectiveUntil = input.effectiveUntil === undefined ? current.effectiveUntil : input.effectiveUntil;
    if (effectiveUntil && effectiveUntil < effectiveFrom) throw new AppError(400, 'Effective end date must be on or after the start date.', 'VALIDATION_ERROR');
    if (input.routeId) await requireRoute(db, input.routeId, true);
    const { days, departureTime, ...fields } = input;
    const updated = await db.schedule.update({ where: { id: scheduleId }, data: { ...fields, ...(departureTime ? { departureTime: new Date(`1970-01-01T${departureTime}Z`) } : {}), ...(days ? { days: { deleteMany: {}, create: [...new Set(days)].map((dayOfWeek) => ({ dayOfWeek })) } } : {}) }, include: { route: true, days: true } });
    await audit(db, { actorId: request.user.id, action: 'SCHEDULE_UPDATED', metadata: { scheduleId } });
    return updated;
  });
  response.json({ success: true, data: { schedule: publicSchedule(schedule) } });
}));

adminRouter.patch('/schedules/:id/status', validate(schemas.scheduleStatusSchema), asyncHandler(async (request, response) => {
  const scheduleId = parsedId(request.params.id); await requireSchedule(prisma, scheduleId);
  const schedule = await prisma.schedule.update({ where: { id: scheduleId }, data: { status: request.body.status }, include: { route: true, days: true } });
  await audit(prisma, { actorId: request.user.id, action: 'SCHEDULE_STATUS_CHANGED', metadata: { scheduleId, status: schedule.status } });
  response.json({ success: true, data: { schedule: publicSchedule(schedule) } });
}));

adminRouter.delete('/schedules/:id', asyncHandler(async (request, response) => {
  const scheduleId = parsedId(request.params.id); await requireSchedule(prisma, scheduleId);
  if (await prisma.trip.count({ where: { scheduleId } })) throw new AppError(409, 'Schedule has historical trips; set it inactive instead.', 'HISTORICAL_RECORDS_EXIST');
  await prisma.$transaction(async (db) => {
    await db.scheduleDay.deleteMany({ where: { scheduleId } });
    await db.schedule.delete({ where: { id: scheduleId } });
    await audit(db, { actorId: request.user.id, action: 'SCHEDULE_DELETED', metadata: { scheduleId } });
  });
  response.json({ success: true, message: 'Schedule deleted.' });
}));

// Automatic, idempotent trip generation.
adminRouter.post('/trips/generate', validate(schemas.generateTripsSchema), asyncHandler(async (request, response) => {
  const { scheduleId, startDate, endDate } = request.body;
  let generated = 0; let skippedDuplicates = 0; let schedulesProcessed = 0;
  await prisma.$transaction(async (db) => {
    const schedules = await db.schedule.findMany({ where: { status: 'ACTIVE', ...(scheduleId ? { id: scheduleId } : {}) }, include: { days: true } });
    if (scheduleId && !schedules.length) {
      const exists = await db.schedule.findUnique({ where: { id: scheduleId } });
      if (!exists) throw new AppError(404, 'Schedule not found.', 'NOT_FOUND');
      throw new AppError(409, 'Trips can only be generated for active schedules.', 'SCHEDULE_INACTIVE');
    }
    for (const schedule of schedules) {
      schedulesProcessed += 1;
      const lower = new Date(Math.max(localDateOnly(startDate).getTime(), localDateOnly(schedule.effectiveFrom).getTime()));
      const upper = new Date(Math.min(localDateOnly(endDate).getTime(), schedule.effectiveUntil ? localDateOnly(schedule.effectiveUntil).getTime() : localDateOnly(endDate).getTime()));
      if (lower > upper) continue;
      const operatingDays = new Set(schedule.days.map((item) => item.dayOfWeek));
      for (const date of datesBetween(lower, upper)) {
        if (!operatingDays.has(dayNames[date.getUTCDay()])) continue;
        const scheduledDeparture = toLusakaInstant(date, schedule.departureTime);
        const scheduledArrival = new Date(scheduledDeparture.getTime() + schedule.estimatedDuration * 60000);
        try {
          await createTrip(db, { scheduleId: schedule.id, routeId: schedule.routeId, tripCode: `SCH-${schedule.id}-${dateKey(date).replaceAll('-', '')}-${String(schedule.departureTime.getUTCHours()).padStart(2, '0')}${String(schedule.departureTime.getUTCMinutes()).padStart(2, '0')}`, scheduledDeparture, scheduledArrival }, request.user.id);
          generated += 1;
        } catch (error) {
          if (error.code === 'P2002') skippedDuplicates += 1;
          else throw error;
        }
      }
    }
    await audit(db, { actorId: request.user.id, action: 'TRIPS_GENERATED', metadata: { scheduleId: scheduleId || null, generated, skippedDuplicates, startDate, endDate } });
  });
  response.json({ success: true, data: { schedulesProcessed, generated, skippedDuplicates } });
}));

// Admin trip management.
adminRouter.post('/trips', validate(schemas.tripCreateSchema), asyncHandler(async (request, response) => {
  const created = await prisma.$transaction(
    async (db) => {
      const { driverId, vehicleId, routeId, ...data } = request.body;
      const schedule = await requireSchedule(db, data.scheduleId);
      const resolvedRouteId = routeId || schedule.routeId;
      if (resolvedRouteId !== schedule.routeId) throw new AppError(400, 'Trip route must match its schedule route.', 'SCHEDULE_ROUTE_MISMATCH');
      await requireRoute(db, resolvedRouteId);
      const trip = await createTrip(db, { ...data, routeId: resolvedRouteId }, request.user.id);
      if ((driverId && !vehicleId) || (!driverId && vehicleId)) throw new AppError(400, 'Driver and vehicle must be assigned together.', 'VALIDATION_ERROR');
      if (driverId) await assignTrip(db, trip, driverId, vehicleId, request.user.id);
      await audit(db, { actorId: request.user.id, action: 'TRIP_CREATED', metadata: { tripId: trip.id } });
      return requireTrip(db, trip.id);
    },
    {
      maxWait: 10000,
      timeout: 15000,
    },
  );
  response.status(201).json({ success: true, data: { trip: created } });
}));

adminRouter.get('/trips', asyncHandler(async (request, response) => {
  const value = pagination(request.query); const where = tripWhere(request.query);
  const [trips, total] = await Promise.all([prisma.trip.findMany({ where, include: tripInclude, orderBy: { scheduledDeparture: 'desc' }, skip: (value.page - 1) * value.limit, take: value.limit }), prisma.trip.count({ where })]);
  response.json({ success: true, data: { trips, pagination: pageResponse([], total, value).pagination } });
}));

adminRouter.get('/trips/:id', asyncHandler(async (request, response) => response.json({ success: true, data: { trip: await requireTrip(prisma, parsedId(request.params.id)) } })));

adminRouter.patch('/trips/:id', validate(schemas.tripPatchSchema), asyncHandler(async (request, response) => {
  const tripId = parsedId(request.params.id);
  const trip = await prisma.$transaction(async (db) => {
    const current = await requireTrip(db, tripId, undefined);
    if (['COMPLETED', 'CANCELLED'].includes(current.status)) throw new AppError(409, 'Completed or cancelled trips cannot be edited.', 'TRIP_NOT_EDITABLE');
    const departure = request.body.scheduledDeparture || current.scheduledDeparture;
    const arrival = request.body.scheduledArrival || current.scheduledArrival;
    if (arrival <= departure) throw new AppError(400, 'Scheduled arrival must be after departure.', 'VALIDATION_ERROR');
    if (current.driverId && current.vehicleId && (request.body.scheduledDeparture || request.body.scheduledArrival)) {
      await validateAssignment(db, { ...current, scheduledDeparture: departure, scheduledArrival: arrival }, current.driverId, current.vehicleId);
    }
    const updated = await db.trip.update({ where: { id: tripId }, data: request.body, include: tripInclude });
    await audit(db, { actorId: request.user.id, action: 'TRIP_UPDATED', metadata: { tripId } });
    return updated;
  });
  response.json({ success: true, data: { trip } });
}));

adminRouter.patch('/trips/:id/assign', validate(schemas.tripAssignmentSchema), asyncHandler(async (request, response) => {
  const tripId = parsedId(request.params.id);
  const result = await prisma.$transaction(async (db) => { const trip = await requireTrip(db, tripId, undefined); return assignTrip(db, trip, request.body.driverId, request.body.vehicleId, request.user.id); });
  if (result.changed) emitDashboard('dashboard:vehicle:updated', { tripId, vehicleId: request.body.vehicleId, driverId: request.body.driverId, change: 'TRIP_ASSIGNED' });
  response.json({ success: true, message: result.changed ? 'Trip assigned.' : 'Trip already has this assignment.', data: { trip: await requireTrip(prisma, tripId) } });
}));

adminRouter.patch('/trips/:id/status', validate(schemas.tripStatusSchema), asyncHandler(async (request, response) => {
  const tripId = parsedId(request.params.id); const { status, reason, revisedDeparture, revisedArrival } = request.body;
  if (status === 'CANCELLED' && !reason) throw new AppError(400, 'Use a cancellation reason.', 'CANCELLATION_REASON_REQUIRED');
  await prisma.$transaction(async (db) => changeStatus(db, await requireTrip(db, tripId, undefined), status, request.user.id, { reason, revisedDeparture, revisedArrival }));
  await reconcileSimulation(tripId, status);
  emitDashboard('dashboard:trip:updated', { tripId, status }); emitDashboard('dashboard:operations:updated', { tripId, change: `TRIP_${status}` });
  response.json({ success: true, data: { trip: await requireTrip(prisma, tripId) } });
}));

adminRouter.patch('/trips/:id/cancel', validate(schemas.tripCancelSchema), asyncHandler(async (request, response) => {
  const tripId = parsedId(request.params.id);
  await prisma.$transaction(async (db) => changeStatus(db, await requireTrip(db, tripId, undefined), 'CANCELLED', request.user.id, { reason: request.body.reason }));
  await reconcileSimulation(tripId, 'CANCELLED');
  emitDashboard('dashboard:trip:updated', { tripId, status: 'CANCELLED' }); emitDashboard('dashboard:operations:updated', { tripId, change: 'TRIP_CANCELLED' });
  response.json({ success: true, data: { trip: await requireTrip(prisma, tripId) } });
}));

// Driver operations only use the authenticated driver's identity.
async function driverTrip(request) {
  const trip = await requireTrip(prisma, parsedId(request.params.id));
  if (trip.driverId !== request.user.id) throw new AppError(403, 'This trip is not assigned to you.', 'FORBIDDEN');
  return trip;
}

driverRouter.get('/trips', asyncHandler(async (request, response) => {
  const value = pagination(request.query); const where = tripWhere(request.query, { driverId: request.user.id });
  if (!request.query.includePast) where.scheduledDeparture = { ...(where.scheduledDeparture || {}), gte: new Date() };
  const [trips, total] = await Promise.all([prisma.trip.findMany({ where, include: tripInclude, orderBy: { scheduledDeparture: 'asc' }, skip: (value.page - 1) * value.limit, take: value.limit }), prisma.trip.count({ where })]);
  response.json({ success: true, data: { trips, pagination: pageResponse([], total, value).pagination } });
}));
driverRouter.get('/trips/history', asyncHandler(async (request, response) => {
  const value = pagination(request.query); const where = { driverId: request.user.id, OR: [{ status: { in: ['COMPLETED', 'CANCELLED'] } }, { scheduledDeparture: { lt: new Date() } }] };
  const [trips, total] = await Promise.all([prisma.trip.findMany({ where, include: tripInclude, orderBy: { scheduledDeparture: 'desc' }, skip: (value.page - 1) * value.limit, take: value.limit }), prisma.trip.count({ where })]);
  response.json({ success: true, data: { trips, pagination: pageResponse([], total, value).pagination } });
}));
driverRouter.get('/trips/:id', asyncHandler(async (request, response) => response.json({ success: true, data: { trip: await driverTrip(request) } })));
for (const [path, status] of [['/trips/:id/boarding', 'BOARDING'], ['/trips/:id/start', 'IN_PROGRESS'], ['/trips/:id/complete', 'COMPLETED']]) {
  driverRouter.patch(path, asyncHandler(async (request, response) => {
    const trip = await driverTrip(request);
    await prisma.$transaction(
      async (db) => changeStatus(db, await requireTrip(db, trip.id, undefined), status, request.user.id),
      {
        maxWait: 10000,
        timeout: 15000,
      },
    );
    await reconcileSimulation(trip.id, status);
    emitDashboard('dashboard:trip:updated', { tripId: trip.id, status }); emitDashboard('dashboard:operations:updated', { tripId: trip.id, change: `TRIP_${status}` });
    response.json({ success: true, data: { trip: await requireTrip(prisma, trip.id) } });
  }));
}

// Public and commuter reads intentionally omit driver and audit data.
publicRouter.get('/routes/:routeId/schedules', asyncHandler(async (request, response) => {
  const routeId = parsedId(request.params.routeId); await requireRoute(prisma, routeId, true); const value = pagination(request.query); const today = lusakaToday();
  const where = { routeId, status: 'ACTIVE', OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: today } }] };
  const [schedules, total] = await Promise.all([prisma.schedule.findMany({ where, include: { route: true, days: true }, orderBy: { departureTime: 'asc' }, skip: (value.page - 1) * value.limit, take: value.limit }), prisma.schedule.count({ where })]);
  response.json({ success: true, data: { schedules: schedules.map(publicSchedule), pagination: pageResponse([], total, value).pagination } });
}));
publicRouter.get('/schedules', asyncHandler(async (request, response) => {
  const value = pagination(request.query); const today = lusakaToday(); const where = { status: 'ACTIVE', OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: today } }], route: { is: { status: 'ACTIVE' } }, ...(request.query.routeId ? { routeId: parsedId(request.query.routeId) } : {}) };
  const [schedules, total] = await Promise.all([prisma.schedule.findMany({ where, include: { route: true, days: true }, orderBy: { departureTime: 'asc' }, skip: (value.page - 1) * value.limit, take: value.limit }), prisma.schedule.count({ where })]);
  response.json({ success: true, data: { schedules: schedules.map(publicSchedule), pagination: pageResponse([], total, value).pagination } });
}));
publicRouter.get('/trips/upcoming', asyncHandler(async (request, response) => {
  const value = pagination(request.query); const where = tripWhere(request.query, { publicOnly: true });
  const [trips, total] = await Promise.all([prisma.trip.findMany({ where, include: tripInclude, orderBy: { scheduledDeparture: 'asc' }, skip: (value.page - 1) * value.limit, take: value.limit }), prisma.trip.count({ where })]);
  response.json({ success: true, data: { trips: trips.map(publicTrip), pagination: pageResponse([], total, value).pagination } });
}));
publicRouter.get('/routes/:routeId/trips', asyncHandler(async (request, response) => {
  const routeId = parsedId(request.params.routeId); await requireRoute(prisma, routeId, true); const value = pagination(request.query); const where = tripWhere({ ...request.query, routeId }, { publicOnly: true });
  const [trips, total] = await Promise.all([prisma.trip.findMany({ where, include: tripInclude, orderBy: { scheduledDeparture: 'asc' }, skip: (value.page - 1) * value.limit, take: value.limit }), prisma.trip.count({ where })]);
  response.json({ success: true, data: { trips: trips.map(publicTrip), pagination: pageResponse([], total, value).pagination } });
}));
publicRouter.get('/schedules/:scheduleId/trips', asyncHandler(async (request, response) => {
  const scheduleId = parsedId(request.params.scheduleId); const schedule = await requireSchedule(prisma, scheduleId); if (schedule.status !== 'ACTIVE' || schedule.route.status !== 'ACTIVE') throw new AppError(404, 'Active schedule not found.', 'NOT_FOUND'); const value = pagination(request.query); const where = tripWhere({ ...request.query, scheduleId }, { publicOnly: true });
  const [trips, total] = await Promise.all([prisma.trip.findMany({ where, include: tripInclude, orderBy: { scheduledDeparture: 'asc' }, skip: (value.page - 1) * value.limit, take: value.limit }), prisma.trip.count({ where })]);
  response.json({ success: true, data: { trips: trips.map(publicTrip), pagination: pageResponse([], total, value).pagination } });
}));
publicRouter.get('/trips/:id', asyncHandler(async (request, response) => {
  const trip = await requireTrip(prisma, parsedId(request.params.id));
  if (!publicTripStatuses.includes(trip.status) || trip.scheduledDeparture < new Date() || trip.route.status !== 'ACTIVE') throw new AppError(404, 'Upcoming trip not found.', 'NOT_FOUND');
  response.json({ success: true, data: { trip: publicTrip(trip) } });
}));
commuterRouter.get('/trips/upcoming', asyncHandler(async (request, response) => {
  const value = pagination(request.query); const where = tripWhere(request.query, { publicOnly: true });
  const [trips, total] = await Promise.all([prisma.trip.findMany({ where, include: tripInclude, orderBy: { scheduledDeparture: 'asc' }, skip: (value.page - 1) * value.limit, take: value.limit }), prisma.trip.count({ where })]);
  response.json({ success: true, data: { trips: trips.map(publicTrip), pagination: pageResponse([], total, value).pagination } });
}));

module.exports = { adminRouter, driverRouter, commuterRouter, publicRouter };
