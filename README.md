# RSL Collective Dashboard

Authenticated profile dashboard for RSL Collective publishers. The app is a Vite React SPA served by a Cloudflare Worker, with Hono API/auth routes and D1-backed local sessions.

## Stack

- React 19, React Router DOM v7, TanStack React Query v5, Mantine v8
- Vite, TypeScript, Vitest, Testing Library, jsdom
- Cloudflare Workers, Workers Assets, Wrangler, Hono, D1
- Auth0 Universal Login with a Regular Web Application OIDC client

## Commands

```sh
pnpm install
pnpm check
pnpm build
pnpm test
```

Local Worker development:

```sh
pnpm db:migrate:local
pnpm worker:dev
```

`pnpm worker:dev` uses the local-safe `wrangler.jsonc` and does not include the production `dashboard.rslcollective.org` custom-domain route.

Production migration and deploy:

```sh
pnpm db:migrate:remote
pnpm worker:deploy
```

Production deploy uses `wrangler.production.jsonc`, which contains the `dashboard.rslcollective.org` custom-domain route.

## Deployment

See [docs/deployment.md](docs/deployment.md) for Cloudflare account targeting, D1 setup, Worker secrets, Auth0 configuration, and the production smoke test.

Use [docs/production-checklist.md](docs/production-checklist.md) for the final production setup sequence before running remote migrations or deploying.
