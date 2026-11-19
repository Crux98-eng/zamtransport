const AppError = require('../errors/app-error');

function orderedRouteStops(route) {
  const routeStops = (route.routeStops || [])
    .slice()
    .sort((a, b) => a.sequence - b.sequence)
    .map(({ stop, sequence }) => ({ ...stop, sequence }));
  const { originStop, destinationStop } = route;

  if (!originStop && !destinationStop) return routeStops;
  if (!originStop || !destinationStop) {
    throw new AppError(409, 'Route must have both endpoint terminals to generate a path.', 'ROUTE_ENDPOINTS_INCOMPLETE');
  }

  const endpointIds = new Set([originStop.id, destinationStop.id]);
  const intermediateStops = routeStops.filter((stop) => !endpointIds.has(stop.id));
  return [originStop, ...intermediateStops, destinationStop]
    .map((stop, index) => ({ ...stop, sequence: index + 1 }));
}

module.exports = { orderedRouteStops };
