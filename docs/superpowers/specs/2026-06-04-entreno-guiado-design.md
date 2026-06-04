# Entreno guiado — diseño

> **Fecha:** 2026-06-04 · **Estado:** aprobado (brainstorming) → listo para `writing-plans`
> **Pilar:** ejecución del atleta (continúa SP1→SP4 + rediseño Entreno). **Live:** holy-oly.onrender.com

## 1. Objetivo

Rediseñar la pantalla "Entreno" del atleta de una **lista plana** a un **reproductor de sesión
guiado con calentamiento**. Pedido textual del coach: *"debería decir iniciar entrenamiento,
empezar con el primer movimiento y mostrar el calentamiento"*.

Hoy `EntrenoScreen` muestra todos los ejercicios en una lista y guarda **un** resultado por
ejercicio. El rediseño:

1. **Entrada (Opción A):** al abrir el día se ve el **resumen** (la lista actual con discos +
   "N series × M repeticiones") con un botón prominente **"▶ Iniciar entrenamiento"** arriba.
2. **Reproductor:** guía **movimiento por movimiento**, arrancando por el primero, con una sección
   de **calentamiento** (rampa automática) y la de **series de trabajo**.
3. **Registro por serie (Opción B):** el atleta marca **cada serie de trabajo por separado**
   (no un resultado único por ejercicio). Cada serie es **independiente** (modificar la serie 3 no
   toca la 4-5).

## 2. Decisiones de diseño (cerradas en el brainstorming)

| Decisión | Elegido | Notas |
|---|---|---|
| Entrada | **A** — resumen + "▶ Iniciar entrenamiento" | (entre A/B/C) |
| Granularidad de registro | **B** — por serie | el coach lo eligió sabiendo que es más trabajo (cambio de modelo) |
| Modificar una serie | **cada serie independiente** | sin cascada "aplicar al resto" (descartado por el coach) |
| Calentamiento | algoritmo determinístico (§4) | escala como fracción del peso de trabajo |
| Modelo de datos | array `sets` en `SessionActual` | NO tabla nueva `SetActual` (YAGNI: más plumbing, sin necesidad) |
| Resumen por ejercicio (coach/charts) | **top set** (máximo kg hecho) | a confirmar por El Carnicero |

## 3. Alcance

**Dentro:**
- Reproductor guiado (entrada A + player movimiento-por-movimiento).
- Calentamiento en `core` (lógica pura, testeable), adjunto a la vista server-side.
- Registro por serie (`sets`) con modificar independiente + "no la hice" por serie.
- Discos en calentamiento **y** en cada serie (vía `Disc.tsx`/`DiscRow` — **intocable**).

**Fuera (otros specs):**
- SP5 (autorregulación / vigencia de RM), A2 ("Mi progreso").
- Cascada "aplicar al resto" al bajar peso (descartada).
- Apareo actual↔ejercicio por identidad (sigue posicional; SP5).

## 4. Calentamiento (core)

Lógica nueva en **`packages/core/src/logic/warmup.ts`** (+ `warmup.test.ts`). Determinística.

### 4.1 Invariantes (anclados al rulebook de dominio — NO negociables)

- **Se muestra y NO se cuenta:** el warm-up nunca crea `SessionActual`, nunca alimenta
  ACWR/IMR/volumen/adherencia. Es sólo display.
- **kg = verdad:** `kg = Math.round(pct/100 × RM)` (igual que `resolveTargetKg`).
- **Sin-dato → `[]`:** si falta RM, `pct`, o `rmRef === "none"`, no hay rampa numérica. JAMÁS un `?? 0`.

### 4.2 Primitivo: `warmupSets`

Los sets cargados son **fracciones del peso de trabajo** `W` (= `workingPct`), no %s fijos del RM.
Así escala solo: W bajo → rampa corta; W alto → rampa larga. Por construcción todo set < trabajo.

