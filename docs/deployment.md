# Deployment

This app deploys as a single Cloudflare Worker that serves both the Vite SPA assets and the Hono Worker routes. Do not deploy from an implicit Wrangler account: the production Cloudflare account must be the account that controls `rslcollective.org` and `dashboard.rslcollective.org`.

## Cloudflare Account Targeting

`wrangler.jsonc` is the local/default Worker config used by `pnpm worker:dev`. It must remain local-safe and must not include the production `dashboard.rslcollective.org` route or `custom_domain` entry. It must include:

```jsonc
{
  "name": "rslcollective-dashboard",
  "main": "worker/index.ts",
  "account_id": "<CLOUDFLARE_ACCOUNT_ID_FOR_RSLCOLLECTIVE_ORG_ACCOUNT>",
  "compatibility_date": "2026-06-11",
  "assets": {
    "directory": "./dist/",
    "binding": "ASSETS",
    "not_found_handling": "single-page-application",
    "run_worker_first": [
      "/",
      "/register",
      "/login",
      "/auth/*",
      "/logout",
      "/api/*"
    ]
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "rsl-collective-dashboard",
      "database_id": "<D1_DATABASE_ID_FROM_SAME_CLOUDFLARE_ACCOUNT>"
    }
  ]
}
```

`wrangler.production.jsonc` is the explicit production deploy config used by `pnpm worker:deploy`. It mirrors the Worker, assets, and D1 bindings above and adds the production custom-domain route:

```jsonc
{
  "routes": [
    {
      "pattern": "dashboard.rslcollective.org",
      "custom_domain": true
    }
  ]
}
```

The `account_id` is not a secret, but it must be correct. The `database_id` must be for the `rsl-collective-dashboard` D1 database in that same Cloudflare account. Do not guess either value.

Before production deploy, run:

```sh
wrangler whoami
```

Confirm the active Wrangler account matches `account_id` in `wrangler.production.jsonc`. Local development may use `wrangler login`. CI or scripted deployment should use `CLOUDFLARE_API_TOKEN` and, where useful, `CLOUDFLARE_ACCOUNT_ID`.

## Deployment Credentials

Cloudflare deployment credentials are Wrangler/system credentials, not application runtime secrets.

- `CLOUDFLARE_API_TOKEN` is used by Wrangler for deployment, D1 migrations, and route updates.
- `CLOUDFLARE_ACCOUNT_ID` may be used by CI scripts for account targeting, while `wrangler.jsonc` still makes the production target explicit.
- The Cloudflare API token must be scoped to the intended Cloudflare account.
- The token needs permissions for Workers deployment, D1 migrations, and the `dashboard.rslcollective.org` Worker route.
- Never commit Cloudflare API tokens or credentials.
- Do not prefix Cloudflare deployment credentials with `VITE_`.
- Do not expose Cloudflare credentials to browser code.

## Runtime Secrets And Variables

Required Worker runtime bindings:

- `ASSETS` Workers Assets binding
- `DB` D1 binding
- `WORKOS_CLIENT_ID`
- `WORKOS_API_KEY`
- `WORKOS_REDIRECT_URI`
- `SESSION_SECRET`
- `DASHBOARD_BASE_URL`
- `ENVIRONMENT=production`

`WORKOS_CLIENT_ID`, `WORKOS_API_KEY`, and `SESSION_SECRET` must be stored as Worker secrets. `WORKOS_REDIRECT_URI`, `DASHBOARD_BASE_URL`, and `ENVIRONMENT` are not secret values, but they are runtime configuration consumed by the Worker.

`ENVIRONMENT=production` is required in production. The Worker checks this value to set production `Secure` session cookies, require `Origin` on protected mutating requests, and reject mismatched production origins. Do not set `ENVIRONMENT` with `wrangler secret put`.

The Wrangler config files do not set `ENVIRONMENT` as a top-level `vars` value because that would also affect local development if the value were placed in the local config. For the production Worker, set `ENVIRONMENT=production` as a plain text Worker variable in Cloudflare's Worker variables settings. If this project later introduces named Wrangler environments, put production-only values under the production environment using Wrangler's supported JSONC `vars` syntax:

