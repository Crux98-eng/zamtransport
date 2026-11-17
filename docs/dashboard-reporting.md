# Dashboard, analytics, and reporting

Every endpoint in this document requires an `Authorization: Bearer <access-token>`
header for an **ACTIVE ADMIN** account. Responses use `{ success: true, data }`.

## Dashboard

- `GET /api/v1/admin/dashboard/overview` returns live user, driver, vehicle, trip, and route counts.
- `GET /api/v1/admin/dashboard/trips`, `/fleet`, `/drivers`, `/routes`, and `/operations` return the corresponding analytics.

## Performance analytics

- `GET /api/v1/admin/analytics/drivers` and `/:driverId`
- `GET /api/v1/admin/analytics/vehicles` and `/:vehicleId`
- `GET /api/v1/admin/analytics/routes` and `/:routeId`

List endpoints support `page`, `limit`, `sortBy`, and `sortOrder=asc|desc`.

## Date filters and metric definitions

Analytics and reports accept either `period=today|yesterday|last7days|last30days|thismonth|previousmonth`, or both `startDate=YYYY-MM-DD` and `endDate=YYYY-MM-DD`. Dates use `Africa/Lusaka` and a closed-open `[start, day-after-end)` interval. Trip analytics filter by **scheduledDeparture**; user reports use `createdAt`; maintenance reports use `maintenanceDate`. Actual timestamps are used only for journey and arrival/delay calculations.

Completion rate is completed / all selected trips. Journey duration is `actualArrival - actualDeparture`, omitted when unavailable. Utilization is the union of each vehicle's trip intervals (actual timestamps where both exist, otherwise scheduled timestamps) / reporting-period minutes, capped at 100%; overlapping trips are merged rather than counted twice. GPS distance sums consecutive points; segments over 5km are excluded as discontinuities.

## Reports

`POST /api/v1/admin/reports/generate` supports `VEHICLE_UTILIZATION`, `DRIVER_PERFORMANCE`, `TRIP_COMPLETION`, `ROUTE_PERFORMANCE`, `TRIP_DELAYS`, `VEHICLE_MAINTENANCE`, `FLEET_OPERATIONAL`, and `USER_REGISTRATION`, in `PDF`, `XLSX`, or `CSV`.

```json
{ "reportType": "TRIP_COMPLETION", "format": "XLSX", "startDate": "2026-11-01", "endDate": "2026-11-30" }
```

Use `GET /api/v1/admin/reports`, `GET /api/v1/admin/reports/:id`, and `GET /api/v1/admin/reports/:id/download` to manage reports. Files reside in `storage/reports`, not PostgreSQL, and records/files older than 30 days are removed during a later report generation.

## Socket.IO

Authenticated admins in `tracking:admin` receive `dashboard:trip:updated`, `dashboard:vehicle:updated`, `dashboard:driver:updated`, and `dashboard:operations:updated`. Each event is a small ID/status/change payload with `occurredAt`; refresh the corresponding widget.
