// Fleet and transport resources: drivers, vehicles, routes, stops,
// and vehicle-to-driver assignments. Admin routes use authentication below.
const bcrypt = require('bcryptjs');
const express = require('express');
const prisma = require('../../lib/prisma');
const AppError = require('../../errors/app-error');
const { authenticate, authorize } = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const asyncHandler = require('../../utils/async-handler');
const { audit } = require('../../utils/audit');
const { publicUser } = require('../../utils/users');
const { emitDashboard } = require('../../services/socket');
const schemas = require('../../validators/transport');

const publicRouter = express.Router();
const adminRouter = express.Router();
adminRouter.use(authenticate, authorize('ADMIN'));

const id = (value) => { const result = Number.parseInt(value, 10); if (!Number.isInteger(result) || result < 1) throw new AppError(400, 'Invalid ID.', 'VALIDATION_ERROR'); return result; };
const page = (request) => ({ page: Math.max(1, Number.parseInt(request.query.page, 10) || 1), limit: Math.min(100, Math.max(1, Number.parseInt(request.query.limit, 10) || 20)), search: typeof request.query.search === 'string' ? request.query.search.trim() : '' });
const ip = (request) => request.ip;
const driverInclude = { driverProfile: true };
const driverWhere = (search) => ({ role: 'DRIVER', ...(search ? { OR: [{ fullName: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }, { driverProfile: { licenceNumber: { contains: search, mode: 'insensitive' } } }] } : {}) });
const publicDriver = (user) => ({ ...publicUser(user), driverProfile: user.driverProfile });
const publicVehicle = (vehicle) => vehicle;
const publicRoute = (route) => route;
const publicStop = (stop) => stop;
async function must(db, model, recordId, label) { const record = await db[model].findUnique({ where: { id: recordId } }); if (!record) throw new AppError(404, `${label} not found.`, 'NOT_FOUND'); return record; }

adminRouter.post('/drivers', validate(schemas.driverCreateSchema), asyncHandler(async (request, response) => {
  const { fullName, email, phoneNumber, password, licenceNumber, licenceExpiry, address } = request.body;
  const passwordHash = await bcrypt.hash(password, 12);
  const driver = await prisma.$transaction(async (db) => {
    const user = await db.user.create({ data: { fullName, email, phoneNumber: phoneNumber || null, passwordHash, role: 'DRIVER', status: 'ACTIVE', approvedAt: new Date() } });
    const profile = await db.driverProfile.create({ data: { userId: user.id, licenceNumber, licenceExpiry, address: address || null } });
    await audit(db, { actorId: request.user.id, targetUserId: user.id, action: 'DRIVER_CREATED', ipAddress: ip(request) });
    return { ...user, driverProfile: profile };
  });
  response.status(201).json({ success: true, message: 'Driver created.', data: { driver: publicDriver(driver) } });
}));

adminRouter.get('/drivers', asyncHandler(async (request, response) => {
  const { page: currentPage, limit, search } = page(request); const where = driverWhere(search);
  const [drivers, total] = await Promise.all([prisma.user.findMany({ where, include: driverInclude, orderBy: { createdAt: 'desc' }, skip: (currentPage - 1) * limit, take: limit }), prisma.user.count({ where })]);
  response.json({ success: true, data: { drivers: drivers.map(publicDriver), pagination: { page: currentPage, limit, total, totalPages: Math.ceil(total / limit) } } });
}));

