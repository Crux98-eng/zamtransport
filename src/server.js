require('dotenv').config();

// Load environment variables before importing modules that use configuration.
const app = require('./app');
const { attachSocketServer } = require('./services/socket');
const simulation = require('./services/simulation');
const prisma = require('./lib/prisma');
const logger = require('./utils/logger');

// PORT is optional. When it is missing, the API uses port 3000.
const port = Number.parseInt(process.env.PORT, 10) || 3000;
const server = app.listen(port, () => {
  logger.info('API server started', { port, environment: process.env.NODE_ENV || 'development' });
});
attachSocketServer(server);
simulation.recoverAfterRestart().catch((error) => console.error('Could not reconcile simulations after restart:', error.message));

function stopServer(signal) {
  logger.info('shutdown requested', { signal });
  simulation.stopAll('APPLICATION_SHUTDOWN').finally(() => server.close(() => prisma.$disconnect().finally(() => process.exit(0))));
}

process.on('SIGINT', () => stopServer('SIGINT'));
process.on('SIGTERM', () => stopServer('SIGTERM'));
process.on('unhandledRejection', (error) => logger.error('unhandled promise rejection', { message: error?.message }));
process.on('uncaughtException', (error) => { logger.error('uncaught exception', { message: error?.message }); stopServer('UNCAUGHT_EXCEPTION'); });
