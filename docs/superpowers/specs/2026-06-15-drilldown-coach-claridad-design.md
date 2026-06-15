# Detalle del atleta (coach) — claridad: anti-solapamiento + de-saturar Plan + jerarquía

**Fecha:** 2026-06-15 · **Estado:** aprobado por el owner, listo para plan
**Origen:** diagnóstico de UX del owner — el `Drilldown` (coach → atleta, `coach/a/:id`) "no es claro".
**Construye sobre:** [2026-06-13-screen-refactor-tabs](./2026-06-13-screen-refactor-tabs-design.md)
(las 3 tabs Resumen/Monitor/Plan ya existen; acá se arregla la *ejecución*, no el mecanismo).

## Problema

Las tabs funcionan, pero el owner marcó **3 dolores** (selección explícita):

1. **Las 3 tabs se pisan.** La palabra/concepto "adherencia" aparece en **3 lugares con 3 sentidos**:
   - Resumen → `DailySection` tiene un sub-bloque titulado **"Adherencia reconciliada"** (verdad
     reconciliada atleta ✓ > coach > none, vía `repo.getDaily`).
   - Resumen → `MacroHistorySection` muestra **constancia** de macros cerrados.
   - Plan → `SessionAdherence` es la grilla **·→✓→✗** (`weekDone/perWeek`, vía `sessionLog`).
   El coach no sabe cuál es "la" adherencia.
2. **El tab Plan está saturado.** 5 superficies apiladas en una columna larga: `PlanCalendar` +
   `SessionAdherence` + `SessionsSection` + `RmSection` + `PrilepinSection`.
3. **Jerarquía visual plana.** Causa raíz **técnica**: no hay primitivo de "sección" — todo son
   `div` con `fontSize` inline dispersos (13.5 / 13 / 12.5 / 11 / 10.5 / 9…). Nada se lee como
   jerarquía. El Monitor se lee mejor *porque* sus gráficos ya van en `ChartCard` (header
   consistente display-700 + eyebrow mono + ⓘ). La cura es llevar ese mismo lenguaje a Resumen y Plan.

Del **review del mock** (owner, misma sesión) salieron dos puntos más:

4. **Monitor "no sirve":** 7 gráficos, de los cuales Bienestar y Cumplimiento duplican lo que ahora
   vive en Resumen, y Recuperación depende de datos HRV/FC que los atletas no registran.
5. **Calendario poco claro:** el formato día×semana tipo GitHub ya existe (`PlanHeatMap` horizontal)
   pero está enterrado tras un colapso + toggle, y su doble-encoding (tono + opacidad) carga la lectura.

## Decisiones (cerradas con el owner)

1. **Dirección A — 3 tabs, bien hecho.** Se mantiene Resumen / Monitor / Plan (buen modelo mental:
   *cómo va* / *señales* / *planificar*); se arregla solapamiento + saturación + jerarquía.
2. **Primitivo `Section` nuevo** (`apps/web/src/ui/Section.tsx` + clases `.wl-sect*` en `theme.css`).
   **Alcance ahora: SÓLO el Drilldown** (Resumen + Plan). Plantel/Cuenta quedan para una pasada futura.
3. **Regla "una sola adherencia":** la palabra **adherencia = ¿cumple las sesiones?** vive en
   **Resumen**. La grilla editable de Plan se re-enmarca como **"Sesiones"** (marcado), sin usar la
   palabra "adherencia". `MacroHistorySection` usa **"Historial / constancia"** (es de macros
   *cerrados*). Así "adherencia" aparece una vez.
4. **Stat read-only "Adherencia del bloque: N/M" en Resumen: SÍ.** Derivado de los datos que
   `DailySection` ya carga (`view.adherence`) — sin fetch nuevo, sin fuente nueva.
5. **Colapso en Plan:** `Calendario` y `Sesiones` **abiertos**; `RM y referencias` y
   `Prilepin (vista previa)` **colapsados** por defecto.