```jsonc
{
  "env": {
    "production": {
      "vars": {
        "ENVIRONMENT": "production",
        "WORKOS_REDIRECT_URI": "https://dashboard.rslcollective.org/auth/callback",
        "DASHBOARD_BASE_URL": "https://dashboard.rslcollective.org"
      }
    }
  }
}
```

Do not expose WorkOS secrets through Vite client variables. Do not put WorkOS or Cloudflare credentials in `VITE_` variables.

Production values:

```txt
WORKOS_REDIRECT_URI=https://dashboard.rslcollective.org/auth/callback
DASHBOARD_BASE_URL=https://dashboard.rslcollective.org
ENVIRONMENT=production
```

Local values:

```txt
WORKOS_REDIRECT_URI=http://localhost:8787/auth/callback
DASHBOARD_BASE_URL=http://localhost:8787
ENVIRONMENT=development
```

For local development, `ENVIRONMENT` may also be omitted because development is the default behavior. Development Origin validation accepts `DASHBOARD_BASE_URL` when configured and local Worker origins on `localhost` or `127.0.0.1` using HTTP or HTTPS on ports `8787` and `8788`. Production still requires the request `Origin` to match `DASHBOARD_BASE_URL`.

`WORKOS_LOGOUT_URI` is deprecated and is not used by the app. `POST /logout` uses the stored WorkOS session ID to build a WorkOS logout URL with a return target of `${DASHBOARD_BASE_URL}/login`. If an older local dashboard session has no stored WorkOS session ID, logout still clears the local session and falls back safely to `/login`.

Session cookies are environment-specific:

- Production uses `__Host-rsl_dashboard_session` with `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, and no `Domain`.
- Local HTTP development uses `rsl_dashboard_session` with `HttpOnly`, `SameSite=Lax`, `Path=/`, and no `Domain`, but without `Secure`.

This split is intentional. The `__Host-` prefix and `Secure` attribute are required for the production security model, but plain `http://localhost:8787` development cannot rely on browsers, especially Safari, persisting a Secure `__Host-` cookie. Production cookie security is unchanged.

Secret setup command patterns:

```sh
wrangler secret put WORKOS_CLIENT_ID
wrangler secret put WORKOS_API_KEY
wrangler secret put WORKOS_REDIRECT_URI
wrangler secret put SESSION_SECRET
wrangler secret put DASHBOARD_BASE_URL
```

Use the command patterns above only for runtime secrets or runtime values the team chooses to manage as secrets. `ENVIRONMENT=production` should be configured as a non-secret production Worker variable. Keep all runtime configuration out of browser code unless it is deliberately browser-safe and uses a `VITE_` prefix.

## D1

Cloudflare requirements:

- D1 database `rsl-collective-dashboard` exists in the same Cloudflare account as `account_id`.
- D1 binding name is `DB`.
- `d1_databases[0].database_id` in both `wrangler.jsonc` and `wrangler.production.jsonc` belongs to that same account.
- Remote migration is applied before production smoke testing.

Commands:

```sh
pnpm db:migrate:local
pnpm db:migrate:remote
```

## Workers Assets And Routing

Cloudflare requirements:

- `dashboard.rslcollective.org` routes to this Worker.
- The production route exists only in `wrangler.production.jsonc`; the local/default `wrangler.jsonc` intentionally has no production `routes` or `custom_domain` entry.
- The Worker is deployed to the Cloudflare account that controls `rslcollective.org`.
- Workers Assets SPA fallback is configured with `not_found_handling: "single-page-application"`.
- `run_worker_first` is configured for `/`, `/register`, `/login`, `/auth/*`, `/logout`, and `/api/*`.
- `/dashboard` and nested dashboard routes are served by the SPA fallback.
- `/auth/callback` remains Worker-handled and must not be swallowed by the SPA fallback.

Production deploy:

```sh
pnpm check
pnpm build
pnpm test
wrangler whoami
pnpm db:migrate:remote
pnpm worker:deploy
```

## Local Worker Smoke Tests

Use Wrangler for local auth/API route testing. Vite-only development is useful for UI work, but it does not exercise Worker-first routes, D1 bindings, Origin behavior, WorkOS redirects, or SPA asset fallback.

