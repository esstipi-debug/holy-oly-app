# HANDOFF — Holy Oly (estado para retomar en un chat nuevo)

**Fecha:** 2026-06-01 · **Objetivo global:** completar la app a producción (100% operativa, online, con cobro). Roadmap maestro: `docs/superpowers/specs/2026-06-01-production-readiness-roadmap.md` (6 fases).

## Dónde estamos parados

- Monorepo pnpm: `packages/core` (dominio puro + tipos + schemas Zod), `apps/web` (React 18 + Vite), `apps/api` (Fastify 5 + Prisma 6 + Postgres).
- **En `main`:** Fase 0 + Fase 1 (read API) + Fase 2 (`HttpRepository`) + **Fase 3 (auth + Vínculo) COMPLETA** + **Fase 4 slices 1-2** (escrituras coach autorizadas + `HttpRepository` writes). Todo verificado (`main` @ `bbb8125`).
- **Fase 3 mergeada a `main` por fast-forward** (7 commits sobre el viejo `73cdbb7`): slices 1-4 (`fafa2a6` modelo/seed, `210fe25` auth core, `6e66512` vínculo API, `65ad037` front auth), slice 5 (`9cb2d22` Vínculo UI), slice 6 (`9487671` e2e full-flow), y **review ECC** (`3167f09` fixes auth/vínculo).
- **Working tree limpio.** La rama `claude/stupefied-greider-01c07c` ya no tiene nada pendiente.

## Qué entró en Fase 3

- **Auth propia, sesión-cookie:** signup/login/logout/me; token = 20 bytes random base32, se guarda sólo `sha256(token)` (id de `Session`); cookie httpOnly + SameSite=Lax + secure en prod (`@oslojs` + `@fastify/cookie`). Passwords: argon2id (`@node-rs/argon2`, prebuilt). Hook `onRequest` resuelve la cookie → `req.coachId`/`req.athleteId` (reemplazó el stub `x-dev-coach`).
- **Multi-tenant authz:** reads coach-scoped exigen sesión de coach (401) **y** Vínculo activo (403). Redacción de ciclo server-side intacta.
- **Flujo Vínculo completo:** coach rota/ve su `inviteCode` y confirma/rechaza pendientes; atleta ingresa el código → solicitud `pendiente`. UI: `InvitacionesScreen` (coach) + `AtletaScreen` (atleta) + `vinculoClient`. API: `vinculo/routes.ts` (rotate/accept/confirm/deny, owner-checked, accept idempotente).
- **Front modo dual:** con `VITE_API_URL` → `HttpRepository` + auth real; sin él → `LocalRepository` (demo localStorage, guards en pass-through).

## Review ECC aplicada (security + TS) — `3167f09`

- signup **transaccional** (User + perfil atómicos; evita usuario huérfano sin coachId/athleteId).
- **email normalizado** (trim+lowercase) en signup/login.
- **CORS exige `WEB_ORIGIN` en producción** (el fallback `?? true` con credentials reflejaba cualquier Origin).
- confirm/deny de Vínculo sólo sobre estado `pendiente` (409 si no).
- `clearCookie` replica los flags de la cookie; seed con credenciales por env (`SEED_COACH_*`/`SEED_INVITE_CODE`).
- web: `authClient.me()` valida con `AuthUserSchema` (Zod); `AuthContext` memoiza el value.
- **Diferido a Fase 5/6** (no bloquea): rate-limiting en auth/vínculo, CSRF token / SameSite=Strict, single-session en login, headers de seguridad (HSTS/etc.).

## Verificado (todo verde)

`94 unit` (core 27 + api 11 + web 56) + `15 integración` (auth/vínculo 9 + escrituras 6) + **e2e full-flow sobre HTTP real** (`pnpm --filter @holy-oly/api e2e`, Fase 3): 401 → login → roster 8 → ciclo redactado → signup atleta → accept (pendiente) → coach confirma → roster 9. `tsc` (core/web/api) + `pnpm lint` + web prod build limpios.

