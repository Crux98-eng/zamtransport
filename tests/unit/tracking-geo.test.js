const assert = require('node:assert/strict');
const test = require('node:test');
const { bearing, distanceKm, interpolate } = require('../../src/services/geo');

const lusaka = { latitude: -15.3875, longitude: 28.3228 };
const kafue = { latitude: -15.7691, longitude: 28.1814 };

test('great-circle interpolation remains between route stop coordinates', () => {
  const midpoint = interpolate(lusaka, kafue, 0.5);
  const total = distanceKm(lusaka, kafue);
  assert.ok(total > 0);
  assert.ok(Math.abs(distanceKm(lusaka, midpoint) - total / 2) < 0.05);
  assert.ok(Math.abs(distanceKm(midpoint, kafue) - total / 2) < 0.05);
});

test('coordinate interpolation clamps endpoints and calculates a compass heading', () => {
  assert.deepEqual(interpolate(lusaka, kafue, -1), lusaka);
  assert.deepEqual(interpolate(lusaka, kafue, 2), kafue);
  assert.ok(bearing(lusaka, kafue) >= 0 && bearing(lusaka, kafue) < 360);
});
