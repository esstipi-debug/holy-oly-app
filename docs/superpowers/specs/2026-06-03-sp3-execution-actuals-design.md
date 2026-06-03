# SP3 — Ejecución del atleta + registro real (`SessionActual`)

**Fecha:** 2026-06-03
**Estado:** aprobado (brainstorming con el user), pendiente de plan.
**Pilar:** Ejecución/Programación. SP1 ✅ (movimientos) · SP2 ✅ (prescripción + autoría coach, live). **Este spec = SP3 (atleta ejecuta + anota real; coach ve desvíos).** Luego SP4 (sustitución/ajuste en vivo), SP5 (vigencia/RM).

## 1. Qué es SP3 (y qué NO)

**Idea:** el atleta ve su sesión **prescripta** (read-only — es su programa) y anota **lo que levantó** por ejercicio (kg/reps/RPE reales, que pueden diferir del objetivo: autorregulación). El coach ve **prescrito-vs-real** en su drill-down y corrige. Conecta SP2 (la prescripción) con el dato real del entreno.

**Dentro de SP3:**
- Modelo `SessionActual` (real por ejercicio) + migración `6_session_actual`.
- API atleta-self: leer la **propia** prescripción + actuals (`GET /me/sessions`), grabar actuals (`PUT /me/session/:week/:idx`).
- API coach: `GET /athletes/:id/prescription` (SP2) **enriquecido con los actuals** (prescrito-vs-real) — sin endpoint nuevo.
- Web atleta: tarjeta **"Tu semana"** en *Hoy* (días con estado hecho/pendiente) → pantalla **"Entreno"** (registrar lo real).
- Web coach: la sección **"Sesiones"** (SP2) muestra **obj X · real Y** con marca de desvío.

**Fuera de SP3 (explícito):** registro **por serie** (SP3 es por-ejercicio) · calentamiento modelado (la receta son series de trabajo; warm-up = guía futura) · **sustitución/cambio de complejidad en vivo del atleta → SP4** · actualización de RM por PR → SP5 · curar las 22 recetas restantes (slice aparte) · charts de "Mi progreso" (A2).

## 2. Decisiones (del brainstorming)

- **Granularidad = por ejercicio:** un `SessionActual` por ejercicio prescripto (no por serie). Pre-llenado con lo prescripto; el atleta confirma o edita. Tipeo mínimo en el celu.
- **Alcance = atleta registra + coach ve desvíos** (el payoff completo).
- **Ubicación = desde "Hoy":** *Hoy* lista los días de la semana actual; tocar un día abre la pantalla **Entreno**. Integra con el loop diario (estado + check-in + entreno).
- **El atleta NO toca la prescripción** (read-only); su "real" vive aparte en `SessionActual`. Si levantó otra cosa, lo refleja en kg/reps reales + nota (la **sustitución dirigida** es SP4).
- **kg real puede ser ≠ objetivo** (más por aprovechar el día, menos por fatiga) — el pedido original del user.
- **Selección de día:** sin mapeo día→fecha; el atleta elige de la lista de la semana (flexible; el orden no se fuerza). El estado hecho/pendiente sale de si existe `SessionActual` para ese (semana, día).
- **HR-1 intacto:** el atleta ve **su** prescripción (su programa) y **sus** actuals — datos propios, no cifras "gameables" del coach (ACWR/IMR siguen coach-only). Es lo que necesita para entrenar.

## 3. Modelo de datos

### `SessionActual` (Prisma — migración `6_session_actual`)
```prisma
/// Lo que el atleta realmente levantó, por ejercicio prescripto. Self-scoped (requireAthlete).
model SessionActual {
  id          String   @id @default(uuid())
  athleteId   String
  athlete     Athlete  @relation(fields: [athleteId], references: [id], onDelete: Cascade)
  week        Int
  sessionIdx  Int
  order       Int
  movementId  String          // = el prescripto (denormalizado para robustez)
  done        Boolean  @default(true)
  actualKg    Float?
  actualReps  Int?
  actualRpe   Float?
  note        String?
  doneAt      String?         // ISO YYYY-MM-DD (opcional; el día que lo registró)

  @@unique([athleteId, week, sessionIdx, order])
  @@index([athleteId, week])
}
```
+ `actuals SessionActual[]` en `Athlete`. Misma clave que `PrescribedExercise` → cada ejercicio prescripto tiene a lo sumo un actual.

