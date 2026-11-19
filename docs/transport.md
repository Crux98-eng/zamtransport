# Phase 2 transport API

All administrator endpoints require `Authorization: Bearer <accessToken>` and
an `ADMIN` user. Public route and stop reads do not require authentication.
Responses use `{ success, message?, data?, code? }`.

## Users

`GET /api/v1/admin/users` supports `page`, `limit`, `search`, `status`, and
`dateFrom`/`dateTo`. `GET /api/v1/admin/users/pending` returns only pending
registrations. `GET /api/v1/admin/users/:id` returns one user.

`PATCH /api/v1/admin/users/:id` accepts `fullName`, `phoneNumber`,
`PATCH /:id/status` accepts `ACTIVE`, `INACTIVE`, or `SUSPENDED`, and
`PATCH /:id/role` accepts `ADMIN`, `DRIVER`, or `COMMUTER`.

Approval endpoints are `PATCH /:id/approve`, `PATCH /:id/reject` (optional
`reason`), `PATCH /:id/suspend`, and `PATCH /:id/reactivate`.

## Drivers

All routes are under `/api/v1/admin` and require `ADMIN`:

- `POST /drivers`: `fullName`, `email`, `password`, `confirmPassword`, `licenceNumber`, `licenceExpiry`; optional `phoneNumber`, `address`.
- `GET /drivers`: `page`, `limit`, `search` (name, email, licence).
- `GET /drivers/:id`, `PATCH /drivers/:id`, `PATCH /drivers/:id/status`.
- `GET /drivers/:id/trips`: paginated trip history.
- `GET /drivers/:id/assignments`: assignment history.

Driver creation uses an administrator-supplied strong password, hashes it with
bcrypt, and creates the user/profile in one transaction. Passwords are never
returned.

## Vehicles

- `POST /admin/vehicles`: `registrationNumber`, `vehicleType`, `capacity`; optional name, manufacturer, model, year, description.
- `GET /admin/vehicles`: `page`, `limit`, `search`, `status`, `vehicleType`.
- `GET/PATCH /admin/vehicles/:id`, `PATCH /admin/vehicles/:id/status`.
- `DELETE /admin/vehicles/:id`: refuses deletion when trips, locations, or maintenance history exists.
- `GET /admin/vehicles/:id/assignments`.

Capacity must be positive and manufacture year must be plausible. Vehicle
assignment requires `ACTIVE` status.

## Routes and stops

- Public: `GET /api/v1/routes`, `GET /api/v1/routes/:id`, `GET /api/v1/routes/:routeId/stops`, `GET /api/v1/stops`, `GET /api/v1/stops/:id`.
- Admin: `POST/PATCH/DELETE /api/v1/admin/routes`, `PATCH /admin/routes/:id/status`.
- Admin: `POST/PATCH/DELETE /api/v1/admin/stops`.
- Admin: `POST /admin/routes/:routeId/stops`, `PATCH /admin/routes/:routeId/stops/reorder`, `DELETE /admin/routes/:routeId/stops/:stopId`.

Route creation requires a name and distinct `originStopId` and
`destinationStopId` values. Route origin/destination names are taken from those
terminals; route responses include the selected terminals and their coordinates.
Existing routes remain readable without endpoint relations until they are
updated. Stop coordinates are validated as latitude `-90..90` and longitude
`-180..180`. Reordering is transactional and requires every route stop exactly
once with unique sequences.
Historical routes and stops cannot be deleted when operational relationships
exist.

## Assignments

- `POST /api/v1/admin/assignments`: `vehicleId`, `driverId`, optional `assignedAt`.
- `GET /api/v1/admin/assignments`, `GET /admin/assignments/:id`.
- `PATCH /api/v1/admin/assignments/:id/end`.

The API rejects inactive/maintenance vehicles, inactive drivers, and any active
vehicle or driver assignment conflict.

Errors use suitable `400`, `401`, `403`, `404`, `409`, or `500` status codes;
duplicate and relationship conflicts are returned as `409` responses.
