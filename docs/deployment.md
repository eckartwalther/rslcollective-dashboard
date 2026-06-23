# Deployment

This app deploys as a single Cloudflare Worker that serves both the Vite SPA assets and the Hono Worker routes. Do not deploy from an implicit Wrangler account: the production Cloudflare account must be the account that controls `rslcollective.org` and `dashboard.rslcollective.org`.

## Cloudflare Account Targeting

`wrangler.jsonc` is the local/default Worker config used by `pnpm worker:dev`. It must remain local-safe and must not include the production `dashboard.rslcollective.org` route or `custom_domain` entry. It must include Worker-first routing for `/`, `/register`, `/login`, `/auth/*`, `/logout`, and `/api/*`.

`wrangler.production.jsonc` is the explicit production deploy config used by `pnpm worker:deploy`. It mirrors the Worker, assets, and D1 bindings and adds the production custom-domain route:

```jsonc
{
  "vars": {
    "AUTH0_ISSUER_BASE_URL": "https://login.rslcollective.org",
    "AUTH0_CLIENT_ID": "Rh6L36YoEzjBtpBVTy2w8gqR03WxgdcN",
    "AUTH0_CALLBACK_URL": "https://dashboard.rslcollective.org/auth/callback",
    "DASHBOARD_BASE_URL": "https://dashboard.rslcollective.org",
    "ENVIRONMENT": "production"
  },
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
pnpm exec wrangler whoami
```

Confirm the active Wrangler account matches `account_id` in `wrangler.production.jsonc`. Local development may use `wrangler login`. CI or scripted deployment should use `CLOUDFLARE_API_TOKEN` and, where useful, `CLOUDFLARE_ACCOUNT_ID`.

## Runtime Secrets And Variables

Required Worker runtime bindings:

- `ASSETS` Workers Assets binding
- `DB` D1 binding
- `AUTH0_ISSUER_BASE_URL`
- `AUTH0_CLIENT_ID`
- `AUTH0_CALLBACK_URL`
- `AUTH0_CLIENT_SECRET`
- `SESSION_SECRET`
- `DASHBOARD_BASE_URL`
- `ENVIRONMENT=production`

`AUTH0_CLIENT_SECRET` and `SESSION_SECRET` must be stored as Worker secrets. `AUTH0_CLIENT_ID`, `AUTH0_ISSUER_BASE_URL`, `AUTH0_CALLBACK_URL`, `DASHBOARD_BASE_URL`, and `ENVIRONMENT` are production variables in `wrangler.production.jsonc`.

`ENVIRONMENT=production` is required in production. The Worker checks this value to set production `Secure` session cookies, require `Origin` on protected mutating requests, and reject mismatched production origins. Do not set `ENVIRONMENT` with `wrangler secret put`.

Do not expose Auth0 access tokens, ID tokens, refresh tokens, or client secrets through Vite client variables. Do not put Auth0 or Cloudflare credentials in `VITE_` variables.

Production values:

```txt
AUTH0_ISSUER_BASE_URL=https://login.rslcollective.org
AUTH0_CLIENT_ID=<Auth0 Production Regular Web Application Client ID>
AUTH0_CALLBACK_URL=https://dashboard.rslcollective.org/auth/callback
DASHBOARD_BASE_URL=https://dashboard.rslcollective.org
ENVIRONMENT=production
```

Local values:

```txt
AUTH0_ISSUER_BASE_URL=https://<tenant>.auth0.com
AUTH0_CLIENT_ID=<Auth0 Development Regular Web Application Client ID>
DASHBOARD_BASE_URL=http://localhost:8787
ENVIRONMENT=development
```

For local development, `AUTH0_CALLBACK_URL` may be omitted so the Worker derives `http://localhost:8787/auth/callback` from `DASHBOARD_BASE_URL`. Development Origin validation accepts `DASHBOARD_BASE_URL` when configured and local Worker origins on `localhost` or `127.0.0.1` using HTTP or HTTPS on ports `8787` and `8788`. Production still requires the request `Origin` to match `DASHBOARD_BASE_URL`.

Secret setup command patterns:

```sh
pnpm exec wrangler secret put AUTH0_CLIENT_SECRET --config wrangler.production.jsonc
pnpm exec wrangler secret put SESSION_SECRET --config wrangler.production.jsonc
```

## Auth0

Use an Auth0 Regular Web Application. The Cloudflare Worker is the confidential OIDC client and performs the Authorization Code Flow server-side. React must not use the Auth0 SPA SDK and must not receive Auth0 tokens.

Production Auth0 application configuration:

