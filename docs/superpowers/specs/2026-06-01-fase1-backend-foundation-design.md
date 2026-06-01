# Fase 1 — Fundación backend (Prisma + Fastify + Postgres)

- **Fecha:** 2026-06-01
- **Hito:** Fase 1 del roadmap a producción (`2026-06-01-production-readiness-roadmap.md`)
- **Estado:** Diseño aprobado · listo para build (subagent-driven, review por tarea)
- **Stack fijado:** Render (prod) · **Postgres local por Docker (dev)** · **Prisma** · **Fastify** · Node/TS API en `apps/api`

---

## 1. Contexto

El front consume solo la interfaz `Repository` (async, inyectada) y `packages/core` es dominio puro. Fase 1 levanta el backend que en Fase 2 implementará `Repository` server-side (vía un `HttpRepository`), reusando `core` (mismas funciones + schemas Zod). Hoy no hay servidor/DB.

## 2. Decisiones

- **API:** Fastify (Node/TS) en `apps/api`. Dev `tsx watch`; prod bundle (tsup) que incluye `core` → **`core` queda zero-build** (se consume como fuente; no se toca su `main`).
- **DB dev:** Postgres por Docker (`docker-compose.yml`), mismo motor que Render. DBs `dev` + `test`.
- **Auth:** **STUB en Fase 1** (un `Coach` sembrado; el `coachId` se resuelve de una constante/header de dev). Auth real = Fase 3. Las lecturas YA se escriben coach-scoped para que Fase 3 solo cambie la resolución del coach.
- **Catálogo de macrocycles:** se queda en `core` (dato estático). No va a tabla. Los `macroId` son referencias string.
- **Alcance:** solo **lecturas** en Fase 1. Escrituras/ingesta → Fase 4. Mercado Pago → Fase 5. `HttpRepository` (conectar front) → Fase 2.

## 3. Modelo de datos (Prisma → Postgres)

- **`Coach`** (tenant): `id` (uuid), `email` (unique), `name`. *(suscripción → Fase 5.)*
- **`Athlete`**: `id` (uuid), `nombre`, `iniciales`, `nivel` (enum), `macroId?`, `compite` (bool, default false), `weightBandLo?`, `weightBandHi?` *(la banda de categoría del chart de Peso; series-level hoy → vive en el atleta)*.
- **`Vinculo`**: `id`, `coachId` → Coach, `athleteId` → Athlete, `estado` (enum: pendiente/activo/rechazado/revocado), `inviteCode?`, `createdAt`. **Join de multi-tenancy**: `@@unique([coachId, athleteId])`. Toda lectura coach-scoped exige un Vínculo `activo`.
- **`Plan`**: `id`, `athleteId` (unique → un plan vigente por atleta), `macroId`, `startWeek`, `rms` (Json: {arranque,envion,sentadilla,frente}), relación `Competencia[]`.
- **`Competencia`**: `id`, `athleteId`, `name`, `week`. *(El store de comps es athlete-scoped, como `getComps` hoy; se reconcilia con `Plan` en M5.)*
- **`MonitorWeek`**: `id`, `athleteId`, `week`, `acute`, `hrv`, `hrvBase`, `rhr`, `rhrBase`, `imr`, `wellness`, `recovery`, `compliance?`, `rpe?`, `bodyweight?`. `@@unique([athleteId, week])`. **`recovery` se computa con `core.recoverySeries` al escribir** (no se confía en input).
- **`WellnessItem`**: `id`, `monitorWeekId` → MonitorWeek, `key`, `value` (number). Normaliza el `Record<string,number[]>` en filas por (semana, ítem). `@@unique([monitorWeekId, key])`.
- **`CycleConsent`** (athlete-private): `athleteId` (unique), `share` (enum full/min/none), `state` (enum regular/unreliable/amenorrhea). El coach NUNCA lee esta tabla directo: solo recibe el `CycleContext` computado.

Enums Prisma: `Nivel`, `VinculoEstado`, `CycleShare`, `CycleState` (espejan los tipos de `core`).

