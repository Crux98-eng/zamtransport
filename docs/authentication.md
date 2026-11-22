# Authentication API

Authentication uses bearer access tokens. Access tokens expire quickly; refresh
tokens are returned in the login response, stored only as SHA-256 hashes, and
rotated on every refresh. A revoked refresh token cannot be reused.

Endpoints:

- `POST /api/v1/auth/register` — creates an unverified `COMMUTER` and emails a one-time verification link.
- `POST /api/v1/auth/register/driver` — creates an unverified, pending `DRIVER` application and driver profile.
- `POST /api/v1/auth/verify-email` — consumes a single-use token; verified commuters become `ACTIVE`, verified drivers remain `PENDING`.
- `POST /api/v1/auth/resend-verification` — requests another link; returns a generic response and is rate limited.
- `POST /api/v1/auth/login` — authenticates only verified `ACTIVE` users.
- `POST /api/v1/auth/refresh` — rotates a refresh token.
- `POST /api/v1/auth/logout` — revokes one refresh session.
- `POST /api/v1/auth/logout-all` — revokes all sessions for the bearer user.
- `POST /api/v1/auth/change-password` — changes the password and revokes sessions.
- `GET /api/v1/auth/me` — returns current database-backed user information.

Administrator approval endpoints are under `/api/v1/admin/users`:

- `GET /pending`
- `PATCH /:userId/approve`
- `PATCH /:userId/reject`
- `PATCH /:userId/suspend`
- `PATCH /:userId/reactivate`
- `GET /` and `GET /:userId`
- `PATCH /:userId`, `PATCH /:userId/role`, `PATCH /:userId/status`

Only email-verified pending applications are shown to administrators. Driver approval
or rejection remains a separate admin action; verification never approves a driver.
Approval/rejection notification email is attempted only after the database action
commits. The API reports whether the provider accepted the message, not inbox delivery.

Verification tokens use 32 cryptographically random bytes; only SHA-256 hashes are
stored. Links expire after 30 minutes, previous links are invalidated on resend,
and resend requests have both per-IP rate limits and a per-account cooldown.

Set `RESEND_API_KEY`, `EMAIL_FROM`, and `FRONTEND_URL` on the backend. `FRONTEND_URL`
is the public frontend origin used in email links; `CLIENT_URL` is used as a
backwards-compatible fallback and remains the API CORS setting. Resend is preferred.
Existing `SMTP_*` settings remain as a fallback. Never put `RESEND_API_KEY` in any
`VITE_*` variable or frontend deployment environment. Verify the sender domain in
Resend before testing delivery.

For local testing, use the same local origin for `FRONTEND_URL` and `CLIENT_URL`
(`http://localhost:5173`), apply migrations with `npm run db:deploy`, start the API
and Vite frontend, and register commuter and driver test accounts. The confirmation
page provides a generic resend flow for missing or expired links. Resend's API
acceptance does not guarantee inbox delivery; check the Resend dashboard and spam
folder when testing.

Every protected request loads the user from the database and checks that the
current status is `ACTIVE`; a status embedded in a JWT is never trusted.

Bootstrap the first administrator once, using environment variables and no
credentials in source control:

```powershell
$env:ADMIN_NAME = 'System Administrator'
$env:ADMIN_EMAIL = 'admin@example.com'
$env:ADMIN_PASSWORD = 'use-a-unique-strong-password'
npm.cmd run db:seed
Remove-Item Env:ADMIN_NAME,Env:ADMIN_EMAIL,Env:ADMIN_PASSWORD
```

The seed script exits without changing an existing administrator.
`npm.cmd run db:bootstrap-admin` is an explicit alias for the same one-time
bootstrap operation. It fails when the required credentials are missing rather
than silently creating no administrator.

To deliberately reset the existing bootstrap administrator password, set the
explicit flag for one command:

```powershell
$env:RESET_ADMIN_PASSWORD = 'true'
npm.cmd run db:bootstrap-admin
Remove-Item Env:RESET_ADMIN_PASSWORD
```

This uses the current `ADMIN_PASSWORD`, revokes existing refresh sessions, and
records an audit event.
