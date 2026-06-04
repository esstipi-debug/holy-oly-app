# SP4 — Sustitución / ajuste en vivo del movimiento

**Fecha:** 2026-06-04
**Estado:** aprobado (brainstorming con el user), pendiente de plan.
**Pilar:** Ejecución/Programación. SP1 ✅ (movimientos) · SP2 ✅ (prescripción + autoría coach) · SP3 ✅ (ejecución + registro real, live). **Este spec = SP4 (sustitución/ajuste guiado en vivo).** Luego SP5 (autorregulación / vigencia de RM).

## 1. Qué es SP4 (y qué NO)

**Idea:** el atleta **y** el coach cambian un ejercicio por una alternativa **guiada** por SP1 — **"bajar complejidad"** (`simplerVariants`: misma base, menor complejidad) o **"sustituir"** (`substitutesOf`: movimiento alternativo). 
- **Atleta (en vivo, en *Entreno*):** cuando no puede con el movimiento prescripto (molestia, etc.), elige una variante simple o un sustituto y registra **lo que realmente hizo** en su *real*. **NO toca el plan**; el coach corrige después si quiere.
- **Coach (en el plan, en el *SessionEditor*):** sugerencias de **un toque** para sustituir/bajar-complejidad de un ejercicio prescripto (hoy el editor de SP2 sólo tiene un picker plano de "agregar"). Cambia la prescripción (es su derecho).

**Dentro de SP4:**
- `SessionActual` gana `prescribedMovementId` (qué decía el plan en ese slot al registrar) → el *real* es auto-descriptivo; `movementId` pasa a ser **lo que se hizo**. Migración `7_actual_substitution`.
- Core: `mergeActuals` re-alinea por slot + marca **`substituido`** (hizo ≠ prescripto) y **`desfasado`** (el coach editó el slot después de registrar — la deuda de El Carnicero en SP3); helper de display.
- Web atleta: acción **"Ajustar / no puedo"** por ejercicio en *Entreno* → hoja con `simplerVariants` + `substitutesOf` → cambia el movimiento de esa fila (kg se limpia, anota el real).
- Web coach: **"sustituir" + "bajar complejidad"** de un toque por ejercicio en el `SessionEditor` → reemplaza el movimiento (kg recalcula `%×RM` del nuevo).
- Web coach: `SessionsSection` muestra "prescripto X → real Y (sustituido)" y "⚠ desfasado".

**Fuera de SP4 (explícito):** registro por-serie · auto-sugerir el kg del sustituto al atleta (anota el real; el sustituto puede tener otro RM) · sugerir sustitutos según la molestia específica (la elección es manual pero guiada) · actualización de RM por PR (= SP5) · "el coach ve el bienestar" · otras recetas.

## 2. Decisiones (del brainstorming)
- **Ambos** (atleta en vivo + coach guiado) · **estructurado** (el *real* guarda el movimiento sustituido, no solo una nota).
- **Atleta read-only sobre el plan:** sustituir en vivo escribe `SessionActual` (su real), NUNCA la prescripción.
- **Coach sustituye en el plan:** mantiene el **`pct`** y **recalcula kg = `pct/100 × RM` del nuevo movimiento** (lógica de SP2). Si el nuevo es `rmRef "none"` → `kgOverride`/`rpe` (igual que SP2).
- **kg del atleta al sustituir:** se **limpia** y el atleta anota el real (el sustituto puede tener otro RM; no auto-sugerimos).
- **Re-alineación:** el merge matchea por slot (orden); `prescribedMovementId` distingue **sustitución legítima** (hizo ≠ plan-al-registrar) de **desfase por edición** (plan-al-registrar ≠ plan-actual-del-slot). Resuelve el MEDIUM de El Carnicero (SP3).
- **HR-1 intacto:** el atleta sigue viendo sólo su plan + su real; las sugerencias son movimientos de SP1 (su programa), no cifras gameables.

## 3. Modelo de datos

### `SessionActual` (migración `7_actual_substitution`)
```prisma
model SessionActual {
  // ... campos SP3 ...
  movementId            String   // lo que REALMENTE hizo (= prescripto, o el sustituto)
  prescribedMovementId  String?  // qué decía el plan en ese slot al registrar (SP4; null en filas SP3)
  // ... done, actualKg?, actualReps?, actualRpe?, note?, doneAt? ...
}
```
`prescribedMovementId` es nullable (filas SP3 no lo tienen → se asume = `movementId`, sin sustitución). Sin índices nuevos.