adminRouter.get('/drivers/:driverId', asyncHandler(async (request, response) => { const driverId = id(request.params.driverId); const driver = await prisma.user.findFirst({ where: { id: driverId, role: 'DRIVER' }, include: driverInclude }); if (!driver) throw new AppError(404, 'Driver not found.', 'NOT_FOUND'); response.json({ success: true, data: { driver: publicDriver(driver) } }); }));
adminRouter.patch('/drivers/:driverId', validate(schemas.driverUpdateSchema), asyncHandler(async (request, response) => {
  const driverId = id(request.params.driverId); const driver = await prisma.$transaction(async (db) => { const target = await db.user.findFirst({ where: { id: driverId, role: 'DRIVER' } }); if (!target) throw new AppError(404, 'Driver not found.', 'NOT_FOUND'); const { licenceNumber, licenceExpiry, address, ...userData } = request.body; await db.user.update({ where: { id: driverId }, data: userData }); await db.driverProfile.update({ where: { userId: driverId }, data: { ...(licenceNumber === undefined ? {} : { licenceNumber }), ...(licenceExpiry === undefined ? {} : { licenceExpiry }), ...(address === undefined ? {} : { address }) } }); await audit(db, { actorId: request.user.id, targetUserId: driverId, action: 'DRIVER_UPDATED', ipAddress: ip(request) }); return db.user.findUnique({ where: { id: driverId }, include: driverInclude }); }); response.json({ success: true, data: { driver: publicDriver(driver) } });
}));
adminRouter.patch('/drivers/:driverId/status', validate(schemas.driverStatusSchema), asyncHandler(async (request, response) => { const driverId = id(request.params.driverId); const driver = await prisma.user.findFirst({ where: { id: driverId, role: 'DRIVER' } }); if (!driver) throw new AppError(404, 'Driver not found.', 'NOT_FOUND'); const updated = await prisma.$transaction(async (db) => { const user = await db.user.update({ where: { id: driverId }, data: { status: request.body.status } }); if (request.body.status !== 'ACTIVE') await db.refreshToken.updateMany({ where: { userId: driverId, revokedAt: null }, data: { revokedAt: new Date(), revokedReason: 'DRIVER_STATUS_CHANGED' } }); await audit(db, { actorId: request.user.id, targetUserId: driverId, action: 'DRIVER_STATUS_CHANGED', metadata: { status: request.body.status }, ipAddress: ip(request) }); return user; }); emitDashboard('dashboard:driver:updated', { driverId, status: updated.status }); response.json({ success: true, data: { driver: publicUser(updated) } }); }));
adminRouter.get('/drivers/:driverId/trips', asyncHandler(async (request, response) => { const driverId = id(request.params.driverId); const driver = await prisma.user.findFirst({ where: { id: driverId, role: 'DRIVER' } }); if (!driver) throw new AppError(404, 'Driver not found.', 'NOT_FOUND'); const { page: currentPage, limit } = page(request); const where = { driverId }; const [trips, total] = await Promise.all([prisma.trip.findMany({ where, include: { route: true, vehicle: true, schedule: true }, orderBy: { scheduledDeparture: 'desc' }, skip: (currentPage - 1) * limit, take: limit }), prisma.trip.count({ where })]); response.json({ success: true, data: { trips, pagination: { page: currentPage, limit, total, totalPages: Math.ceil(total / limit) } } }); }));

