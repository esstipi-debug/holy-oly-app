# Plan — Calendario heat-map del plan (coach + atleta)

> Spec: `docs/superpowers/specs/2026-06-10-calendario-heatmap-design.md`. Orden: core → API →
> data clients → UI compartida → coach → atleta → verificación + review. TDD por pieza.

## T1 — core: `planHeat`
- `packages/core/src/types/index.ts`: `DayHeat`, `WeekHeat`.
- `packages/core/src/logic/planHeat.ts`: `planHeat(rows, totalWeeks)`, `maxLifts(heat)`.
- `packages/core/src/schemas.ts`: `WeekHeatSchema`, `WeekHeatsSchema`.
- `MePlanView.plan.startDate?` (types + schema + `buildMePlanView` lo copia del plan).
- `index.ts`: export. Tests: `planHeat.test.ts` (agrupación, máx pct, Σ lifts, semana vacía,
  sin-%, sessionIdx>6 ignorado, totalWeeks fijo) + schema test si aplica.

## T2 — api
- `repo.ts`: `getPlanHeat(prisma, athleteId)` (select liviano, core `planHeat`).
- `server.ts`: `GET /athletes/:id/heat` (guardAthlete).
- `me/routes.ts`: `GET /me/heat` (requireAthlete).
- Int tests `heat.int.test.ts`: coach 200 con shape, sin vínculo 403, atleta `/me/heat` 200,
  `/me/plan` trae `startDate`.

## T3 — data clients (web)
- `repository.ts`: `getPlanHeat(id)`.
- `LocalRepository`: desde `prescriptionRows(id)` + totalWeeks del macro del plan.
- `HttpRepository`: GET + `WeekHeatsSchema`. Tests de ambos.
- `meClient.ts` (+ iface), `httpMeClient`, `LocalMeClient`: `getMeHeat()`. Tests.

## T4 — UI compartida
- `ui/charts/heatPalette.ts`: rampa + `heatTone(topPct?)` + `heatAlpha(lifts, max)` + neutro.
- `ui/charts/PlanHeatMap.tsx`: grilla compacta (cuadrados 18px, hitos, franjas de fase, HOY,
  compe dorada), tap → `onSelectDay`.
- `ui/charts/PlanDayDetail.tsx`: fase+objetivo, estado, filas kg + `DiscRow`; variantes
  compe/descanso; kg null → «—» sin discos.
- Tests: palette (paradas/alpha/neutro), map (render, click, hoy/comp), detail (DiscRow presente
  con kg, ausente sin kg, focus visible).

## T5 — coach
- `PlanCalendar.tsx`: seg [Mapa|Lista] al abrir (Mapa default); mapa con lazy `loadHeat` +
  `loadWeek` cacheado + `PlanDayDetail` (estado desde `marks`); lista intacta.
- `Drilldown.tsx`: pasa `loadHeat`/`loadWeek`/`sexo`/`today`.
- Tests `PlanCalendar.test.tsx`: los 3 existentes adaptados (lista vía toggle) + mapa default +
  tap día → desglose con disco.

## T6 — atleta
- `PlanDetailSheet.tsx`: sección «Mapa del plan» (lazy heat vía `client`), día → `getMeSessions`
  → `PlanDayDetail` con `barKgForSexo(athlete.sexo)`.
- Quien abre el sheet pasa `client` (HomeScreen / preview del coach). Test del sheet con mock.

## T7 — verificación + review + commit
- `pnpm -r typecheck && pnpm -r test && pnpm --filter @holy-oly/api verify`; eslint.
- Review de dominio (rulebook `docs/domain/HOLY-OLY-DOMAIN.md`) + react review sobre el diff.
- Commit(s) convencionales en esta rama worktree; sin push.
