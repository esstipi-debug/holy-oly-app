# Puntos clickeables → panel de semana (editable) · Design doc

**Fecha:** 2026-06-02
**Estado:** aprobado en brainstorming, pendiente de plan.
**Origen:** pedido del coach ("clickear un punto del ACWR para revisar qué pasó ahí"). Veredicto de dominio de **El Carnicero** (oráculo, verificado contra el código): la granularidad es **semanal**, el destino honesto hoy es un **panel de semana**, el "entrenamiento del día" no existe (es la app del atleta, futuro).

## 1. Problema / objetivo

El coach quiere clickear un punto de un gráfico del drill-down para **revisar qué pasó esa semana**. Hoy los charts no son clickeables. Objetivo: cada punto (= **una semana**, no un día) abre un **panel de detalle de esa semana** con el cruce de todas las señales + la **adherencia editable**, reusando el `BottomSheet` que ya tenemos.

## 2. Decisiones (del veredicto de El Carnicero + el coach)

- **Granularidad = SEMANA.** `MonitorSeries` es todo arrays por semana ("one dot per week"). El panel es de la semana `w`. Nunca promete contenido diario.
- **Destino = `WeekDetailSheet` compartido** dentro del `BottomSheet` existente. **No** una pantalla/ruta nueva (§4 tap-detail es el vehículo canónico).
- **Mecanismo = zonas de tap por semana**: un rect transparente por semana sobre el plot de cada chart de señal → `onPointClick(week)`. Uniforme para charts de puntos y de líneas; hit-target grande (mobile), no depende del dot de 3px.
- **Adherencia EDITABLE** (decisión del coach): desde el panel se marca/corrige qué sesiones se cumplieron → `Repository.setSessionLog` (ya existe).
- **Container/presentacional (DRY):** el `Drilldown` (container) posee `selectedWeek` + el sheet + la mutación; las charts quedan presentacionales (emiten `onPointClick`). Un panel, una ruta de escritura — no se duplica.
- **Scope = las 6 charts de señal** del drill-down del atleta: `AcwrChart`, `LoadChart`, `ImrFaseChart`, `RecoveryChart`, `WeightChart`, `WellnessChart`. Fuera: Heatmap/RiskQuadrant (nivel plantel, otra pantalla) y MacroTimeline/MacroPeriodization (forma del macro, no señal-por-semana).

## 3. Componentes

- **Nuevo — `weekSignals(series, macro, week)`** (pura, nuevo `packages/core/src/logic/week.ts`): devuelve el cross-section de la semana como filas `{ label, value, state }` (o marcadas "sin dato"), reusando `acwr`/`acwrStateSafe`, `recoverySeries`/`recoveryState`, `imrStateForWeekSafe`, `weightBandState`, etc. **La disciplina de sin-dato vive acá** (valor faltante/NaN → fila "sin dato", nunca falso-verde). Testeable en core.
- **Nuevo — `WeekTapZones`** (en `chartkit.tsx`): componente que dado `(weeks, x, top, bot, onPick)` renderiza los rects transparentes por semana. Lo rendea cada chart dentro de su `<svg>`.
- **Nuevo — `WeekDetailSheet`** (presentacional, `apps/web/src/ui/charts/WeekDetailSheet.tsx`): recibe `{ week, dateISO, signals, adherence, isTaper, onToggleSession }` y renderiza: header "Semana w · fecha", las filas valor-vs-banda (lead: carga↔recuperación), 🚩 si taper/comp, y la **grilla de adherencia editable** (toggles ✓/✗/pendiente por sesión planificada).
- **Modificados — las 6 charts:** suman prop opcional `onPointClick?: (week: number) => void` y rendean `WeekTapZones` cuando está.
- **Modificado — `Drilldown`:** estado `selectedWeek`, pasa `onPointClick` a las 6 charts, arma el `WeekDetailSheet` (deriva `weekSignals` + fecha con `dateOfWeek(plan.startDate, w)` + adherencia de `sessionLog`), y cablea el toggle a `setSessionLog`.

## 4. Adherencia editable (flujo de escritura)

- Sesiones planificadas de la semana = `sessionsPerWeek(macro.frequency)`. Cada slot muestra su estado desde los `SessionMark` del `SessionLog` (sparse; sin marca = pendiente).
- Toggle de un slot → actualiza **inmutablemente** el `SessionLog` (agrega/reemplaza/quita el mark `{week, idx, status}`) → `Repository.setSessionLog(id, log)`.
- **Manejo de error** (HttpRepository puede fallar; LocalRepository no): optimistic update + rollback + toast de error si la escritura rechaza. (M4c asumía LocalRepository infalible; acá NO.)

## 5. Privacidad

El panel se arma **sólo** de `MonitorSeries` + `SessionLog`. **Cero** dato de ciclo (el drill-down no tiene chart de ciclo y así sigue). Es superficie de coach; el ACWR-como-cifra acá es correcto (no es la vista del atleta). Si el patrón se porta a la app del atleta, NO mostrará cifras gameables (HR-1) — futuro.

## 6. Verificación

- **TDD:** (a) `weekSignals` (core) — valores+estados correctos por semana, y **"sin dato"** ante faltante/NaN; (b) `WeekTapZones` — un tap llama `onPick(week)`; (c) `WeekDetailSheet` — muestra el cross-section + "sin dato"; (d) el toggle llama `onToggleSession` → `setSessionLog`.
- **El Carnicero revisa** el diff (disciplina de sin-dato, valor-vs-banda, privacidad, write por `Repository`).
- web build + tsc + eslint limpios; tests verdes; deploy.

## 7. Fuera de scope (futuro)

- **Drill-down a la sesión real** (ejercicios/series/kilos): no existe el dato → app del atleta (telemetría). Este mismo panel bajará a la sesión cuando exista.
- Las 4 charts no-señal (Heatmap/RiskQuadrant/MacroTimeline/MacroPeriodization).

## 8. Próximo paso

Invocar **writing-plans** (orden: `weekSignals` core TDD → `WeekTapZones` + `onPointClick` en las charts → `WeekDetailSheet` (lectura) → adherencia editable + `setSessionLog` con manejo de error → wiring en `Drilldown` → review de El Carnicero → verificación).
