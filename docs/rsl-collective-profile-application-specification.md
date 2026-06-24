# RSL Collective Dashboard Specification

## Scope

The dashboard lets one authenticated publisher user create and maintain one publisher company profile. The app does not migrate old provider users or old D1 data.

## Architecture

- React + TypeScript frontend.
- Vite build.
- React Router routes for `/login`, `/register`, `/logout`, and `/dashboard/*`.
- Clerk React components for sign-in and sign-up.
- Clerk-native browser sessions.
- Clerk frontend `getToken()` sends `Authorization: Bearer <token>` to Worker APIs.
- Cloudflare Worker + Hono backend.
- Worker API routes verify Clerk tokens with `@clerk/backend` `verifyToken()`.
- D1 stores app-owned `users` and `companies` records.
- No local D1 session table.
- No app-owned OAuth callback or code-exchange flow.
- No Clerk Organizations in this phase.

## Routes

- `GET /login`: React route rendering Clerk sign-in.
- `GET /register`: React route rendering Clerk sign-up.
- `GET /logout`: React route that calls Clerk `signOut()` and redirects to `/login`.
- `GET /dashboard/*`: authenticated dashboard UI.
- `GET /api/session`: returns the stable dashboard session contract.
- `GET /api/company`: returns the authenticated user's company profile or `null`.
- `PUT /api/company`: creates or updates the authenticated user's company profile.

`/auth/callback` is not used.

## Session Contract

`GET /api/session` returns:

```json
{ "authenticated": false }
```

or:

```json
{
  "authenticated": true,
  "user": {
    "email": "publisher@example.com",
    "firstName": "Jane",
    "lastName": "Publisher",
    "role": "owner",
    "hasCompany": false
  }
}
```

The response must not expose provider IDs, token claims, raw tokens, or internal D1 IDs.

## Identity Mapping

Local users are keyed by the provider-neutral columns:

- `auth_provider = "clerk"`
- `auth_subject = <Clerk user id from session token sub>`

Users must not be keyed by email address.

## Environment

Frontend:

```sh
VITE_CLERK_PUBLISHABLE_KEY=<Clerk publishable key>
```

Worker:

```sh
CLERK_SECRET_KEY=<Clerk secret key>
CLERK_AUTHORIZED_PARTIES=<comma-separated allowed origins>
DASHBOARD_BASE_URL=<dashboard origin>
ENVIRONMENT=development|production
```

`CLERK_SECRET_KEY` must never be exposed to React. `CLERK_JWT_KEY` is optional and should only be added if networkless verification is required.

## Database

The baseline D1 schema contains:

- `companies`
- `users`

`users.auth_provider` and `users.auth_subject` have a unique index. `users.company_id` links a user to one company.

Current local and production data can be reset; no old provider migration is required.

## Required Tests

- Clerk token extraction and verification options.
- Clerk user-to-D1 identity mapping.
- `/api/session` unauthenticated response.
- `/api/session` authenticated response shape.
- `/api/company` unauthenticated `401`.
- `/api/company` authenticated read/create/update.
- Origin rejection for state-changing company writes.
- Frontend bearer-token API calls.
- `/login` and `/register` route rendering.
- Worker routing for Clerk SPA auth routes.
- D1 baseline has no sessions table.
