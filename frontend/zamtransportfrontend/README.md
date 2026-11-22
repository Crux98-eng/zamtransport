# ZamTransport frontend

React, TypeScript, Vite, React Router, Axios, and TanStack Query client for the Zambia Transport Management System.

## Setup

```powershell
cd frontend/zamtransportfrontend
npm.cmd install
Copy-Item .env.example .env
npm.cmd run dev
```

The development UI runs on Vite's default `http://localhost:5173`. The API must allow that origin through its `CLIENT_URL` setting and be running before trying to sign in or register.

## Environment and commands

`VITE_API_BASE_URL` is the versioned API base URL. `VITE_SOCKET_URL` is the Socket.IO server origin. Neither variable contains a secret. The API uses bearer tokens and all signing secrets remain on the server.

```powershell
npm.cmd run dev
npm.cmd run build
npm.cmd run lint
npm.cmd run preview
```

## Authentication architecture

- `services/api.ts` owns the Axios instance, bearer header, API error parsing, one-flight refresh rotation, and authorization/account-status handling.
- `services/auth.ts` contains only API calls for the backend's supported auth endpoints: register, login, refresh, logout, logout-all, current user, and password change.
- `features/auth/AuthProvider.tsx` restores a saved session by calling `GET /auth/me`, exposes login/register/logout state, clears React Query and sockets on session end, and keeps the authoritative user record current.
- Tokens are stored as the backend requires: the existing API returns bearer access and refresh tokens in JSON rather than HttpOnly cookies. They are never logged or placed in Vite environment variables. A future cookie-based API can replace this storage without changing screens or guards.

## Flow and route protection

Commuter registration sends `fullName`, `email`, optional `phoneNumber`, `password`, and `confirmPassword` to `POST /auth/register`. Commuters verify their email before the account becomes active. Driver applications use `POST /auth/register/driver`, collect licence details, and remain pending for administrator approval after email verification. The UI provides verification and resend screens; only email-verified active accounts can receive tokens through `POST /auth/login`.

`GuestGuard` keeps signed-in users away from login and registration. `ProtectedRoute` requires an initialized, valid session, while `ApprovalGuard` blocks pending and non-active accounts. `RoleGuard` is used for the current administrator-only operational pages. `PermissionGuard` is available but no permissions field is currently returned by the backend, so it is deliberately not applied speculatively. Navigation follows the same role restrictions.

On a 401, a single request refreshes the session via `POST /auth/refresh` and replays the original request. If refresh fails, tokens and cached protected data are cleared and the user is returned to sign-in. Account-status 403 responses also clear the session; ordinary 403 permission denials do not.

TanStack Query is configured in `app/query-client.ts` with a 30-second stale time, bounded retries, and no retries for authorization, validation, or server errors. Queries that need authentication should be declared with `enabled: auth.phase === 'authenticated'`.

## Backend contract

The frontend expects `/api/v1` routes from this repository. In particular, authentication is bearer-token based and CORS must permit `CLIENT_URL`. There is no password-reset endpoint or permissions collection in the current API, so the client does not invent either feature.

## Application shell and navigation

Authenticated routes render in `AppShell`, which provides a collapsible desktop
sidebar, a mobile drawer, topbar, route-derived breadcrumbs, notification menu,
and user menu. The central configuration is in `src/app/navigation.ts`; it is
the single source of labels, paths, icons, role/permission requirements, and
breadcrumb labels.

Current working navigation destinations are Dashboard, Notifications, and My
Profile. Notifications use the authenticated `/notifications` and
`/notifications/unread-count` APIs, including mark-read actions. The backend
also supports operations, fleet, live tracking, user approval, audit, reports,
analytics, and settings endpoints, but their full management screens have not
been implemented. They are retained as documented future navigation candidates
and intentionally do not appear as placeholder links.