adminRouter.post('/vehicles', validate(schemas.vehicleSchema), asyncHandler(async (request, response) => { const vehicle = await prisma.vehicle.create({ data: request.body }); await audit(prisma, { actorId: request.user.id, action: 'VEHICLE_CREATED', metadata: { vehicleId: vehicle.id }, ipAddress: ip(request) }); response.status(201).json({ success: true, data: { vehicle } }); }));
adminRouter.get('/vehicles', asyncHandler(async (request, response) => { const { page: currentPage, limit, search } = page(request); const where = { ...(search ? { registrationNumber: { contains: search, mode: 'insensitive' } } : {}), ...(request.query.status ? { status: request.query.status } : {}), ...(request.query.vehicleType ? { vehicleType: request.query.vehicleType } : {}) }; const [vehicles, total] = await Promise.all([prisma.vehicle.findMany({ where, include: { assignments: { where: { endedAt: null }, include: { driver: { select: { id: true, fullName: true, email: true } } } }, _count: { select: { trips: true, maintenanceRecords: true } } }, orderBy: { createdAt: 'desc' }, skip: (currentPage - 1) * limit, take: limit }), prisma.vehicle.count({ where })]); response.json({ success: true, data: { vehicles, pagination: { page: currentPage, limit, total, totalPages: Math.ceil(total / limit) } } }); }));
adminRouter.get('/vehicles/:vehicleId', asyncHandler(async (request, response) => { const vehicle = await prisma.vehicle.findUnique({ where: { id: id(request.params.vehicleId) }, include: { assignments: { include: { driver: { select: { id: true, fullName: true, email: true } } }, orderBy: { assignedAt: 'desc' }, take: 20 }, trips: { orderBy: { scheduledDeparture: 'desc' }, take: 20 }, maintenanceRecords: { orderBy: { maintenanceDate: 'desc' }, take: 20 } } }); if (!vehicle) throw new AppError(404, 'Vehicle not found.', 'NOT_FOUND'); response.json({ success: true, data: { vehicle } }); }));
adminRouter.patch('/vehicles/:vehicleId', validate(schemas.vehiclePatchSchema), asyncHandler(async (request, response) => { const vehicleId = id(request.params.vehicleId); await must(prisma, 'vehicle', vehicleId, 'Vehicle'); const vehicle = await prisma.vehicle.update({ where: { id: vehicleId }, data: request.body }); await audit(prisma, { actorId: request.user.id, action: 'VEHICLE_UPDATED', metadata: { vehicleId }, ipAddress: ip(request) }); response.json({ success: true, data: { vehicle } }); }));
adminRouter.patch('/vehicles/:vehicleId/status', validate(schemas.vehicleStatusSchema), asyncHandler(async (request, response) => { const vehicleId = id(request.params.vehicleId); await must(prisma, 'vehicle', vehicleId, 'Vehicle'); const vehicle = await prisma.vehicle.update({ where: { id: vehicleId }, data: { status: request.body.status } }); await audit(prisma, { actorId: request.user.id, action: 'VEHICLE_STATUS_CHANGED', metadata: { vehicleId, status: request.body.status }, ipAddress: ip(request) }); emitDashboard('dashboard:vehicle:updated', { vehicleId, status: vehicle.status, change: vehicle.status === 'MAINTENANCE' ? 'ENTERED_MAINTENANCE' : 'STATUS_CHANGED' }); emitDashboard('dashboard:operations:updated', { vehicleId, change: vehicle.status === 'ACTIVE' ? 'RETURNED_TO_SERVICE' : 'VEHICLE_STATUS_CHANGED' }); response.json({ success: true, data: { vehicle } }); }));
adminRouter.delete('/vehicles/:vehicleId', asyncHandler(async (request, response) => { const vehicleId = id(request.params.vehicleId); const vehicle = await must(prisma, 'vehicle', vehicleId, 'Vehicle'); const [trips, locations, maintenance] = await Promise.all([prisma.trip.count({ where: { vehicleId } }), prisma.vehicleLocation.count({ where: { vehicleId } }), prisma.maintenanceRecord.count({ where: { vehicleId } })]); if (trips || locations || maintenance) throw new AppError(409, 'Vehicle has historical records; deactivate it instead of deleting it.', 'HISTORICAL_RECORDS_EXIST'); await prisma.vehicle.delete({ where: { id: vehicle.id } }); await audit(prisma, { actorId: request.user.id, action: 'VEHICLE_DELETED', metadata: { vehicleId }, ipAddress: ip(request) }); response.json({ success: true, message: 'Vehicle deleted.' }); }));

adminRouter.post('/routes', validate(schemas.routeSchema), asyncHandler(async (request, response) => {
  const { originStopId, destinationStopId, ...data } = request.body;
  const [originStop, destinationStop] = await Promise.all([
    must(prisma, 'stop', originStopId, 'Origin terminal'),
    must(prisma, 'stop', destinationStopId, 'Destination terminal'),
  ]);
  const route = await prisma.route.create({
    data: { ...data, origin: originStop.name, destination: destinationStop.name, originStopId, destinationStopId },
    include: { originStop: true, destinationStop: true },
  });
  await audit(prisma, { actorId: request.user.id, action: 'ROUTE_CREATED', metadata: { routeId: route.id }, ipAddress: ip(request) });
  response.status(201).json({ success: true, data: { route } });
}));
adminRouter.patch('/routes/:routeId', validate(schemas.routePatchSchema), asyncHandler(async (request, response) => {
  const routeId = id(request.params.routeId);
  await must(prisma, 'route', routeId, 'Route');
  const { originStopId, destinationStopId, ...data } = request.body;
  if (originStopId !== undefined && destinationStopId !== undefined) {
    const [originStop, destinationStop] = await Promise.all([
      must(prisma, 'stop', originStopId, 'Origin terminal'),
      must(prisma, 'stop', destinationStopId, 'Destination terminal'),
    ]);
    Object.assign(data, {
      origin: originStop.name,
      destination: destinationStop.name,
      originStopId,
      destinationStopId,
    });
  }
  const route = await prisma.route.update({
    where: { id: routeId },
    data,
    include: { originStop: true, destinationStop: true },
  });
  await audit(prisma, { actorId: request.user.id, action: 'ROUTE_UPDATED', metadata: { routeId }, ipAddress: ip(request) });
  response.json({ success: true, data: { route } });
}));
adminRouter.patch('/routes/:routeId/status', validate(schemas.routeStatusSchema), asyncHandler(async (request, response) => { const routeId = id(request.params.routeId); await must(prisma, 'route', routeId, 'Route'); const route = await prisma.route.update({ where: { id: routeId }, data: { status: request.body.status } }); await audit(prisma, { actorId: request.user.id, action: 'ROUTE_STATUS_CHANGED', metadata: { routeId, status: request.body.status }, ipAddress: ip(request) }); response.json({ success: true, data: { route } }); }));
adminRouter.delete('/routes/:routeId', asyncHandler(async (request, response) => { const routeId = id(request.params.routeId); await must(prisma, 'route', routeId, 'Route'); if (await prisma.trip.count({ where: { routeId } })) throw new AppError(409, 'Route has historical trips; deactivate it instead of deleting it.', 'HISTORICAL_RECORDS_EXIST'); await prisma.route.delete({ where: { id: routeId } }); response.json({ success: true, message: 'Route deleted.' }); }));

