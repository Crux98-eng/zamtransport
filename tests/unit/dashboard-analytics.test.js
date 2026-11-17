const assert = require('node:assert/strict');
const test = require('node:test');
const app = require('../../src/app');
const { dateRange } = require('../../src/services/analytics');

test('analytics custom ranges are Lusaka closed-open calendar periods', () => {
  const range = dateRange({ startDate: '2026-11-01', endDate: '2026-11-30' });
  assert.equal(range.startDate, '2026-11-01');
  assert.equal(range.endDate, '2026-11-30');
  assert.equal(range.end.getTime() - range.start.getTime(), 30 * 86400000);
  assert.equal(range.timeZone, 'Africa/Lusaka');
});

test('analytics reject incomplete and inverted date ranges', () => {
  assert.throws(() => dateRange({ startDate: '2026-11-01' }), { code: 'VALIDATION_ERROR' });
  assert.throws(() => dateRange({ startDate: '2026-11-30', endDate: '2026-11-01' }), { code: 'VALIDATION_ERROR' });
});

test('dashboard requires an authenticated administrator', async () => {
  const server = await new Promise((resolve) => { const value = app.listen(0, '127.0.0.1', () => resolve(value)); });
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/admin/dashboard/overview`);
    const body = await response.json();
    assert.equal(response.status, 401);
    assert.equal(body.code, 'UNAUTHENTICATED');
  } finally { await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
});
