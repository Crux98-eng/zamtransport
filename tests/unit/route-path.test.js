const assert = require('node:assert/strict');
const test = require('node:test');
const { orderedRouteStops } = require('../../src/services/route-path');

const lusaka = { id: 1, name: 'Lusaka', latitude: -15.3875, longitude: 28.3228 };
const kafue = { id: 2, name: 'Kafue', latitude: -15.7691, longitude: 28.1814 };
const mazabuka = { id: 3, name: 'Mazabuka', latitude: -15.856, longitude: 27.748 };

test('route endpoints bracket ordered intermediate stops', () => {
  const stops = orderedRouteStops({
    originStop: lusaka,
    destinationStop: kafue,
    routeStops: [
      { sequence: 2, stop: mazabuka },
      { sequence: 1, stop: lusaka },
      { sequence: 3, stop: kafue },
    ],
  });

  assert.deepEqual(stops.map(({ id, sequence }) => ({ id, sequence })), [
    { id: lusaka.id, sequence: 1 },
    { id: mazabuka.id, sequence: 2 },
    { id: kafue.id, sequence: 3 },
  ]);
});

test('endpoint-only routes provide a two-point simulation path', () => {
  const stops = orderedRouteStops({
    originStop: lusaka,
    destinationStop: kafue,
    routeStops: [],
  });

  assert.deepEqual(stops.map(({ id }) => id), [lusaka.id, kafue.id]);
});

test('legacy routes without endpoint relations retain their ordered stops', () => {
  const stops = orderedRouteStops({
    routeStops: [
      { sequence: 2, stop: kafue },
      { sequence: 1, stop: lusaka },
    ],
  });

  assert.deepEqual(stops.map(({ id }) => id), [lusaka.id, kafue.id]);
});

test('route path rejects incomplete endpoint relations', () => {
  assert.throws(
    () => orderedRouteStops({ originStop: lusaka, destinationStop: null, routeStops: [] }),
    { code: 'ROUTE_ENDPOINTS_INCOMPLETE' },
  );
});
