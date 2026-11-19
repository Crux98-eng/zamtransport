# Frontend API Contract

> **Contract version:** 1.0  
> **Canonical backend sources:** `src/app.js`, `src/routes/v1/`, and
> `src/validators/`. This document describes the API that is currently
> implemented, not planned features.

## Keeping this contract current

When an endpoint, query parameter, request field, response field, enum, or
authorization rule changes, update this document in the same change. Run:

```powershell
npm.cmd run contract:check
```

The command compares the literal Express routes with this document and fails
when a documented endpoint is missing. `npm test` also runs this check.

## Connection and conventions

Set the frontend API base URL to:

```text
http://localhost:3000/api/v1
```

Use `VITE_API_BASE_URL` (or the equivalent frontend environment variable) so
production can supply its own origin. The backend allows the comma-separated
origins in `CLIENT_URL`; browser requests from another origin will fail CORS.

Send JSON bodies and, for protected endpoints:

```http
Authorization: Bearer <accessToken>
Content-Type: application/json
```

All successful API responses use this envelope:

```json
{ "success": true, "message": "optional", "data": {} }
```

Errors use:

```json
{ "success": false, "message": "Human-readable explanation", "code": "MACHINE_CODE" }
```

Validation failures use HTTP `400`; missing records use `404`; invalid state,
duplicate, or allocation conflicts generally use `409`; missing/invalid tokens
use `401`; wrong roles or inactive users use `403`. Do not depend on every
error code being present—always display `message` safely.

Dates and timestamps are ISO-8601 strings in responses. Schedule dates are
calendar dates and schedule generation interprets departure times in
`Africa/Lusaka` (UTC+02:00). Time-only inputs use `HH:mm` or `HH:mm:ss`.

List responses include:

```json
{
  "pagination": { "page": 1, "limit": 20, "total": 42, "totalPages": 3 }
}
```

All lists default to `page=1`, `limit=20`; the maximum limit is `100`.

### Enums

| Field | Values |
| --- | --- |
| `role` | `ADMIN`, `DRIVER`, `COMMUTER` |
| user status | `PENDING`, `ACTIVE`, `REJECTED`, `INACTIVE`, `SUSPENDED` |
| vehicle status | `ACTIVE`, `INACTIVE`, `MAINTENANCE` |
| route/schedule status | `ACTIVE`, `INACTIVE` |
| weekdays | `MONDAY`, `TUESDAY`, `WEDNESDAY`, `THURSDAY`, `FRIDAY`, `SATURDAY`, `SUNDAY` |
| trip status | `SCHEDULED`, `BOARDING`, `IN_PROGRESS`, `COMPLETED`, `DELAYED`, `CANCELLED` |

## Endpoint directory

`Public` means no token. `Authenticated` accepts any active account. Role names
mean an active bearer token with that exact role is required.

### Service and authentication

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| GET | / | Public | Service metadata |
| GET | /health | Public | Health probe (`status`, `service`, `timestamp`) |
| GET | /api/v1 | Public | API metadata |
| POST | /api/v1/auth/register | Public | Register a pending commuter account |
| POST | /api/v1/auth/login | Public | Login and receive access/refresh tokens |
| POST | /api/v1/auth/refresh | Public | Rotate refresh token and receive new tokens |
| POST | /api/v1/auth/logout | Public | Revoke one refresh token |
| POST | /api/v1/auth/logout-all | Authenticated | Revoke all of the caller's refresh tokens |
| GET | /api/v1/auth/me | Authenticated | Current public user profile; driver includes `profile` |
| POST | /api/v1/auth/change-password | Authenticated | Change password and revoke all sessions |

### Public transport and traveller information

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| GET | /api/v1/routes | Public | Paginated active routes with endpoint terminals and coordinates |
| GET | /api/v1/routes/:routeId | Public | One active route with endpoint terminals, coordinates, and ordered `routeStops` |
| GET | /api/v1/routes/:routeId/stops | Public | Ordered stops for a route |
| GET | /api/v1/stops | Public | Paginated stops |
| GET | /api/v1/stops/:stopId | Public | Stop plus route relationships |
| GET | /api/v1/schedules | Public | Active current/future schedules |
| GET | /api/v1/routes/:routeId/schedules | Public | Active schedules for an active route |
| GET | /api/v1/trips/upcoming | Public | Upcoming published trips |
| GET | /api/v1/trips/:id | Public | One upcoming published trip |
| GET | /api/v1/routes/:routeId/trips | Public | Upcoming trips for an active route |
| GET | /api/v1/schedules/:scheduleId/trips | Public | Upcoming trips for an active schedule |
| GET | /api/v1/commuter/trips/upcoming | COMMUTER | Authenticated commuter view of upcoming trips |