6. **Monitor: de 7 a 4 gráficos.** Quedan **ACWR · Carga semanal · IMR por fase · Peso**. Se sacan
   **Bienestar** y **Cumplimiento** (los duplica Resumen) y **Recuperación** (depende de datos
   HRV/FC que los atletas no registran). Monitor sigue siendo tab (3 tabs en total). Los componentes
   `WellnessChart`/`RecoveryChart`/`CompChart` **no se borran** (los usa el Progreso del atleta) —
   sólo salen de `MonitorTab`.
7. **Calendario en formato GitHub, des-enterrado.** El heatmap día×semana ya existe
   (`PlanHeatMap orientation="horizontal"`); hoy vive tras un colapso propio + toggle Mapa/Lista. Se
   muestra **directo y abierto** dentro de la `Section "Calendario"`, con **encoding limpio de una
   sola rampa** = carga del día (intensidad % tope), leyenda *menos→más* (se cae la opacidad-por-
   volumen; el volumen queda en el detalle al tocar el día). **Sólo el lado coach** — el heatmap del
   atleta no se toca (vía prop, ver Diseño 5).

## Diseño

### 1 · Primitivo `Section` (`ui/Section.tsx`)

```ts
type SectionProps = {
  title: string;
  eyebrow?: string;          // etiqueta mono mayúsculas arriba del título
  right?: ReactNode;         // slot derecho: stat, badge o acción
  collapsible?: boolean;     // default false
  defaultOpen?: boolean;     // default true; sólo aplica si collapsible
  children: ReactNode;
};
```

- **Superficie** = la misma de `Card` (token `--wl-surface` + hairline `--wl-text 8%` + `--wl-radius`),
  vía clase `.wl-sect` (no inline) para que el skin `legend` la pueda tematizar.
- **Header** `.wl-sect__head`: `eyebrow` (`.wl-sect__eyebrow`) + `title` (`.wl-sect__title`) a la
  izquierda; `right` a la derecha; chevron `.wl-sect__chev` sólo si `collapsible`.
- **Colapsable:** el header es un `<button>` con `aria-expanded` + `aria-controls={bodyId}`; el chevron
  es `aria-hidden`. **Lazy-mount:** el cuerpo se renderiza sólo cuando está abierto (cerrado → no monta
  → `RmSection`/`PrilepinSection` no hacen su fetch hasta que se abren; mismo costo que el remount por
  `rmsStamp` si se cierra y reabre — aceptable). No-colapsable → header estático + cuerpo siempre.
- **Animación** sólo `opacity`/`transform` reusando el patrón `wl-daydetail-in`; `prefers-reduced-motion`
  → sin animación. (Espeja `WeekDetailSheet`/heat ya existentes.)

### 2 · Escala de tipografía (3 niveles fijos, reemplaza los 6 sueltos)

| Nivel | Uso | Token |
|---|---|---|
| **1 — título de sección** | header de cada `Section` | `--wl-display` 700, **14px**, `--wl-text` |
| **2 — eyebrow / etiqueta** | sobre-título, mini-labels | `--mono` **9px**, MAYÚS, `letter-spacing:.1em`, `--wl-muted` |
| **3 — cuerpo / meta** | texto y metadatos | `--mono` **11px** / body 12.5–13px, `--wl-muted`/`--wl-text` |

Los números grandes de **dato** (nombre 22px, score 18px, N/M) NO son cromo de sección y se mantienen
como énfasis de dato — la escala de 3 niveles ordena el *chrome*, no apaga los datos.

### 3 · Resumen (¿cómo viene? — sólo lectura)

Cada bloque envuelto en `Section`:

1. `Section title="En el macro"` → `MacroTimeline` (cuando hay macro + serie).
2. `Section title="Adherencia del bloque" right={<b>N/M</b>}` → la lista reconciliada por sesión
   (reubicada desde el sub-bloque de `DailySection`). **N/M definido sin ambigüedad:**
   **N = sesiones hechas (`status==="done"`)**, **M = sesiones con registro (`status!=="none"`)**
   en las últimas semanas, sobre el mismo `view.adherence`. Eyebrow: "hechas / con registro".
