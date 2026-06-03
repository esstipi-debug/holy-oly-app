# SP2 — Prescripción por sesión + autoría del coach · Design doc

**Fecha:** 2026-06-03
**Estado:** aprobado (brainstorming con el user), pendiente de plan.
**Pilar:** Ejecución/Programación. SP1 ✅ (librería de movimientos). **Este spec = SP2 (coach-side).** Luego SP3 (atleta: ejecución + registro real), SP4 (autorregulación), SP5 (vigencia/RM).

## 1. Qué es SP2 (y qué NO)

Da **contenido concreto** a las sesiones que hoy están vacías. Hoy: el coach asigna un macro + RMs + fecha (`AssignSheet`→`savePlan`); el `phaseProfile` del macro es una **forma** (corredor de % por fase); la grilla de adherencia marca cada `(semana, idx)` hecho/no-hecho **sin contenido**. SP2 pone el contenido: por sesión, una lista de ejercicios `{movimiento, esquema, %1RM|kg, flags}`, con `kg = %×RM` usando la librería de SP1.

**Modelo híbrido (decidido):** el **macro lleva la receta**; al **asignarlo** se **instancia** como la **prescripción editable del atleta** (copia); el **coach la edita cuando quiera** — incluso después de que el atleta entrenó (sin lock por estado). El macro original queda intacto y reusable. El **atleta es read-only** sobre la prescripción.

**Dentro de SP2 (coach-side):** tipos de receta + la receta de **Ruso 5D** en `core`; modelo `PrescribedExercise` persistido; **instanciación** al asignar; endpoints coach-autorizados (leer/editar sesión); UI del coach para **ver** las sesiones (reemplaza la data hardcodeada del mockup "Entreno") y **editarlas** (selector de movimientos SP1 + esquema/%/kg + sustitución/complejidad).

**Fuera de SP2 → SP3:** el **atleta ejecuta + anota lo real** (kg/reps real, sin tocar el plan) y el coach ve los **desvíos**. El **modelo de "real" (`SessionActual`) se define acá** (§3) para que sea coherente, pero **la tabla + la UI del atleta + la vista coach de desvíos se construyen en SP3**. Las otras recetas (23 macros restantes) se completan después; SP2 arranca con Ruso 5D.

## 2. Decisiones (del brainstorming)

- **Híbrido:** receta-en-macro → copia editable por atleta → el coach edita la copia.
- **Coach edita en cualquier momento** (antes/durante/después); **sin lock por estado** de la sesión.
- **Atleta read-only** sobre la prescripción (anota su "real" aparte, en SP3).
- **kg por % o por kg directo:** la prescripción guarda `pct` y/o `kgOverride`; `kg = kgOverride ?? round(pct/100 × RM)`. Accesorios (`rmRef "none"`) → `kgOverride`/`rpe`.
- **Receta plana por fase:** todas las semanas de una fase arrancan con la misma sesión-tipo; el coach mete la ondulación semanal editando. (Ondulación auto = enriquecimiento futuro.)
- **Editor dentro del drill-down** del atleta (no pantalla aparte).

## 3. Modelo de datos

### core — tipos de receta (`packages/core/src/types/index.ts`)
```ts
export interface PrescribedExercise {
  movementId: string;            // id de SP1 (p.ej. "arranque", "tiron-arranque", "sentadilla-frente")
  sets: number;                  // int ≥1
  reps: number;                  // int ≥1
  pct?: number;                  // %1RM (1..120); presente sólo si el movimiento deriva de un RM
  kgOverride?: number;           // kg absoluto (accesorios, o el coach fija el peso); pisa al pct
  rpe?: number;                  // 1..10 (accesorios / trabajo por sensación)
  flags?: MovementFlag[];        // pausa/deficit/tempo/sin-recibida aplicados a esta prescripción
  notes?: string;                // máx 200
}
export interface SessionTemplate { label?: string; exercises: PrescribedExercise[] }
export interface PhaseTemplate { phaseKey: string; sessions: SessionTemplate[] } // sessions[idx], idx 0..días/sem-1
export interface MacroRecipe { macroId: string; phases: PhaseTemplate[] }

/** Una fila concreta de la prescripción del atleta (= PrescribedExercise + su ubicación). */
export interface PrescriptionRow extends PrescribedExercise { week: number; sessionIdx: number; order: number }
/** Vista de una sesión instanciada, con el kg ya derivado, para el front. */
export interface PrescribedExerciseView extends PrescribedExercise { movementName: string; targetKg?: number }
export interface SessionView { week: number; sessionIdx: number; label?: string; exercises: PrescribedExerciseView[] }
```

### core — derivación (`packages/core/src/logic/prescription.ts`)
- `resolveTargetKg(ex: PrescribedExercise, rms: RM): number | undefined` — `kgOverride ?? (ex.pct != null && movement.rmRef !== "none" ? round(ex.pct/100 × rms[movement.rmRef]) : undefined)`; redondea a 1 kg. Usa `getMovement` de SP1 para el `rmRef`.
- `sessionTemplateFor(recipe, macro, week): SessionTemplate[]` — `phaseForWeek(macro, week)` → `phaseKey` → `recipe.phases.find(p => p.phaseKey === key)?.sessions ?? []`.
- `instantiatePrescription(recipe, macro, totalWeeks): PrescriptionRow[]` — por cada semana 1..N: las sesiones de su fase → filas `{week, sessionIdx, order, ...exercise}`. Macro sin receta → `[]`.
- `MACRO_RECIPES: MacroRecipe[]` en `packages/core/src/data/recipes.ts` (arranca con `ruso-5d`).