Public trip data includes route, ordered route stops, schedule and limited
vehicle information. It intentionally omits driver details, cancellation actor,
status history, and assignment history.

### Admin user administration

All routes below require `ADMIN`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | /api/v1/admin/users | Paginated users |
| GET | /api/v1/admin/users/pending | Paginated pending users |
| GET | /api/v1/admin/users/:userId | One user |
| PATCH | /api/v1/admin/users/:userId | Update name/phone |
| PATCH | /api/v1/admin/users/:userId/approve | Approve a pending user |
| PATCH | /api/v1/admin/users/:userId/reject | Reject a pending user |
| PATCH | /api/v1/admin/users/:userId/suspend | Suspend an active user |
| PATCH | /api/v1/admin/users/:userId/reactivate | Reactivate inactive/suspended user |
| PATCH | /api/v1/admin/users/:userId/role | Change role |
| PATCH | /api/v1/admin/users/:userId/status | Set `ACTIVE`, `INACTIVE`, or `SUSPENDED` |

### Admin drivers, vehicles, routes, stops, and standing assignments

All routes below require `ADMIN`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | /api/v1/admin/drivers | Create active driver and driver profile |
| GET | /api/v1/admin/drivers | Paginated drivers |
| GET | /api/v1/admin/drivers/:driverId | One driver |
| PATCH | /api/v1/admin/drivers/:driverId | Update driver/account fields |
| PATCH | /api/v1/admin/drivers/:driverId/status | Set driver account status |
| GET | /api/v1/admin/drivers/:driverId/trips | Driver's trip history |
| GET | /api/v1/admin/drivers/:driverId/assignments | Driver's standing vehicle assignments |
| POST | /api/v1/admin/vehicles | Create vehicle |
| GET | /api/v1/admin/vehicles | Paginated vehicles |
| GET | /api/v1/admin/vehicles/:vehicleId | Vehicle, assignments, recent trips, maintenance |
| PATCH | /api/v1/admin/vehicles/:vehicleId | Update vehicle |
| PATCH | /api/v1/admin/vehicles/:vehicleId/status | Set vehicle status |
| DELETE | /api/v1/admin/vehicles/:vehicleId | Delete only with no historical records |
| GET | /api/v1/admin/vehicles/:vehicleId/assignments | Vehicle's standing assignments |
| POST | /api/v1/admin/routes | Create route |
| PATCH | /api/v1/admin/routes/:routeId | Update route |
| PATCH | /api/v1/admin/routes/:routeId/status | Set route status |
| DELETE | /api/v1/admin/routes/:routeId | Delete only with no trips |
| POST | /api/v1/admin/stops | Create stop |
| PATCH | /api/v1/admin/stops/:stopId | Update stop |
| DELETE | /api/v1/admin/stops/:stopId | Delete unused stop |
| POST | /api/v1/admin/routes/:routeId/stops | Attach a stop to a route |
| PATCH | /api/v1/admin/routes/:routeId/stops/reorder | Replace ordering for all route stops |
| DELETE | /api/v1/admin/routes/:routeId/stops/:stopId | Detach a stop |
| POST | /api/v1/admin/assignments | Create standing vehicle-driver assignment |
| GET | /api/v1/admin/assignments | Paginated standing assignments |
| GET | /api/v1/admin/assignments/:assignmentId | One standing assignment |
| PATCH | /api/v1/admin/assignments/:assignmentId/end | End standing assignment |

### Admin schedules and trips

All routes below require `ADMIN`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | /api/v1/admin/schedules | Create recurring schedule |
| GET | /api/v1/admin/schedules | Paginated schedules |
| GET | /api/v1/admin/schedules/:id | Schedule and recent trips |
| PATCH | /api/v1/admin/schedules/:id | Update schedule |
| PATCH | /api/v1/admin/schedules/:id/status | Activate/deactivate schedule |
| DELETE | /api/v1/admin/schedules/:id | Delete schedule with no trips |
| POST | /api/v1/admin/trips/generate | Generate idempotent schedule trips |
| POST | /api/v1/admin/trips | Create one individual trip |
| GET | /api/v1/admin/trips | Paginated trips |
| GET | /api/v1/admin/trips/:id | One trip, histories and relations |
| PATCH | /api/v1/admin/trips/:id | Update permitted trip fields/times |
| PATCH | /api/v1/admin/trips/:id/assign | Assign driver and vehicle |
| PATCH | /api/v1/admin/trips/:id/status | Controlled status transition/delay |
| PATCH | /api/v1/admin/trips/:id/cancel | Cancel with required reason |

