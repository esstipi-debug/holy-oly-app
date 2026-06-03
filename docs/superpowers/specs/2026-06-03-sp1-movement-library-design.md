# SP1 — Librería de movimientos · Design doc

**Fecha:** 2026-06-03
**Estado:** aprobado (brainstorming con el user), pendiente de plan.
**Pilar:** Ejecución/Programación (coach programa, atleta ejecuta, ambos adaptan). Decomposición:
**SP1 librería de movimientos** → SP2 prescripción + autoría coach → SP3 ejecución + registro real del atleta → SP4 ajuste en sesión (override de peso + sustitución/complejidad) → SP5 autorregulación + vigencia/actualización de RM.
Cada SP es su propio ciclo spec → plan → build. **Este spec es sólo SP1.**

## 1. Qué es SP1 (y qué NO)

La **fundación de dominio** del pilar: el catálogo de movimientos de halterofilia, **core puro** (como `data/macrocycles.ts`), que SP2–SP5 referencian. Resuelve dos necesidades del coach (de su pedido): **bajar la complejidad** de un movimiento y **sustituirlo** por un problema del atleta.

**Dentro de SP1:** tipos + el catálogo curado (bases) + el **generador** de variantes + helpers de consulta (puros, testeados).
**Fuera de SP1** (otros SP): prescripción por sesión, UI del coach/atleta, persistencia (DB), override de peso real, autorregulación, alimentar el ACWR/carga con datos reales, visualización de discos (kg→10/15/20/25). SP1 **no tiene DB ni UI**.

## 2. Anclajes de dominio

- **kg = %1RM × RM.** El atleta tiene **4 RMs** (`Plan.rms`: `arranque`, `envion`, `sentadilla`, `frente`). Cada movimiento **deriva su % de UNO de esos 4** — o de **ninguno** (`none` = kg libre / RPE, accesorios). El `%` que programa el coach (SP2) ya es apropiado al movimiento (un power snatch ~70% del snatch; un tirón 90–110%). SP1 **no calcula kg** (eso es SP2); SP1 sólo declara el `rmRef` de cada movimiento.
- **Taxonomía combinatoria.** Una variante = **lift base × ejes**: captura (completo/potencia) × origen (piso/bloques/colgado) × posición (alto/rodilla/bajo) × `tipoEnvion` (para el jerk) + flags (pausa/déficit/tempo/sin-recibida). "Hang power snatch" = `arranque` + potencia + colgado. El catálogo se **genera** de los bases → **completo por construcción** (no se "olvida" ninguna variante).
- **Complejidad.** Número derivado: full-desde-piso es lo más complejo; potencia y colgado/bloques **bajan** complejidad (menor demanda técnica/ROM); pausa/déficit/tempo la **suben**. "Bajar complejidad" (pedido del coach) = elegir, mismo base, una variante de `complexity` menor.
- **Warm-up se muestra, no se cuenta** — es regla de ejecución (SP3), no de SP1.

## 3. Modelo de datos (`packages/core/src/types/index.ts`)

