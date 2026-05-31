# HANDOFF — Holy Oly · arrancar el build en una sesión nueva

Este documento permite **continuar el proyecto desde cero de contexto** en otra sesión. Empezás el build real (mockup → app) con ejecución **subagente-driven**.

---

## ▶️ Cómo arrancar (pegá esto en la sesión nueva)

> Abrí una sesión de Claude Code en `C:\Holy Oly 0017` y pegá:

```
Leé docs/superpowers/HANDOFF.md, docs/superpowers/specs/2026-05-31-holy-oly-app-design.md
y docs/superpowers/plans/2026-05-31-holy-oly-foundation-coach.md.
Después implementá ese plan con la skill superpowers:subagent-driven-development,
empezando por la Task 1 (scaffold del monorepo). Un subagente por tarea, me mostrás
el review entre tareas. Commit por tarea; push por milestone (M1 y M2).
```

La memoria del proyecto (MEMORY.md + specs) se autocarga sola en la sesión nueva, así que el contexto de diseño ya va a estar.

---

## Qué es esto
**Holy Oly** — app móvil de macrociclos de halterofilia, coach⇄atleta. *Smart training, zero burnout.*
Estamos pasando de un **mockup navegable** a la **app real**, por slices verticales.

## Estado actual (lo que ya existe en el repo)
- `_mockup/` — prototipo completo en HTML/CSS/JS (referencia visual, **se conserva**): Inicio, Entreno, Macrociclos (catálogo+detalle, rol coach=asignar), Atleta Progreso (con ciclo), Coach Equipo + Drill-down (palmarés/medallas + asignar competencia/reestructuración), Asignar plan (RM+macro), PWA instalable (app.html/manifest/sw), medals.js.
- `macrocycles.ts` (raíz) — catálogo normalizado **24 programas / 10 escuelas** = fuente de verdad. **En la Task 4 se mueve a `packages/core/src/data/` y se borra de la raíz.**
- `docs/superpowers/specs/2026-05-31-holy-oly-app-design.md` — design doc (aprobado).
- `docs/superpowers/plans/2026-05-31-holy-oly-foundation-coach.md` — **el plan a ejecutar** (M1 + M2, ~14 tareas, TDD).
- Git: repo **`holy-oly-app`** en GitHub (privado, cuenta `esstipi-debug`), rama `main`, en sync.

## Decisiones bloqueadas (no re-preguntar)
- **Monorepo nuevo** (pnpm workspaces) en este repo: `apps/web` + `apps/api` (placeholder) + `packages/core`.
- **Frontend-first con datos locales** (patrón `Repository`: `LocalRepository`/localStorage ahora, `ApiRepository` después). Las pantallas **nunca** tocan storage directo.
- **Primer slice = vista coach** (Equipo + Drill-down + Asignar plan). M1+M2 son el cimiento; las pantallas coach son M3–M5 (otro plan).
- **Stack:** `apps/web` = Vite + React 18 + TS + Tailwind 3 + React Router 6; `packages/core` = TS puro + Vitest.
- **Backend (`apps/api`): lenguaje diferido** (TS vs FastAPI) — se decide en el slice de backend, NO ahora.
- **Port, no rehago:** los componentes salen del `_mockup/` (tokens `wl-themes`, charts SVG, Disc, Medal). Default tema **Neon PR**.

## Entorno (Windows)
- Node **v24.13.1**, pnpm **10.33.0**, npm 11.8 (usar **pnpm**). Git 2.54.
- Working dir: `C:\Holy Oly 0017` (= raíz del repo y del monorepo).
- `gh` autenticado como `esstipi-debug` (scope `repo`) → push directo OK.
- Inofensivo: warnings de git `LF will be replaced by CRLF`. Ignorar.

## Ejecución (subagente-driven)
- Skill: **superpowers:subagent-driven-development** sobre el plan. Un subagente por tarea, review entre tareas.
- **Commit por tarea** (mensajes ya están en el plan). **Push por milestone** (M1, M2). Terminar cada commit con:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- **Verificación:** `pnpm -r test` verde. Verificación visual del Gallery (M2) en `pnpm --filter @holy-oly/web dev` (:8743).
- **Definition of done:**
  - **M1:** `pnpm -r test` verde; `@holy-oly/core` exporta tipos + catálogo (24/10) + discos/monitor/restructure + `Repository`.
  - **M2:** `pnpm -r test` verde; `apps/web` bootea; el Gallery muestra tokens + primitivos + Disc + Medal + MacroTimeline en Neon PR y el cambio de tema funciona.

## Gotchas
- La **herramienta de captura de pantalla** estuvo trabada esta sesión (efecto del service worker del mockup). No bloquea nada: verificar por `pnpm test` y por estado/DOM (eval). El service worker vive en `_mockup/sw.js` (no afecta `apps/web`).
- **Render: pendiente de TU login** (no se puede automatizar: crear cuenta + OAuth). `render.yaml` ya publica `_mockup/` como sitio estático; conectar el repo en Render (New → Blueprint) cuando quieras la URL HTTPS (necesaria para instalar la PWA en el teléfono).
- No re-scaffoldear sobre archivos existentes; el plan asume el estado actual del repo.

## Después de M1–M2
Escribir el plan **M3–M5** (LocalRepository con seeds → Equipo → Drill-down → Asignar plan) referenciando este cimiento. Luego: slice atleta, auth + vinculación coach⇄atleta (spec en memoria), backend real, deploy.
