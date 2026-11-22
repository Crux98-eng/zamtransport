# Phase 6 operations, notifications, and security

## Notifications

Authenticated users can use `GET /api/v1/notifications`, `GET /:id`,
`PATCH /:id/read`, `PATCH /read-all`, `DELETE /:id`, `GET /unread-count`, and
`GET/PATCH /preferences`. List filters are `type`, `read=true|false`, `page`,
and `limit`. Records are always scoped to the authenticated user.

Supported categories: `USER_APPROVAL`, `USER_REJECTION`, `TRIP_ASSIGNMENT`,
`TRIP_BOARDING`, `TRIP_DEPARTURE`, `TRIP_DELAY`, `TRIP_CANCELLATION`,
`TRIP_COMPLETION`, `VEHICLE_MAINTENANCE`, `SYSTEM_ALERT`, and `GENERAL`.
Repeated operational notifications use database-enforced deduplication keys.

Socket clients are authenticated with the existing JWT flow and automatically
join only `notifications:user:<their-id>`. Listen for `notification:new`,
`notification:read`, and `notification:unread-count`.

Resend is preferred for transactional email. Set backend-only `RESEND_API_KEY`,
`EMAIL_FROM`, and `FRONTEND_URL`; verify the sender domain in Resend. The existing
`SMTP_*` settings remain a fallback for notification email. Users must opt in to
optional notification mail with `emailEnabled`; mandatory verification and driver
decision emails do not depend on that preference. Provider acceptance and failures
are logged without token values. Acceptance is not proof of inbox delivery.

## Administration

Active administrators can access:

- `GET/PATCH /api/v1/admin/settings`
- `POST /api/v1/admin/system/maintenance-mode`
- `GET /api/v1/admin/system/info` and `/system/health`
- `GET /api/v1/admin/audit-logs`, `/:id`, and `/export`
- `GET /api/v1/admin/users/:id/activity`

Settings are allow-listed, validated, persisted in `system_settings`, and
audited. Maintenance mode returns `503` for public API endpoints while leaving
health, auth, and admin recovery paths available. `GET /health` and
`GET /api/v1/health` are deliberately minimal; the administrator health route
includes database timing, Socket.IO attachment, email configuration state, and
simulation count.

Sessions use hashed refresh tokens. Users can list sessions with
`GET /api/v1/auth/sessions`, revoke one with `DELETE /sessions/:id`, or revoke
all with `DELETE /sessions`. No endpoint returns refresh-token hashes.

## Security and remaining limitations

The API uses Helmet, explicit CORS origins, body-size limits, Zod validation,
rate-limited authentication, hashed passwords, active-account verification,
rotating refresh tokens with replay handling, and role/ownership checks.
Audit records omit passwords and tokens. The socket service uses one server
instance and validated rooms.

GPS simulation, email delivery, and report generation remain in-process. They
are safe to stop/reconcile on restart but are not a durable distributed job
queue; use external workers/queues before horizontally scaling. Email sending has
no durable retry queue or bounce webhook integration. Run `npm audit` during dependency maintenance; its output
depends on the installed dependency tree.

## Deployment and recovery

Use Node 24+ with HTTPS terminated by the hosting platform or reverse proxy.
The Express app trusts exactly one proxy hop for `req.ip`, matching Render's
edge proxy and allowing rate limits to key on the originating client address.
Do not increase this trust count unless the deployed proxy topology requires it.
For Render, set the backend `DATABASE_URL`, token secrets, `CLIENT_URL` to the
Vercel origin, `FRONTEND_URL` to the Vercel origin, `RESEND_API_KEY`, and
`EMAIL_FROM`; verify the sender domain in Resend, then deploy with
`npm ci`, `npm run db:deploy`, and `npm start`. For Vercel, set only
`VITE_API_BASE_URL` and `VITE_SOCKET_URL` for the Render API; never add
`RESEND_API_KEY` to frontend/build variables. Redeploy the frontend after
changing Vite environment variables because they are embedded at build time.
Configure a writable `LOG_FILE` for persistent structured logs. Never commit
`.env`.

For Resend, use a current API key created in the correct Resend account and a
sender such as `Zambia Transport <verified-address@your-domain>` whose domain is
verified in Resend. Set both values in the Render backend environment, save, and
redeploy/restart the service so the process loads the new key. Keep the key out
of Vercel and source control. Failed sends are logged with safe provider metadata;
they are not reported as accepted.

This deployment uses PostgreSQL (the configured Prisma provider), not MySQL.
Before a migration, take a tested PostgreSQL backup, for example:

```sh
pg_dump --format=custom --file=transport-before-migration.dump "$DATABASE_URL"
```

Run encrypted daily backups with at least 30 days retention and regularly test
restores in an isolated database. Restore with
`pg_restore --clean --if-exists --dbname="$DATABASE_URL" backup.dump` only
after explicitly confirming the target is safe to replace. Keep report files
in the backup plan separately from the database.
