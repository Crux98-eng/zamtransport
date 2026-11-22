const assert = require('node:assert/strict');
const test = require('node:test');

const app = require('../../src/app');

test('Render proxy IP is used as the rate-limit client key', async () => {
  assert.equal(app.get('trust proxy'), 1);
  const server = await new Promise((resolve) => {
    const httpServer = app.listen(0, '127.0.0.1', () => resolve(httpServer));
  });

  try {
    const { port } = server.address();
    const request = (ip) => fetch(`http://127.0.0.1:${port}/api/v1/auth/__proxy-test`, {
      headers: { 'x-forwarded-for': ip },
    });
    const statuses = [];
    for (let index = 0; index < 11; index += 1) {
      statuses.push((await request('203.0.113.251')).status);
    }

    assert.deepEqual(statuses.slice(0, 10), Array(10).fill(404));
    assert.equal(statuses[10], 429);
    assert.equal((await request('203.0.113.252')).status, 404);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test('GET /health returns service health', async () => {
  const server = await new Promise((resolve) => {
    const httpServer = app.listen(0, '127.0.0.1', () => resolve(httpServer));
  });

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.status, 'ok');
    assert.equal(body.service, 'zambia-transport-api');
    assert.ok(Number.isFinite(Date.parse(body.timestamp)));
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
