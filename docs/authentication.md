# Authentication API

Authentication uses bearer access tokens. Access tokens expire quickly; refresh
tokens are returned in the login response, stored only as SHA-256 hashes, and
rotated on every refresh. A revoked refresh token cannot be reused.

Endpoints:

- `POST /api/v1/auth/register` — creates a `COMMUTER` with `PENDING` status.
- `POST /api/v1/auth/login` — authenticates only `ACTIVE` users.
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
