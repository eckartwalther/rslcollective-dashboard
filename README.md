# RSL Collective Dashboard

Authenticated profile dashboard for RSL Collective publishers. The app is a Vite React SPA served by a Cloudflare Worker, with Clerk-native browser sessions, Hono API routes, and D1-backed user/company records.

## Stack

- React 19, React Router DOM v7, TanStack React Query v5, Mantine v8
- Vite, TypeScript, Vitest, Testing Library, jsdom
- Cloudflare Workers, Workers Assets, Wrangler, Hono, D1
- Clerk React components with Worker-side Clerk session-token verification

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

See [docs/deployment.md](docs/deployment.md) for Cloudflare account targeting, D1 setup, Worker secrets, Clerk configuration, and the production smoke test.

Use [docs/production-checklist.md](docs/production-checklist.md) for the final production setup sequence before running remote migrations or deploying.
