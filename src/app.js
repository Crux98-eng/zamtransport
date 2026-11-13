const express = require('express');

const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_request, response) => {
  response.status(200).json({
    status: 'ok',
    service: 'zambia-transport-api',
    timestamp: new Date().toISOString(),
  });
});

app.use((_request, response) => {
  response.status(404).json({
    error: 'Not Found',
  });
});

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({
    error: 'Internal Server Error',
  });
});

module.exports = app;
