# Holy Oly — Roadmap a producción (prototipo → SaaS desplegado)

- **Fecha:** 2026-06-01
- **Estado:** Roadmap aprobado · stack fijado · arranca Fase 0
- **Origen:** Revisión ECC read-only (4 agentes: architect, code-reviewer, security-reviewer, react-reviewer)
- **Repo:** monorepo pnpm · rama `claude/stupefied-greider-01c07c`

> Documento maestro de la iniciativa "completar la app a 100% operativa, en línea, con cobro". Cada fase abre su propio ciclo **brainstorm → planner → TDD → build → code-review + security-review** (reglas ECC). Este doc es la fuente de verdad del orden y el alcance; los specs por fase se escriben al llegar a cada una.

---

## 1. Decisiones fijadas

| Decisión | Elección |
|---|---|
| Hosting | **Render** |
| Backend/DB | **Render Postgres + API Node/TS + Prisma** |
| Auth | **Propia** (Lucia o Auth.js), cookies httpOnly |
| Pagos | **Mercado Pago** (Argentina/LatAm) |
| Monetización | **B2B — el coach paga suscripción**; invita atletas gratis |
| Arranque | **Fase 0 (quick wins) primero** |

---

## 2. Estado actual (qué es hoy)

Prototipo **frontend-only**: React 18 + Vite (`apps/web`) sobre `LocalRepository` (localStorage + seeds). Dominio puro en `packages/core` (tipos + lógica + catálogo de 24 programas + la interfaz `Repository`). 62 tests verdes. Sin backend, DB, auth, pagos ni deploy real.

**El mayor activo (de-risker):** el front consume solo la interfaz `Repository` (async, inyectada). Cambiar a backend real ≈ **un `HttpRepository` nuevo + una línea en el router**; las pantallas casi no cambian. `core` es puro → el server corre las **mismas** funciones de triage y devuelve los **mismos** tipos.

---

## 3. Hallazgos de la revisión (condensado)

**Arquitectura (gaps que bloquean producción):**
- Sin multi-tenant: `Repository` es por `athleteId`, `getRoster()` es global, no existe `coachId`. Es el cambio de esquema más grande → **modelar `coach` + `Vinculo` desde la 1ª migración**.
- `Vinculo` está en los tipos pero **100% sin cablear** → auth/relación coach⇄atleta es net-new.
- Sin vía de ingreso de telemetría (`MonitorSeries` solo llega por seeds; la app del atleta no existe).
- `render.yaml` publica `_mockup`, no `apps/web`. `core` no tiene build output (afecta importarlo desde una API Node).

**Seguridad (marco: hoy NO explotable — single-user localStorage; es checklist para cuando exista backend):**
- authz por ruta + **aislamiento por tenant** (scoping por coach + Vínculo activo).
- **redacción del ciclo server-side** (dato sensible; hoy en el cliente, `LocalRepository.getCycleContext`). Raw del ciclo nunca a un endpoint coach-facing.
- sacar el backdoor `__setCycleForTest` de prod; **webhook Mercado Pago con verificación de firma + idempotencia + allowlist de IPs**; CSP + headers; sourcemaps off; IDs UUID (no shortcodes adivinables); cifrado de datos de ciclo en reposo.

**Calidad:** 0 críticos. 2 altos → **validación Zod en el borde de datos** (`JsonStore` castea `JSON.parse as T` sin validar) y **MacroTimeline hardcodeado a 16 semanas** (= M4c, ya speceado). Lote de quick wins baratos.

**React (para backend async):** faltan estados de carga/error, **error boundaries**, TanStack Query (caching/retries/optimistic), `AbortSignal` en los effects; `BottomSheet` necesita portal + focus-trap + Escape (parte de M4c); accesibilidad por teclado en SVG interactivos (Heatmap/RiskQuadrant); no hay ESLint/CI.

---

## 4. Roadmap (6 fases)

### Fase 0 — Base limpia + deploy real *(en curso)*
Quick wins sobre el código actual + infraestructura de arranque. **No bloquea por decisiones de producto.**
- **Código (aprobado):** Zod en el borde de datos · extraer `MemStorage` a test-utils · keys estables en medallas · sacar código muerto (`intToState`/`stateToInt`) · dedup colores de Badge · `.catch` + estados de carga/error en `Drilldown`/`Equipo` · ESLint + reglas de hooks · sourcemaps off · `__setCycleForTest` a test-only · gatear `/gallery` a dev-only.
- **Infra:** arreglar `render.yaml` para construir/publicar `apps/web` (dist), no `_mockup`. *(Provisionar el servicio + DB en Render queda pendiente del login del usuario.)*
- Cierre: `pnpm -r test` verde + code-review + commit.

