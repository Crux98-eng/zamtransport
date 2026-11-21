// Wrap async route handlers so rejected promises reach Express error handling.
module.exports = (handler) => (request, response, next) => {
  Promise.resolve(handler(request, response, next)).catch(next);
};