adminRouter.post('/stops', validate(schemas.stopSchema), asyncHandler(async (request, response) => { const stop = await prisma.stop.create({ data: request.body }); await audit(prisma, { actorId: request.user.id, action: 'STOP_CREATED', metadata: { stopId: stop.id }, ipAddress: ip(request) }); response.status(201).json({ success: true, data: { stop } }); }));
adminRouter.patch('/stops/:stopId', validate(schemas.stopPatchSchema), asyncHandler(async (request, response) => { const stopId = id(request.params.stopId); await must(prisma, 'stop', stopId, 'Stop'); const stop = await prisma.stop.update({ where: { id: stopId }, data: request.body }); response.json({ success: true, data: { stop } }); }));
adminRouter.delete('/stops/:stopId', asyncHandler(async (request, response) => {
  const stopId = id(request.params.stopId);
  await must(prisma, 'stop', stopId, 'Stop');
  const [routeStopCount, endpointRouteCount] = await Promise.all([
    prisma.routeStop.count({ where: { stopId } }),
    prisma.route.count({ where: { OR: [{ originStopId: stopId }, { destinationStopId: stopId }] } }),
  ]);
  if (routeStopCount || endpointRouteCount) throw new AppError(409, 'Stop is used by a route endpoint or route stop; remove those relationships first.', 'RELATIONSHIPS_EXIST');
  await prisma.stop.delete({ where: { id: stopId } });
  response.json({ success: true, message: 'Stop deleted.' });
}));

adminRouter.post('/routes/:routeId/stops', validate(schemas.routeStopSchema), asyncHandler(async (request, response) => { const routeId = id(request.params.routeId); const { stopId, sequence, estimatedMinutesFromStart } = request.body; const routeStop = await prisma.$transaction(async (db) => { await must(db, 'route', routeId, 'Route'); await must(db, 'stop', stopId, 'Stop'); return db.routeStop.create({ data: { routeId, stopId, sequence, estimatedMinutesFromStart: estimatedMinutesFromStart ?? null } }); }); response.status(201).json({ success: true, data: { routeStop } }); }));
publicRouter.get('/routes/:routeId/stops', asyncHandler(async (request, response) => { const routeId = id(request.params.routeId); await must(prisma, 'route', routeId, 'Route'); const stops = await prisma.routeStop.findMany({ where: { routeId }, include: { stop: true }, orderBy: { sequence: 'asc' } }); response.json({ success: true, data: { stops } }); }));
adminRouter.patch('/routes/:routeId/stops/reorder', validate(schemas.reorderSchema), asyncHandler(async (request, response) => { const routeId = id(request.params.routeId); const records = await prisma.routeStop.findMany({ where: { routeId } }); const incoming = request.body.stops; if (records.length !== incoming.length || new Set(incoming.map((item) => item.stopId)).size !== incoming.length || new Set(incoming.map((item) => item.sequence)).size !== incoming.length || records.some((record) => !incoming.some((item) => item.stopId === record.stopId))) throw new AppError(400, 'Reorder must include every route stop exactly once with unique sequences.', 'INVALID_ROUTE_ORDER'); const updated = await prisma.$transaction(async (db) => { for (const record of records) await db.routeStop.update({ where: { id: record.id }, data: { sequence: -record.id } }); for (const item of incoming) { const record = records.find((value) => value.stopId === item.stopId); await db.routeStop.update({ where: { id: record.id }, data: { sequence: item.sequence } }); } return db.routeStop.findMany({ where: { routeId }, include: { stop: true }, orderBy: { sequence: 'asc' } }); }); response.json({ success: true, data: { stops: updated } }); }));
adminRouter.delete('/routes/:routeId/stops/:stopId', asyncHandler(async (request, response) => { const routeId = id(request.params.routeId); const stopId = id(request.params.stopId); const relation = await prisma.routeStop.findFirst({ where: { routeId, stopId } }); if (!relation) throw new AppError(404, 'Route stop relationship not found.', 'NOT_FOUND'); await prisma.routeStop.delete({ where: { id: relation.id } }); response.json({ success: true, message: 'Stop removed from route.' }); }));

