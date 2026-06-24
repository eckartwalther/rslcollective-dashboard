# Production Checklist

Do not run remote migrations or deploy until each configuration item below is complete.

## Clerk

- Production instance created.
- Production domain set to `dashboard.rslcollective.org`.
- Clerk DNS records added and validated.
- Allowed subdomains enabled and restricted to the dashboard subdomain.
- Email identifier enabled.
- Email verification required.
- Email verification codes preferred.
- Google social connection enabled with production OAuth credentials.
- Microsoft social connection enabled with production Entra ID credentials.
- Microsoft client secret expiration reminder created.
- Branding set to RSL Internet Collective.
- Clerk email SPF/DKIM records configured.
- DMARC configured for the sending domain.
- Active From addresses have real mailboxes.

## Cloudflare

- `wrangler.production.jsonc` has the correct Cloudflare account ID.
- `wrangler.production.jsonc` has the production D1 database ID.
- `wrangler.production.jsonc` keeps the `dashboard.rslcollective.org` custom-domain route.
- `wrangler.production.jsonc` includes:
  - `ADMIN_EMAILS=eckart@rslcollective.org`
  - `CLERK_AUTHORIZED_PARTIES=https://dashboard.rslcollective.org`
  - `DASHBOARD_BASE_URL=https://dashboard.rslcollective.org`
  - `ENVIRONMENT=production`
- Worker secret `CLERK_SECRET_KEY` is set.
- `CLERK_JWT_KEY` is unset unless networkless verification is intentionally enabled.

## Frontend Build

Set the Vite production build variable:

```sh
VITE_CLERK_PUBLISHABLE_KEY=<Clerk production publishable key>
```

Do not expose Worker secrets through Vite variables.

## D1 Reset

Current production D1 data is disposable.

- Use a fresh D1 database, or intentionally discard the old production database.
- Confirm `migrations/0001_core.sql` creates only `companies` and `users`.
- Confirm `users.auth_provider` and `users.auth_subject` remain provider-neutral.

## Pre-Deploy Validation

```sh
pnpm install
pnpm check
pnpm test
pnpm build
pnpm exec wrangler whoami
```

## Production Commands

Run only after the checklist above is complete:

```sh
pnpm exec wrangler secret put CLERK_SECRET_KEY --config wrangler.production.jsonc
pnpm db:migrate:remote
pnpm worker:deploy
```

## Smoke Test

1. Visit `https://dashboard.rslcollective.org/login`.
2. Confirm Clerk sign-in renders.
3. Visit `https://dashboard.rslcollective.org/register`.
4. Create a test account.
5. Complete email verification.
6. Confirm the dashboard loads.
7. Confirm `/api/session` returns authenticated user data in browser devtools.
8. Create a publisher profile.
9. Confirm `/api/company` returns the saved profile.
10. Sign out and confirm return to `/login`.
11. Sign in again with email.
12. Test Google sign-in.
13. Test Microsoft sign-in.
14. Confirm a direct unauthenticated API request returns `401`.
15. Confirm `/auth/callback` is not part of the auth flow and returns `404`.
16. Confirm `/api/admin/users` returns `403` for an authenticated non-admin user.
17. Confirm `/admin/users` shows the Admin users list for `eckart@rslcollective.org`.
18. Confirm `/admin/users` does not render user data for an authenticated non-admin user.
