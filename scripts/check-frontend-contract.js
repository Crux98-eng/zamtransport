const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const contract = fs.readFileSync(path.join(root, 'docs', 'frontend-contract.md'), 'utf8')
  .replaceAll('`', '')
  .replaceAll('|', ' ')
  .replace(/\s+/g, ' ');
const sources = [
  { file: 'src/routes/v1/auth.js', prefixes: { router: '/api/v1/auth' } },
  { file: 'src/routes/v1/admin-users.js', prefixes: { router: '/api/v1/admin/users' } },
  { file: 'src/routes/v1/transport.js', prefixes: { adminRouter: '/api/v1/admin', publicRouter: '/api/v1' } },
  { file: 'src/routes/v1/schedule-trip.js', prefixes: { adminRouter: '/api/v1/admin', driverRouter: '/api/v1/driver', commuterRouter: '/api/v1/commuter', publicRouter: '/api/v1' } },
  { file: 'src/routes/v1/tracking.js', prefixes: { adminRouter: '/api/v1/admin', driverRouter: '/api/v1/driver', publicRouter: '/api/v1' } },
  { file: 'src/routes/v1/dashboard.js', prefixes: { adminRouter: '/api/v1/admin' } },
  { file: 'src/routes/v1/notifications.js', prefixes: { router: '/api/v1/notifications' } },
  { file: 'src/routes/v1/admin-system.js', prefixes: { router: '/api/v1/admin' } },
];
const endpoints = ['GET /', 'GET /health', 'GET /api/v1'];

for (const source of sources) {
  const text = fs.readFileSync(path.join(root, source.file), 'utf8');
  const pattern = /(adminRouter|publicRouter|driverRouter|commuterRouter|router)\.(get|post|patch|delete)\(\s*'([^']+)'/g;
  for (const match of text.matchAll(pattern)) {
    const endpoint = `${match[2].toUpperCase()} ${source.prefixes[match[1]]}${match[3]}`.replace(/\/$/, '');
    endpoints.push(endpoint || `${match[2].toUpperCase()} /`);
  }
}

// These are registered from the controlled lifecycle loop rather than literals.
endpoints.push(
  'PATCH /api/v1/driver/trips/:id/boarding',
  'PATCH /api/v1/driver/trips/:id/start',
  'PATCH /api/v1/driver/trips/:id/complete',
);

const missing = [...new Set(endpoints)].filter((endpoint) => !contract.includes(endpoint));
if (missing.length) {
  console.error('Frontend contract is missing endpoint(s):\n' + missing.map((item) => `- ${item}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Frontend contract covers ${new Set(endpoints).size} endpoints.`);
}
