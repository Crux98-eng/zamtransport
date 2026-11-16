const assert = require('node:assert/strict');
const test = require('node:test');
const schemas = require('../../src/validators/schedule-trip');

const validSchedule = {
  routeId: 1,
  departureTime: '08:00',
  estimatedDuration: 90,
  effectiveFrom: '2026-12-01',
  effectiveUntil: '2026-12-31',
  days: ['MONDAY', 'TUESDAY'],
};

test('schedule validation rejects invalid operating days and date ranges', () => {
  assert.throws(() => schemas.scheduleCreateSchema.parse({ ...validSchedule, days: ['MONDAY', 'MONDAY'] }));
  assert.throws(() => schemas.scheduleCreateSchema.parse({ ...validSchedule, effectiveUntil: '2026-11-30' }));
  assert.throws(() => schemas.scheduleCreateSchema.parse({ ...validSchedule, departureTime: '25:00' }));
});

test('trip generation requires a non-empty, ordered date range', () => {
  assert.throws(() => schemas.generateTripsSchema.parse({ scheduleId: 1, startDate: '2026-12-31', endDate: '2026-12-01' }));
  assert.throws(() => schemas.generateTripsSchema.parse({ startDate: 'not-a-date', endDate: '2026-12-01' }));
});

test('trip assignment IDs and cancellations are validated', () => {
  assert.throws(() => schemas.tripAssignmentSchema.parse({ driverId: 0, vehicleId: 1 }));
  assert.throws(() => schemas.tripCancelSchema.parse({ reason: '' }));
});