### apps/api — prescripción persistida (`prisma/schema.prisma`)
```prisma
model PrescribedExercise {
  id          String  @id @default(uuid())
  athleteId   String
  athlete     Athlete @relation(fields: [athleteId], references: [id], onDelete: Cascade)
  week        Int
  sessionIdx  Int
  order       Int
  movementId  String
  sets        Int
  reps        Int
  pct         Float?
  kgOverride  Float?
  rpe         Float?
  flags       String[]
  notes       String?
  @@unique([athleteId, week, sessionIdx, order])
  @@index([athleteId, week])
}
```
+ `prescription PrescribedExercise[]` en `Athlete`. Migración `5_prescription`. (Mapeo: `flags?` ausente en core ↔ `String[]` `[]` en Prisma.)

### (SP3, definido acá; NO se construye en SP2) — real del atleta
```prisma
// model SessionActual { athleteId, week, sessionIdx, movementId, order, actualKg?, actualReps?, actualRpe?, doneAt }
```
El atleta lo escribe (scope-self, `requireAthlete`); el coach ve prescrito-vs-real. **Construcción = SP3.**

## 4. Receta de Ruso 5D (curada — el coach corrige en la revisión)

`MACRO_RECIPES = [{ macroId: "ruso-5d", phases: [...] }]`. 5 sesiones/fase (5d/sem). Los `%` de los lifts de competencia caen en el corredor de la fase; tirones 90–110% de su lift; sentadillas relativas a su RM. Movimientos = ids de SP1.

**Fase `hipertrofia` (sem 1-4, corredor 65-72%, volumen alto):**
- Día 1: `arranque` 5×3 @68 · `tiron-arranque` 4×4 @80 · `sentadilla` 5×5 @70
- Día 2: `cargada-envion` 5×2 @68 · `sentadilla-frente` 4×4 @70 · `peso-muerto-rumano` 3×8 rpe7
- Día 3: `arranque.potencia` 5×2 @62 · `tiron-cargada` 4×4 @85 · `press-empuje` 4×5 rpe7
- Día 4: `arranque` 5×3 @70 · `sentadilla` 5×3 @75 · `sentadilla-overhead` 4×3 rpe6
- Día 5: `cargada` 5×2 @70 · `envion.tijera` 5×2 @70 · `buenos-dias` 3×8 rpe7

**Fase `fuerza-basica` (sem 5-8, corredor 75-82%):**
- Día 1: `arranque` 5×2 @78 · `tiron-arranque` 4×3 @95 · `sentadilla` 5×4 @80
- Día 2: `cargada-envion` 5×2 @78 · `sentadilla-frente` 4×3 @78 · `peso-muerto-rumano` 3×6 rpe8
- Día 3: `arranque.potencia` 4×2 @72 · `tiron-cargada` 4×3 @100 · `press-empuje` 4×4 rpe8
- Día 4: `arranque` 5×2 @80 · `sentadilla` 5×3 @82 · `sentadilla-overhead` 3×3 rpe7
- Día 5: `cargada` 4×2 @80 · `envion.tijera` 5×2 @78 · `buenos-dias` 3×6 rpe8

**Fase `fuerza-potencia` (sem 9-12, corredor 85-92%):**
- Día 1: `arranque` 6×1 @88 · `tiron-arranque` 4×2 @105 · `sentadilla` 5×3 @88
- Día 2: `cargada-envion` 5×1 @88 · `sentadilla-frente` 4×2 @85 · `peso-muerto-rumano` 3×5 rpe8
- Día 3: `arranque.potencia` 4×1 @80 · `tiron-cargada` 4×2 @108 · `press-empuje` 4×3 rpe8
- Día 4: `arranque` 5×1 @90 · `sentadilla` 4×2 @90 · `sentadilla-overhead` 3×2 rpe7
- Día 5: `cargada` 4×1 @90 · `envion.tijera` 5×1 @88

**Fase `peaking` (sem 13-16, corredor 92-102%, taper):**
- Día 1: `arranque` 5×1 @93 · `sentadilla` 3×2 @92
- Día 2: `cargada-envion` 5×1 @93 · `sentadilla-frente` 3×1 @90
- Día 3: `arranque.potencia` 3×1 @85 · `tiron-arranque` 3×1 @100
- Día 4: `arranque` 4×1 @96 · `sentadilla` 2×1 @95
- Día 5: `cargada-envion` 3×1 @97

## 5. Instanciación (al asignar)