```ts
export type RmRef = "arranque" | "envion" | "sentadilla" | "frente" | "none";

export type Captura = "completo" | "potencia";          // squat catch vs power
export type Origen = "piso" | "bloques" | "colgado";    // floor / blocks / hang
export type Posicion = "alto" | "rodilla" | "bajo";     // sólo si origen ∈ {bloques, colgado}
export type TipoEnvion = "tijera" | "empuje" | "potencia" | "fuerza"; // split/push/power/strict-rack
export type MovementFlag = "pausa" | "deficit" | "tempo" | "sin-recibida";

/** Modificadores concretos de una variante (todos opcionales salvo flags, que es []). */
export interface MovementModifiers {
  captura?: Captura;
  origen?: Origen;
  posicion?: Posicion;
  tipoEnvion?: TipoEnvion;
  flags: MovementFlag[];
}

/** Lo que se cura a mano (pocas filas). Declara qué ejes admite el base y sus valores. */
export interface MovementBase {
  id: string;            // slug: "arranque", "cargada", "tiron-arranque", "sentadilla-frente"…
  name: string;          // "Arranque"
  aliasEn?: string;      // "Snatch" — para búsqueda bilingüe (el coach tipea "hang power snatch")
  rmRef: RmRef;
  baseComplexity: number;
  /** Ejes admitidos (los ausentes no se generan). `posicion` NO es configurable por base: el
   *  generador aplica las 3 (alto/rodilla/bajo) automáticamente cuando origen ∈ {bloques, colgado}. */
  axes: {
    captura?: Captura[];
    origen?: Origen[];
    tipoEnvion?: TipoEnvion[];
  };
  /** Flags que TIENEN sentido para este base (los aplica SP2 al prescribir; NO se pre-generan). */
  allowedFlags: MovementFlag[];
  /** Sustitutos curados a nivel base (mismo patrón/objetivo; puede cruzar familia). ids de bases. */
  substituteBases: string[];
  notes?: string;        // p.ej. "se programa 90–110%"
}

/** Variante concreta — GENERADA del base × ejes (sin flags; los flags los aplica SP2). */
export interface Movement {
  id: string;            // "arranque.potencia.colgado.rodilla"  (base = "arranque" sin sufijo)
  baseId: string;
  name: string;          // "Arranque de potencia colgado (rodilla)"
  rmRef: RmRef;          // = base.rmRef
  complexity: number;    // derivada (ver §5)
  modifiers: MovementModifiers; // flags siempre [] en el catálogo
}
```

## 4. Bases curados (`packages/core/src/data/movements.ts`)

`MOVEMENT_BASES: MovementBase[]` — el set inicial (el coach ajusta en la revisión del spec). `posicion` siempre `["alto","rodilla","bajo"]` cuando hay bloques/colgado.

| id | name (aliasEn) | rmRef | baseComplexity | captura | origen | tipoEnvion | allowedFlags | substituteBases |
|---|---|---|---|---|---|---|---|---|
| `arranque` | Arranque (Snatch) | arranque | 9 | completo,potencia | piso,bloques,colgado | — | pausa,deficit,sin-recibida | tiron-arranque, sentadilla-overhead |
| `cargada` | Cargada (Clean) | envion | 8 | completo,potencia | piso,bloques,colgado | — | pausa,deficit | tiron-cargada, sentadilla-frente |
| `envion` | Envión (Jerk) | envion | 7 | — | — | tijera,empuje,potencia,fuerza | pausa | press-empuje |
| `cargada-envion` | Cargada y Envión (Clean & Jerk) | envion | 9 | completo,potencia | piso,bloques,colgado | — | pausa | cargada, envion |
| `tiron-arranque` | Tirón de arranque (Snatch pull) | arranque | 5 | — | piso,bloques,colgado | — | deficit,pausa | tiron-cargada |
| `tiron-cargada` | Tirón de cargada (Clean pull) | envion | 5 | — | piso,bloques,colgado | — | deficit,pausa | tiron-arranque, peso-muerto-rumano |
| `sentadilla` | Sentadilla (Back squat) | sentadilla | 4 | — | — | — | pausa,tempo | sentadilla-frente |
| `sentadilla-frente` | Sentadilla frontal (Front squat) | frente | 5 | — | — | — | pausa,tempo | sentadilla |
| `sentadilla-overhead` | Sentadilla de arranque (Overhead squat) | none | 5 | — | — | — | pausa | sentadilla-frente |
| `press-empuje` | Push press | none | 3 | — | — | — | pausa | press-hombros |
| `press-hombros` | Press de hombros (Strict press) | none | 2 | — | — | — | tempo | press-empuje |
| `peso-muerto-rumano` | Peso muerto rumano (RDL) | none | 2 | — | — | — | tempo,pausa | tiron-cargada |
| `buenos-dias` | Buenos días (Good morning) | none | 2 | — | — | — | tempo | peso-muerto-rumano |
| `remo` | Remo con barra (Barbell row) | none | 2 | — | — | — | pausa | — |

> **rmRef a confirmar por el coach:** `sentadilla-overhead` está como `none` (kg libre / % del snatch a criterio); si querés que derive del `arranque`, lo cambio. Accesorios (`press-*`, RDL, etc.) = `none` (kg directo o RPE). Lista de accesorios **extensible** (agregás los que falten en la revisión).

