# Entreno — Rediseño: discos + adherencia por defecto + RPE fuera + accesorios %×RM

**Fecha:** 2026-06-04
**Estado:** Diseño aprobado por el user (coach) vía brainstorming + companion visual. Próximo: plan de implementación (`writing-plans`).
**Construye sobre:** SP1 (catálogo de movimientos), SP2 (prescripción/autoría coach), SP3 (ejecución/registro real), SP4 (sustitución en vivo). Reusa el componente de discos existente.

---

## 1. Problema

La `EntrenoScreen` (SP3) salió mal y el user la marcó "muy mal":
- **Sin discos** (viola la regla de que toda fila del atleta muestra kg + discos).
- **Con input de RPE por ejercicio** (el atleta no debe entender/aplicar RPE).
- Modelo de **tildar cada ejercicio** antes (confirmación previa innecesaria).
- Botón "Guardar" roto visualmente.

## 2. Decisiones (LOCKED — aprobadas por el coach)

1. **Discos en cada ejercicio.** Render = **SÓLO los círculos del componente existente `apps/web/src/ui/Disc.tsx`** (`Disc`/`DiscRow`). **NUNCA redibujar/reinventar** (ni barras ni barbell ni en mockups). `perSide(kg, barKg)`; **barra por sexo del atleta: 20 kg ♂ / 15 kg ♀**. El **kg manda**, los discos aproximan (sólo 10/15/20/25). → [[plate-disc-system]] (regla intocable).
2. **RPE fuera de TODO lo del atleta — y de la prescripción.** Se elimina el RPE de core/api/web. Todo ejercicio se prescribe con kg (vía %×RM), así siempre hay kg + discos.
3. **Accesorios = %×RM de un lift de referencia** (reemplaza el RPE). Mapeo en §3.
4. **Series/reps explícitas:** "N series × M repeticiones" (no "N×M").
5. **Adherencia por defecto + sólo "modificar".** No hay checkbox "hecho" por ejercicio. La sesión se asume hecha como está prescrita; el atleta toca **"✎ modificar"** sólo donde cambió algo. Al dar **"Listo"**, lo no-modificado se registra **hecho = prescrito** (la confirmación es a nivel sesión).
6. **"Modificar" = inline** (en la misma tarjeta), simple. Permite: cambiar peso, cambiar reps, **⇄ cambiar movimiento** (SP4), **"no la hice"**, y **↩ volver a lo prescrito**.

## 3. Mapeo de accesorios → referencia RM + % (aprobado)

Los 4 RMs del atleta: `arranque`, `envion` (C&J), `sentadilla`, `frente`. El kg = `% × RM(ref)`. El coach siempre puede pinear el kg a mano (`kgOverride`).

| Accesorio (`id`) | Sale de % de… (`rmRef`) | % receta Ruso 5D (hiper / fuerza-bás / fuerza-pot) | Default fuera de receta |
|---|---|---|---|
| `sentadilla-overhead` (OHS) | **arranque** | 65 / 72 / 78 % | 80–95 % (singles) |
| `press-empuje` (push press) | **envion** | 55 / 62 / 68 % | — |
| `peso-muerto-rumano` (RDL) | **sentadilla** | 60 / 68 / 72 % | — |
| `buenos-dias` (good morning) | **sentadilla** | 40 / 48 % (sólo hiper + fuerza-bás) | — |
| `press-hombros` (strict press) | **envion** (se deriva del jerk) | (no está en la receta) | ~35–50 % |
| `remo` (barbell row) | **envion** (en proporción al clean) | (no está en la receta) | ~30–45 % · conviene pinear kg |

Sanity (Mara: arranque 92, envión 116, sentadilla 150): RDL fuerza-bás 68 %→102 kg · push press 62 %→72 kg · OHS 72 %→66 kg.

Nota de dominio (El Carnicero): los % no inflan el corredor IMR de la fase (son trabajo asistencial); `remo` es mapeo "débil" (no hay RM de tracción) → el % es escala, el coach pinea kg.

