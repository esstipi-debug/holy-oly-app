# Calendario heat-map del plan (coach + atleta) — diseño

> Slice aprobado por el owner 2026-06-10 sobre mock iterado (v1→v5). Decisiones cerradas en
> `2026-06-09-bundle-reconciliacion-vs-holyoly.md` §5.6: encoding **mixto** (tono = % tope del
> día, opacidad = volumen del día), **celdas cuadradas compactas**, entra en **coach y atleta a
> la vez** (mismo componente presentacional), **toggle Lista ↔ Mapa** (la lista `PlanCalendar`
> se mantiene). Mandato adicional del owner: «no olvides usar los discos» — el desglose del día
> lleva `DiscRow` oficial en cada fila con kg.

## 1. Contrato de datos (core, athlete-safe)

```ts
// packages/core — types
export interface DayHeat { topPct?: number; lifts: number }       // lifts = Σ sets×reps del día
export interface WeekHeat { week: number; days: (DayHeat | null)[] } // SIEMPRE largo 7; null = descanso
```

- `planHeat(rows, totalWeeks): WeekHeat[]` (pura, `logic/planHeat.ts`): agrupa `PrescriptionRow`
  por `(week, sessionIdx)`; `topPct` = máx `pct` del día (`undefined` si ninguna fila trae `pct`);
  `lifts` = Σ `sets×reps`. Devuelve TODAS las semanas 1..totalWeeks (semana sin filas → 7 nulls).
- `maxLifts(heat): number` para normalizar el volumen (0 si no hay días).
- **Supuesto documentado:** la sesión `i` de la semana se pinta en el día `i` (0 = Lunes). El
  modelo de datos no asigna weekday a las sesiones; cuando exista configuración de días de
  entreno, sólo cambia este mapeo. `sessionIdx > 6` se ignora (la frecuencia real es ≤ 7).
- Payload 100 % athlete-safe: `%` + conteo de levantamientos. **Sin RM crudo, sin RPE.**
- Wire: `WeekHeatSchema`/`WeekHeatsSchema` (Zod) en `core/schemas` — los clientes HTTP validan.
- `MePlanView.plan` gana `startDate?: string` (el atleta ve fechas reales de su propio plan;
  ya recibe `currentWeek` derivado de ella — no expone nada nuevo).

## 2. Encoding visual (`ui/charts/heatPalette.ts`)

- **Tono (5 paradas por `topPct`):** ≤74 `#33305e` · ≤81 `#4b44ad` · ≤87 `#8440e8` ·
  ≤92 `#c92bc9` · ≥93 `#ff2d96`. Rampa índigo→fucsia (Neon Bloom); NO usa verde/ámbar/rojo
  (reservados al semáforo) ni colisiona con `PHASE_RAMP`.
- **Opacidad por volumen:** `alpha = 0.35 + 0.65 · (lifts / maxLifts)` (clamp 1).
- Día con filas pero **sin ningún `pct`** → tono neutro (gris `#3a3f4c`) con alpha por volumen
  (sin-dato honesto: no se inventa intensidad).
- Descanso (`null`) → celda base apagada (`#14151c`-equivalente vía token).
- **Competencia:** con `date` → esa celda en anillo dorado (`--gold`); sólo `week` → la etiqueta
  de la semana en dorado. (El wire del atleta no trae `date` → atleta marca por semana.)
- **HOY:** anillo blanco interior en (semana actual, weekday real de hoy) — aunque sea descanso.
- Celdas **cuadradas 18 px**, gap 4, grilla centrada; etiquetas de semana sólo en hitos
  (S1 y cada 4: S4, S8, …, y la última); franja izquierda 3 px = `phaseColor(idx)` existente.
- Touch target ≥ 44 px: el área de tap se expande con padding invisible (la celda visual queda 18).

## 3. Componentes (presentacionales compartidos, `ui/charts/`)

- **`PlanHeatMap`** — props: `{ heat, hoy: {week, day} | null, selected, onSelectDay(week, day),
  phaseIndexFor(week), compByWeek: Map<week, {name, day?}>, milestones }`. Sin fetch.
