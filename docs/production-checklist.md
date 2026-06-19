# Production Setup Checklist

Use this checklist when moving the RSL Collective Profile Application from local QA to production. Do not commit real account IDs, database IDs, API tokens, or secrets.

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
  - Production vars for `WORKOS_REDIRECT_URI`, `DASHBOARD_BASE_URL`, and `ENVIRONMENT`.
  - Custom-domain route for `dashboard.rslcollective.org`.
- Create the production D1 database if it does not already exist:

```sh
pnpm exec wrangler d1 create rsl-collective-dashboard --config wrangler.production.jsonc
```

- Copy the returned production `database_id` into `wrangler.production.jsonc`.
- Do not add a migration for the required Publisher Profile address fields. The API enforces `addressLine1`, `city`, `postalCode`, and `country` through server validation while the pre-production D1 columns remain nullable.

## 2. WorkOS Production AuthKit Setup

- Use the WorkOS Production environment, not Staging.
- Use WorkOS default hosted AuthKit for the first production deploy.
- Use the default WorkOS email sender for the first production deploy.
- Use the WorkOS Production Client ID and API Key.
- Configure AuthKit for the production dashboard:
  - Callback URL: `https://dashboard.rslcollective.org/auth/callback`
  - Sign-in endpoint: `https://dashboard.rslcollective.org/login`
  - Logout/sign-out return URL: `https://dashboard.rslcollective.org/login`
  - App homepage: `https://dashboard.rslcollective.org/`
- Do not configure a custom AuthKit domain for the first production deploy.
- Do not configure a custom WorkOS email sender/domain for the first production deploy.
- Custom AuthKit domain `login.rslcollective.org` and custom email sender/domain `no-reply@mail.rslcollective.org` are optional future branding steps.
- Do not enable WorkOS Organizations for this phase.

## 3. Worker Secrets And Runtime Variables

Required Worker bindings are `ASSETS` and `DB`.

Required Worker runtime values:

- `WORKOS_CLIENT_ID`
- `WORKOS_API_KEY`
- `WORKOS_REDIRECT_URI`
- `DASHBOARD_BASE_URL`
- `SESSION_SECRET`
- `ENVIRONMENT`

Secrets:

- `WORKOS_API_KEY`
- `SESSION_SECRET`
- `WORKOS_CLIENT_ID` may be stored as a secret, but prefer a non-secret Worker variable unless there is a reason to hide it.

Non-secret runtime variables:

- `WORKOS_CLIENT_ID=<WorkOS Production Client ID>`, preferred unless managed as a secret
- `WORKOS_REDIRECT_URI=https://dashboard.rslcollective.org/auth/callback`
- `DASHBOARD_BASE_URL=https://dashboard.rslcollective.org`
- `ENVIRONMENT=production`

`WORKOS_LOGOUT_URI` is not used by this app. Logout uses the stored WorkOS session ID and sends WorkOS `returnTo` to `${DASHBOARD_BASE_URL}/login`.

Set production secrets and variables before deploy:

```sh
pnpm exec wrangler secret put WORKOS_API_KEY --config wrangler.production.jsonc
pnpm exec wrangler secret put SESSION_SECRET --config wrangler.production.jsonc
```

`WORKOS_REDIRECT_URI`, `DASHBOARD_BASE_URL`, and `ENVIRONMENT` are already set in `wrangler.production.jsonc`. Set `WORKOS_CLIENT_ID` as a production Worker variable in Cloudflare Worker settings, or as a secret if the team chooses to hide it:

```txt
WORKOS_CLIENT_ID=<WorkOS Production Client ID>
WORKOS_REDIRECT_URI=https://dashboard.rslcollective.org/auth/callback
DASHBOARD_BASE_URL=https://dashboard.rslcollective.org
ENVIRONMENT=production
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

Apply the two production D1 migrations only after the production database ID and account ID are correct:

```sh
pnpm db:migrate:remote
```

Deploy only after migrations and runtime configuration are complete:

```sh
pnpm worker:deploy
```

Do not run `pnpm db:migrate:remote` or `pnpm worker:deploy` until the Cloudflare account ID, production D1 database ID, WorkOS Production configuration, and Worker runtime values have all been verified.

## 5. Production Smoke Test

After deploy:

1. Visit `https://dashboard.rslcollective.org/`.
2. Confirm unauthenticated access redirects to `/login`.
3. Complete login through WorkOS Production AuthKit.
4. Confirm the callback reaches `/auth/callback`.
5. Confirm the authenticated user lands on `/dashboard`.
6. Open Publisher Profile.
7. Create or edit the Publisher Profile, including required `Country`, `Business address line 1`, `City`, and `Postal code`.
8. Refresh and confirm the profile persists.
9. Sign out.
10. Confirm logout redirects through WorkOS hosted logout and returns to `/login`.
11. Visit `/dashboard` after logout and confirm login is required.
12. Log in again and confirm the existing Publisher Profile loads.

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
- `0002_sessions_workos_session_id.sql` adds `sessions.workos_session_id` for WorkOS logout.
- Production sessions use `__Host-rsl_dashboard_session` with `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, and no `Domain`.
- Local HTTP development sessions use `rsl_dashboard_session` without `Secure`.

## 7. Known Non-Goals

- No production deploy in this checklist step.
- No remote migration until explicitly executed after setup verification.
- No WorkOS Organizations.
- No `company_members` or multi-company behavior.
- No onboarding, enrollment, RSL parsing, repertoire backend, reporting backend, payment backend, or licensee-exclusion backend.
- No `publisher_url`, website, or domain fields.
- No localStorage or sessionStorage auth.
- No Tailwind or Vinxi.