## 4. Cambios por capa

### 4.1 core (`packages/core`)
- **types/index.ts:**
  - Quitar `rpe` de `PrescribedExercise` y `PrescribedExerciseView`.
  - Quitar `rpe` de `ExerciseActualInput`; quitar `rpe`/`actualRpe` de `ExerciseActual` (vista) y `SessionActual`.
  - Agregar **`sexo: "M" | "F"`** a `Atleta` (deriva la barra: `barKg = sexo === "F" ? 15 : 20`).
- **data/movements.ts:** setear `rmRef` de las 6 bases hoy `"none"`: `sentadilla-overhead`→`arranque`; `press-empuje`→`envion`; `press-hombros`→`envion`; `peso-muerto-rumano`→`sentadilla`; `buenos-dias`→`sentadilla`; `remo`→`envion`. (Tras esto ninguna base queda `"none"`; el tipo puede seguir admitiéndolo para futuros, pero el catálogo no lo usa.)
- **data/recipes.ts:** reemplazar `rpe:` por `pct:` en los 4 accesorios de la receta, por fase (§3). Sin campo `rpe`.
- **logic/prescription.ts:** `resolveTargetKg` siempre resuelve kg (se elimina la rama RPE); accesorios usan su `rmRef`. `buildSessionViews`/vistas sin `rpe`.
- **logic/discs.ts:** sin cambios (`perSide`/`DISC_COLORS` ya existen). Helper `barKgForSexo(sexo)` si conviene (o inline).
- **schemas.ts:** quitar `rpe` de los schemas de prescripción y de actuals (input + vista); agregar `sexo` a `AtletaSchema`.

### 4.2 api (`apps/api`)
- **Migración `8_rpe_out_sexo`** (vía `scripts/make-migration.ts`, no `prisma migrate dev`): drop `rpe` de `PrescribedExercise`; drop `actualRpe` de `SessionActual`; add `sexo` a `Athlete` (con default seguro, p.ej. `'M'`, y backfill). `prisma generate`.
- **repo.ts:** dejar de leer/escribir `rpe`/`actualRpe`; mapear `sexo` en roster/atleta; la instanciación de prescripción usa `pct` (sin rpe).
- **seed.ts:** `sexo` por atleta (Mara = `"F"`); la receta ya viene con `pct`.
- Endpoints: misma forma, sin `rpe` en body/respuesta. (Drop de columnas = se pierde el `actualRpe` histórico de demo — aceptable, RPE se elimina por diseño.)

### 4.3 web (`apps/web`)
- **`screens/atleta/EntrenoScreen.tsx` — rediseño completo** (§5). Discos vía `DiscRow` con `barKg` por sexo del atleta. Sin RPE. Default-adherencia + "modificar" inline. Necesita el `sexo` del atleta (extender `/me/plan` o el view que ya consume para traerlo).
- **`screens/coach/sessions/SessionEditor.tsx`:** quitar inputs de RPE; los accesorios se prescriben por **%** (la `rmRef` sale del catálogo del movimiento); `kgOverride` sigue para pinear. El selector de carga ya no ofrece "RPE".
- **`screens/coach/sessions/SessionsSection.tsx`:** quitar el manejo/visualización de RPE (ya no existe); los accesorios ahora muestran kg + (su desvío real-vs-prescrito como el resto). La lógica SP4 (sustituido/desfasado) intacta.
- **`data/meClient.ts`** y schemas web: sin `rpe`; traer `sexo` si hace falta para los discos.

## 5. Modelo de guardado del Entreno (detalle)

**Tarjeta del atleta (estado normal)** muestra: nombre · **kg** (verdad, grande) · **discos** (`DiscRow`, barra por sexo) · **"N series × M repeticiones"** (explícito) · **%** (chico/muteado, como en la referencia original) · "✎ modificar". Sin RPE, sin checkbox.

