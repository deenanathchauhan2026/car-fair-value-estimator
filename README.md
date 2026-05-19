# Car Fair-value Estimator

Private unpacked Chrome extension + Fastify API for estimating fair value of car listings.

## Requirements
- Node.js 22 LTS
- pnpm 9.15.4 (`corepack prepare pnpm@9.15.4 --activate`)
- Docker Compose

## Setup
```bash
pnpm install
cp .env.example .env
docker compose -f infra/docker-compose.yml up -d
pnpm --filter @car-value/api prisma:generate
pnpm --filter @car-value/api prisma:migrate
pnpm dev
```

API health: `http://localhost:4000/health`.

## Extension
```bash
pnpm --filter @car-value/extension build
```
Open Chrome → Extensions → Developer mode → Load unpacked → select `apps/extension/dist`.

Popup flow: scan current marketplace page → review listing summary → click **Estimate Fair Value** → see range, confidence, and comparables.

## Tests
```bash
pnpm typecheck
pnpm test
pnpm test:e2e
```

## Notes
- No auth/accounts; intended for Anuj only.
- Uses local PostgreSQL and deterministic fallback comparables when DB is empty/unavailable.
- Does not use KBB/Edmunds.
