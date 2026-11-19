const assert = require('node:assert/strict');
const test = require('node:test');
const { vehicleSchema, stopSchema, routeSchema, routePatchSchema, routeStopSchema, assignmentSchema } = require('../../src/validators/transport');

test('vehicle validation rejects zero capacity and invalid year', () => {
  assert.throws(() => vehicleSchema.parse({ registrationNumber: 'AB-123', vehicleType: 'BUS', capacity: 0, manufactureYear: 1800 }));
});

test('stop validation rejects coordinates outside geographic bounds', () => {
  assert.throws(() => stopSchema.parse({ name: 'Invalid', latitude: 91, longitude: 181 }));
});

test('route stop and assignment IDs must be positive integers', () => {
  assert.throws(() => routeStopSchema.parse({ stopId: 0, sequence: 1 }));
  assert.throws(() => assignmentSchema.parse({ vehicleId: 1, driverId: 0 }));
});

test('route endpoints require two different terminal IDs', () => {
  const route = { name: 'Lusaka to Ndola', originStopId: 1, destinationStopId: 2 };
  assert.deepEqual(routeSchema.parse(route), route);
  assert.throws(() => routeSchema.parse({ ...route, destinationStopId: 1 }));
  assert.throws(() => routePatchSchema.parse({ originStopId: 1 }));
  assert.throws(() => routePatchSchema.parse({ originStopId: 2, destinationStopId: 2 }));
});