> **Semántica de sustitución (revisión El Carnicero):** los sustitutos son **regresión/alternativa por limitación**, de patrón similar y demanda ≤ — **nunca** el lift completo del que un movimiento es asistencia (subir complejidad ya lo da `variantsOf`/`simplerVariants`). Por eso los tirones se sustituyen entre sí / con RDL, y el push press con press de hombros (no con el lift completo). **`cargada` deriva del RM de `envion` (C&J);** como el clean aislado suele superar el C&J, SP2/coach programa el % alto (no se agrega un 5º RM — se resuelve en el `%`). **`complexity` = demanda TÉCNICA/coordinativa, NO carga física** — el coach la usa para "bajar la coordinación", jamás para derivar `%`.

## 5. Generación + derivación

**Generador** (`buildMovements(bases): Movement[]`, puro): por cada base, producto cartesiano de los ejes que declara, con reglas:
- **captura:** si `axes.captura` existe, itera sus valores; si no, no aplica.
- **origen:** si `axes.origen` existe, itera; **`posicion`** se genera **sólo** para `origen ∈ {bloques, colgado}` (con `piso` no hay posición), usando una constante del módulo `POSICIONES = ["alto","rodilla","bajo"]` (no se declara por base).
- **tipoEnvion:** sólo `envion`; itera sus valores (excluyente con captura/origen).
- **flags:** **no** se generan (la variante del catálogo es flag-less; `flags: []`). SP2 aplica flags al prescribir vía `computeComplexity`/`movementDisplayName`.
- **id canónico:** el id **omite los valores por defecto** (`captura: completo`, `origen: piso`) e **incluye los no-default**, en orden fijo `base[.captura][.origen[.posicion]][.tipoEnvion]`. Así "completo + piso" → `id = baseId`. Ej.: `arranque` (completo, piso), `arranque.potencia`, `arranque.potencia.colgado.rodilla`, `envion.empuje`. (El `envion` no tiene default de `tipoEnvion` → todas sus variantes llevan sufijo: `envion.tijera`, `envion.empuje`, …; no existe un `id = "envion"` pelado.)

**Conteo esperado** (~68 movimientos): arranque/cargada/cargada-envion = 2 capturas × (piso + bloques×3 + colgado×3) = **14 c/u**; tirones = 1 + 3 + 3 = **7 c/u**; envión = **4** (tipoEnvion); squats/press/accesorios = **1 c/u** (8). Total ≈ **68**.

**Nombre** (`movementDisplayName(baseName, modifiers)`): compone en español — captura ("de potencia"), origen+posición ("colgado (rodilla)", "desde bloques (bajo)"), tipoEnvion ("en tijera"/"de empuje"/"de potencia"/"de fuerza"), flags ("con pausa", "con déficit", "tempo", "sin recibida"). Ej.: `Arranque de potencia colgado (rodilla)`.

**Complejidad** (`computeComplexity(baseComplexity, modifiers) → clamp 1..12`):
```
complexity = baseComplexity
  + (captura === "potencia" ? -2 : 0)
  + (origen === "bloques" || origen === "colgado" ? -2 : 0)   // hang/blocks: pull más corto, sin levantada del piso
  + (posicion === "alto" ? -1 : posicion === "bajo" ? +1 : 0) // bajo-rodilla = pull más largo, más difícil
  + (tipoEnvion === "empuje" || tipoEnvion === "potencia" ? -1 : tipoEnvion === "fuerza" ? -2 : 0) // tijera 0
  + flags.reduce: pausa +1, deficit +1, tempo +1, "sin-recibida" -1
  → clamp(1, 12)
```
Ej.: arranque base 9 → *hang power snatch (rodilla)* = 9 −2 (potencia) −2 (colgado) +0 (rodilla) = **5**. El `−2` de colgado/bloques (no `−1`) garantiza orden monótono y que toda variante hang/blocks quede por debajo del lift completo desde piso (9): colgado completo alto 6 < rodilla 7 < bajo 8 < piso 9.

## 6. Helpers (`packages/core/src/logic/movements.ts`)

