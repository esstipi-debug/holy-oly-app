# Calendario del plan (lista de semanas) · Design doc

**Fecha:** 2026-06-02
**Estado:** aprobado en brainstorming, pendiente de plan.
**Origen:** pedido del coach — segunda de dos features (la primera, charts Fase 2, ya shippeada). El Carnicero como **oráculo de diseño** (verificado contra el código): el entrenamiento se modela **por semana** (no hay dato por-día — eso es la app del atleta, futuro), así que el calendario honesto es una **lista de semanas anclada a fechas**, no una grilla de mes con celdas-día vacías.

## 1. Problema / objetivo

El coach quiere un **calendario** del plan de un atleta: ver, semana a semana, en qué fechas reales cae cada semana del macro, en qué fase está, cómo va la adherencia, dónde están las competencias y cuál es HOY. Tocar una semana abre el detalle de esa semana (el `WeekDetailSheet` que ya existe). Es superficie **de coach**, per-atleta, dentro del drill-down.

## 2. Decisiones (aprobadas por el coach)

- **Fork A — per-SEMANA sobre el dato actual, SIN migración.** El modelo es semanal (`MonitorSeries`, `SessionLog`, `phaseProfile`, `Plan.startDate` ya existen). Un calendario per-día (extender `SessionMark` a fechas) es **Fork B futuro** — no se hace acá.
- **Layout = LISTA DE SEMANAS** (aprobado explícitamente). Filas verticales, una por semana, ancladas a fechas con `dateOfWeek(startDate, w)`. **No** grilla de mes (implicaría datos por-día inexistentes → celdas vacías) ni cinta horizontal (la duplicaría `MacroTimeline` y queda apretada en mobile con 12–16 sem).
- **Adherencia: CONVIVEN, calendario plegable** (aprobado). La grilla densa editable (`SessionAdherence`) **se queda** como editor rápido de muchas semanas; el calendario es la **vista-overview** con fechas/fase/comps y va en una sección **colapsable** (default cerrada) para no alargar el drill-down. La fila del calendario muestra la adherencia como **resumen** (`weekDone/perWeek`); la edición sigue ocurriendo en la grilla o en el `WeekDetailSheet`.
- **Cero wiring nuevo de detalle (DRY):** el `Drilldown` ya posee `selectedWeek` + renderiza `WeekDetailSheet` y los 7 charts ya llaman `onPointClick={setSelectedWeek}`. La fila del calendario sólo emite `onWeekClick(week)` → `setSelectedWeek` → **el mismo sheet**. Un panel, una ruta de escritura.
- **Aditivo:** sin migración, sin endpoint nuevo, sin nueva ruta de escritura. La adherencia editable del sheet reusa `onToggleSession` (Repository, optimistic+rollback) ya existente.

## 3. Componentes

