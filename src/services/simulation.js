const prisma = require('../lib/prisma');
const AppError = require('../errors/app-error');
const { trackingConfig } = require('../lib/tracking-config');
const { bearing, distanceKm, interpolate } = require('./geo');
const { emitLocation } = require('./socket');

const tasks = new Map();

function orderedStops(route) {
  const stops = route.routeStops.map((item) => ({ ...item.stop, sequence: item.sequence }));
  if (stops.length < 2) throw new AppError(409, 'A tracked route must have at least two ordered stops.', 'TRACKING_ROUTE_STOPS_REQUIRED');
  return stops;
}

async function saveAndBroadcast(task, point, speed, heading) {
  const recordedAt = new Date();
  const location = await prisma.vehicleLocation.create({ data: { vehicleId: task.vehicleId, tripId: task.tripId, latitude: point.latitude, longitude: point.longitude, speed, heading, isSimulated: true, recordedAt } });
  emitLocation({ vehicleId: task.vehicleId, tripId: task.tripId, routeId: task.routeId, latitude: Number(location.latitude), longitude: Number(location.longitude), speed: Number(location.speed || 0), heading: Number(location.heading || 0), isSimulated: true, recordedAt: location.recordedAt.toISOString() });
  return location;
}

async function tick(tripId) {
  const task = tasks.get(tripId); if (!task) return;
  try {
    const trip = await prisma.trip.findUnique({ where: { id: tripId }, select: { status: true } });
    if (!trip || trip.status !== 'IN_PROGRESS') return stop(tripId, trip ? `TRIP_${trip.status}` : 'TRIP_MISSING');
    const config = trackingConfig(); const now = Date.now();
    if (task.dwellUntil > now) return schedule(task);
    const from = task.stops[task.segmentIndex]; const to = task.stops[task.segmentIndex + 1];
    const segmentDistance = distanceKm(from, to);
    task.segmentProgress += (config.defaultSpeedKph * config.speedMultiplier * config.updateIntervalMs) / 3600000 / Math.max(segmentDistance, 0.000001);
    if (task.segmentProgress >= 1) {
      await saveAndBroadcast(task, to, 0, bearing(from, to));
      task.segmentIndex += 1; task.segmentProgress = 0; task.dwellUntil = now + config.stopDwellMs;
      if (task.segmentIndex >= task.stops.length - 1) return stop(tripId, 'DESTINATION_REACHED');
    } else {
      const point = interpolate(from, to, task.segmentProgress);
      await saveAndBroadcast(task, point, config.defaultSpeedKph * config.speedMultiplier, bearing(from, to));
    }
    schedule(task);
  } catch (error) {
    await fail(tripId, error); // cleanup happens even if a database/socket write fails.
  }
}

function schedule(task) { task.timer = setTimeout(() => tick(task.tripId), trackingConfig().updateIntervalMs); }

async function start(tripId) {
  const existing = tasks.get(tripId); if (existing) return { started: false, simulation: await prisma.trackingSimulation.findUnique({ where: { tripId } }) };
  const config = trackingConfig(); if (tasks.size >= config.maxConcurrent) throw new AppError(409, 'Maximum concurrent simulations reached.', 'SIMULATION_CAPACITY_REACHED');
  const trip = await prisma.trip.findUnique({ where: { id: tripId }, include: { route: { include: { routeStops: { include: { stop: true }, orderBy: { sequence: 'asc' } } } } } });
  if (!trip) throw new AppError(404, 'Trip not found.', 'NOT_FOUND');
  if (trip.status !== 'IN_PROGRESS') throw new AppError(409, 'Only in-progress trips can be simulated.', 'TRIP_NOT_IN_PROGRESS');
  if (!trip.vehicleId || !trip.driverId) throw new AppError(409, 'Trip needs an assigned driver and vehicle.', 'TRIP_ASSIGNMENT_REQUIRED');
  const stops = orderedStops(trip.route);
  const simulation = await prisma.trackingSimulation.upsert({ where: { tripId }, update: { vehicleId: trip.vehicleId, status: 'RUNNING', startedAt: new Date(), stoppedAt: null, stopReason: null, errorMessage: null }, create: { tripId, vehicleId: trip.vehicleId, status: 'RUNNING' } });
  const task = { tripId, vehicleId: trip.vehicleId, routeId: trip.routeId, stops, segmentIndex: 0, segmentProgress: 0, dwellUntil: 0, timer: null };
  tasks.set(tripId, task);
  await saveAndBroadcast(task, stops[0], 0, bearing(stops[0], stops[1]));
  schedule(task);
  return { started: true, simulation };
}

async function stop(tripId, reason = 'MANUAL_STOP') {
  const task = tasks.get(tripId); if (task?.timer) clearTimeout(task.timer); tasks.delete(tripId);
  const simulation = await prisma.trackingSimulation.findUnique({ where: { tripId } });
  if (simulation?.status === 'RUNNING') return prisma.trackingSimulation.update({ where: { tripId }, data: { status: 'STOPPED', stoppedAt: new Date(), stopReason: reason } });
  return simulation;
}

async function complete(tripId) {
  const task = tasks.get(tripId);
  if (task) await saveAndBroadcast(task, task.stops[task.stops.length - 1], 0, task.stops.length > 1 ? bearing(task.stops[task.stops.length - 2], task.stops[task.stops.length - 1]) : 0);
  return stop(tripId, 'TRIP_COMPLETED');
}

async function fail(tripId, error) {
  const task = tasks.get(tripId); if (task?.timer) clearTimeout(task.timer); tasks.delete(tripId);
  console.error('Tracking simulation failed:', error.message);
  return prisma.trackingSimulation.updateMany({ where: { tripId, status: 'RUNNING' }, data: { status: 'ERROR', stoppedAt: new Date(), stopReason: 'SIMULATION_ERROR', errorMessage: error.message } });
}

async function stopAll(reason = 'STOP_ALL') { return Promise.all([...tasks.keys()].map((tripId) => stop(tripId, reason))); }
async function recoverAfterRestart() {
  await prisma.trackingSimulation.updateMany({
    where: { status: 'RUNNING' },
    data: { status: 'STOPPED', stoppedAt: new Date(), stopReason: 'APPLICATION_RESTART' },
  });
}
function active() { return [...tasks.values()].map(({ timer, stops, ...task }) => ({ ...task, currentStopSequence: stops[task.segmentIndex]?.sequence || null })); }

module.exports = { active, complete, recoverAfterRestart, start, stop, stopAll };