```ts
export interface WarmupSet { pct: number; kg: number; reps: number; label: "barra" | "rampa"; }

const FRACTIONS: ReadonlyArray<{ f: number; reps: number; minW?: number }> = [
  { f: 0.50, reps: 5 },
  { f: 0.70, reps: 3 },
  { f: 0.85, reps: 2 },
  { f: 0.93, reps: 1, minW: 85 }, // single de aproximación SÓLO en días pesados (W≥85)
];

export function warmupSets(workingPct: number, rm: number, barKg: number, isFirstMovement: boolean): WarmupSet[] {
  if (!Number.isFinite(workingPct) || !Number.isFinite(rm) || rm <= 0 || workingPct <= 0) return [];
  const workingKg = Math.round((workingPct / 100) * rm);
  const out: WarmupSet[] = [];
  if (isFirstMovement) out.push({ pct: 0, kg: barKg, reps: 5, label: "barra" }); // barra vacía SÓLO 1er mov

  if (workingPct <= 55) { // día muy liviano/técnica: un solo set de aproximación
    const kg = Math.round((0.75 * workingPct / 100) * rm);
    if (kg > barKg && kg < workingKg) out.push({ pct: Math.round(0.75 * workingPct), kg, reps: 3, label: "rampa" });
    return dedupeAndGuard(out, workingKg, barKg);
  }
  for (const { f, reps, minW } of FRACTIONS) {
    if (minW != null && workingPct < minW) continue;
    const pct = f * workingPct;
    const kg = Math.round((pct / 100) * rm);
    out.push({ pct: Math.round(pct), kg, reps, label: "rampa" });
  }
  return dedupeAndGuard(out, workingKg, barKg);
}

// cada set < trabajo; sin kg duplicados (queda el de más reps); sin sets sub-barra.
function dedupeAndGuard(sets: WarmupSet[], workingKg: number, barKg: number): WarmupSet[] {
  const seen = new Map<number, WarmupSet>();
  for (const s of sets) {
    const isBar = s.label === "barra";
    if (!isBar && (s.kg <= barKg || s.kg >= workingKg)) continue;
    const prev = seen.get(s.kg);
    if (!prev || s.reps > prev.reps) seen.set(s.kg, s);
  }
  return [...seen.values()].sort((a, b) => a.kg - b.kg);
}
```

### 4.3 Orquestador: `warmupForExercise`

Decide la **forma** de la rampa según el tipo de movimiento. Usa `getMovement`/`getBase` (SP1).
`isFirstMovement` = `order === 0` (la convención ya es "main lifts come first"; determinista, KISS).

```ts
export function warmupForExercise(
  args: { movementId: string; pct?: number; order: number },
  rms: RM, barKg: number,
): WarmupSet[]
```

Árbol de decisión:

1. **Sin-dato:** `mv = getMovement(movementId)`; si `!mv` → `[]`. `rmRef = mv.rmRef`; si `rmRef === "none"`
   o `pct == null` o `rms[rmRef] <= 0` → `[]`. Si no, `rm = rms[rmRef]`, `W = pct`, `isFirst = order === 0`.
2. **OHS al final** (`mv.baseId === "sentadilla-overhead"` y `!isFirst`): **2 feelers** `[0.5·W×5, 0.7·W×3]`
   (demanda de movilidad overhead).
3. **Accesorio** (`getBase(mv.baseId).baseComplexity <= 3` y `!isFirst`): **1 feeler** `0.6·W×5`
   (ya está caliente). Captura push-press(3)/strict-press(2)/RDL(2)/buenos-días(2)/remo(2).
4. **Resto** (lifts principales, sentadillas, tirones, y cualquiera de los anteriores **cuando es el
   primero**): **rampa completa** `warmupSets(W, rm, barKg, isFirst)`. Tirones programados 90–110%
   funcionan acá (casi siempre `!isFirst` → sin barra; si abren el día, llevan barra). Todos los
   feelers pasan por `dedupeAndGuard` (cada set < trabajo, > barra; reps del feeler usan la misma
   forma `pct = f·W`, `kg = round(pct/100·rm)`).

