# Deployment

This dashboard is a Vite React app served by a Cloudflare Worker. Clerk owns browser sessions. Worker API routes verify Clerk session tokens and keep app-owned user/company records in D1.

## Runtime Model

- `/login` and `/register` are React routes that render Clerk `<SignIn />` and `<SignUp />`.
- Frontend API requests call Clerk `getToken()` and send `Authorization: Bearer <token>`.
- Worker API routes call `@clerk/backend` `verifyToken()` with `CLERK_SECRET_KEY` and `authorizedParties`.
- D1 stores `users` and `companies`; it does not store local sessions.
- D1 user identity is `auth_provider = "clerk"` and `auth_subject = <Clerk user id>`.

## Required Local Environment

Create `.env.local` for Vite:

```sh
VITE_CLERK_PUBLISHABLE_KEY=<Clerk development publishable key>
```

Create `.dev.vars` or pass Worker vars/secrets for Wrangler local development:

```sh
CLERK_SECRET_KEY=<Clerk development secret key>
CLERK_AUTHORIZED_PARTIES=http://localhost:8787,http://127.0.0.1:8787
DASHBOARD_BASE_URL=http://localhost:8787
ENVIRONMENT=development
ADMIN_EMAILS="eckart@rslcollective.org"
```

Do not put `CLERK_SECRET_KEY` or future `CLERK_JWT_KEY` values in Vite `VITE_` variables.
Do not put the admin allowlist in Vite variables; the frontend only receives the current user's `isAdmin` result from `/api/session`.

## Production Worker Configuration

`wrangler.production.jsonc` stores non-secret production vars:

```json
{
  "vars": {
    "ADMIN_EMAILS": "eckart@rslcollective.org",
    "CLERK_AUTHORIZED_PARTIES": "https://dashboard.rslcollective.org",
    "DASHBOARD_BASE_URL": "https://dashboard.rslcollective.org",
    "ENVIRONMENT": "production"
  }
}
```

`ADMIN_EMAILS` is a comma-separated allowlist for server-side admin authorization. The initial production allowlist is `eckart@rslcollective.org`.

Set production secrets with Wrangler:

```sh
pnpm exec wrangler secret put CLERK_SECRET_KEY --config wrangler.production.jsonc
```

`CLERK_JWT_KEY` is not required for the initial implementation. Add it later only if networkless verification is required:

```sh
pnpm exec wrangler secret put CLERK_JWT_KEY --config wrangler.production.jsonc
```

## Clerk Dashboard

Configure the Clerk development and production instances separately.

Localhost:

- Use the development instance.
- Do not rely on Clerk Dashboard component-path settings for sign-in or sign-up; the React app configures `/login`, `/register`, and `/dashboard` in code.
- Include `http://localhost:8787` and `http://127.0.0.1:8787` in Worker `CLERK_AUTHORIZED_PARTIES`.

Production domain:

- Create a production instance for `dashboard.rslcollective.org`.
- Set the production Home URL to `https://dashboard.rslcollective.org`.
- Do not configure custom OAuth consent pages; use Clerk's default Account Portal consent flow.
- Add Clerk-required DNS records.
- If Clerk asks for DNS validation records in Cloudflare, keep those validation records DNS-only while validating.
- Enable allowed subdomains and allow only the dashboard subdomain needed by this app.

Authentication:

- Enable email as an identifier.
- Require email verification.
- Prefer email verification codes over email links for B2B deliverability.
- Enable Google social connection.
- Enable Microsoft Azure Entra ID social connection.
- Use custom Google and Microsoft credentials in production.
- Keep the one-user-one-company app model; do not enable Clerk Organizations for this migration.

Email and branding:

- Set the application name and logo to RSL Internet Collective.
- Configure Clerk production email DNS records for SPF/DKIM.
- Add a DMARC record for the sending domain.
- Keep real mailboxes for active sender addresses such as `notifications@rslcollective.org` or `noreply@rslcollective.org`.
- Keep default Clerk email templates initially unless there is a clear deliverability-safe reason to customize them.

## D1 Reset

Current local and production D1 data is disposable. Reset instead of migrating old provider data.

Local:

```sh
pnpm db:migrate:local
```

Production:

1. Create a fresh production D1 database or intentionally discard the existing one.
2. Update `wrangler.production.jsonc` with the production D1 `database_id`.
3. Apply the baseline schema:

```sh
pnpm db:migrate:remote
```

## Local Verification

```sh
pnpm check
pnpm test
pnpm build
pnpm db:migrate:local
pnpm worker:dev
```

`pnpm worker:dev` rebuilds `dist/` with Vite `--mode development` before starting Wrangler, so local Worker testing uses `.env.local` and avoids `.env.production.local`.

Then verify:

- `http://localhost:8787/login` renders Clerk sign-in.
- `http://localhost:8787/register` renders Clerk sign-up.
- Signing in lands on `/dashboard`.
- `/api/session` returns `{ "authenticated": true, "user": ... }` after sign-in.
- `/api/company` returns `401` without a valid Clerk token.
- `/api/admin/users` returns `401` without a valid Clerk token.
- `/api/admin/users` returns `403` for authenticated non-admin users.
- Creating a publisher profile returns `201`.
- Sign-out returns to `/login`.

## Production Deploy

```sh
pnpm check
pnpm test
pnpm build
pnpm exec wrangler whoami
pnpm db:migrate:remote
pnpm worker:deploy
```

Production smoke test:

1. Visit `https://dashboard.rslcollective.org/login`.
2. Sign up with email and complete verification.
3. Confirm redirect to `/dashboard`.
4. Confirm `/api/session` is authenticated.
5. Create a publisher profile.
6. Sign out and confirm return to `/login`.
7. Sign in again with email.
8. Test Google sign-in.
9. Test Microsoft sign-in.
10. Confirm unauthenticated API requests return `401`.
11. Confirm the Admin navigation item appears only for `ADMIN_EMAILS` users.
12. Confirm direct non-admin access to `/admin/users` shows an unauthorized state and `/api/admin/users` returns `403`.