El server instancia **dentro del handler `PUT /athletes/:id/plan`** (el flujo de asignación de M5), tras guardar el `Plan`: si hay receta para `plan.macroId`, `instantiatePrescription(recipe, macro, totalWeeks)` → reemplaza (transaccional) las filas `PrescribedExercise` del atleta. Sin receta → no crea filas (el coach arma de cero). Re-asignar **reinstancia** (reemplaza la prescripción — ⚠ pisa ediciones; ver §8 nota). `totalWeeks = macro.phaseProfile.at(-1).weeks[1]`.

## 6. Endpoints API (coach-autorizados, `guardAthlete`)

Reusan el patrón de escritura de Fase 4 (coach 401 + Vínculo activo 403, `body.atletaId`/path match):
- `GET /athletes/:id/prescription?week=N` → `SessionView[]` de esa semana (kg ya derivado con los RMs del plan del atleta). **`week` requerido** (400 si falta o fuera de 1..104).
- `PUT /athletes/:id/prescription/:week/:idx` → reemplaza los ejercicios de esa sesión (body = `PrescribedExercise[]` validado por Zod, bounds: sets/reps int ≥1, pct 1..120, kg positivo ≤500, rpe 1..10, movementId existe en SP1). Replace transaccional de las filas `(athleteId, week, idx)`.
- (Instanciación: **dentro del `PUT /athletes/:id/plan` existente** — ver §5; no hay endpoint aparte.)

`repo.ts`: `getPrescriptionWeek`, `setSession`, `instantiateForPlan`. Schemas wire en `core/schemas.ts` (`PrescribedExerciseSchema`, `SessionViewSchema`).

## 7. UI del coach (en el drill-down)

Sección **"Sesiones · semana N"** (con selector de semana, default = HOY). Por cada sesión-idx: una card con sus ejercicios (`movementName`, `esquema sets×reps`, `targetKg` derivado o RPE). Botón **editar** por sesión → `SessionEditor` (BottomSheet):
- Lista editable de ejercicios (reordenar, quitar).
- **Agregar/cambiar movimiento:** `MovementPicker` que usa SP1 — `searchMovements` (búsqueda bilingüe), `variantsOf`/`simplerVariants` ("bajar complejidad"), `substitutesOf` ("sustituir").
- Por ejercicio: esquema (sets×reps), **% o kg** (toggle), flags, notas.
- Guardar → `PUT .../prescription/:week/:idx`. **Sin lock por estado.**
- Reemplaza la `SESSION` hardcodeada del mockup "Entreno" con datos reales.

`web/data/`: `prescriptionClient` (o métodos en el `Repository`/`HttpRepository` — propongo extender `Repository` para mantener el patrón: `getPrescriptionWeek(id, week)`, `setSession(id, week, idx, exercises)`).

## 8. Verificación (TDD)

- **core:** `resolveTargetKg` (pct×RM redondeado; kgOverride pisa; rmRef "none"→undefined sin kgOverride), `sessionTemplateFor`/`instantiatePrescription` (semana→fase correcta, conteo de filas, macro-sin-receta→[]), integridad de la receta (todo `movementId` existe en SP1; `phaseKey` ∈ phaseProfile de ruso-5d; pct en rango).
- **api (integración, PG embebido):** instanciar al asignar (Ruso 5D + RMs → filas, kg derivado correcto); `PUT prescription` reemplaza una sesión; **authz coach-only** (atleta 401/403; un coach sin Vínculo 403); bounds Zod (400).
- **web:** la sección de sesiones renderiza con kg derivado; el editor agrega/sustituye un movimiento (vía SP1) y guarda; estados de error.
- **El Carnicero:** kg = verdad (no inventar; redondeo coherente), color=estado intacto, authz coach-only, el atleta no edita la prescripción.

⚠ **Nota (reinstanciar pisa ediciones):** re-asignar el mismo macro reinstancia y pierde ediciones del coach. Para SP2 es aceptable (re-asignar = empezar de nuevo); si molesta, un flag "no reinstanciar si ya hay prescripción editada" es trivial de agregar. Documentado, no bloquea.

## 9. Estructura de archivos

- **core:** `types/index.ts` (+tipos §3), `data/recipes.ts` (`MACRO_RECIPES` Ruso 5D), `logic/prescription.ts` (derivación/instanciación), `schemas.ts` (+schemas wire), tests; `index.ts` exports.
- **api:** `prisma/schema.prisma` (+`PrescribedExercise`), migración `5_prescription`, `repo.ts` (+funciones), `server.ts` o `me/`-style módulo (+endpoints), instanciación en el assign, `*.int.test.ts`.
- **web:** `Drilldown.tsx` (+sección sesiones), `screens/coach/sessions/SessionEditor.tsx` + `MovementPicker.tsx`, `data/` (+métodos prescripción + Zod), tests.

## 10. Alcance SP2 vs SP3 (límite)

- **SP2 (esto):** receta + modelo + instanciación + endpoints + **el coach ve y edita** las sesiones (incl. sustitución vía SP1). Ruso 5D como receta de arranque.
- **SP3:** el **atleta** ve su sesión (en su app, reemplaza el placeholder de "Mi progreso"/o una pestaña "Entreno") + **anota lo real** (`SessionActual`) + el coach ve **prescrito-vs-real**. + completar recetas de otros macros.
