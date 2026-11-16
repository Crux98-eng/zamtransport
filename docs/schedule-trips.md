# Phase 3: schedules and trips

Apply the Phase 3 migration, then regenerate Prisma's client before starting
the API:

```powershell
npm.cmd run db:deploy
npm.cmd run db:generate
npm.cmd test
```

All times supplied by schedule generation are interpreted in `Africa/Lusaka`
(UTC+02:00). A schedule's `departureTime` is `HH:mm` (or `HH:mm:ss`), its
operating `days` are uppercase weekday names, and `effectiveUntil` is optional.

## Administrator endpoints

Every endpoint below requires an active `ADMIN` bearer token.

- `POST /api/v1/admin/schedules`, `GET /api/v1/admin/schedules`
- `GET/PATCH/DELETE /api/v1/admin/schedules/:id`
- `PATCH /api/v1/admin/schedules/:id/status`
- `POST /api/v1/admin/trips/generate`
- `POST /api/v1/admin/trips`, `GET /api/v1/admin/trips`
- `GET/PATCH /api/v1/admin/trips/:id`
- `PATCH /api/v1/admin/trips/:id/assign`, `/status`, `/cancel`

Create a schedule:

```json
{
  "routeId": 1,
  "departureTime": "08:00",
  "estimatedDuration": 90,
  "days": ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"],
  "effectiveFrom": "2026-12-01",
  "effectiveUntil": "2026-12-31",
  "description": "Morning Lusaka to Kafue service"
}
```

Generate trips for one schedule or all active schedules (omit `scheduleId` for
all):

```json
{ "scheduleId": 1, "startDate": "2026-12-01", "endDate": "2026-12-31" }
```

The response includes `generated` and `skippedDuplicates`. A database unique
constraint on `(scheduleId, scheduledDeparture)` makes repeated generation
idempotent. Generation respects operating days and the schedule's effective
date window; inactive schedules cannot generate trips.

Assign a trip with:

```json
{ "driverId": 5, "vehicleId": 3 }
```

The driver must be an active `DRIVER`, the vehicle must be active and free of
pending/in-progress maintenance, and any current vehicle-driver pairing must
match. A driver and vehicle cannot overlap another operational trip.

Trip statuses follow this lifecycle:

`SCHEDULED → BOARDING → IN_PROGRESS → COMPLETED`

`SCHEDULED/BOARDING → DELAYED`, then `DELAYED → BOARDING/IN_PROGRESS`

`SCHEDULED/BOARDING → CANCELLED`

Boarding and starting require both driver and vehicle. Starting writes
`actualDeparture`; completing writes `actualArrival`. Cancellation requires a
reason and records the actor and timestamp. Delays retain original scheduled
times and can store `delayReason`, `revisedDeparture`, and `revisedArrival`.
Every creation and status transition receives an audit/history record.

List endpoints accept `page` and `limit` (maximum 100). Admin trip lists also
accept `routeId`, `scheduleId`, `driverId`, `vehicleId`, `tripStatus`,
`tripCode`, `from`, and `to`; schedule lists accept `routeId`, `status`, and
`search`.

## Driver endpoints

These require an active `DRIVER` bearer token and always derive the driver from
the token, never the request body:

- `GET /api/v1/driver/trips`
- `GET /api/v1/driver/trips/history`
- `GET /api/v1/driver/trips/:id`
- `PATCH /api/v1/driver/trips/:id/boarding`
- `PATCH /api/v1/driver/trips/:id/start`
- `PATCH /api/v1/driver/trips/:id/complete`

Drivers can view or transition only trips assigned to them.

## Public and commuter endpoints

No token is needed for active, upcoming information:

- `GET /api/v1/schedules`
- `GET /api/v1/routes/:routeId/schedules`
- `GET /api/v1/trips/upcoming`
- `GET /api/v1/trips/:id`
- `GET /api/v1/routes/:routeId/trips`
- `GET /api/v1/schedules/:scheduleId/trips`

`GET /api/v1/commuter/trips/upcoming` requires an active `COMMUTER` token.
Public trip representations include route stops and limited vehicle data, but
never driver contact details, cancellation actors, status history, or assignment
history.

## Error responses

Errors use `{ "success": false, "message": "…", "code": "…" }`. Common
codes include `VALIDATION_ERROR`, `SCHEDULE_INACTIVE`,
`TRIP_ASSIGNMENT_CONFLICT`, `TRIP_ASSIGNMENT_REQUIRED`, and
`INVALID_STATUS_TRANSITION`.
