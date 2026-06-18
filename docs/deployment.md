# Deployment

This app deploys as a single Cloudflare Worker that serves both the Vite SPA assets and the Hono Worker routes. Do not deploy from an implicit Wrangler account: the production Cloudflare account must be the account that controls `rslcollective.org` and `dashboard.rslcollective.org`.

## Cloudflare Account Targeting

`wrangler.jsonc` must include:

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

The `account_id` is not a secret, but it must be correct. The `database_id` must be for the `rsl-collective-dashboard` D1 database in that same Cloudflare account. Do not guess either value.

Before production deploy, run:

```sh
wrangler whoami
```

Confirm the active Wrangler account matches `account_id` in `wrangler.jsonc`. Local deployment may use `wrangler login`. CI or scripted deployment should use `CLOUDFLARE_API_TOKEN` and, where useful, `CLOUDFLARE_ACCOUNT_ID`.

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
- `WORKOS_LOGOUT_URI`, optional but recommended for production logout
- `ENVIRONMENT=production`

`WORKOS_CLIENT_ID`, `WORKOS_API_KEY`, and `SESSION_SECRET` must be stored as Worker secrets. `WORKOS_REDIRECT_URI`, `DASHBOARD_BASE_URL`, `WORKOS_LOGOUT_URI`, and `ENVIRONMENT` are not secret values, but they are runtime configuration consumed by the Worker.

`ENVIRONMENT=production` is required in production. The Worker checks this value to set production `Secure` session cookies, require `Origin` on protected mutating requests, reject mismatched production origins, and disable the local logout fallback. Do not set `ENVIRONMENT` with `wrangler secret put`.

The current `wrangler.jsonc` does not set `ENVIRONMENT` as a top-level `vars` value because that would also affect `pnpm worker:dev`. For the current single production Worker, set `ENVIRONMENT=production` as a plain text Worker variable in Cloudflare's Worker variables settings. If this project later introduces named Wrangler environments, put production-only values under the production environment using Wrangler's supported JSONC `vars` syntax:

```jsonc
{
  "env": {
    "production": {
      "vars": {
        "ENVIRONMENT": "production",
        "WORKOS_REDIRECT_URI": "https://dashboard.rslcollective.org/auth/callback",
        "DASHBOARD_BASE_URL": "https://dashboard.rslcollective.org",
        "WORKOS_LOGOUT_URI": "https://dashboard.rslcollective.org/"
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
WORKOS_LOGOUT_URI=https://dashboard.rslcollective.org/
ENVIRONMENT=production
```

Local values:

```txt
WORKOS_REDIRECT_URI=http://localhost:8787/auth/callback
DASHBOARD_BASE_URL=http://localhost:8787
ENVIRONMENT=development
```

For local development, `ENVIRONMENT` may also be omitted because development is the default behavior. Development Origin validation accepts `DASHBOARD_BASE_URL` when configured and local Worker origins on `localhost` or `127.0.0.1` using HTTP or HTTPS on ports `8787` and `8788`. Production still requires the request `Origin` to match `DASHBOARD_BASE_URL`.

Secret setup command patterns:

```sh
wrangler secret put WORKOS_CLIENT_ID
wrangler secret put WORKOS_API_KEY
wrangler secret put WORKOS_REDIRECT_URI
wrangler secret put SESSION_SECRET
wrangler secret put DASHBOARD_BASE_URL
wrangler secret put WORKOS_LOGOUT_URI
```

Use the command patterns above only for runtime secrets or runtime values the team chooses to manage as secrets. `ENVIRONMENT=production` should be configured as a non-secret production Worker variable. Keep all runtime configuration out of browser code unless it is deliberately browser-safe and uses a `VITE_` prefix.

## D1

Cloudflare requirements:

- D1 database `rsl-collective-dashboard` exists in the same Cloudflare account as `account_id`.
- D1 binding name is `DB`.
- `d1_databases[0].database_id` in `wrangler.jsonc` belongs to that same account.
- Remote migration is applied before production smoke testing.

Commands:

```sh
pnpm db:migrate:local
pnpm db:migrate:remote
```

## Workers Assets And Routing

Cloudflare requirements:

- `dashboard.rslcollective.org` routes to this Worker.
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

Then run these checks against the local Worker:

```sh
curl -i http://localhost:8787/
curl -i http://localhost:8787/register
curl -i http://localhost:8787/login
curl -i "http://localhost:8787/auth/callback?code=test&state=test"
curl -i http://localhost:8787/api/session
curl -i http://localhost:8787/api/company
curl -i http://localhost:8787/dashboard
```

Expected routing shape:

- `/`, `/register`, `/login`, `/auth/callback`, `/logout`, and `/api/*` are Worker-handled.
- `/auth/callback` must return a Worker response and must not be served by the SPA fallback.
- `/dashboard` is served by the SPA fallback.
- Without local WorkOS settings, `/register` and `/login` may fail clearly with a WorkOS configuration error instead of redirecting.
- Without an authenticated local session, `/api/session` returns unauthenticated and `/api/company` returns unauthenticated.

## WorkOS/AuthKit

WorkOS production requirements:

- `login.rslcollective.org` is configured as the AuthKit custom domain.
- The Cloudflare CNAME for `login.rslcollective.org` is DNS-only, not proxied.
- Email domain for `no-reply@mail.rslcollective.org` is configured and verified.
- Callback URL is configured as `https://dashboard.rslcollective.org/auth/callback`.
- Sign-in endpoint is configured as `https://dashboard.rslcollective.org/login`.
- Sign-out redirect is configured as `https://dashboard.rslcollective.org/`.

Current logout behavior:

- `POST /logout` clears the local `__Host-rsl_dashboard_session` cookie and invalidates the local D1 session when present.
- If `WORKOS_LOGOUT_URI` is set, the Worker constructs a WorkOS logout URL with that return target.
- If `WORKOS_LOGOUT_URI` is not set, the Worker uses `DASHBOARD_BASE_URL` as the WorkOS logout return target.
- In local development only, if no WorkOS logout URL can be constructed, logout falls back to `/login`.

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
- `wrangler.jsonc` `account_id` is the Cloudflare account that controls `rslcollective.org`.
- `wrangler.jsonc` placeholder account and D1 IDs have been replaced before deploy.
- D1 `database_id` belongs to the same Cloudflare account.
- Remote D1 migration is applied.
- Worker secrets and production runtime variables are set.
- WorkOS callback URL is set.
- WorkOS sign-in endpoint is set.
- WorkOS sign-out redirect is set.
- AuthKit custom domain is DNS-only in Cloudflare.
- Email domain is verified.
- `dashboard.rslcollective.org` route is active.
- `/auth/callback` is tested as Worker-handled.