### Core — tipos
- `SessionActual` (dominio: el shape de arriba sin `id`/relación).
- `ExerciseActual = { done; kg?; reps?; rpe?; note? }` — el real "aplanado" para la vista.
- Extender `PrescribedExerciseView` con `actual?: ExerciseActual` (la vista de sesión gana el real por ejercicio). `SessionView` no cambia (sus `exercises[]` ya llevan el `actual?`).

## 4. Core — lógica
- `mergeActuals(views: SessionView[], rows: SessionActual[]): SessionView[]` — adjunta `actual` a cada ejercicio por `(week, sessionIdx, order)` (puro).
- `kgDeviation(targetKg: number | undefined, actualKg: number | undefined): "none" | "igual" | "mas" | "menos"` — para la marca de desvío del coach (tolerancia ±0; `none` si falta algún dato).
- Schemas Zod del wire: `ExerciseActualInput` (lo que el atleta manda por ejercicio: `order` + done + kg?/reps?/rpe?/note?, acotados) + `SessionActualsInput` (array por sesión).

## 5. API

### Atleta (self · `requireAthlete` · scope a `req.athleteId`, nunca body/path)
- **`GET /me/sessions?week=N`** → `SessionView[]` de la semana N del **propio** plan, **prescripción read-only + actuals mergeados**. `week` requerido (1..104, 400 si falta). Sin plan → `[]`.
- **`PUT /me/session/:week/:idx`** → body = `ExerciseActualInput[]` (un actual por ejercicio de esa sesión) → upsert de `SessionActual` (reemplaza los de ese `(week, idx)`). 200 `{ok:true}`. Valida bounds (400). `idx` 0..13.

### Coach
- **`GET /athletes/:id/prescription?week=N`** (SP2) ahora **merge-a los actuals** del atleta → cada ejercicio lleva `actual?`. El front del coach muestra prescrito-vs-real. (`guardAthlete` intacto; sin endpoint nuevo.)

### Repo
- `getMeSessions(prisma, athleteId, week)` — como `getPrescriptionWeek` (reusa `buildSessionViews`) + `mergeActuals`.
- `setSessionActuals(prisma, athleteId, week, sessionIdx, actuals)` — `$transaction` deleteMany+createMany de los `SessionActual` de ese `(week, idx)` (transaccional, mismo patrón que `setSession`).
- `getPrescriptionWeek` (coach) extendido para mergear actuals.

## 6. Web — atleta

- `data/meClient.ts`: `getMeSessions(week)`, `putMeSession(week, idx, actuals)` (Zod, schemas de core).
- **`Hoy`** (`HomeScreen`): nueva tarjeta **`SemanaCard`** = los días (1..N) de `plan.currentWeek` con dot hecho/pendiente (de `getMeSessions(currentWeek)`) → tocar un día navega a la pantalla Entreno. (Sin plan → no se muestra.)
- **`EntrenoScreen`** (ruta `/atleta/entreno/:week/:idx`): carga la sesión (prescripto + actual). Por ejercicio: nombre · `sets×reps · obj kg/RPE`; toggle **hecho** + inputs **kg / reps / RPE reales** (pre-llenados con el objetivo) + nota opcional. **Guardar** → `putMeSession` → vuelve a *Hoy*. Manejo de error en el submit. Caritas/colores: el real es dato propio, sin semáforo gameable (HR-1).

## 7. Web — coach
- `SessionsSection` (SP2): cuando un ejercicio tiene `actual`, mostrar `obj X · real Y` + marca (`=` igual, `↑` levantó más, `↓` menos) vía `kgDeviation`. Estado de sesión hecha si todos sus ejercicios tienen `actual.done`.

## 8. HR-1 / dominio
- El atleta ve **su** prescripción + **sus** actuals (datos propios, no cifras de coach). ACWR/IMR/recovery siguen coach-only.
- `kg = verdad`; el real se anota en kg (los discos siguen aproximados, downstream).
- Sin-dato honesto: sesión sin registro → "pendiente", nunca un real inventado.

## 9. Cómo se conecta (SP1–SP5)
- **SP1** movimientos · **SP2** prescripción (coach) · **SP3 (esto)** el atleta ejecuta + anota real + el coach ve desvíos · **SP4** sustitución/ajuste en vivo (usa `simplerVariants`/`substitutesOf` de SP1) · **SP5** PR → actualizar `Plan.rms` → repercute en %×RM.
- **Payoff futuro:** cuando haya volumen de `SessionActual`, la carga/tonelaje **real** puede alimentar el ACWR/MonitorSeries (hoy mock) y los discos.
