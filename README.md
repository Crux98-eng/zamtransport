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

Phase 3 schedule and trip management is documented in
[`docs/schedule-trips.md`](docs/schedule-trips.md), with a Postman collection at
[`docs/postman/smart-transport-phase-3.postman_collection.json`](docs/postman/smart-transport-phase-3.postman_collection.json).

## Frontend integration contract

The complete, implementation-backed frontend contract—authentication, roles,
all endpoints, request/query bodies, response conventions, enums, and client
error behavior—is in [docs/frontend-contract.md](docs/frontend-contract.md).
Run `npm.cmd run contract:check` after changing routes; `npm.cmd test` performs
this check automatically so the contract remains aligned with implemented
endpoints.

Phase 4 simulated vehicle tracking, live Socket.IO updates, and ETA behaviour
are documented in [docs/tracking.md](docs/tracking.md), with a Phase 4
[Postman collection](docs/postman/smart-transport-phase-4.postman_collection.json).

The project uses PostgreSQL because the configured Prisma connection is
PostgreSQL; the original design document's MySQL recommendation was adapted to
the actual connection provider.

Phase 5 administrator dashboards, analytics, PDF/XLSX/CSV reports, reporting
timezone, metric definitions, file retention, and real-time dashboard events
are documented in [`docs/dashboard-reporting.md`](docs/dashboard-reporting.md).
Apply the Phase 5 migration before use with `npm.cmd run db:deploy`.
An importable Phase 5 Postman collection is at
[`docs/postman/smart-transport-phase-5.postman_collection.json`](docs/postman/smart-transport-phase-5.postman_collection.json).

Phase 6 notification, administration, health, security, deployment, and backup
guidance is in [`docs/operations.md`](docs/operations.md). Copy `.env.example`
to `.env` and provide production secrets only through deployment configuration.
The Phase 6 Postman collection is
[`docs/postman/smart-transport-phase-6.postman_collection.json`](docs/postman/smart-transport-phase-6.postman_collection.json).