### 4.4 Integración: `buildSessionViews` adjunta el warmup

El RM vive en `plan.rms[mv.rmRef]` → el warmup se computa **en `core` (server-side), nunca en el
cliente del atleta**. `buildSessionViews(rows, rms, barKg)` ya tiene `rms` y el orden (índice del
array ordenado = `order`); por cada ejercicio llama `warmupForExercise` y adjunta el resultado a
`PrescribedExerciseView.warmup` (siempre presente; `[]` cuando sin-dato). El RM no viaja crudo al
atleta — va embebido en los kg del warmup, que el atleta ve igual.

- Firma: `buildSessionViews(rows: PrescriptionRow[], rms: RM, barKg = 20): SessionView[]` (param
  `barKg` nuevo, default 20 ♂; `getPrescriptionWeek` pasa `barKgForSexo(athlete.sexo)`).
- El coach (SessionEditor, week grid) recibe `warmup` también; lo ignora. Costo trivial.

### 4.5 Worked examples (oráculos de los tests) — Mara ♀, barra 15

RM: arranque 92, envión 116, sentadilla 150.

| Día | Ejercicio | W | 1er mov | warmup esperado | trabajo |
|---|---|---|---|---|---|
| Liviano | Arranque | 62% | sí | `[barra 15×5, 29×5, 40×3, 48×2]` | 57 |
| Medio | Envión | 78% | no | `[45×5, 63×3, 77×2]` (sin barra) | 90 |
| Pesado | Sentadilla | 90% | sí | `[barra 15×5, 68×5, 95×3, 115×2, 126×1]` | 135 |

Los tres validados a mano contra `warmupSets`. (Afinables por el coach sin romper invariantes:
`0.50/0.70/0.85/0.93`, umbral `W≥85`, reps `5/5/3/2/1`, corte `≤55%`, feeler `0.6·W`.)

## 5. Registro por serie (Opción B) — modelo de datos

Hoy `SessionActual` es **1 fila por ejercicio** con un solo `actualKg`/`actualReps`, apareada
posicionalmente (`order == índice de vista`) por `mergeActuals`. B agrega el detalle por serie
**sin** cambiar esa estructura (el merge posicional queda intacto).

### 5.1 Tipos (`core/src/types/index.ts`)

```ts
/** Una serie de trabajo registrada. */
export interface SetActual { kg?: number; reps?: number; done: boolean; }

// SessionActual gana:        sets?: SetActual[];
// ExerciseActual (read view) gana: sets?: SetActual[];
```

### 5.2 Persistencia (Prisma · migración 9)

`SessionActual` gana `sets Json?` (migración `9_set_actuals` vía `scripts/make-migration.ts`; nunca
`prisma migrate dev`). Sigue **1 fila por ejercicio**. Las columnas `actualKg`/`actualReps`/`done`
permanecen como **resumen derivado** (top set) → coach, charts y `kgDeviation` no cambian.

### 5.3 Resumen derivado — `summarizeSets` (core, puro, testeado)

```ts
/** Resumen por ejercicio a partir de las series (para el coach/charts). */
export function summarizeSets(sets: SetActual[]): { done: boolean; kg?: number; reps?: number } {
  const done = sets.filter((s) => s.done);
  if (done.length === 0) return { done: false };       // ninguna serie hecha = "no la hice"
  const top = done.reduce((a, b) => ((b.kg ?? -Infinity) > (a.kg ?? -Infinity) ? b : a));
  return { done: true, kg: top.kg, reps: top.reps };   // top set = máximo kg hecho
}
```

### 5.4 Wire (schemas Zod · `core/src/schemas.ts`)

