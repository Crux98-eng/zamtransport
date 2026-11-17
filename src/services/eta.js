const prisma = require('../lib/prisma');
const { trackingConfig } = require('../lib/tracking-config');
const { distanceKm } = require('./geo');

async function calculateForTrip(tripId) {
  const trip = await prisma.trip.findUnique({ where: { id: tripId }, include: { route: { include: { routeStops: { include: { stop: true }, orderBy: { sequence: 'asc' } } } }, vehicle: true } });
  if (!trip) return { available: false, reason: 'TRIP_NOT_FOUND' };
  if (!trip.vehicleId) return { available: false, reason: 'TRIP_UNASSIGNED', trip };
  const location = await prisma.vehicleLocation.findFirst({ where: { tripId, vehicleId: trip.vehicleId }, orderBy: { recordedAt: 'desc' } });
  const stops = trip.route.routeStops.map((item) => item.stop);
  if (!location) return { available: false, reason: 'LOCATION_UNAVAILABLE', trip };
  if (!stops.length) return { available: false, reason: 'DESTINATION_UNAVAILABLE', trip, location };
  const point = { latitude: Number(location.latitude), longitude: Number(location.longitude) };
  let closest = 0; let closestDistance = Infinity;
  stops.forEach((stop, index) => { const value = distanceKm(point, stop); if (value < closestDistance) { closestDistance = value; closest = index; } });
  const atStop = closestDistance < 0.05;
  const nextIndex = Math.min(stops.length - 1, atStop ? closest + 1 : closest);
  let remainingDistanceKm = distanceKm(point, stops[nextIndex]);
  for (let index = nextIndex; index < stops.length - 1; index += 1) remainingDistanceKm += distanceKm(stops[index], stops[index + 1]);
  const speedKph = Number(location.speed) > 0 ? Number(location.speed) : trackingConfig().defaultSpeedKph;
  const remainingMinutes = remainingDistanceKm / speedKph * 60;
  const estimatedArrival = new Date(Date.now() + remainingMinutes * 60000);
  return { available: true, trip, location, nextStop: nextIndex < stops.length ? stops[nextIndex] : null, remainingDistanceKm, speedKph, remainingMinutes, estimatedArrival, delayed: trip.status === 'DELAYED' || estimatedArrival > trip.scheduledArrival };
}

function publicEta(result) {
  if (!result.available) return { available: false, reason: result.reason };
  return { available: true, tripId: result.trip.id, vehicleId: result.trip.vehicleId, routeId: result.trip.routeId, nextStop: result.nextStop && { id: result.nextStop.id, name: result.nextStop.name, latitude: result.nextStop.latitude, longitude: result.nextStop.longitude }, remainingDistanceKm: Number(result.remainingDistanceKm.toFixed(2)), estimatedRemainingMinutes: Number(result.remainingMinutes.toFixed(1)), estimatedArrival: result.estimatedArrival, scheduledArrival: result.trip.scheduledArrival, delayed: result.delayed, estimated: true, lastLocationAt: result.location.recordedAt };
}

module.exports = { calculateForTrip, publicEta };
