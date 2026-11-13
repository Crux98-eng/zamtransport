const assert = require('node:assert/strict');
const test = require('node:test');

const app = require('../../src/app');

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
