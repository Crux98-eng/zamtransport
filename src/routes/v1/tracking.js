const express = require('express');
const prisma = require('../../lib/prisma');
const AppError = require('../../errors/app-error');
const { authenticate, authorize } = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const asyncHandler = require('../../utils/async-handler');
const simulation = require('../../services/simulation');
const { calculateForTrip, publicEta } = require('../../services/eta');
const schemas = require('../../validators/tracking');

const publicRouter = express.Router(); const adminRouter = express.Router(); const driverRouter = express.Router();
adminRouter.use(authenticate, authorize('ADMIN')); driverRouter.use(authenticate, authorize('DRIVER'));
const id = (value) => { const result = Number.parseInt(value, 10); if (!Number.isInteger(result) || result < 1) throw new AppError(400, 'Invalid ID.', 'VALIDATION_ERROR'); return result; };
const page = (query) => ({ page: Math.max(1, Number.parseInt(query.page, 10) || 1), limit: Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 50)) });
const publicStatuses = ['SCHEDULED', 'BOARDING', 'IN_PROGRESS', 'DELAYED'];

function publicLocation(location, trip) {
  return { vehicleId: location.vehicleId, tripId: location.tripId, routeId: trip.routeId, vehicle: { id: trip.vehicle.id, registrationNumber: trip.vehicle.registrationNumber, vehicleName: trip.vehicle.vehicleName, vehicleType: trip.vehicle.vehicleType }, trip: { id: trip.id, tripCode: trip.tripCode, status: trip.status, scheduledArrival: trip.scheduledArrival }, route: { id: trip.route.id, name: trip.route.name, origin: trip.route.origin, destination: trip.route.destination }, latitude: Number(location.latitude), longitude: Number(location.longitude), speed: location.speed === null ? null : Number(location.speed), heading: location.heading === null ? null : Number(location.heading), isSimulated: location.isSimulated, recordedAt: location.recordedAt };
}

async function publicTrip(tripId) {
  const trip = await prisma.trip.findFirst({ where: { id: tripId, status: { in: publicStatuses }, route: { is: { status: 'ACTIVE' } } }, include: { vehicle: true, route: true } });
  if (!trip || !trip.vehicle) throw new AppError(404, 'Publicly trackable trip not found.', 'NOT_FOUND'); return trip;
}
async function latestForTrip(trip) { return prisma.vehicleLocation.findFirst({ where: { tripId: trip.id, vehicleId: trip.vehicleId }, orderBy: { recordedAt: 'desc' } }); }
function dateFilter(query) { const result = {}; if (query.from) { const value = new Date(query.from); if (Number.isNaN(value.getTime())) throw new AppError(400, 'Invalid from timestamp.', 'VALIDATION_ERROR'); result.gte = value; } if (query.to) { const value = new Date(query.to); if (Number.isNaN(value.getTime())) throw new AppError(400, 'Invalid to timestamp.', 'VALIDATION_ERROR'); result.lte = value; } return result; }

adminRouter.post('/tracking/simulations/start', validate(schemas.simulationStartSchema), asyncHandler(async (request, response) => response.status(201).json({ success: true, data: await simulation.start(request.body.tripId) })));
adminRouter.post('/tracking/simulations/:tripId/stop', asyncHandler(async (request, response) => response.json({ success: true, data: { simulation: await simulation.stop(id(request.params.tripId), 'ADMIN_STOP') } })));
adminRouter.post('/tracking/simulations/stop-all', asyncHandler(async (_request, response) => { const simulations = await simulation.stopAll('ADMIN_STOP_ALL'); response.json({ success: true, data: { stopped: simulations.length } }); }));
adminRouter.get('/tracking/simulations', asyncHandler(async (_request, response) => {
  const simulations = await prisma.trackingSimulation.findMany({ include: { trip: { select: { id: true, tripCode: true, status: true, routeId: true } }, vehicle: { select: { id: true, registrationNumber: true } } }, orderBy: { startedAt: 'desc' } });
  response.json({ success: true, data: { simulations, active: simulation.active() } });
}));
adminRouter.get('/tracking/simulations/:tripId', asyncHandler(async (request, response) => { const record = await prisma.trackingSimulation.findUnique({ where: { tripId: id(request.params.tripId) }, include: { trip: true, vehicle: true } }); if (!record) throw new AppError(404, 'Simulation not found.', 'NOT_FOUND'); response.json({ success: true, data: { simulation: record, active: simulation.active().find((item) => item.tripId === record.tripId) || null } }); }));

adminRouter.get('/tracking/overview', asyncHandler(async (_request, response) => { const [running, activeTrips, latest] = await Promise.all([prisma.trackingSimulation.count({ where: { status: 'RUNNING' } }), prisma.trip.count({ where: { status: 'IN_PROGRESS' } }), prisma.vehicleLocation.findMany({ orderBy: { recordedAt: 'desc' }, take: 20 })]); response.json({ success: true, data: { runningSimulations: running, activeTrips, latestLocations: latest } }); }));

