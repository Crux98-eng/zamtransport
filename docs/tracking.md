# Phase 4: vehicle tracking simulation

Phase 4 simulates GPS movement; it does not connect to physical tracking
hardware. It uses the route's ordered stop coordinates and great-circle
interpolation between consecutive stops. This is a geographic approximation,
not road geometry, so it must not be presented as a vehicle's exact route.

## Install and migrate

Stop any running Node API process first, then run:

```powershell
npm.cmd install
npm.cmd run db:deploy
npm.cmd run db:generate
npm.cmd test
npm.cmd start
```

The Phase 4 migration creates `tracking_simulations` and adds the
`vehicle_locations(tripId, recordedAt)` index. It preserves all existing
location data. The simulation service requires the generated Prisma client
before any tracking endpoint is called.

## Simulation lifecycle

An administrator can start a simulation with:

```http
POST /api/v1/admin/tracking/simulations/start
Authorization: Bearer <admin token>
Content-Type: application/json

{ "tripId": 25 }
```

The trip must be `IN_PROGRESS`, have both a driver and vehicle, and its route
must have at least two ordered stops. The service writes an initial location,
then controlled `setTimeout` ticks write/broadcast progress. Duplicate starts
are idempotent in a running process. Completing or cancelling a trip stops its
simulation automatically; completion writes a final destination coordinate.

At application startup, persisted `RUNNING` records are marked `STOPPED` with
reason `APPLICATION_RESTART`. Simulations are not automatically resumed after
a restart; an administrator must start eligible in-progress trips again. This
is deliberate because timers are in-memory and are not safe across multiple
application instances.

## Configuration

| Environment variable | Default | Allowed range | Meaning |
| --- | ---: | ---: | --- |
| `SIMULATION_UPDATE_INTERVAL_MS` | `10000` | 1000–300000 | Database/socket update period |
| `SIMULATION_SPEED_MULTIPLIER` | `1` | 0.1–100 | Multiplies simulated speed |
| `SIMULATION_DEFAULT_SPEED_KPH` | `35` | 1–160 | Speed when no location speed is available |
| `SIMULATION_STOP_DWELL_MS` | `5000` | 0–300000 | Pause at intermediate stops |
| `SIMULATION_MAX_CONCURRENT` | `20` | 1–200 | Per-process cap on simultaneous simulations |

For a visible demo, set `SIMULATION_SPEED_MULTIPLIER=20`. Keep the update
interval at several seconds to avoid unnecessary history writes.

## Socket.IO

Socket.IO is attached once to the server used by Express. Connect with an
active JWT in either `auth.token` or `Authorization: Bearer <token>`:

```js
import { io } from 'socket.io-client';
const socket = io(API_ORIGIN, { auth: { token: accessToken } });
socket.emit('tracking:subscribe:trip', { tripId: 25 }, console.log);
socket.on('vehicle:location:update', (location) => renderLocation(location));
```

Available subscription events:

- `tracking:subscribe:trip` with `{ tripId }`
- `tracking:subscribe:route` with `{ routeId }`

Administrators automatically join `tracking:admin`; authorized subscriptions
join `tracking:trip:{tripId}` and `tracking:route:{routeId}`. Drivers may only
subscribe to assigned active trips/routes; commuters may subscribe only to
publicly trackable trips and active routes. Invalid or inactive accounts are
rejected during the socket handshake.

Location event payload:

```json
{
  "vehicleId": 10,
  "tripId": 25,
  "routeId": 3,
  "latitude": -15.4167,
  "longitude": 28.2833,
  "speed": 35,
  "heading": 120,
  "isSimulated": true,
  "recordedAt": "2026-12-01T08:15:00.000Z"
}
```

## Tracking and ETA endpoints

See [frontend-contract.md](frontend-contract.md) for the full endpoint and
response contract. Public endpoints return only active-route, non-sensitive
vehicle/trip information. History endpoints require an administrator or the
trip's assigned driver. The ETA uses the latest position, remaining stop
segments, and simulated/default speed. It responds with `available: false`
when a location or destination is unavailable rather than inventing an ETA.

## Limits

- No physical GPS ingestion is implemented.
- Road geometry, traffic, and actual dwell time are not modelled.
- There is no distributed lock or job queue: multi-instance deployments must
  replace the in-memory timer manager with shared coordination before use.
- Notifications occur for trip lifecycle events, not every location tick.