### Driver trip operations

All routes below require `DRIVER`. The backend derives the driver identity from
the access token, so the frontend must never send a driver ID for these calls.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | /api/v1/driver/trips | Assigned scheduled and active trips (`includePast=true` includes old trips) |
| GET | /api/v1/driver/trips/history | Completed, cancelled, or past assigned trips |
| GET | /api/v1/driver/trips/:id | Assigned trip detail |
| PATCH | /api/v1/driver/trips/:id/accept | Accept a scheduled trip and move it to `BOARDING` |
| PATCH | /api/v1/driver/trips/:id/decline | Decline a scheduled trip with a reason |
| PATCH | /api/v1/driver/trips/:id/boarding | Transition to `BOARDING` |
| PATCH | /api/v1/driver/trips/:id/start | Transition to `IN_PROGRESS` and record actual departure |
| PATCH | /api/v1/driver/trips/:id/complete | Transition to `COMPLETED` and record actual arrival |

### Live vehicle tracking

Public location and ETA endpoints expose only currently trackable vehicles on
active routes. They never expose driver account data. Tracking history is
restricted to an administrator or the driver assigned to that trip.

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| GET | /api/v1/tracking/vehicles | Public | Latest location for each in-progress tracked vehicle |
| GET | /api/v1/tracking/vehicles/:vehicleId/location | Public | Latest location for an active vehicle |
| GET | /api/v1/tracking/trips/:tripId/location | Public | Latest location for a publicly trackable trip |
| GET | /api/v1/tracking/routes/:routeId/vehicles | Public | Current tracked vehicles on an active route |
| GET | /api/v1/tracking/trips/:tripId/eta | Public | Estimated arrival for a publicly trackable trip |
| GET | /api/v1/tracking/vehicles/:vehicleId/eta | Public | Estimated arrival for a publicly trackable vehicle |
| GET | /api/v1/tracking/trips/:tripId/history | ADMIN or assigned DRIVER | Paginated chronological location history |
| GET | /api/v1/driver/tracking/current | DRIVER | Assigned in-progress trip, latest location, and ETA |
| GET | /api/v1/admin/tracking/overview | ADMIN | Active trip/simulation counters and recent locations |
| GET | /api/v1/admin/tracking/vehicles/:vehicleId/history | ADMIN | Paginated vehicle location history |
| GET | /api/v1/admin/tracking/trips/:tripId/history | ADMIN | Paginated trip location history |
| POST | /api/v1/admin/tracking/simulations/start | ADMIN | Start a simulation for a trip |
| POST | /api/v1/admin/tracking/simulations/:tripId/stop | ADMIN | Stop one simulation |
| POST | /api/v1/admin/tracking/simulations/stop-all | ADMIN | Stop all in-memory simulations |
| GET | /api/v1/admin/tracking/simulations | ADMIN | Persisted simulations plus active in-memory tasks |
| GET | /api/v1/admin/tracking/simulations/:tripId | ADMIN | Simulation detail for a trip |

## Request contracts

Only send documented fields: body validators reject unknown fields on validated
write endpoints. `PATCH` resource bodies accept the listed fields as optional
unless noted otherwise. IDs are positive integers.

### Authentication and accounts

```ts
type RegisterBody = {
  fullName: string;                 // 2–150 chars
  email: string;
  phoneNumber?: string;
  password: StrongPassword;
  confirmPassword: string;
};
type LoginBody = { email: string; password: string };
type RefreshBody = { refreshToken: string };
type ChangePasswordBody = {
  currentPassword: string;
  newPassword: StrongPassword;
  confirmPassword: string;
};
type StrongPassword = string;       // 12–128 chars; lowercase, uppercase, number, symbol
```

`POST /auth/login` returns `data.user`, `data.accessToken`, and
`data.refreshToken`. Store tokens according to the frontend's security model;
send only the access token in the bearer header. `POST /auth/refresh` rotates
the refresh token—replace both saved tokens atomically. Registration always
creates `role: COMMUTER`, `status: PENDING` regardless of client input.

Admin user bodies:

```ts
type UserPatchBody = { fullName?: string; phoneNumber?: string | null };
type RejectBody = { reason?: string };
type RoleBody = { role: 'ADMIN' | 'DRIVER' | 'COMMUTER' };
type UserStatusBody = { status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' };
```

### Transport resources