adminRouter.post('/assignments', validate(schemas.assignmentSchema), asyncHandler(async (request, response) => { const { vehicleId, driverId, assignedAt } = request.body; const assignment = await prisma.$transaction(async (db) => { const vehicle = await must(db, 'vehicle', vehicleId, 'Vehicle'); if (vehicle.status !== 'ACTIVE') throw new AppError(409, 'Only active vehicles can be assigned.', 'VEHICLE_UNAVAILABLE'); const driver = await db.user.findUnique({ where: { id: driverId }, include: { driverProfile: true } }); if (!driver || driver.role !== 'DRIVER' || driver.status !== 'ACTIVE') throw new AppError(409, 'Only active drivers can be assigned.', 'DRIVER_UNAVAILABLE'); const [vehicleConflict, driverConflict] = await Promise.all([db.vehicleAssignment.findFirst({ where: { vehicleId, endedAt: null } }), db.vehicleAssignment.findFirst({ where: { driverId, endedAt: null } })]); if (vehicleConflict || driverConflict) throw new AppError(409, 'Vehicle and driver assignments cannot overlap.', 'ASSIGNMENT_CONFLICT'); const created = await db.vehicleAssignment.create({ data: { vehicleId, driverId, assignedAt: assignedAt || new Date() }, include: { vehicle: true, driver: { select: { id: true, fullName: true, email: true } } } }); await audit(db, { actorId: request.user.id, targetUserId: driverId, action: 'VEHICLE_DRIVER_ASSIGNED', metadata: { vehicleId, assignmentId: created.id }, ipAddress: ip(request) }); return created; }); emitDashboard('dashboard:vehicle:updated', { vehicleId, driverId, assignmentId: assignment.id, change: 'VEHICLE_DRIVER_ASSIGNED' }); emitDashboard('dashboard:driver:updated', { driverId, vehicleId, change: 'VEHICLE_DRIVER_ASSIGNED' }); response.status(201).json({ success: true, data: { assignment } }); }));
adminRouter.get('/assignments', asyncHandler(async (request, response) => { const { page: currentPage, limit } = page(request); const [assignments, total] = await Promise.all([prisma.vehicleAssignment.findMany({ include: { vehicle: true, driver: { select: { id: true, fullName: true, email: true, status: true } } }, orderBy: { assignedAt: 'desc' }, skip: (currentPage - 1) * limit, take: limit }), prisma.vehicleAssignment.count()]); response.json({ success: true, data: { assignments, pagination: { page: currentPage, limit, total, totalPages: Math.ceil(total / limit) } } }); }));
adminRouter.get('/assignments/:assignmentId', asyncHandler(async (request, response) => { const assignment = await prisma.vehicleAssignment.findUnique({ where: { id: id(request.params.assignmentId) }, include: { vehicle: true, driver: { select: { id: true, fullName: true, email: true, status: true } } } }); if (!assignment) throw new AppError(404, 'Assignment not found.', 'NOT_FOUND'); response.json({ success: true, data: { assignment } }); }));
adminRouter.patch('/assignments/:assignmentId/end', asyncHandler(async (request, response) => { const assignmentId = id(request.params.assignmentId); const assignment = await prisma.vehicleAssignment.findUnique({ where: { id: assignmentId } }); if (!assignment) throw new AppError(404, 'Assignment not found.', 'NOT_FOUND'); if (assignment.endedAt) throw new AppError(409, 'Assignment has already ended.', 'INVALID_STATUS_TRANSITION'); const updated = await prisma.vehicleAssignment.update({ where: { id: assignmentId }, data: { endedAt: new Date() }, include: { vehicle: true, driver: { select: { id: true, fullName: true, email: true } } } }); await audit(prisma, { actorId: request.user.id, targetUserId: assignment.driverId, action: 'VEHICLE_DRIVER_ASSIGNMENT_ENDED', metadata: { vehicleId: assignment.vehicleId, assignmentId }, ipAddress: ip(request) }); emitDashboard('dashboard:vehicle:updated', { vehicleId: assignment.vehicleId, driverId: assignment.driverId, assignmentId, change: 'VEHICLE_DRIVER_ASSIGNMENT_ENDED' }); emitDashboard('dashboard:driver:updated', { driverId: assignment.driverId, vehicleId: assignment.vehicleId, change: 'VEHICLE_DRIVER_ASSIGNMENT_ENDED' }); response.json({ success: true, data: { assignment: updated } }); }));
adminRouter.get('/vehicles/:vehicleId/assignments', asyncHandler(async (request, response) => { const vehicleId = id(request.params.vehicleId); await must(prisma, 'vehicle', vehicleId, 'Vehicle'); const assignments = await prisma.vehicleAssignment.findMany({ where: { vehicleId }, include: { driver: { select: { id: true, fullName: true, email: true, status: true } } }, orderBy: { assignedAt: 'desc' } }); response.json({ success: true, data: { assignments } }); }));
adminRouter.get('/drivers/:driverId/assignments', asyncHandler(async (request, response) => { const driverId = id(request.params.driverId); const driver = await prisma.user.findFirst({ where: { id: driverId, role: 'DRIVER' } }); if (!driver) throw new AppError(404, 'Driver not found.', 'NOT_FOUND'); const assignments = await prisma.vehicleAssignment.findMany({ where: { driverId }, include: { vehicle: true }, orderBy: { assignedAt: 'desc' } }); response.json({ success: true, data: { assignments } }); }));