- Application type: Regular Web Application.
- Allowed Callback URLs: `https://dashboard.rslcollective.org/auth/callback`.
- Allowed Logout URLs: `https://dashboard.rslcollective.org/login`.
- Application Login URI: `https://dashboard.rslcollective.org/login`.
- Allowed Web Origins: secondary for this architecture; add `https://dashboard.rslcollective.org` only if future browser-side Auth0 SDK behavior is introduced.
- Grant types: Authorization Code.
- ID token signing algorithm: RS256.
- Universal Login: enabled and branded in Auth0.

Custom domain setup for production:

- Configure `login.rslcollective.org` in Auth0 Branding or Custom Domains.
- Use Auth0-managed certificates unless there is a specific reason to self-manage certificates.
- Add the Auth0-provided CNAME in Cloudflare as DNS-only, not proxied, at least through validation.
- Keep the CNAME present for certificate renewal.
- After validation, set `AUTH0_ISSUER_BASE_URL=https://login.rslcollective.org`.

Staging should use a separate Auth0 tenant or application and separate Worker/D1 runtime values. Auth0 recommends separate tenants for development, staging, and production isolation. A staging custom login domain such as `login-staging.rslcollective.org` is recommended if staging needs to mirror production branding.

## D1

Cloudflare requirements:

- D1 database `rsl-collective-dashboard` exists in the same Cloudflare account as `account_id`.
- D1 binding name is `DB`.
- `d1_databases[0].database_id` in both Wrangler configs belongs to that same account.
- Remote migration is applied before production smoke testing.

Commands:

```sh
pnpm exec wrangler d1 create rsl-collective-dashboard --config wrangler.production.jsonc
pnpm db:migrate:local
pnpm db:migrate:remote
```

## Workers Assets And Routing

Cloudflare requirements:

- `dashboard.rslcollective.org` routes to this Worker.
- The production route exists only in `wrangler.production.jsonc`; the local/default `wrangler.jsonc` intentionally has no production `routes` or `custom_domain` entry.
- Workers Assets SPA fallback is configured with `not_found_handling: "single-page-application"`.
- `run_worker_first` is configured for `/`, `/register`, `/login`, `/auth/*`, `/logout`, and `/api/*`.
- `/dashboard` and nested dashboard routes are served by the SPA fallback.
- `/auth/callback` remains Worker-handled and must not be swallowed by the SPA fallback.

Production deploy:

```sh
pnpm check
pnpm build
pnpm test
pnpm exec wrangler whoami
pnpm db:migrate:remote
pnpm worker:deploy
```

## Local Worker Smoke Tests

Use Wrangler for local auth/API route testing. Vite-only development is useful for UI work, but it does not exercise Worker-first routes, D1 bindings, Origin behavior, Auth0 redirects, or SPA asset fallback.

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
- Without local Auth0 settings, `/register` and `/login` may fail clearly with an Auth0 configuration error instead of redirecting.
- Without an authenticated local session, `/api/session` returns unauthenticated and `/api/company` returns unauthenticated. The local PUT request above should return `401 Unauthorized`, not `403 Forbidden` for Origin.

## Production Smoke Test

1. Visit `https://dashboard.rslcollective.org/`.
2. Confirm unauthenticated access redirects to `/login`.
3. Complete Auth0 Universal Login or registration.
4. Confirm the callback returns through `/auth/callback` and lands on `/dashboard`.
5. Confirm a new user lands on Company Profile.
6. Create a company profile.
7. Refresh and confirm the profile persists.
8. Sign out.
9. Confirm the local session is cleared and the browser redirects through Auth0 logout to `/login`.
10. Log in again.
11. Confirm the company profile loads.

## Pre-Deploy Checklist

- `pnpm check` passes.
- `pnpm build` passes.
- `pnpm test` passes.
- `pnpm exec wrangler whoami` shows the intended Cloudflare account.
- `wrangler.production.jsonc` `account_id` is the Cloudflare account that controls `rslcollective.org`.
- Any placeholder account, D1, or Auth0 IDs in Wrangler configs have been replaced before deploy.
- D1 `database_id` belongs to the same Cloudflare account.
- Remote D1 migration is applied.
- Worker secrets and production runtime variables are set.
- Auth0 callback URL is allow-listed.
- Auth0 logout return URL is allow-listed.
- Auth0 custom domain `login.rslcollective.org` is verified with DNS-only CNAME while validating Auth0-managed certificates.
- `dashboard.rslcollective.org` route is active.
- `/auth/callback` is tested as Worker-handled.
