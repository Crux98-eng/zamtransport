// Validate request JSON against a Zod schema before the route handler runs.
const AppError = require('../errors/app-error');

module.exports = (schema) => (request, _response, next) => {
  const result = schema.safeParse(request.body);
  if (!result.success) return next(new AppError(400, 'Validation failed.', 'VALIDATION_ERROR'));
  request.body = result.data;
  next();
};