Al cargar (`GET /me/sessions?week`): cada ejercicio prescrito → una fila con `movementId`, `movementName`, `prescribedMovementId = movementId`, `sets`, `reps`, `targetKg`, y el `actual` previo si existe (re-entrada). Estado UI por fila: "como prescrito" (sin marca) salvo que el atleta abra "modificar".

Al dar **"Listo · Guardar"**, se manda un `ExerciseActualInput` por **cada** ejercicio:
- **No modificado** → `{ order, movementId, prescribedMovementId, done: true, kg: targetKg, reps: prescribedReps }` (hecho = prescrito).
- **Modificado (peso/reps, mismo movimiento)** → `done: true`, `kg = ingresado ?? targetKg`, `reps = ingresado ?? prescribedReps`, `note?`.
- **Sustituido (⇄)** → `movementId = sustituto`, `prescribedMovementId = original`, `done: true`, `kg = ingresado` (se limpia al sustituir; el atleta anota el real), `reps?`, `note?`. (Comportamiento SP4 preservado.)
- **"No la hice"** → `{ order, movementId, prescribedMovementId, done: false }` (sin kg/reps).

Resultado: el coach ve prescrito-vs-real (no-modificado → "=", sin desvío falso). Reusa `SessionActual` + `mergeActuals` (SP3/SP4). **Sin-dato:** el "Listo" a nivel sesión es la afirmación del atleta → registrar prescrito-como-real para lo no-tocado NO es fabricar dato (decisión del coach "por defecto se hace lo establecido"). El único "no hecho" es explícito.

## 6. Discos — INTOCABLE

Reusar `apps/web/src/ui/Disc.tsx` (`Disc`/`DiscRow`) + `core` `perSide`/`DISC_COLORS`. Círculos IWF de frente (degradado + cubo + número; el 15 con número oscuro). **Nunca** redibujar como barras/barbell. Barra: 20 ♂ / 15 ♀ (del `sexo` del atleta). El kg es la verdad; los discos aproximan (sólo 10/15/20/25; remanente bajo un disco no se dibuja).

## 7. Fuera de scope (YAGNI)

- Warm-up (shown-not-counted) — no está en el modelo de prescripción; no se agrega ahora.
- Registro por-serie (sigue por-ejercicio).
- UI de setting de barra (se deriva del sexo, no hay selector).
- Auto-sugerir el kg del sustituto al atleta (sigue limpiándose; el atleta anota el real).
- Quinto RM para el clean aislado (sigue el default `cargada.rmRef = envion`).

## 8. Testing / revisión / deploy

- **TDD por unidad** (subagent-driven). core: prescription/discs/recipes/schemas; api: int (instancia con pct, sin rpe, sexo→barra); web: EntrenoScreen (default-adherencia, modificar inline, discos vía DiscRow, sin RPE), SessionEditor (sin RPE, accesorios %), SessionsSection.
- **Verificación no-Docker:** `pnpm --filter @holy-oly/api verify` (PG embebido, migración `8`), `… e2e`; core/web tests; tsc×3; eslint; web build; **prod-bundle inlinea `@holy-oly/core`**.
- **El Carnicero** (dominio) sobre el diff: discos (componente, no redibujados), kg=verdad (accesorios %×RM dan kg realista, sin inflar IMR), RPE ausente del atleta, adherencia-por-defecto honesta (sin-dato), sustitución intacta.
- **Deploy:** FF main → Render (migración `8` vía `start:prod`) → smoke Playwright (Mara: Entreno con discos + series/reps + modificar; coach ve real-vs-prescrito). Actualizar memoria.

## 9. Riesgos

- **sin-dato al faltar el RM de referencia:** los 4 RMs son obligatorios, pero si faltara, el `targetKg` de un accesorio debe quedar **ausente**, jamás `?? 0`. Guard explícito.
- **Migración destructiva de columnas RPE:** se pierde `actualRpe` histórico (demo) — aceptable.
- **`sexo` requerido para la barra:** backfill en la migración (default `'M'`); Mara = `'F'` en el seed.