3. `Section title="Bienestar"` → la mini-tendencia de check-in (sparkline + ítems del último, peso)
   de `DailySection`. **Jamás RPE ni ciclo** (invariante intacto).
4. `Section title="Historial"` → `MacroHistorySection` (constancia de macros cerrados).
5. Línea de **Ciclo** redactada (sólo si `cycleCtx`): se mantiene **como hoy** (línea suelta, no
   `Section`; paleta neutra, contrato redactado, jamás fase/fecha).

**Refactor de `DailySection`:** sigue con **una sola** carga (`getDaily` + error/retry), pero ahora
renderiza **dos** `Section` (Adherencia del bloque + Bienestar) en vez de dos `div` con headers
inline. El sub-título interno "Adherencia reconciliada" desaparece (lo reemplaza el título de Section).

### 4 · Monitor (señales coach-only — reducido a 4)

`MonitorTab` renderiza sólo **4** gráficos, en este orden: **ACWR** (riesgo carga aguda:crónica) ·
**Carga semanal** (tonelaje + crónica) · **IMR por fase** (intensidad vs lo que pide la fase, requiere
macro) · **Peso** (vs banda, requiere `bodyweight`). Se **quitan de `MonitorTab`**: `WellnessChart`
(= Resumen "Bienestar"), `CompChart` (= Resumen "Adherencia"), `RecoveryChart` (sin datos HRV/FC).
Cada uno ya va en `ChartCard` (header + ⓘ + empty-state) → es el lenguaje visual que Resumen y Plan
igualan. Se conserva el empty-state honesto de `MonitorTab` cuando no hay `series`. (`ChartCard` NO se
refactoriza a `Section` — fuera de alcance; comparten escala por diseño, no por código.) Los componentes
quitados **siguen existiendo** (los consume el Progreso del atleta).

### 5 · Plan (¿qué hace? — editable, de-saturado)

- **Sin macro:** se mantiene la card de empty-state con CTA "Asignar macro ›" → `/coach/macros`
  (sin `Section`).
