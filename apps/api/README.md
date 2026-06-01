# @holy-oly/api — Fase 1 (backend foundation)

Fastify + Prisma + Postgres. Coach-scoped **read** API that reuses `@holy-oly/core`
(same triage functions + Zod schemas). Auth is a **stub** in Fase 1 (dev header
`x-dev-coach`); real session auth lands in Fase 3.

## Verify end-to-end with ONE command (no Docker)

Spins up a throwaway Postgres via `embedded-postgres` (UTF8), applies the committed
migration, seeds, runs the integration tests, and tears everything down:

```bash
pnpm --filter @holy-oly/api verify
```

Use this when Docker isn't available. For a persistent local DB, use the Docker path below.

## Run the DB + API (Docker, for a persistent local DB)

```bash
cd apps/api
cp .env.example .env

# 1) Start Postgres (dev + test DBs)
docker compose up -d

# 2) Generate client + apply the committed migration (0_init)
pnpm prisma:generate
pnpm exec prisma migrate deploy

# 3) Seed (coach + 8 athletes + Mara fully instrumented)
pnpm db:seed

# 4) Dev server (tsx watch, :8787)
pnpm dev
```

## Tests

```bash
pnpm test       # unit — no DB (mapping round-trip + cycle redaction)
pnpm test:int   # integration — needs a migrated+seeded DB; point DATABASE_URL at the test DB
```

For integration against the test DB:

```bash
$env:DATABASE_URL = "postgresql://holyoly:holyoly@localhost:5433/holyoly_test?schema=public"  # PowerShell
pnpm exec prisma migrate deploy
pnpm db:seed
pnpm test:int
```

## Endpoints (coach-scoped; pass `x-dev-coach` in Fase 1)

| Method | Path | Returns |
|---|---|---|
| GET | `/health` | `{ ok: true }` |
| GET | `/roster` | athletes with an `activo` Vinculo to the coach |
| GET | `/athletes/:id/series` | `MonitorSeries` (403 if no link, 404 if none) |
| GET | `/athletes/:id/plan` | `Plan` |
| GET | `/athletes/:id/medals` | `Medal[]` |
| GET | `/athletes/:id/comps` | `Competencia[]` |
| GET | `/athletes/:id/cycle` | redacted `CycleContext` (never raw share/state) |