- `WarmupSetSchema = z.object({ pct: z.number(), kg: z.number(), reps: z.number().int(), label: z.enum(["barra","rampa"]) })`.
- `PrescribedExerciseViewSchema` gana `warmup: z.array(WarmupSetSchema).max(8).default([])`.
- `SetActualInputSchema = z.object({ kg: KgSchema.optional(), reps: z.number().int().min(0).max(100).optional(), done: z.boolean() })`.
- `ExerciseActualInputSchema` gana `sets: z.array(SetActualInputSchema).max(20).optional()` (input
  no-confiable del atleta → acotado).
- `ExerciseActualSchema` (read-side) gana `sets: z.array(SetActualInputSchema).optional()`.

### 5.5 Servidor (`apps/api/src/repo.ts`)

- `setSessionActuals`: por cada actual, si `sets?.length` → `const sum = summarizeSets(a.sets)` y
  persiste `done: sum.done, actualKg: sum.kg ?? null, actualReps: sum.reps ?? null, sets: a.sets`
  (Json); si no, usa los top-level de hoy (tolerante a writes legacy). `doneAt` se sella sólo si done.
- `getPrescriptionWeek`/`mergeActuals`: el row vuelve con `sets` (Json) + el resumen; `mergeActuals`
  adjunta `sets` al `ExerciseActual`. Backward-compat: filas SP3/SP4 sin `sets` → `sets: undefined`,
  se muestran como un valor (legacy), degradación honesta.

### 5.6 Cliente (`apps/web/src/data/meClient.ts`)

`putMeSession(week, idx, actuals)` no cambia de firma; el `ExerciseActualInput` ahora lleva `sets`.
`getMeSessions` parsea `SessionViewsSchema` (ya con `warmup` + `actual.sets`).

## 6. Reproductor (web)

`EntrenoScreen.tsx` (hoy ~125 líneas, lista plana) se reorganiza en componentes chicos y enfocados:

- **`EntrenoScreen`** (container): carga `plan` + `sessions`, resuelve `barKg`, posee el estado del
  player (modo resumen vs player, índice del movimiento, las series editables) y el `save`.
- **`ResumenDia`** (entrada A): la lista actual (discos + "N series × M reps") + **"▶ Iniciar
  entrenamiento"**.
- **`SessionPlayer`** (movimiento por movimiento; estado = índice del movimiento actual):
  - **Header:** nombre · "N series × M repeticiones" · `%` · "Movimiento X/Y" + **crono simple**
    (cuenta desde Iniciar) + **cue del coach** (si el ejercicio tiene `notes`).
  - **`WarmupSection`:** las `WarmupSet[]` de la vista, cada una con `DiscRow` (kg→discos) + reps;
    **salteable**, **no cuenta**. Oculta cuando el movimiento fue **sustituido** en vivo (el warmup
    es del prescripto; al sustituir ya estás caliente y el kg quedó sin definir — ver §7).
  - **`WorkSetsSection`:** N filas "**Serie n/N · {kg} kg · {reps} reps · ✓**", cada una con su
    `DiscRow`. **Adherencia por defecto:** cada serie nace hecha al target (✓ verde). Tocás **✎** en
    una serie → editás kg/reps **de esa serie**, o la marcás "no la hice". **Independiente.**
  - **Footer:** `⇄ cambiar` (movimiento entero, reusa `SubstituteSheet` de SP4) · atajo "no la hice"
    a nivel movimiento (marca todas las series no-hechas) · `‹ Ant` / `Siguiente movimiento ›`; en el
    último movimiento → **Fin · Guardar entreno**.
- Reusa `Disc`/`DiscRow` y `SubstituteSheet`. Tokens: el atleta usa `--ho-mono`/`--wl-*`;
  `SubstituteSheet` (compartido coach+atleta) sólo `--wl-*`.

**Pre-carga al reabrir** una sesión ya registrada: las filas de serie se llenan desde `actual.sets`
(si existe); si no, desde el target (adherencia por defecto).

**Guardar:** `putMeSession(week, idx, actuals)` donde cada actual lleva `sets` (las N series). El
resumen lo deriva el server (`summarizeSets`).