async function history(request, response, where) { const pagination = page(request.query); const locationWhere = { ...where, ...(request.query.from || request.query.to ? { recordedAt: dateFilter(request.query) } : {}) }; const [locations, total] = await Promise.all([prisma.vehicleLocation.findMany({ where: locationWhere, orderBy: { recordedAt: 'asc' }, skip: (pagination.page - 1) * pagination.limit, take: pagination.limit }), prisma.vehicleLocation.count({ where: locationWhere })]); response.json({ success: true, data: { locations, pagination: { ...pagination, total, totalPages: Math.ceil(total / pagination.limit) } } }); }
adminRouter.get('/tracking/vehicles/:vehicleId/history', asyncHandler(async (request, response) => history(request, response, { vehicleId: id(request.params.vehicleId) })));
adminRouter.get('/tracking/trips/:tripId/history', asyncHandler(async (request, response) => history(request, response, { tripId: id(request.params.tripId) })));

publicRouter.get('/tracking/vehicles', asyncHandler(async (_request, response) => { const trips = await prisma.trip.findMany({ where: { status: 'IN_PROGRESS', route: { is: { status: 'ACTIVE' } }, vehicleId: { not: null } }, include: { vehicle: true, route: true } }); const locations = await Promise.all(trips.map(async (trip) => { const location = await latestForTrip(trip); return location ? publicLocation(location, trip) : null; })); response.json({ success: true, data: { vehicles: locations.filter(Boolean) } }); }));
publicRouter.get('/tracking/vehicles/:vehicleId/location', asyncHandler(async (request, response) => { const vehicleId = id(request.params.vehicleId); const trip = await prisma.trip.findFirst({ where: { vehicleId, status: 'IN_PROGRESS', route: { is: { status: 'ACTIVE' } } }, include: { vehicle: true, route: true } }); if (!trip) throw new AppError(404, 'Active tracked vehicle not found.', 'NOT_FOUND'); const location = await latestForTrip(trip); if (!location) throw new AppError(404, 'Location unavailable.', 'LOCATION_UNAVAILABLE'); response.json({ success: true, data: { location: publicLocation(location, trip) } }); }));
publicRouter.get('/tracking/trips/:tripId/location', asyncHandler(async (request, response) => { const trip = await publicTrip(id(request.params.tripId)); const location = await latestForTrip(trip); if (!location) throw new AppError(404, 'Location unavailable.', 'LOCATION_UNAVAILABLE'); response.json({ success: true, data: { location: publicLocation(location, trip) } }); }));
publicRouter.get('/tracking/routes/:routeId/vehicles', asyncHandler(async (request, response) => { const routeId = id(request.params.routeId); const trips = await prisma.trip.findMany({ where: { routeId, status: 'IN_PROGRESS', route: { is: { status: 'ACTIVE' } }, vehicleId: { not: null } }, include: { vehicle: true, route: true } }); const locations = await Promise.all(trips.map(async (trip) => { const location = await latestForTrip(trip); return location ? publicLocation(location, trip) : null; })); response.json({ success: true, data: { vehicles: locations.filter(Boolean) } }); }));
publicRouter.get('/tracking/trips/:tripId/eta', asyncHandler(async (request, response) => { const trip = await publicTrip(id(request.params.tripId)); response.json({ success: true, data: { eta: publicEta(await calculateForTrip(trip.id)) } }); }));
publicRouter.get('/tracking/vehicles/:vehicleId/eta', asyncHandler(async (request, response) => { const trip = await prisma.trip.findFirst({ where: { vehicleId: id(request.params.vehicleId), status: { in: publicStatuses }, route: { is: { status: 'ACTIVE' } } } }); if (!trip) throw new AppError(404, 'Publicly trackable vehicle not found.', 'NOT_FOUND'); response.json({ success: true, data: { eta: publicEta(await calculateForTrip(trip.id)) } }); }));
publicRouter.get('/tracking/trips/:tripId/history', authenticate, asyncHandler(async (request, response) => { const tripId = id(request.params.tripId); const trip = await prisma.trip.findUnique({ where: { id: tripId } }); if (!trip || (request.user.role !== 'ADMIN' && !(request.user.role === 'DRIVER' && trip.driverId === request.user.id))) throw new AppError(403, 'You cannot view this tracking history.', 'FORBIDDEN'); return history(request, response, { tripId }); }));

driverRouter.get('/tracking/current', asyncHandler(async (request, response) => { const trip = await prisma.trip.findFirst({ where: { driverId: request.user.id, status: 'IN_PROGRESS' }, include: { vehicle: true, route: { include: { routeStops: { include: { stop: true }, orderBy: { sequence: 'asc' } } } } } }); if (!trip) throw new AppError(404, 'No in-progress trip is assigned to you.', 'NOT_FOUND'); const location = await latestForTrip(trip); const eta = await calculateForTrip(trip.id); response.json({ success: true, data: { trip, location: location && publicLocation(location, trip), eta: publicEta(eta) } }); }));

module.exports = { adminRouter, driverRouter, publicRouter };
