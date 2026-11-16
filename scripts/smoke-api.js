require('dotenv').config();

const app = require('../src/app');

async function main() {
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });

  try {
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;
    const checks = [
      ['/health', 200],
      ['/api/v1/routes', 200],
      ['/api/v1/admin/vehicles', 401],
    ];

    for (const [path, expectedStatus] of checks) {
      const response = await fetch(`${baseUrl}${path}`);
      if (response.status !== expectedStatus) throw new Error(`${path}: expected ${expectedStatus}, received ${response.status}`);
      console.log(`${path} -> ${response.status}`);
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
