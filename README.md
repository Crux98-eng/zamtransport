# Zambia Transport API

Express + Prisma backend for the Smart Transport Monitoring and Route
Management System.

## Run

```powershell
npm.cmd install
npm.cmd run db:deploy
npm.cmd start
```

The API listens on `PORT` (default `3000`) and exposes `GET /health`.
Authentication and administrator bootstrap are documented in
[`docs/authentication.md`](docs/authentication.md). Core transport endpoints
are documented in [`docs/transport.md`](docs/transport.md), with an importable
Postman collection at
[`docs/postman/smart-transport-phase-2.postman_collection.json`](docs/postman/smart-transport-phase-2.postman_collection.json).

The project uses PostgreSQL because the configured Prisma connection is
PostgreSQL; the original design document's MySQL recommendation was adapted to
the actual connection provider.
