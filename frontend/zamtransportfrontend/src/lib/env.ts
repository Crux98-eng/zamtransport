// Environment values used to find the backend HTTP API and Socket.IO server.
// Vite reads VITE_* values at build time; localhost is the development default.
export const env = { apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000/api/v1', socketUrl: import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:5000' }

// export const env = { apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? 'https://zambia-transport-api.onrender.com/api/v1', socketUrl: import.meta.env.VITE_SOCKET_URL ?? 'https://zambia-transport-api.onrender.com' }