- **Nuevo — `phasePalette.ts`** (`apps/web/src/ui/charts/`): extrae la **paleta neutra de fases** (`PHASE_RAMP` + `phaseColor(i)`) que hoy vive local en `MacroTimeline`. Categórica, NO semáforo (no colisiona con `STATUS`). Compartida por `MacroTimeline` (cinta) y `PlanCalendar` (chips) → garantiza que ambas vistas coloreen la misma fase igual. `MacroTimeline` se modifica para importarla (reemplaza su `RAMP` local).
- **Nuevo — `planRows.ts`** (puro, `apps/web/src/screens/coach/calendar/`): `planWeeks(macro, weeks, startDate, hoyWeek, comps, marks, perWeek) → PlanWeekRow[]`, una fila por semana con `{ week, range, phaseName, phaseIndex, done, perWeek, isToday, isTaper, comp? }`, reusando `dateOfWeek`/`phaseForWeek`/`isTaperWeek`/`weekDone`. Incluye `weekRangeLabel(startDate, week)` ("2–8 jun" mismo mes / "29 may–4 jun" cruza mes). Testeable sin render.
- **Nuevo — `PlanCalendar.tsx`** (`apps/web/src/screens/coach/calendar/`): sección **plegable** (header que togglea; default cerrada). Abierta, lista las filas; cada fila es un `<button>` tappable que muestra Sem N + rango de fechas + chip de fase (color por `phaseColor(phaseIndex)`) + `done/perWeek` + 🚩 comp / "taper" + resaltado **HOY**. Tap → `onWeekClick(week)`.
- **Modificado — `weekSignals.ts`:** acepta `series: MonitorSeries | undefined`. Sin serie → 7 filas todas "sin dato" (disciplina de faltante, nunca falso-verde). Habilita abrir el sheet para un atleta con plan pero **sin monitoreo** (§4).
- **Modificado — `Drilldown.tsx`:** computa `hoyWeek = weekOfDate(startDate, today, maxWeek)`, rendea `{macro && <PlanCalendar … onWeekClick={setSelectedWeek} />}`, y **abre el `WeekDetailSheet` aunque no haya serie** (cambia el guard `series && …` → `selectedWeek != null`, con `signals` "sin dato" vía `weekSignals(undefined,…)`).

## 4. Edge case: atleta con plan pero sin monitoreo

Hoy el `WeekDetailSheet` sólo se rendea si hay `series` (la necesitaba `weekSignals`). Un atleta con macro asignado pero sin HRV/carga registrada tendría el calendario pero el tap no abriría nada. Fix: `weekSignals` series-opcional + abrir el sheet con `selectedWeek != null`. El panel muestra entonces fecha + 7 señales "sin dato" + adherencia (que no depende de la serie). El calendario en sí no necesita serie: se arma del **plan** (macro/fase/fechas/comps) y del `SessionLog`.

## 5. HOY anclado a fecha

`hoyWeek = weekOfDate(startDate, today, maxWeek)`. Con `plan.startDate` real (asignado en M5) es la semana actual **verdadera por fecha**; sin él, `startDate = defaultStartDate(today, series.weeks)` hace que `weekOfDate` devuelva `series.weeks` — consistente con el `hoy` que ya usa `MacroTimeline`. Verdad anclada a la fecha, degradación correcta.

## 6. Privacidad

El calendario se arma de `Plan`/`Macrocycle`/`Competencia`/`SessionLog` — **cero** dato de ciclo. Superficie de coach; las cifras de adherencia (`done/perWeek`) son correctas acá (no es la vista del atleta gameable, HR-1). El chip de fase es neutro, jamás semáforo.

## 7. Verificación

- **TDD:** (a) `phaseColor` — color por orden, modulo; (b) `planWeeks`/`weekRangeLabel` — una fila por semana, HOY, comp mapeada, fase/índice por semana, `done`, taper, rango mismo-mes/cruza-mes; (c) `PlanCalendar` — colapsado por default, abrir lista filas, tap → `onWeekClick`, HOY/🚩 visibles; (d) `weekSignals(undefined,…)` → 7 "sin dato".
- **El Carnicero revisa** el diff: paleta neutra (no semáforo), disciplina sin-dato, HOY por fecha, privacidad (sin ciclo), detalle/escritura por el sheet reusado.
- web build + tsc + eslint limpios; tests verdes; deploy (push a main = Render).

## 8. Fuera de scope (futuro)

- **Calendario per-día** (Fork B): extender `SessionMark`/`Plan` a fechas de sesión reales → app del atleta / telemetría.
- **Vista del atleta** del calendario: gated por la app del atleta (no existe).
- **Calendario multi-atleta / agenda del coach** (todas las competencias del plantel en un mes): otra pantalla, futuro.

## 9. Próximo paso

Invocar **writing-plans** (orden: `phasePalette` + refactor `MacroTimeline` → `planRows` builder puro → `PlanCalendar` componente plegable → `weekSignals` series-opcional → wiring en `Drilldown` → review de El Carnicero → verificación + deploy).
