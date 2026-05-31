# Holy Oly — del prototipo a la app · Design doc

**Fecha:** 2026-05-31
**Decisión de partida:** monorepo nuevo (front+back) · **frontend-first** (datos locales) · **primer slice = vista coach**.

## 1. Contexto
- Tenemos un **mockup navegable** (`_mockup/`, vanilla HTML/CSS/JS) que ya exploró casi todo el diseño visual y de interacción, y el **catálogo normalizado** `macrocycles.ts` (24 programas / 10 escuelas) como fuente de verdad.
- Specs de referencia (memoria del proyecto): sistema-macrociclos (maestro), charts (data-viz móvil), design-system ("Neon Bloom"), plate/disc, ciclo menstrual, vinculación coach⇄atleta.
- Esto es el paso "mockup → app real". **No** es un único entregable: es una plataforma que se construye por **slices verticales**.

## 2. Objetivos / No-objetivos
**Objetivos (de este doc y los primeros slices):**
- App **real** (React, ruteable, componentes) — no más HTML de prototipo.
- Arquitectura que **escale a backend + multiusuario** sin reescribir la UI.
- **Reusar** el mockup: portarlo a componentes, no rehacerlo.
- **Slice 1 = vista coach** andando con datos locales.

**No-objetivos (por ahora, slices futuros):**
- Backend/API real, auth, multiusuario en servidor, deploy productivo, integración con el frontend/backend legacy (out-of-sync 23/9).

## 3. Arquitectura
- **Monorepo** con **pnpm workspaces**.
- **`apps/web`** — Vite + React + TS + Tailwind + React Router. La app.
- **`apps/api`** — placeholder; lenguaje (TS vs FastAPI) **diferido** al slice de backend.
- **`packages/core`** — dominio **TS puro** (tipos + catálogo + funciones), sin dependencias de UI ni de storage. Reusable por web hoy y por la api mañana.
- **Patrón Repository:** la web depende de una **interfaz** `Repository`, no de `localStorage`. Hoy `LocalRepository` (localStorage + seeds); mañana `ApiRepository`. **Las pantallas nunca tocan storage directo** → enchufar el backend = cambiar una implementación.

```
holy-oly-app/
  apps/
    web/                 # Vite + React + TS + Tailwind + Router
      src/
        app/             # router, layout, providers
        screens/coach/   # Equipo, Drilldown, AsignarPlan
        ui/              # design system (componentes)
        data/            # LocalRepository (impl de core.Repository)
    api/                 # placeholder
  packages/
    core/
      src/
        types/           # dominio
        data/            # macrocycles.ts (port) + catálogo
        logic/           # discos, monitor, reestructuración (puro + testeado)
        repository.ts    # interfaz Repository
  _mockup/               # referencia visual (se conserva)
  docs/superpowers/specs/
```

## 4. `packages/core` (dominio)
- **types:** `Atleta`, `Coach`, `Vinculo`(estados), `Macrocycle`+`MacrocyclePhase`, `Plan`(rms + macroId + startWeek + comps[]), `Medal`, `Competencia`, `MonitorSnapshot`.
- **data:** port de `macrocycles.ts` → `MACROCYCLES`, `phaseForWeek`.
- **logic (puro, con tests):**
  - `discs` — `perSide(kg)` + colores IWF (verdad = kg, discos aproximados).
  - `monitor` — ACWR (banda 0,8–1,3), bandas IMR por fase, recuperación vs base.
  - `restructure` — taper por competencia (`d = semanaCompetencia − semana`): 1 comp → adelanta; varias → repite.

## 5. Capa de datos (frontend-first)
- **`Repository`** (interfaz en core): `getRoster()`, `getAthlete(id)`, `getSeries(id)`, `getPlan(id)`, `savePlan(id, plan)`, `getMedals(id)`, `addMedal(id, m)`, `getComps(id)`, `setComps(id, c)`, `getCycleShare/State`…
- **`LocalRepository`** (en web): `localStorage` namespaced `ho:*` + seeds (roster + series mock + catálogo real). Migra los datos sueltos del mockup (`ho_comps`, `ho_medals`, `ho_cycle_*`) a un store coherente por atleta.

## 6. Design system (port del mockup)
- **Tokens `wl-themes`** (5 skins, default **Neon PR**) → CSS vars globales + theme de Tailwind. La paleta y los tokens **no cambian**.
- **Componentes React** (de lo que ya existe en el mockup):
  - Primitivos: `Button`/`GhostButton`, `Badge`, `Card`, `BottomSheet`, `Stepper`, `Chip`, `WeekPicker`, `Toast`.
  - Dominio: `Disc`, `DiscRow`, `Medal`, `PhaseRibbon`.
  - Charts (SVG → componentes): `LineWithBand` (ACWR/peso/recup), `IMRvsFase`, `MacroTimeline` (con reestructuración), `Heatmap`, `RiskQuadrant`, `Sparkline`, `PeriodizationChart`.
- **Regla:** los charts del monitor usan color = estado; vinculación/UI normal NO usan la paleta de estado; el ciclo usa su paleta lavanda neutra.

## 7. Slice 1 — Vista coach
**Rutas:** `/coach` (Equipo) · `/coach/a/:id` (drill-down) · `/coach/a/:id/plan` (asignar plan). Sheets: asignar competencia, añadir medalla.

**Pantallas (datos locales):**
- **Equipo** — heatmap del plantel (nombre sticky + scroll semanas) + cuadrante de riesgo (ACWR×recup); marca de competidor. Tap atleta → drill-down.
- **Drill-down del atleta** — los 8 gráficos del spec (series mock por atleta) + **Palmarés** (medallas, alta) + **Asignar competencia** (reestructura el macro, persiste; loop al atleta queda para el slice atleta).
- **Asignar plan** — RM con discos + macrociclo (catálogo real) + semana de inicio → guarda `Plan` local.

**Respeta:** privacidad del ciclo / datos sensibles (visibilidad propia) aunque sea vista coach.

## 8. Secuencia / milestones (commit+push por hito)
- **M1** — scaffold monorepo + `packages/core` (tipos + catálogo + funciones puras + tests vitest).
- **M2** — design system en React (tokens + primitivos + `Disc`/`Medal` + 1 chart de prueba).
- **M3** — **Equipo** (roster + heatmap + cuadrante) andando con `LocalRepository`.
- **M4** — **Drill-down** (8 charts + palmarés + asignar competencia/reestructura).
- **M5** — **Asignar plan** (RM + macro + semana).
- **M6** — pulido + verificación + (opcional) deploy web estático.

## 9. Testing
- `core`: unit tests (vitest) de las funciones puras (discos, monitor, reestructuración, `phaseForWeek`).
- `web`: smoke + componentes clave; verificación visual por milestone (preview).

## 10. Riesgos / decisiones abiertas
- **Backend** (lenguaje + reusar FastAPI legacy + converger 23/9→24/10): diferido al slice de backend.
- **"App terminada"** = varios slices más tras el coach (atleta, auth + vinculación, backend real, deploy). Este doc cubre el cimiento + el slice coach.

## 11. Próximo paso
Invocar **writing-plans** para detallar M1–M2 (scaffold + core + design system) y empezar a implementar, verificando por milestone.