Todos puros, sobre `MOVEMENTS` (= `buildMovements(MOVEMENT_BASES)`, memoizado/const):
- `getMovement(id): Movement | undefined`
- `getBase(baseId): MovementBase | undefined`
- `variantsOf(baseId): Movement[]` — todas las variantes de un base, orden por `complexity` desc.
- `canonicalVariant(baseId): Movement` — la variante representativa del base = `variantsOf(baseId)[0]` (la más compleja: full-desde-piso para los lifts, `tijera` para el envión, la única para sentadillas/accesorios). Evita asumir `id === baseId` (el envión no lo cumple).
- `simplerVariants(id): Movement[]` — mismas-base con `complexity < el de id`, orden desc (= "bajar complejidad").
- `substitutesOf(id): Movement[]` — resuelve `base.substituteBases` → `canonicalVariant(...)` de cada sustituto.
- `movementsForRm(rmRef): Movement[]`
- `computeComplexity(baseComplexity, modifiers): number` — exportado (SP2 lo reusa al aplicar flags).
- `movementDisplayName(baseName, modifiers): string` — exportado (SP2 lo reusa).
- `searchMovements(q): Movement[]` — match por `name`/`aliasEn` (case/acento-insensible), para el selector del coach (SP2).

Export desde `packages/core/src/index.ts`: `export * from "./data/movements"; export * from "./logic/movements";`.

## 7. Verificación (TDD)

- **Integridad del catálogo** (`movements.test.ts`): todo `substituteBases` apunta a un `MovementBase` existente; todo `rmRef` ∈ los 5 válidos; ids únicos en `MOVEMENTS`; `complexity ∈ [1,12]`; cada base con `axes.captura`/`origen`/`tipoEnvion` genera ≥1 variante; `posicion` nunca aparece con `origen: "piso"`.
- **Generación:** `MOVEMENTS.length` ≈ 68 (assert el conteo exacto una vez calculado); `getMovement("arranque.potencia.colgado.rodilla")` existe, `rmRef="arranque"`, `complexity=6`, nombre contiene "potencia" y "colgado"; el snatch completo desde piso es `getMovement("arranque")`.
- **Helpers:** `simplerVariants("arranque")` excluye el full y todos tienen `complexity < 9`, ordenados desc; `substitutesOf("arranque")` incluye `tiron-arranque` y `sentadilla-overhead` (variantes canónicas); `movementsForRm("frente")` incluye `sentadilla-frente`; `searchMovements("hang power snatch")` y `searchMovements("arranque potencia colgado")` ambas devuelven la variante; `computeComplexity` cubre cada delta + clamp.
- **core commands:** `pnpm --filter @holy-oly/core test movements` · `pnpm --filter @holy-oly/core exec tsc --noEmit`.

## 8. Estructura de archivos

- **Modify** `packages/core/src/types/index.ts` — tipos de §3.
- **Create** `packages/core/src/data/movements.ts` — `MOVEMENT_BASES` + `buildMovements` + `MOVEMENTS`.
- **Create** `packages/core/src/logic/movements.ts` — helpers de §6 (`computeComplexity`, `movementDisplayName`, consultas).
- **Create** `packages/core/src/logic/movements.test.ts` + `packages/core/src/data/movements.test.ts` (o uno solo) — §7.
- **Modify** `packages/core/src/index.ts` — exports.

> **Decisión de ubicación:** datos puros del catálogo en `data/`; lógica (generación, complejidad, consultas) en `logic/`. Espeja `macrocycles.ts` (data) + `monitor.ts`/`schedule.ts` (logic).

## 9. Lo que SP2+ construyen encima (no en SP1)

- **SP2:** modelo de prescripción por sesión (`{movementId, esquema sets×reps, %1RM | kg, flags[]}`), `kg = %1RM × Plan.rms[movement.rmRef]`, UI del coach (selector con `searchMovements`/`variantsOf`/`simplerVariants`/`substitutesOf`), persistencia.
- **SP3:** ejecución del atleta + registro real (warm-up shown-not-counted, marcado por serie).
- **SP4:** override de peso (real ≠ objetivo, preservando lo planeado) + aplicar `simplerVariants`/`substitutesOf` en vivo.
- **SP5:** autorregulación + vigencia/actualización de RM.