publicRouter.get('/routes', asyncHandler(async (request, response) => { const { page: currentPage, limit, search } = page(request); const where = { status: 'ACTIVE', ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { origin: { contains: search, mode: 'insensitive' } }, { destination: { contains: search, mode: 'insensitive' } }] } : {}) }; const [routes, total] = await Promise.all([prisma.route.findMany({ where, include: { originStop: true, destinationStop: true }, orderBy: { name: 'asc' }, skip: (currentPage - 1) * limit, take: limit }), prisma.route.count({ where })]); response.json({ success: true, data: { routes: routes.map(publicRoute), pagination: { page: currentPage, limit, total, totalPages: Math.ceil(total / limit) } } }); }));
publicRouter.get('/routes/:routeId', asyncHandler(async (request, response) => { const route = await prisma.route.findFirst({ where: { id: id(request.params.routeId), status: 'ACTIVE' }, include: { originStop: true, destinationStop: true, routeStops: { include: { stop: true }, orderBy: { sequence: 'asc' } } } }); if (!route) throw new AppError(404, 'Active route not found.', 'NOT_FOUND'); response.json({ success: true, data: { route } }); }));
publicRouter.get('/stops', asyncHandler(async (request, response) => { const { page: currentPage, limit, search } = page(request); const where = search ? { name: { contains: search, mode: 'insensitive' } } : {}; const [stops, total] = await Promise.all([prisma.stop.findMany({ where, orderBy: { name: 'asc' }, skip: (currentPage - 1) * limit, take: limit }), prisma.stop.count({ where })]); response.json({ success: true, data: { stops: stops.map(publicStop), pagination: { page: currentPage, limit, total, totalPages: Math.ceil(total / limit) } } }); }));
publicRouter.get('/stops/:stopId', asyncHandler(async (request, response) => { const stop = await prisma.stop.findUnique({ where: { id: id(request.params.stopId) }, include: { routeStops: { include: { route: true }, orderBy: { sequence: 'asc' } } } }); if (!stop) throw new AppError(404, 'Stop not found.', 'NOT_FOUND'); response.json({ success: true, data: { stop } }); }));

module.exports = { adminRouter, publicRouter };
