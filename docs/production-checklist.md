# Production Setup Checklist

Use this checklist when moving the RSL Collective Profile Application from local QA to production. Do not commit real API tokens or secrets.

## 1. Cloudflare Account And D1 Setup

- Confirm the target Cloudflare account controls `rslcollective.org` and `dashboard.rslcollective.org`.
- Confirm or replace the production account and D1 values in `wrangler.production.jsonc`:
  - `account_id`: Cloudflare account ID for the `rslcollective.org` account.
  - `d1_databases[0].database_id`: production D1 database ID from the same account.
- Keep `wrangler.jsonc` local/dev-safe. It must not contain a production `routes` or `custom_domain` entry.
- Confirm `wrangler.production.jsonc` keeps:
  - D1 binding name `DB`.
  - Workers Assets binding name `ASSETS`.
  - `not_found_handling: "single-page-application"`.
  - `run_worker_first` entries for `/`, `/register`, `/login`, `/auth/*`, `/logout`, and `/api/*`.
  - Production vars for `AUTH0_ISSUER_BASE_URL`, `AUTH0_CLIENT_ID`, `AUTH0_CALLBACK_URL`, `DASHBOARD_BASE_URL`, and `ENVIRONMENT`.
  - Custom-domain route for `dashboard.rslcollective.org`.
- Create the production D1 database if it does not already exist:

```sh
pnpm exec wrangler d1 create rsl-collective-dashboard --config wrangler.production.jsonc
```

- Copy the returned production `database_id` into `wrangler.production.jsonc`.

## 2. Auth0 Production Setup

- Use an Auth0 Production tenant, preferably separate from development and staging tenants.
- Create an Auth0 Regular Web Application for the dashboard.
- Configure the production application:
  - Allowed Callback URLs: `https://dashboard.rslcollective.org/auth/callback`
  - Allowed Logout URLs: `https://dashboard.rslcollective.org/login`
  - Application Login URI: `https://dashboard.rslcollective.org/login`
  - App homepage: `https://dashboard.rslcollective.org/`
  - Grant type: Authorization Code
  - ID token signing algorithm: RS256
- Configure Universal Login branding and test it in staging before production.
- Configure custom domain `login.rslcollective.org`:
  - Use Auth0-managed certificates.
  - Add the Auth0-provided Cloudflare CNAME as DNS-only, not proxied, at least through validation.
  - Keep the CNAME present for certificate renewal.
- Do not configure the React app with Auth0 SPA SDK values.
- Do not expose Auth0 access tokens, ID tokens, refresh tokens, or client secrets to browser code.

Allowed Web Origins are secondary for the current server-side architecture. Add `https://dashboard.rslcollective.org` only if a future browser-side Auth0 SDK flow is introduced.

## 3. Worker Secrets And Runtime Variables

Required Worker bindings are `ASSETS` and `DB`.

Required Worker runtime values:

- `AUTH0_ISSUER_BASE_URL`
- `AUTH0_CLIENT_ID`
- `AUTH0_CALLBACK_URL`
- `AUTH0_CLIENT_SECRET`
- `DASHBOARD_BASE_URL`
- `SESSION_SECRET`
- `ENVIRONMENT`

Secrets:

- `AUTH0_CLIENT_SECRET`
- `SESSION_SECRET`

Non-secret runtime variables:

- `AUTH0_ISSUER_BASE_URL=https://login.rslcollective.org`
- `AUTH0_CLIENT_ID=<Auth0 Production Regular Web Application Client ID>`
- `AUTH0_CALLBACK_URL=https://dashboard.rslcollective.org/auth/callback`
- `DASHBOARD_BASE_URL=https://dashboard.rslcollective.org`
- `ENVIRONMENT=production`

Set production secrets before deploy:

```sh
pnpm exec wrangler secret put AUTH0_CLIENT_SECRET --config wrangler.production.jsonc
pnpm exec wrangler secret put SESSION_SECRET --config wrangler.production.jsonc
```

Cloudflare deployment credentials such as `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are Wrangler or CI credentials, not application runtime variables. Never commit them and never expose them with a `VITE_` prefix.

## 4. Migration And Deploy Commands

Run local quality gates first:

```sh
pnpm check
pnpm build
pnpm test
```

Confirm Wrangler is targeting the correct Cloudflare account:

```sh
pnpm exec wrangler whoami
```

Apply production D1 migrations only after the production database ID and account ID are correct:

```sh
pnpm db:migrate:remote
```

Deploy only after migrations and runtime configuration are complete:

```sh
pnpm worker:deploy
```

Do not run `pnpm db:migrate:remote` or `pnpm worker:deploy` until the Cloudflare account ID, production D1 database ID, Auth0 Production configuration, and Worker runtime values have all been verified.

## 5. Production Smoke Test

After deploy:

1. Visit `https://dashboard.rslcollective.org/`.
2. Confirm unauthenticated access redirects to `/login`.
3. Confirm `/login` redirects to Auth0 Universal Login on `https://login.rslcollective.org`.
4. Complete login through Auth0.
5. Confirm the callback reaches `/auth/callback`.
6. Confirm the authenticated user lands on `/dashboard`.
7. Open Publisher Profile.
8. Create or edit the Publisher Profile, including required `Country`, `Business address line 1`, `City`, and `Postal code`.
9. Refresh and confirm the profile persists.
10. Sign out.
11. Confirm logout clears the local session, redirects through Auth0 logout, and returns to `/login`.
12. Visit `/dashboard` after logout and confirm login is required.
13. Log in again and confirm the existing Publisher Profile loads.

Useful non-mutating smoke commands:

```sh
curl -i https://dashboard.rslcollective.org/
curl -i https://dashboard.rslcollective.org/login
curl -i https://dashboard.rslcollective.org/api/session
```

## 6. Rollback Notes

- If deploy fails before traffic changes, fix the configuration and redeploy.
- If the Worker deploy succeeds but smoke testing fails, redeploy the last known good Worker version from Cloudflare or from the previous git revision.
- If D1 migrations have already run, do not manually edit production D1 data during rollback unless a separate data recovery plan is prepared.
- `0001_core.sql` creates users, companies, and sessions.
- Production sessions use `__Host-rsl_dashboard_session` with `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, and no `Domain`.
- Local HTTP development sessions use `rsl_dashboard_session` without `Secure`.

## 7. Known Non-Goals

- No production deploy in this checklist step.
- No remote migration until explicitly executed after setup verification.
- No `company_members` or multi-company behavior.
- No onboarding, enrollment, RSL parsing, repertoire backend, reporting backend, payment backend, or licensee-exclusion backend.
- No `publisher_url`, website, or domain fields.
- No localStorage or sessionStorage auth.
- No Auth0 SPA SDK.
- No Tailwind or Vinxi.
