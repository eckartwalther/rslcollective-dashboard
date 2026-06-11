# RSL Collective Dashboard

Authenticated profile dashboard for RSL Collective publishers. The app is a Vite React SPA served by a Cloudflare Worker, with Hono API/auth routes and D1-backed local sessions.

## Stack

- React 19, React Router DOM v7, TanStack React Query v5, Mantine v8
- Vite, TypeScript, Vitest, Testing Library, jsdom
- Cloudflare Workers, Workers Assets, Wrangler, Hono, D1
- WorkOS/AuthKit for hosted authentication

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

Production migration and deploy:

```sh
pnpm db:migrate:remote
pnpm worker:deploy
```

## Deployment

See [docs/deployment.md](docs/deployment.md) for Cloudflare account targeting, D1 setup, Worker secrets, WorkOS/AuthKit configuration, and the production smoke test.