- **Con macro**, cada superficie en `Section`:
  1. `Section title="Calendario"` **(abierto)** → `PlanCalendar` (`key=cal-${rmsStamp}` intacto).
     **Des-enterrar:** `PlanCalendar` pierde su botón-colapso interno propio (el "📅 Calendario del
     plan") — la `Section` ya da el marco; el heatmap se ve directo. Sigue el toggle **Mapa/Lista**
     (Mapa default). El heatmap usa `PlanHeatMap orientation="horizontal"` (formato GitHub: semanas =
     columnas, días = filas) con **rampa única** = carga del día. **Encoding por prop:** se agrega
     `singleRamp?: boolean` (default `false`) a `PlanHeatMap` + `HeatLegend`; en `true` el color sale
     de una sola rampa (intensidad % tope, leyenda *menos→más*, sin la opacidad-por-volumen). **Sólo
     el coach pasa `singleRamp`** — el heatmap del atleta (ciclo-visible) queda igual. El volumen del
     día sigue disponible al tocar la celda (`PlanDayDetail`). Carga lazy del heat: hoy depende del
     `open` interno; pasa a depender del montaje del tab Plan (ya lazy por tab).
  2. `Section title="Sesiones"` **(abierto)** → `SessionAdherence` (grilla **·→✓→✗**, hint
     "tocá · → ✓ → ✗" como eyebrow/ayuda + banner `sessionError`) **+** `SessionsSection`
     (`key=ses-${rmsStamp}` intacto). **Reencuadre:** esta sección es *marcado/edición de sesiones*,
     no "adherencia".
  3. `Section title="RM y referencias" collapsible defaultOpen={false}` → `RmSection` (sólo `{plan}`).
  4. `Section title="Prilepin · vista previa" collapsible defaultOpen={false}` → `PrilepinSection`
     (sólo `{plan}`).
- Resultado: **5 muros → 2 abiertos + 2 colapsados.** El lazy-mount del Section colapsado difiere el
  fetch de RM/Prilepin hasta abrir.

### 6 · Header / chrome (sobre las tabs) — sin cambios estructurales

BackButton · nombre + badge estado · card "Competencia objetivo" + Asignar · toggle Coach/Atleta
(`!API_ENABLED`) · tira de tabs sticky. Sólo se ordena tipografía al pasar por la escala de 3 niveles.

## Reglas intocables — preservadas

- **Discos:** `DiscRow`/`Disc` del canónico `ui/Disc` se usan sólo en `PrilepinSection` y
  `AtletaPreview`; envolver en `Section` no toca el render del disco. ✓
- **kg manda + % + series×reps:** las filas de prescripción (`SessionsSection`, `AtletaPreview`) no
  cambian de estructura — sólo se envuelven. ✓
- **no-RPE:** los 4 gráficos que quedan en Monitor (ACWR/Carga/IMR/Peso) son coach-only; sacar
  `CompChart` además **elimina** la única línea de RPE (era coach-only — no es regresión). Nada nuevo
  fluye a una superficie del atleta; "Bienestar" muestra los 6 ítems crudos del check-in, jamás RPE. ✓

## Slices

1. **Section primitive** — `ui/Section.tsx` + clases `.wl-sect*` en `theme.css` + `section.test.tsx`.
2. **Monitor 7→4** — `MonitorTab` deja ACWR/Carga/IMR/Peso; saca Wellness/Comp/Recovery (sin borrar
   los componentes); actualizar tests del Monitor.
3. **Calendario GitHub** — `singleRamp` en `PlanHeatMap` + `HeatLegend`; `PlanCalendar` pierde el
   colapso interno y pasa `singleRamp` (coach); tests del heatmap (rampa única + athlete sin tocar).
4. **Plan tab** — envolver en `Section`, fusionar "Sesiones", colapsar RM/Prilepin; integrar el
   `Calendario` des-enterrado; actualizar tests.
5. **Resumen tab** — envolver en `Section`, partir `DailySection` en Adherencia (N/M) + Bienestar,
   stat N/M; actualizar tests.

## Plan de tests

- **`section.test.tsx`:** renderiza title/eyebrow/right; colapsable → header con `aria-expanded`,
  toggle muestra/oculta cuerpo; **lazy-mount** (cuerpo ausente del DOM cuando cerrado); no-colapsable
  cuerpo siempre presente; `prefers-reduced-motion` no rompe.
- **`drilldown.test.tsx` / `planTab`:** RM y Prilepin **no** están en el DOM al entrar a Plan
  (colapsados); Calendario y Sesiones visibles; expandir "RM y referencias" → aparece `RmSection`.
  La grilla ·→✓→✗ vive bajo "Sesiones" (no bajo "adherencia").
- **`resumen` / `daily`:** "Adherencia del bloque" con N/M (hechas/con-registro) visible; sección
  "Bienestar" con el sparkline; el sub-título "Adherencia reconciliada" ya no existe. Sin RPE.
- **`monitor`:** se renderizan ACWR/Carga/IMR/Peso; **no** se renderizan Wellness/Cumplimiento/
  Recuperación en Monitor; empty-state honesto sin `series`. (El Progreso del atleta sigue usando
  los componentes quitados — sus tests no cambian.)
- **`PlanHeatMap` / calendario:** con `singleRamp` la leyenda es *menos→más* (una rampa, sin la doble
  codificación) y la celda colorea por % tope; con `singleRamp` ausente/false el encoding rico actual
  queda **idéntico** (guard del lado atleta); `PlanCalendar` muestra el heatmap sin el colapso interno
  (Mapa directo).
- Actualizar expectativas de labels en los tests existentes de `drilldown.test.tsx` (las tabs y el
  contenido cambian de heading).