### Core — tipos
- `SessionActual` gana `prescribedMovementId?: string`.
- `ExerciseActual` (rider de la vista) gana: `movementId: string` (lo hecho), `movementName: string` (nombre de lo hecho), `substituted: boolean`, `desfasado: boolean`.
- `ExerciseActualInput` (wire del atleta) gana `prescribedMovementId?: string`.

## 4. Core — lógica
- `mergeActuals(views, rows, getName)` — por cada ejercicio del slot `i`: busca el actual con `order===i`; calcula:
  - `substituted = actual.movementId !== (actual.prescribedMovementId ?? exercise.movementId)`.
  - `desfasado = actual.prescribedMovementId != null && actual.prescribedMovementId !== exercise.movementId`.
  - `movementName` = nombre del `actual.movementId` (vía `getMovement` de core, ya disponible — `mergeActuals` puede resolver el nombre por sí mismo importando `getMovement`).
- `kgDeviation` se usa **sólo cuando NO hay sustitución** (comparar kg de movimientos distintos no tiene sentido).
- Las sugerencias (`simplerVariants`/`substitutesOf`) ya existen en SP1 — SP4 sólo las consume desde la UI.
- Schemas Zod: `ExerciseActualInputSchema` gana `prescribedMovementId: z.string().max(60).optional()`; `ExerciseActualSchema` (vista) gana `movementId`, `movementName`, `substituted`, `desfasado`.

## 5. API
- **Migración `7_actual_substitution`** + `prescribedMovementId` en el modelo.
- `setSessionActuals` guarda `movementId` (hecho) + `prescribedMovementId` (del input). 
- `getPrescriptionWeek` (sirve coach y atleta): mapea las filas a `SessionActual` con `prescribedMovementId`; `mergeActuals` calcula `substituted`/`desfasado`/`movementName`.
- Sin endpoints nuevos: el atleta usa `PUT /me/session/:week/:idx` (SP3, ahora el body lleva `prescribedMovementId`); el coach usa `PUT /athletes/:id/prescription/:week/:idx` (SP2, sin cambios — el editor manda el movimiento sustituido como cualquier edición).

## 6. Web — atleta (*Entreno*)
- Por ejercicio, botón **"Ajustar / no puedo"** → `BottomSheet` con dos grupos: **Bajar complejidad** (`simplerVariants(movementId)`) y **Sustituir** (`substitutesOf(movementId)`) + (si ya sustituyó) "volver al prescripto". Elegís un movimiento → la fila pasa a ese `movementId`/nombre, **kg se limpia** (anota el real), `prescribedMovementId` queda fijo al original, marca hecho. La fila muestra "prescripto: [X]" tachado + el nuevo.
- `save()` manda por ejercicio `{order, movementId (hecho), prescribedMovementId (original), done, kg, reps, rpe, note}`.
- Selector reusa el patrón del `MovementPicker`/sheets de la app del atleta.

## 7. Web — coach (`SessionEditor`, mejora SP2)
- Por ejercicio del editor, dos acciones de un toque: **"sustituir"** (`substitutesOf`) y **"bajar complejidad"** (`simplerVariants`) → hoja con las sugerencias → elegís → reemplaza el `movementId` de ese ejercicio **conservando sets/reps/pct**; el kg derivado recalcula por `%×RM` del nuevo (o `rmRef "none"` → kg/rpe). El picker plano "+ Agregar ejercicio" sigue para añadir uno nuevo.

## 8. Web — coach (`SessionsSection`)
- Cuando `actual.substituted`: muestra "→ **real: [movementName] [kg]** (sustituido)" **sin** marca ↑/↓ (kg de movimientos distintos no se compara). Sin sustitución: el comportamiento SP3 (`obj X · real Y ↑/↓/=`).
- Cuando `actual.desfasado`: "⚠ desfasado (registrado contra [prescribedMovementName])".
- La nota (`📝`) se mantiene.

## 9. HR-1 / dominio
- El atleta ve su plan + su real + las sugerencias de SP1 (movimientos, no cifras de coach). Sustituir es su decisión de ejecución; no cambia el plan.
- Sustitución = regresión/alternativa **domain-correcta** (SP1 ya garantiza la dirección: nunca el lift completo como "sustituto" de una asistencia — corregido por El Carnicero en SP1).
- kg = verdad; sin-dato honesto (sustituido ≠ desvío falso; desfasado se marca, no se inventa).

## 10. Cómo se conecta (SP1–SP5)
- **SP1** movimientos + `simplerVariants`/`substitutesOf` (la dirección de sustitución ya está bien). **SP2** prescripción/editor del coach. **SP3** el atleta registra real. **SP4 (esto)** ambos sustituyen/ajustan guiado + cierra el desfase posicional de SP3. **SP5** PR/autorregulación → actualizar `Plan.rms`.