- **`PlanDayDetail`** — el desglose del día: encabezado (fecha o «Semana N · sesión M»), chip de
  fase (`phaseColor` + nombre) + **objetivo = `focus` de la fase** (ya existe en el catálogo),
  estado opcional (`done | missed | today | pending`), filas de ejercicios
  `{ name, sets, reps, pct?, kg? }` con **kg + `DiscRow(kg, barKg)`** (regla intocable; el kg
  manda). `kg == null` → «—» y **sin discos** (jamás 0 inventado). Variantes: competencia
  (banner dorado) y descanso (texto de recuperación).

## 4. Coach — `PlanCalendar` evoluciona (no se duplica)

Mismo header colapsable «Calendario del plan»; abierto muestra seg **[Mapa | Lista]** (Mapa
default). Lista = filas actuales sin cambios. Mapa = `PlanHeatMap` + `PlanDayDetail`.
- Datos: `repo.getPlanHeat(id)` se carga lazy al abrir (estado loading/error con retry honesto);
  el tap a un día carga `repo.getPrescriptionWeek(id, week)` (cache por semana en el componente)
  y toma `sessions[day]`. Estado del día desde `marks` (SessionLog). `barKg = barKgForSexo(sexo)`.
- Props nuevas que pasa `Drilldown`: `loadHeat`, `loadWeek`, `sexo`, `today`.

## 5. Atleta — sección «Mapa del plan» en `PlanDetailSheet`

Debajo de los mesos: `PlanHeatMap` con heat de `meClient.getMeHeat()` (lazy al abrir el sheet) y
tap → `meClient.getMeSessions(week)` → `PlanDayDetail` (kg + discos con su `barKg` por sexo; el
`targetKg` ya viene calculado server-side — el RM nunca viaja). Sin estado de adherencia en v1
(el SessionLog es del coach). `PlanDetailSheet` gana prop `client?: MeClient` (patrón HomeScreen).

## 6. API + repos

- `repo.getPlanHeat(prisma, athleteId)`: plan → totalWeeks del macro → select liviano de
  `PrescribedExercise {week, sessionIdx, sets, reps, pct}` → `planHeat`. Sin plan → `[]`.
- `GET /athletes/:id/heat` (guardAthlete) y `GET /me/heat` (requireAthlete) — espejo de los
  endpoints de prescription existentes.
- `Repository.getPlanHeat(id)` → LocalRepository (desde `prescriptionRows(id)` + totalWeeks del
  macro del plan) y HttpRepository (fetch + `WeekHeatsSchema`).
- `MeClient.getMeHeat()` → httpMeClient + LocalMeClient (mismas fuentes locales que sessions).

## 7. Fuera de alcance (v1)

Días de entreno configurables (weekday real por sesión) · estado de adherencia en el mapa del
atleta · chips→peek del grafo (app viva — este panel es su precursor) · heat por tonelaje real
(elegido: lifts; el tonelaje requiere RM y no mejora la lectura) · `rationale` del motor (cuando
exista, se suma al panel).

## 8. Criterios de aceptación

- [ ] `planHeat`: agrupa por día, topPct = máx, lifts = Σ sets×reps, semana vacía = 7 nulls,
      sin-% → `topPct undefined`, largo SIEMPRE `totalWeeks`.
- [ ] Coach: toggle Mapa|Lista dentro del calendario; lista intacta; mapa pinta y el tap abre el
      desglose con fase + objetivo + ejercicios con kg y **DiscRow**.
- [ ] Atleta: el sheet del plan muestra el mapa y el desglose del día con kg + **DiscRow**.
- [ ] kg ausente → «—» sin discos; día sin `pct` → tono neutro; descanso → sin desglose falso.
- [ ] Authz: coach sin vínculo → 403 en `/athletes/:id/heat`; `/me/heat` exige sesión de atleta.
- [ ] Sin RPE en ningún payload/superficie nueva; sin verde/ámbar/rojo fuera del semáforo.
- [ ] tsc + eslint + `pnpm -r test` + `verify` (int) verdes.