## 4. Mapeo `MonitorSeries` ↔ relacional (la pieza más delicada — TDD)

Funciones puras (en `apps/api`, testeadas sin DB):
- `seriesToRows(athleteId, s: MonitorSeries) → { weeks: MonitorWeekInput[], items: WellnessItemInput[] }`
- `rowsToSeries(weeks, items) → MonitorSeries` (round-trip: `rowsToSeries(seriesToRows(s)) ≈ s`).
`recovery` se recomputa con `core.recoverySeries` en la escritura (la fila guarda el resultado, igual que los seeds hoy).

## 5. API (Fastify, solo lectura, coach-scoped)

Resolución del coach (stub): middleware que setea `req.coachId` desde una constante/header de dev (`x-dev-coach`). En Fase 3 se reemplaza por la sesión.

Endpoints (devuelven **tipos de `core`**, validados con los schemas Zod de `core`; Zod valida params en el borde):
- `GET /roster` → atletas con Vínculo `activo` al coach.
- `GET /athletes/:id/series` → `MonitorSeries | 404`.
- `GET /athletes/:id/plan` → `Plan | 404`.
- `GET /athletes/:id/medals` → `Medal[]`.
- `GET /athletes/:id/comps` → `Competencia[]`.
- `GET /athletes/:id/cycle` → `CycleContext` **redactado server-side** (reusa la lógica hoy en `LocalRepository.getCycleContext`); nunca expone share/state crudos.
- Cada `:id` se **autoriza contra un Vínculo activo** del coach antes de responder (404/403 si no).
- `GET /health` (liveness).

## 6. Seeding

`apps/api/prisma/seed.ts` espeja `apps/web/src/data/seeds.ts`: 1 `Coach` stub + 8 `Athlete` + `Vinculo` activos + serie/medallas/ciclo de Mara (+ los mapeos `metodo→macroId` que ya se decidieron para M4c). Transforma `MonitorSeries` → `MonitorWeek[]` + `WellnessItem[]` con `seriesToRows`.

## 7. Testing

- **Unit (sin DB):** `seriesToRows`/`rowsToSeries` round-trip; la lógica de autorización por Vínculo; la redacción de `CycleContext`.
- **Integración (Docker PG `test`):** migra + seed + golpea cada endpoint; incluye un test de **aislamiento** (un coach NO ve atletas de otro coach; `:id` sin Vínculo → 403/404) y de **no-fuga de ciclo** (el endpoint nunca devuelve share/state crudos).
- *(Correr integración requiere Docker arriba — máquina del usuario. Los unit corren sin DB.)*

## 8. Secuencia de tareas (subagent-driven, review por tarea)

1. Scaffold `apps/api` (Fastify + Prisma + tsconfig + scripts) + workspace.
2. `docker-compose.yml` (Postgres dev+test) + `.env.example`.
3. Prisma schema (todas las tablas + enums, **Coach+Vinculo incluidos**) + 1ª migración.
4. Mapeo `seriesToRows`/`rowsToSeries` (TDD) reusando `core`.
5. `prisma/seed.ts` (espeja seeds.ts).
6. Endpoints read coach-scoped + Zod + redacción de ciclo.
7. Tests unit + integración (incl. aislamiento y no-fuga).
8. Code-review + security-review ECC; `pnpm -r test` verde; commit.

## 9. Riesgos / notas

- **Tenancy desde la 1ª migración** (Coach+Vinculo) — no retrofittear. Las lecturas nacen coach-scoped aunque el auth sea stub.
- **Redacción de ciclo server-side**: la `CycleConsent` es athlete-private; solo se expone el `CycleContext` computado. Test de no-fuga obligatorio.
- **`core` en el server**: se consume como fuente vía bundle (tsup) en prod y `tsx` en dev; si surge fricción de resolución, alternativa = darle build a `core`.
- Provisioning de Render (servicio + DB prod) sigue **pendiente del login del usuario**; Fase 1 se construye/testea local.