```ts
type DriverCreateBody = {
  fullName: string; email: string; password: StrongPassword; confirmPassword: string;
  licenceNumber: string; licenceExpiry: string; phoneNumber?: string; address?: string;
};
type DriverPatchBody = {
  fullName?: string; phoneNumber?: string | null; address?: string | null;
  licenceNumber?: string; licenceExpiry?: string;
};
type VehicleBody = {
  registrationNumber: string; vehicleType: string; capacity: number;
  vehicleName?: string | null; manufacturer?: string | null; model?: string | null;
  manufactureYear?: number | null; description?: string | null;
};
type RouteBody = {
  name: string; originStopId: number; destinationStopId: number; routeCode?: string | null;
  description?: string | null; distanceKm?: number | null; estimatedDuration?: number | null;
};
type StopBody = { name: string; latitude: number; longitude: number; description?: string | null };
type RouteStopBody = { stopId: number; sequence: number; estimatedMinutesFromStart?: number | null };
type RouteStopReorderBody = { stops: Array<{ stopId: number; sequence: number }> };
type StandingAssignmentBody = { vehicleId: number; driverId: number; assignedAt?: string };
```

Vehicle statuses are `ACTIVE`, `INACTIVE`, or `MAINTENANCE`. Route statuses are
`ACTIVE` or `INACTIVE`. Driver status body uses active/inactive/suspended user
statuses. An active standing vehicle-driver pairing is required only when one
exists; conflicts return `409`.

### Schedule and trip resources

```ts
type ScheduleCreateBody = {
  routeId: number;
  departureTime: string;            // HH:mm or HH:mm:ss
  estimatedDuration: number;        // minutes, 1–1440
  effectiveFrom: string;            // calendar date
  effectiveUntil?: string | null;   // must not precede effectiveFrom
  days: DayOfWeek[];                // 1–7 unique values
  description?: string | null;
};
type SchedulePatchBody = Partial<ScheduleCreateBody> & {
  status?: 'ACTIVE' | 'INACTIVE';
};
type GenerateTripsBody = {
  scheduleId?: number;              // omit to generate every active schedule
  startDate: string;
  endDate: string;                  // on/after startDate
};
type TripCreateBody = {
  scheduleId: number;
  scheduledDeparture: string;
  scheduledArrival: string;         // after scheduledDeparture
  routeId?: number;                 // must equal the schedule route
  tripCode?: string | null;
  driverId?: number; vehicleId?: number; // send both or neither
};
type TripPatchBody = {
  tripCode?: string | null;
  scheduledDeparture?: string; scheduledArrival?: string;
  delayReason?: string | null;
  revisedDeparture?: string | null; revisedArrival?: string | null;
};
type TripAssignBody = { driverId: number; vehicleId: number };
type TripStatusBody = {
  status: TripStatus;
  reason?: string;                  // required if status is CANCELLED
  revisedDeparture?: string; revisedArrival?: string;
};
type TripCancelBody = { reason: string };
type StartSimulationBody = { tripId: number };
```

Trip transitions are: `SCHEDULED → BOARDING → IN_PROGRESS → COMPLETED`,
`SCHEDULED/BOARDING → DELAYED`, `DELAYED → BOARDING/IN_PROGRESS`, and
`SCHEDULED/BOARDING → CANCELLED`. Boarding/starting needs both assigned driver
and vehicle. A completed or cancelled trip cannot be changed or reassigned.

`POST /admin/trips/generate` returns:

```json
{
  "success": true,
  "data": { "schedulesProcessed": 1, "generated": 26, "skippedDuplicates": 0 }
}
```

Repeated generation is safe: the API skips existing `(scheduleId,
scheduledDeparture)` pairs.

Tracking history accepts `page`, `limit`, and optional ISO timestamp `from` and
`to` filters. A location response has `vehicleId`, `tripId`, `routeId`,
`latitude`, `longitude`, `speed`, `heading`, `isSimulated`, and `recordedAt`,
plus safe vehicle, route, and trip summaries. ETA responses return either
`{ available: false, reason }` or `available: true` with `nextStop`, remaining
distance/minutes, `estimatedArrival`, `scheduledArrival`, `delayed`, and
`lastLocationAt`. ETA values are estimates, never guarantees.

## Query contracts