## Cómo verificar (NO hay Docker/Postgres/WSL en la máquina)

- `pnpm --filter @holy-oly/api verify` → levanta Postgres efímero (`embedded-postgres`), migra, siembra y corre los 15 tests de integración (auth/vínculo + escrituras).
- `pnpm --filter @holy-oly/api e2e` → flujo HTTP completo (auth + Vínculo) contra PG embebido.
- `pnpm -r test` (unit) · `pnpm -r typecheck` · `pnpm lint`.
- Migraciones nuevas: `apps/api/scripts/make-migration.ts` (embedded-PG + `migrate diff`, no-interactivo).

## Gotchas críticos (no re-descubrir)

- **Locale del host = Spanish_Chile.1252 → WIN1252.** Los scripts pasan `initdbFlags: ["--encoding=UTF8","--locale=C"]` (prod Render PG ya es UTF8). Sin eso, chars como `−` (U+2212) rompen el seed.
- **argon2 = `@node-rs/argon2`** (prebuilt; el `argon2` normal falla por node-gyp en Windows). **CORS:** `@fastify/cors` (credentials) — ahora **requiere `WEB_ORIGIN` en prod**.
- **Prisma pin v6** (v7 da fricción). Migraciones `0_init` + `1_auth` committeadas.
- **Cuentas demo (del seed):** coach `coach@holyoly.dev` / `holyoly-demo`; inviteCode `HOLY-DEMO` (ahora overridables por env `SEED_COACH_EMAIL`/`SEED_COACH_PASSWORD`/`SEED_INVITE_CODE`).
- Los tests de `apps/web` inyectan su repo y NO pasan por el router/auth.

## Fase 4 EN CURSO — slices 1-2 hechos; EMPEZAR ACÁ = slice 3 (M4c UI)

Spec de la fase: `2026-06-01-fase4-writes-design.md` (decomposición 1-6 por riesgo/dependencia).

- **Hecho (en `main`):** **slice 1** (`9171619`) escrituras coach autorizadas en la API — `PUT /athletes/:id/plan` (upsert, ignora `plan.comps`), `POST /athletes/:id/medals` (append), `PUT /athletes/:id/comps` (replace transaccional); bajo `guardAthlete` (coach 401 + Vínculo 403) + check `body.atletaId === :id` (400). **slice 2** (`bbb8125`) `HttpRepository` writes (los 3 stubs reemplazados → abstracción `Repository` cerrada). Review ECC aplicada (bounds de input en `core/schemas`, `mutate` consume body, JSDoc del contrato `savePlan`). **94 unit + 15 integración** verdes.
- **EMPEZAR ACÁ → slice 3 = UI de escritura M4c** (spec propio `2026-06-01-m4c-drilldown-interactivity-design.md`, ya aprobado): primer **consumidor real** de las writes — sheets de comp/medalla + `MacroTimeline` data-driven + overlay luteal en el Drilldown. OJO: hoy **ninguna UI llama writes** (los stubs eran inalcanzables); M4c es quien las cablea. Añadir **manejo de error** en los submit (M4c asumía `LocalRepository`, que nunca falla; contra HTTP el write puede dar 403).
- **Luego:** slice 6 (**M5** asignar plan, sobre `savePlan`) · **[gated por design doc]** slice 4 (ingestión de telemetría — nuevo eje de authz: atleta-sobre-sí-mismo vía `requireAthlete`, scope a `req.athleteId`, **NO** requiere Vínculo) · **[gated por brainstorm+doc]** slice 5 (**app del atleta** — el esfuerzo no-dimensionado más grande). Recordar: `ruso-5d` = **16 sem**, serie de Mara = **12** (timeline: eje = semanas del macro, HOY = largo de serie).

**Fase 5** (Mercado Pago — suscripción del coach; paralelizable a Fase 4) y **Fase 6** (CSP/headers/rate-limit, **E2E Playwright browser**, backups, cifrado de ciclo, export "el atleta es dueño de sus datos") después. **Render provisioning prod sigue pendiente del login del usuario.**
