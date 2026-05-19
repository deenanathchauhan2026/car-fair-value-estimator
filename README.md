# Car Fair-value Estimator

Private unpacked Chrome extension + Fastify API for estimating fair value of car listings.

## Requirements
- Node.js 22 LTS
- pnpm 9.15.4 (`corepack prepare pnpm@9.15.4 --activate`)

## Setup
```bash
pnpm install
pnpm dev
```

Then open Chrome → Extensions → Developer mode → Load unpacked → select `apps/extension/dist`.

Done.

`pnpm dev` starts both:
- Fastify API at `http://localhost:4000` (`/health` for health checks)
- Extension Vite dev build

The API uses a local SQLite database file in the project directory (`car-value.sqlite`) via `better-sqlite3`. No Docker, PostgreSQL, or separate database server is required.

## Tests
```bash
pnpm typecheck
pnpm test
pnpm test:e2e
```

## Notes
- No auth/accounts; intended for Anuj only.
- Uses local SQLite and deterministic fallback comparables when DB is empty/unavailable.
- Does not use KBB/Edmunds.