### Fase 1 — Esquema + API + `core` en el server
- Schema relacional desde los tipos de `core`, **con `coach` + `Vinculo` y el scoping por coach desde la 1ª migración** (Prisma). Seed del catálogo de macrocycles como dato de referencia (no por-tenant).
- API Node/TS (Fastify/Express) que importa `@holy-oly/core` (resolver el build de `core`). Endpoints de lectura devolviendo tipos de `core`, con `recovery` computado por `core` al escribir.
- Validación Zod en el borde de la API.
- Reshape clave: `MonitorSeries` (arrays paralelos) → filas `monitor_week` + hijos `wellness_item`.
- *Riesgo: medio (el reshape de series).*

### Fase 2 — `HttpRepository` (probar la abstracción)
- Implementar `Repository` contra la API; flip del provider en `router.tsx`. **Verificar que `Equipo`/`Drilldown` renderizan sin tocar pantallas.**
- TanStack Query + estados de carga/error + `AbortSignal` en los dos consumidores.
- *Riesgo: bajo — valida que todo el plan se sostiene. Hacerlo temprano.*

### Fase 3 — Auth + multi-tenant + Vínculo *(la fase más dura/sensible)*
- Auth real (Lucia/Auth.js), sesiones por cookie httpOnly.
- Tenancy: toda lectura scopeada por `coachId` de sesión; todo método por-atleta gateado por **Vínculo activo**.
- Construir el flujo **invite-code → pendiente → confirma** end-to-end (server + UI coach que falta).
- Mover y **forzar server-side** la redacción de `CycleContext`; tests de fuga (un coach nunca ve raw de ciclo ni atletas de otro coach).
- *Riesgo: el más alto — net-new y security-critical. Tests de autorización obligatorios.*

### Fase 4 — Escrituras + telemetría + app del atleta
- `savePlan`/`addMedal`/`setComps` como escrituras autorizadas (comps = replace transaccional).
- **Ingestión de series** → arranca la **app del atleta** (productor de telemetría; hoy no existe).
- **Aquí entran M4c** (interactividad del drill-down; spec en `docs/superpowers/specs/2026-06-01-m4c-drilldown-interactivity-design.md`) **y M5** (asignar plan).
- *Riesgo: medio-alto — la app del atleta es el esfuerzo no-dimensionado más grande.*

### Fase 5 — Mercado Pago + suscripción
- Suscripción del coach (preapproval), endpoint de webhook (**verificación de firma + idempotencia**), `subscription_status` como fuente de verdad del gating. Claves MP solo server-side (nunca `VITE_*`).
- *Riesgo: medio — casos borde de pagos. Aislado: puede ir en paralelo a Fase 4 una vez que existe auth (Fase 3).*

### Fase 6 — Hardening / launch
- CSP + headers de seguridad (en Render), rate-limiting, backups de Postgres, monitoring/error-tracking, E2E (Playwright), cifrado de datos de ciclo, export de datos ("el atleta es dueño de sus datos").

**Cadena de dependencias:** 0 → 1 → 2 corren rápido y prueban el diseño. **3 gatea 4 y 5** (sin auth/tenancy no hay escrituras ni pagos).

---

## 5. Riesgos top (de la revisión)

1. **Tenancy retrofitteada tarde = re-migración.** Modelar `coach` + `Vinculo` en la 1ª migración aunque el auth siga stub.
2. **`Vinculo` es vapor** — la pieza más grande de greenfield y es security-critical. Fase 3 es su propio proyecto.
3. **Redacción del ciclo al server sin fugas** — raw en tabla athlete-private; solo la proyección `CycleContext` al coach; tests de fuga.
4. **`MonitorSeries` blob → relacional** + no hay ingestión (la app del atleta no existe). Diseñar `monitor_week` temprano; dimensionar la app del atleta explícitamente.
5. **`render.yaml` apunta al artefacto equivocado** — primer deploy real puede sacar problemas de routing SPA/base-URL. Fase 0 lo arregla.
6. **Tokens de auth NO en localStorage** — cookies httpOnly desde el día 1 de Fase 3.
7. **`core` sin build output** — decidir tsx/bundler vs build en Fase 1.

---

## 6. Referencias

- Informes completos de los 4 agentes ECC (architect / code-reviewer / security-reviewer / react-reviewer) — sesión 2026-06-01. El checklist de seguridad pre-producción del security-reviewer es la guía detallada para Fases 3/5/6.
- Spec de M4c: `docs/superpowers/specs/2026-06-01-m4c-drilldown-interactivity-design.md`.
- Activos clave: `packages/core/src/repository.ts` (interfaz), `apps/web/src/data/LocalRepository.ts` (impl a portar), `packages/core/src/types/index.ts` (tipos → schema).
