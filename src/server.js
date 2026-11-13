require('dotenv').config();

const app = require('./app');

const port = Number.parseInt(process.env.PORT, 10) || 3000;
const server = app.listen(port, () => {
  console.log(`Zambia Transport API listening on port ${port}`);
});

function stopServer(signal) {
  console.log(`${signal} received; shutting down.`);
  server.close(() => process.exit(0));
}

process.on('SIGINT', () => stopServer('SIGINT'));
process.on('SIGTERM', () => stopServer('SIGTERM'));
