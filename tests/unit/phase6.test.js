const assert = require('node:assert/strict');
const test = require('node:test');
const app = require('../../src/app');
const { TYPES } = require('../../src/services/notifications');

test('notification service exposes the supported notification categories', () => {
  assert.ok(TYPES.includes('USER_APPROVAL'));
  assert.ok(TYPES.includes('TRIP_CANCELLATION'));
  assert.ok(TYPES.includes('SYSTEM_ALERT'));
});

test('versioned public health endpoint exposes no diagnostics', async () => {
  const server = await new Promise((resolve) => { const value = app.listen(0, '127.0.0.1', () => resolve(value)); });
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/health`);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.status, 'ok');
    assert.equal('database' in body, false);
  } finally { await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
});

test('notification and system administration APIs require authentication', async () => {
  const server = await new Promise((resolve) => { const value = app.listen(0, '127.0.0.1', () => resolve(value)); });
  try {
    for (const path of ['/api/v1/notifications', '/api/v1/admin/settings', '/api/v1/auth/sessions']) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`);
      assert.equal(response.status, 401);
    }
  } finally { await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
});