Referencia visual: el mockup B del coach (header/crono/badges/Ant-Fin/Movimiento X/Y/cue/
Calentamiento con discos/Series de trabajo/Siguiente movimiento) + `_mockup/index.html` pantalla
"Entreno · ejecución".

## 7. Casos borde / errores

- **Warmup sin-dato** (sin RM/pct, `rmRef:"none"`, override-only) → `[]`; la sección no se muestra.
- **Sustitución en vivo:** al sustituir, `movementId !== prescribedMovementId` y el kg se limpia (como
  hoy en SP4). El `warmup` de la vista es del **prescripto** → se **oculta** la sección de
  calentamiento mientras esté sustituido (no recomputamos en el cliente: no tiene el RM, y al sustituir
  el atleta ya calentó). Las series del sustituto muestran "— kg" hasta cargar.
- **Guardar falla** → `setError`, no navega (patrón ya existente en `EntrenoScreen`).
- **Sesión sin plan / día inexistente** → `[]` (mensaje "No hay sesión para este día").
- **Todas las series no-hechas** → resumen `done:false` ("no la hice" del ejercicio).

## 8. Tests

- **core** `warmup.test.ts`: los 3 worked examples (liviano/medio/pesado) + invariantes (sin-dato→[],
  guard sub-barra, dedupe, todo set < trabajo) + accesorio (1 feeler) + OHS-al-final (2 feelers) +
  tirón (rampa sin barra cuando `!isFirst`).
- **core**: `buildSessionViews` adjunta `warmup` correcto por ejercicio; `summarizeSets` (top set,
  todas-no-hechas, kg ausente).
- **core/schemas**: bounds de `SetActualInput`/`warmup`.
- **api int**: `putMeSession` con `sets` round-trip; lectura del coach muestra el resumen = top set;
  el warmup NO crea filas `SessionActual`.
- **web**: `ResumenDia` → "▶ Iniciar" entra al player; modificar una serie → el payload incluye `sets`
  con esa serie cambiada y las demás al target; warmup visible no afecta el guardado; **sin RPE** en
  ninguna superficie.

## 9. No-negociables honrados

- **Discos** sólo vía `Disc.tsx`/`DiscRow` (calentamiento + cada serie) — nunca redibujar.
- **kg = verdad**; toda fila de ejercicio/serie muestra **kg + discos**.
- **RPE no va** en ninguna superficie del atleta.
- **"N series × M repeticiones"** explícito.
- **Adherencia por defecto**: se hace lo prescrito; el atleta sólo modifica lo que cambió.

## 10. Decomposición tentativa (para `writing-plans`)

1. **Fase 1 — core warmup:** `warmup.ts` (`warmupSets` + `warmupForExercise`) + tests; integrar en
   `buildSessionViews` (param `barKg`, campo `warmup` en la vista + schema).
2. **Fase 2 — core/api modelo por serie:** `SetActual` + `summarizeSets` + schemas; migración 9
   (`sets Json?`); `setSessionActuals`/`mergeActuals`/`getPrescriptionWeek`; tests + int.
3. **Fase 3 — web reproductor:** partir `EntrenoScreen` en `ResumenDia` + `SessionPlayer`
   (`WarmupSection`/`WorkSetsSection`) con modificar por serie; reusar `Disc`/`SubstituteSheet`; tests.
4. **Fase 4 — wire/e2e:** `meClient` + e2e round-trip; verificación local (PG embebido) + smoke.

Después de las fases: **El Carnicero** (dominio — confirma warmup + resumen=top-set) → deploy
(Render auto-deploy on push a `main`) → smoke live → actualizar memoria.

## 11. A confirmar con El Carnicero (no bloquean el spec)

- **Resumen = top set** (vs modal/última). Top set = "tocó el peso prescripto"; el detalle fino vive
  en `sets`.
- **OHS "al final" = `!isFirst`** (no detectamos "última posición" literal).
