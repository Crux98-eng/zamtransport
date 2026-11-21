// Convert validation, database, and application errors into JSON API responses.
const { ZodError } = require('zod');
const logger = require('../utils/logger');

function notFound(_request, response) {
  response.status(404).json({ success: false, message: 'Route not found.' });
}

function errorHandler(error, _request, response, _next) {
  if (error instanceof ZodError) return response.status(400).json({ success: false, message: 'Validation failed.', errors: error.issues });
  if (error.code === 'P2002') return response.status(409).json({ success: false, message: 'A record with that value already exists.', code: 'DUPLICATE_RECORD' });
  const status = error.statusCode || 500;
  if (status >= 500) logger.error('unhandled API error', { name: error.name, message: error.message, code: error.code });
  response.status(status).json({ success: false, message: status >= 500 ? 'An unexpected error occurred.' : error.message, code: error.code });
}

module.exports = { errorHandler, notFound };