Start the local Worker:

```sh
pnpm db:migrate:local
pnpm worker:dev
```

`pnpm worker:dev` runs `wrangler dev --config wrangler.jsonc`, so local requests should stay under `localhost:8787`. It must not use the production custom-domain route from `wrangler.production.jsonc`.

Then run these checks against the local Worker:

```sh
curl -i http://localhost:8787/
curl -i http://localhost:8787/register
curl -i http://localhost:8787/login
curl -i -X PUT http://localhost:8787/api/company \
  -H "Origin: http://localhost:8787" \
  -H "Content-Type: application/json" \
  --data '{}'
curl -i "http://localhost:8787/auth/callback?code=test&state=test"
curl -i http://localhost:8787/api/session
curl -i http://localhost:8787/api/company
curl -i http://localhost:8787/dashboard
```

Expected routing shape:

- `/`, `/register`, `/login`, `/auth/callback`, `/logout`, and `/api/*` are Worker-handled.
- `/auth/callback` must return a Worker response and must not be served by the SPA fallback.
- `/dashboard` is served by the SPA fallback.
- Wrangler request logs for the local curl requests should show `http://localhost:8787/...`, not `http://dashboard.rslcollective.org/...`.
- Without local WorkOS settings, `/register` and `/login` may fail clearly with a WorkOS configuration error instead of redirecting.
- Without an authenticated local session, `/api/session` returns unauthenticated and `/api/company` returns unauthenticated. The local PUT request above should return `401 Unauthorized`, not `403 Forbidden` for Origin.

## WorkOS/AuthKit

WorkOS production requirements:

- `login.rslcollective.org` is configured as the AuthKit custom domain.
- The Cloudflare CNAME for `login.rslcollective.org` is DNS-only, not proxied.
- Email domain for `no-reply@mail.rslcollective.org` is configured and verified.
- Callback URL is configured as `https://dashboard.rslcollective.org/auth/callback`.
- Sign-in endpoint is configured as `https://dashboard.rslcollective.org/login`.
- Sign-out/logout return URL is configured as `https://dashboard.rslcollective.org/login`.
- WorkOS Organizations are not used in this phase.

Current logout behavior:

- `POST /logout` clears the current environment's session cookie and invalidates the local D1 session when present.
- In local development, `POST /logout` also clears a stale production `__Host-rsl_dashboard_session` cookie defensively.
- If the local D1 session has a `workos_session_id`, the Worker redirects through WorkOS hosted logout with `returnTo` set to `${DASHBOARD_BASE_URL}/login`.
- If no WorkOS session ID exists, logout falls back safely to `/login` after clearing the local session.
- `GET /logout` is not implemented; logout remains POST-only.

## Production Smoke Test

1. Visit `https://dashboard.rslcollective.org/`.
2. Confirm unauthenticated access redirects to `/login`.
3. Complete AuthKit login or registration.
4. Confirm the callback returns through `/auth/callback` and lands on `/dashboard`.
5. Confirm a new user lands on Company Profile.
6. Create a company profile.
7. Refresh and confirm the profile persists.
8. Sign out.
9. Confirm the local session is cleared.
10. Login again.
11. Confirm the company profile loads.

## Pre-Deploy Checklist

- `pnpm check` passes.
- `pnpm build` passes.
- `pnpm test` passes.
- `wrangler whoami` shows the intended Cloudflare account.
- `wrangler.production.jsonc` `account_id` is the Cloudflare account that controls `rslcollective.org`.
- `wrangler.jsonc` and `wrangler.production.jsonc` placeholder account and D1 IDs have been replaced before deploy.
- D1 `database_id` belongs to the same Cloudflare account.
- Remote D1 migration is applied.
- Worker secrets and production runtime variables are set.
- WorkOS callback URL is set.
- WorkOS sign-in endpoint is set.
- WorkOS sign-out/logout return URL is set to `/login`.
- AuthKit custom domain is DNS-only in Cloudflare.
- Email domain is verified.
- `dashboard.rslcollective.org` route is active.
- `/auth/callback` is tested as Worker-handled.