| Endpoints | Supported query parameters |
| --- | --- |
| all paginated lists | `page`, `limit` |
| `GET /routes`, `GET /stops` | `search` |
| `GET /admin/users`, `/admin/users/pending` | `search`; users also accept `status`, `dateFrom`, `dateTo` |
| `GET /admin/drivers` | `search` (name, email, licence) |
| `GET /admin/vehicles` | `search`, `status`, `vehicleType` |
| `GET /admin/schedules` | `routeId`, `status`, `search` |
| `GET /admin/trips` | `routeId`, `scheduleId`, `driverId`, `vehicleId`, `tripStatus`, `tripCode`, `from`, `to` |
| public/commuter trip lists | `routeId`, `scheduleId`, `driverId`, `vehicleId`, `tripStatus`, `tripCode`, `from`, `to` (availability rules still apply) |
| `GET /driver/trips` | trip list filters above plus `includePast=true` |

## Frontend entity expectations

## Phase 5 and Phase 6 endpoints

All dashboard, reporting, system, and audit endpoints below require an active
administrator. Notification and session endpoints require the current active
user and are scoped to that user.

| Method | Endpoint |
| --- | --- |
| GET | /api/v1/auth/sessions |
| DELETE | /api/v1/auth/sessions/:sessionId |
| DELETE | /api/v1/auth/sessions |
| GET | /api/v1/admin/dashboard/overview |
| GET | /api/v1/admin/dashboard/trips |
| GET | /api/v1/admin/dashboard/fleet |
| GET | /api/v1/admin/dashboard/drivers |
| GET | /api/v1/admin/dashboard/routes |
| GET | /api/v1/admin/dashboard/operations |
| GET | /api/v1/admin/analytics/drivers |
| GET | /api/v1/admin/analytics/drivers/:driverId |
| GET | /api/v1/admin/analytics/vehicles |
| GET | /api/v1/admin/analytics/vehicles/:vehicleId |
| GET | /api/v1/admin/analytics/routes |
| GET | /api/v1/admin/analytics/routes/:routeId |
| POST | /api/v1/admin/reports/generate |
| GET | /api/v1/admin/reports |
| GET | /api/v1/admin/reports/:reportId |
| GET | /api/v1/admin/reports/:reportId/download |
| GET | /api/v1/notifications |
| GET | /api/v1/notifications/unread-count |
| GET | /api/v1/notifications/preferences |
| PATCH | /api/v1/notifications/preferences |
| PATCH | /api/v1/notifications/read-all |
| GET | /api/v1/notifications/:id |
| PATCH | /api/v1/notifications/:id/read |
| DELETE | /api/v1/notifications/:id |
| GET | /api/v1/admin/settings |
| PATCH | /api/v1/admin/settings |
| POST | /api/v1/admin/system/maintenance-mode |
| GET | /api/v1/admin/system/info |
| GET | /api/v1/admin/system/health |
| GET | /api/v1/admin/audit-logs |
| GET | /api/v1/admin/audit-logs/export |
| GET | /api/v1/admin/audit-logs/:id |
| GET | /api/v1/admin/users/:userId/activity |

`User` values never include a password hash. Public user fields are `id`,
`fullName`, `email`, `phoneNumber`, `role`, `status`, and lifecycle timestamps.
Driver details add `driverProfile`/`profile` with `licenceNumber`,
`licenceExpiry`, and `address`.

`Route` has `id`, `name`, `routeCode`, `origin`, `destination`, endpoint stop
IDs, and optional `originStop`/`destinationStop` relations containing terminal
coordinates. Legacy routes may lack those relations until updated. Route details
also use `routeStops`, each carrying `sequence`, `estimatedMinutesFromStart`,
and `stop`.

`Schedule` has `id`, `routeId`, `description`, `departureTime`,
`estimatedDuration`, `effectiveFrom`, `effectiveUntil`, `status`, timestamps,
and `days`. Admin schedule lists also include `_count.trips`.

`Trip` has `id`, `tripCode`, `scheduleId`, `routeId`, `vehicleId`, `driverId`,
scheduled/actual/revised timestamps, status, cancellation/delay fields, and
timestamps. Admin and driver trip detail responses may include `route`,
`schedule`, `vehicle`, `driver`, `cancelledBy`, `tripAssignments`, and
`statusHistory`. Render optional relations defensively.

`Vehicle` has registration, descriptive fields, `capacity`, `status`, and
timestamps. `Stop` has name, description, latitude, longitude, and timestamps.

## Suggested client behavior

- On `401`, clear the current session or attempt one refresh-token rotation,
  then redirect to sign-in if it fails.
- On `403`, show an authorization/account-status message; do not retry.
- On `409`, preserve the form and show the returned message—the user usually
  needs to resolve a conflict or refresh stale data.
- Refresh list/detail data after mutations instead of assuming server-calculated
  timestamps, trip codes, histories, or assignment state.
- Treat public schedules/trips as read-only and never assume driver data is
  present in those responses.
