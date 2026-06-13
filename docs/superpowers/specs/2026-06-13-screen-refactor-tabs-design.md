# Refactor de pantallas largas — tabs en Drilldown + pills en Progreso

**Fecha:** 2026-06-13 · **Estado:** aprobado por el owner, en implementación
**Origen:** diagnóstico de UX del owner (Drilldown = la pantalla más larga; Progreso moderada).

## Problema

`Drilldown` (coach → atleta, ruta `coach/a/:id`) apila en una sola columna:
MacroTimeline + 7 charts + chip de ciclo + PlanCalendar + SessionAdherence + SessionsSection +
RmSection + DailySection + PrilepinSection → 10–15 pantallas de scroll en mobile.
`ProgresoScreen` (atleta) apila 3–4 ChartCards completos con su bloque `explain`.

## Decisiones (cerradas con el owner)

1. **Mecanismo de tabs:** in-file + `?tab=` search param (no rutas hijas). Una sola carga de datos
   compartida en el padre; el estado cross-cutting queda en el shell; sobrevive refresh y back sin
   tocar el router. Cada tab extraída a su componente.
2. **3 tabs, no 4:** Palmarés/medallas están desactivadas → quedan **Resumen / Monitor / Plan**.
3. **P2 ya estaba ~90% hecho:** el `explain` (`{forma,sirve,lectura}`) ya vive colapsado detrás del
   botón "i" → BottomSheet en el `ChartCard` compartido. P2 se reduce a pulido a11y (no rebuild) y
   se **descarta** la sub-idea de "2 charts ancla + ver más" (el tab dedicado ya resuelve el scroll).
4. **`DailySection` → Resumen** (read-only, plan-independiente, "cómo viene el atleta hoy").

## Diseño

### P1 — Tabs del Drilldown

- **Chrome persistente (arriba de las tabs, scrollea):** BackButton · nombre + badge estado ·
  card "Competencia objetivo" + botón **Asignar** · toggle **Coach/Atleta** (`!API_ENABLED`).
- **Tira de tabs sticky** (`position: sticky; top: 0; zIndex: 10`, fondo `var(--wl-bg)` opaco +
  hairline, full-bleed por margen negativo). Idiom = segmented `aria-pressed` (44px) ya usado en
  Coach/Atleta y Mapa/Lista. **No** `role=tablist` (consistencia con el repo, evita un keyboard
  manager bespoke).
- **`?tab=` sync:** `toTab()` deriva la tab de la URL en cada render (sin `useState`+`useEffect`),
  `setSearchParams(..., { replace: true })`, valores desconocidos → `resumen`, no se escribe default.
- **Agrupación:**
  - **Resumen:** MacroTimeline (cuando hay macro+serie) · DailySection · chip de ciclo redactado.
  - **Monitor:** Acwr · Load · Recovery · ImrFase · Wellness · Comp · Weight (o empty-state).
  - **Plan:** PlanCalendar (`key=cal-${rmsStamp}`) · SessionAdherence (+ banner error + header) ·
    SessionsSection (`key=ses-${rmsStamp}`) · RmSection · PrilepinSection.
- **Parent-owned (NO baja a tabs):** carga `Promise.all` + loaded/error/reload · `selectedWeek` +
  WeekDetailSheet · `compOpen` + CompSheet + onAdd/Remove · `asAthlete` + previewClient + preview ·
  `sessionLog` + onToggleSession + `sessionError` · `rmsStamp` + onRmsChange.
- **`asAthlete` ON →** se ocultan tabs + contenido y se muestra HomeScreen + AtletaPreview (either/or).
  "Atleta" no es una tab.
- **Cambio de atleta:** ruta nueva sin `?tab=` → Resumen automático (sin código de reset).
- **Lazy-mount** sólo del tab activo, paneles en `.wl-viewfade`. Trade-off conocido: salir/volver a
  Plan re-fetchea el heat de PlanCalendar (igual que el remount por `cal-${rmsStamp}`); aceptable.

### P2 — ChartCard (pulido)

`aria-expanded={open}` + `aria-haspopup="dialog"` en el botón; glifo `i` → `ⓘ`. Una sola vez en el
card compartido → beneficia Monitor (coach) y Progreso (atleta).

### P3 — Progreso (pills)

Fila de pills (`.ho-seg` + `min-height:44`) sobre **un** chart. Default = Carga (siempre presente).
Recuperación · Bienestar · **Peso condicional** (`hasWeight`). Mount-only-active. `RecorridoCard`
queda **fuera** de las pills (siempre visible, ramas vacía y ready). Sin `onPointClick`. HR-2 intacto
(cada chart trae su "i"→explain vía ChartCard).

### P4 — diferido

Clases/Reservas/config viven en la rama parqueada `wip/booking` (no están en este worktree). Se deja
como principios (agrupar por semana + header sticky, alta en BottomSheet, virtualizar si el seed lo
justifica) pendiente del merge de booking. P5 (tokens de página) y P6 (lazy charts) quedan
absorbidos: el column 390 ya es uniforme; el lazy-mount lo dan las tabs.

## Reglas intocables — preservadas

- **Discos:** sólo PrilepinSection y AtletaPreview usan `DiscRow` del canónico `ui/Disc`. ✓
- **kg manda:** intacto en cada fila. ✓
- **no-RPE:** CompChart/AcwrChart (RPE/ACWR) son coach-only en Monitor y nunca fluyen a Progreso
  atleta (que los excluye y tiene tests negativos). Preview atleta sin RPE. ✓

## Slices

1. **P1** — tabs Drilldown (`drilldown/tabs.ts` + ResumenTab/MonitorTab/PlanTab + Drilldown shell).
2. **P3** — pills Progreso + tests.
3. **P2** — a11y ChartCard.

## Plan de tests

- `tabs.test.ts`: `toTab` (válidos, null, basura, "" → resumen).
- `drilldown.test.tsx`: default Resumen (charts ocultos, chip ciclo visible); click Monitor → charts;
  click Plan → calendario; deep-link `?tab=monitor`; `?tab=basura` → Resumen; "ver como atleta" y
  back; ciclo redactado; back button; error state. (Tests de charts/empty-state ahora clickean Monitor.)
- `progreso.test.tsx`: default Carga; pills presentes; click pill → cambia chart; sin bodyweight → sin
  pill Peso; no-RPE/no-ACWR; RecorridoCard (sin cambios).
