# Spec: Motor Prilepin — core dormant (v1)

> Slice 1 del bundle [5] (`2026-06-09-bundle-spec-motor-prescripcion.md`) **adaptado según la
> reconciliación** (`2026-06-09-bundle-reconciliacion-vs-holyoly.md` §3/§5.1/§6). Aterriza como
> módulo PURO en `packages/core/src/logic/prilepin.ts` (patrón SP1: config + funciones + tests,
> **cero UI, cero API, cero migración**). El pseudocódigo del bundle tiene bugs conocidos (§6 de
> la reconciliación) — esta spec define el contrato real; se implementa con TDD contra los
> criterios de abajo, no copy-paste.
>
> Tesis del owner que este módulo hace literal: **"todo gira en torno al calendario, el sistema
> ordena el peak"** — la fecha de la compe (anclada al calendario) determina la fase de cada
> semana hacia atrás; sin compe, olas continuas de 6 semanas.

---

## 1. Qué es / qué no es

**ES:** un generador semanal `sets × reps × % → kg` con motor Prilepin interno auditable
(opción C del owner). Entrada: semanas a la compe (o posición en la ola), RM vigente del lift,
ACWR reciente, semáforo del día. Salida: filas legibles para el atleta + auditoría para el coach.

**NO ES (este slice):**
- NO se cablea a nada: ni rutas, ni `Repository`, ni UI, ni seeds. Dormant.
- NO decide genera-vs-propone (decisión abierta del owner §7.2 de la reconciliación; la
  recomendación vigente es *propone, el coach aprueba* — eso es cableado posterior).
- NO toca `volumeCurve`/`restructure.ts` (la conciliación motor↔taper-de-volumen es del slice
  peaking).
- NO recibe el ciclo menstrual como input (rulebook §3: el ciclo jamás prescribe; entrará como
  *contexto* en readiness→modulación, Capa 3, post-motor).
- NO genera movimientos concretos del catálogo: prescribe **por lift** (`RmLift`); el mapeo a
  `PrescribedExercise`/movimientos es del slice de cableado.

## 2. Contrato

```ts
export type EnginePhase = "accumulation" | "intensification" | "peak" | "taper" | "comp_week" | "deload";
export type IntensityZone = "70-80" | "80-90" | "90+";
export type ReadinessBand = "green" | "amber" | "red";

export interface EngineInput {
  weeksToComp: number | null;     // largo del countdown FIJADO AL ANCLAR (la compe = última semana); null = ola
  weekIdx?: number;               // semana del countdown a generar (0-based, default 0) — D13
  lift: RmLift;                   // arranque | envion | sentadilla | frente (house, no enum paralelo)
  rmKg: number;                   // RM vigente del lift (SP5; el coach lo fija — acá jamás se estima)
  recentACWR: number | null;      // de monitor.ts; null = sin dato (sin ajuste, jamás inventar)
  waveWeek?: number;              // 1-based, posición en la ola si weeksToComp === null — SIN default (D13b)
  readiness?: ReadinessBand | null; // banda sobre readiness.ts 0-100; null/ausente = sin dato
}

export interface EngineSet {
  sets: number;
  reps: number;
  pct: number;                    // % del RM vigente
  weightKg: number;               // round(pct/100 × rmKg) a 1 kg — coherente con resolveTargetKg
  zone: IntensityZone;
}

export interface EngineZoneAudit {
  zone: IntensityZone;
  optimalReps: number;            // tabla Prilepin
  prescribedReps: number;         // sets × reps efectivos de la zona
  withinRange: boolean;           // prescribedReps ∈ [min, max] de Prilepin
}

export interface EngineWeek {
  phase: EnginePhase;
  label: string;                  // es-CL: "Acumulación", "Intensificación", "Pico", "Taper", …
  rationale: string;              // microcopy de supercompensación (explica, no castiga)
  sets: EngineSet[];              // lo que ve el atleta (kg manda; discos los pinta la UI con DiscRow)
  audits: EngineZoneAudit[];      // TODAS las zonas prescritas (bug audits[0] del bundle corregido)
  taper: { base: number; acwrFactor: number; readinessFactor: number; final: number };
  inputs: { acwr: number | null; readiness: ReadinessBand | null }; // eco auditable (HR-2: cómo se forma)
  heavySinglesAdvisory: boolean;  // readiness red + zona 90+ presente → "mover los singles a otro día"
}

/** Cara del atleta (redacción EN CORE, patrón redactCycle — D12): solo phase/label/rationale/sets. */
export interface EngineWeekAthleteView { phase: EnginePhase; label: string; rationale: string; sets: EngineSet[]; }

export function generateWeek(input: EngineInput): EngineWeek | null;
export function phasePlan(weeksToComp: number): EnginePhase[];
export function wavePhase(waveWeek: number): EnginePhase | null;
export function athleteWeekView(week: EngineWeek): EngineWeekAthleteView;
// + en readiness.ts (aditivo): export function readinessBand(score: number | undefined): ReadinessBand | null;
```

`generateWeek → null` = "sin prescripción honesta" (RM inválido, compe en el pasado, ola
inválida). Jamás una prescripción inventada sobre dato degenerado (lección Carnicero del ciclo).

## 3. Configuración (constantes nombradas, ajustables acá y en ningún otro lado)

**Tabla Prilepin** (heurística observacional soviética, no ECA — el comentario lo dice):

| zona | óptimo | min | max | reps/set (sentadilla/frente) | reps/set (arranque/envión) |
|---|---|---|---|---|---|
| 70-80 | 18 | 12 | 24 | 3 | 2 |
| 80-90 | 15 | 10 | 20 | 2 | 2 |
| 90+ | 4 | 1 | 10 | 1 | 1 |

`CLASSIC_LIFTS = arranque | envion` (la técnica degrada antes que en sentadilla → menos reps/set).

**PHASE_PROFILE** (la inversión volumen↓/intensidad↑ hecha número):

| fase | taperFactor | zoneMix (70-80 / 80-90 / 90+) | topPct | label |
|---|---|---|---|---|
| accumulation | 1.00 | .6 / .4 / 0 | 85 | Acumulación |
| intensification | 0.80 | .3 / .6 / .1 | 90 | Intensificación |
| peak | 0.55 | .1 / .5 / .4 | 95 | Pico |
| taper | 0.40 | .1 / .4 / .5 | 100 | Taper |
| comp_week | 0.25 | 0 / .3 / .7 | 100 | Semana de competencia |
| deload | 0.50 | .8 / .2 / 0 | 80 | Descarga |

**Microcopy `rationale`** (es-CL, marco supercompensación de la spec [4] §1: cada bajada se
explica, nunca se impone): acumulación = construir base · intensificación = "últimos kg de fuerza
útil: baja el volumen, sube la intensidad" · pico = "menos trabajo, mismo peso" · taper = "quitamos
cansancio sin perder fuerza" · comp_week = "solo aperturas: disipar fatiga para llegar afilado" ·
deload = "acá es donde el cuerpo se vuelve más fuerte". Texto final en el código (constante por
fase); sin emojis (regla emoji=contenido).

## 4. `phasePlan(weeksToComp)` — el countdown FIJADO AL ANCLAR (D13)

**Semántica (corregida por el HIGH de El Carnicero):** `n` = largo del countdown en semanas,
**fijado al anclar la compe**; la semana de la compe es **siempre la última** (`weekIdx = n−1`).
La semana vivida `i` es `phasePlan(n)[i]` — **JAMÁS re-derivar `[0]` con un weeksToComp
recomputado semana a semana**: la compresión depende del largo TOTAL (n=3 salta el taper, n≥4
no), así que una función pura de la distancia sola produce una secuencia vivida distinta del
array (y el caso del owner perdía su forma en vivo). Re-anclar/mover la compe recomputa el
countdown entero (mismo patrón que `anchorPlanToComp`).

- `n ≥ 4` → `(n−4) × accumulation` + `[intensification, peak, taper, comp_week]` (cubre el
  hueco del bundle en n=7).
- `n = 3` → `[intensification, peak, comp_week]` (el caso explícito del owner: sin taper aparte
  — la disipación vive en comp_week, taperFactor 0.25)
- `n = 2` → `[peak, comp_week]` · `n = 1` → `[comp_week]` (la compe es esta misma semana)
- `n < 1` o no-entero o no-finito → `[]` (compe pasada / input degenerado → sin plan;
  `generateWeek` devuelve `null`). Invariantes testeadas: largo = n; comp_week última y única.

## 5. `wavePhase(waveWeek)` — ola continua de 6 semanas

`[accumulation, accumulation, intensification, intensification, peak, deload]`, 1-based, cicla
indefinidamente. El `peak` de la semana 5 es el **mini-pico** (la spec [4] §3.1: single/test
*opcional* — la obligatoriedad es decisión abierta del owner, no de core).
`waveWeek` no-entero, < 1 o no-finito → `null` (jamás fabricar una fase desde NaN).
**Sin default (D13b):** la posición en la ola es ESTADO del cableado; `waveWeek` ausente con
`weeksToComp === null` → `generateWeek` devuelve `null` honesto — el default 1 del bundle
fabricaba la semana de MÁS volumen desde un dato faltante (hallazgo de El Carnicero).

## 6. `generateWeek` — los 4 pasos

1. **Fase**: `weeksToComp !== null` → `phasePlan(weeksToComp)[weekIdx ?? 0]` (fuera de rango o
   weekIdx degenerado → null); si no → `waveWeek` ausente → null, presente → `wavePhase(waveWeek)`.
2. **Ajuste ACWR** (banda de la casa, no la del bundle — D3): `> 1.3 → ×0.9` · `< 0.8 → ×1.1` ·
   en banda o `null`/no-finito → ×1.0.
3. **Ajuste readiness**: `amber → ×0.9` · `red → ×0.75` + `heavySinglesAdvisory` si hay zona 90+ ·
   `green`/`null` → ×1.0.
4. **Prilepin → sets** por zona con `mix > 0`:
   - `targetReps = round(óptimo × taperFinal × mix)`; si `< 1` se omite la zona — **salvo la zona
     top** (la más alta con `mix > 0`), que tiene piso 1 (D5).
   - `numSets = max(1, round(targetReps / repsPerSet))`; `prescribedReps = numSets × repsPerSet`.
   - `pct`: zona top → `min(zoneCeil, topPct)`; no-top → `min(zoneBase, topPct)`.
     Bases `{75, 85, 92}`, techos `{80, 90, 95}` (D4: el techo de 90+ es el **tope prescribible
     95** — el 100 es el intento del día de la compe, no se programa).
   - `weightKg = round(pct/100 × rmKg)` (kg a 1 kg — D6).
   - Auditoría por CADA zona prescrita (`audits[]`), + eco `taper`/`inputs`.

## 7. Decisiones de esta spec (las que corrigen o superan al bundle — no re-litigar sin causa)

- **D1 · Sin sRPE/RPE.** Ni en input ni en output ni en audit (regla intocable + reconciliación
  §3.1). Los inputs de carga son ACWR de `monitor.ts`.
- **D2 · `lift: RmLift`, no enum paralelo.** El bundle traía `'snatch'|'clean_jerk'|'pull'|'squat'`;
  la casa prescribe contra los 4 lifts del RM (SP5). "Pull" no es un lift de RM acá; el mapeo
  movimiento→lift (rmRef) es del cableado.
- **D3 · Umbrales ACWR de la casa.** Banda segura `[0.8, 1.3]` (rulebook §2, `monitor.ts:7`);
  el bundle usaba `< 0.9` para "liviano" — acá `< 0.8` para no inventar un segundo umbral.
- **D4 · `pctForZone` corregido + tope prescribible 95.** El bundle dejaba 90+ clavado en 92
  (`min(base, topPct)` para todas las zonas) y su propio ejemplo mostraba singles @95. Regla
  nueva: la zona top alcanza `min(zoneCeil, topPct)`; `zoneCeil(90+) = 95` porque **nunca se
  prescribe >95% en entrenamiento** (las aperturas son ~90-95; el 100 del perfil es techo
  conceptual de la fase, verificable en `PHASE_PROFILE`, no una carga programada).
- **D5 · Piso de 1 rep en la zona top.** Sin piso, intensificación (mix 90+ = 0.1) redondea a 0 y
  la fase pierde su seña de identidad (el single @90 que el propio bundle ejemplifica). Sólo la
  zona top tiene piso; las demás se omiten honestamente si redondean a 0.
- **D6 · Redondeo de la casa: kg a 1 kg.** Coherente con `resolveTargetKg` (`prescription.ts:14`).
  NADA de `round(kg/2.5)×2.5`: el kg es la verdad, los discos aproximan y los pinta la UI
  (`Disc.tsx`) — jamás este módulo.
- **D7 · Sin-dato honesto, jamás silencioso.** `recentACWR: number | null` (en `monitor.ts` el
  ACWR puede no existir aún); null → factor 1.0 **y** el eco `inputs.acwr = null` deja auditable
  que NO hubo ajuste por falta de dato (disciplina anti-falso-verde del rulebook §2).
- **D8 · `audits[]` completo.** El bundle devolvía `audits[0]` y descartaba el resto de zonas.
- **D9 · Bandas readiness = cortes de la casa.** `readinessBand` (aditivo en `readiness.ts`):
  `≥80 green · 70-79 amber · <70 red · sin dato → null` — espejo de `recoveryState`
  (`monitor.ts:67`, misma escala 0-100). El semáforo EXISTENTE (worse-of) no se toca.
  **Enmienda (El Carnicero):** como `readiness` ya penaliza ACWR fuera de banda (hasta −20),
  un ACWR muy alto puede pegar DOS veces (factor estructural ×0.9 + banda amber/red del día) —
  **deliberado y conservador**: venir cargado y venir poco recuperado son dos razones distintas
  para bajar volumen. Candidato explícito a la calibración con coaches piloto (§7.1 reconc.).
- **D10 · `withinRange` puede ser `false` y está bien.** En zonas secundarias el mix chico queda
  bajo el rango Prilepin — el audit lo dice honesto; la UI del peek (cableado) lo fraseará. No se
  "arregla" inflando reps.
- **D11 · El ejemplo numérico del bundle NO es contrato.** Sus cifras (§5 del bundle) no salen de
  sus propias fórmulas (p.ej. 5 singles 90+ en pico con taper 0.55×0.4 ≈ 1). El contrato son los
  criterios de §8 + estas decisiones; El Carnicero juzga la cordura de dominio de las salidas
  reales.
- **D12 · HR-1 en el shape, con redactor EN CORE.** `sets[]` (kg incluidos) es la cara del
  atleta; `audits`/`taper`/`inputs` (incluye el ACWR crudo — número gameable) son material de
  coach/peek. **Enmienda (El Carnicero):** declararlo no basta — el precedente del ciclo es
  redacción en core (`redactCycle`), una sola fuente. Por eso `athleteWeekView(week)` vive YA
  en `prilepin.ts` y el cableado consume ESO para el atleta, no filtra por su cuenta.
- **D13 · Countdown fijado al anclar (fix del HIGH de El Carnicero).** `phasePlan(n)` y la
  secuencia vivida eran inconsistentes si el caller re-derivaba `[0]` semanalmente (el taper
  reaparecía en el caso n=3 del owner). Contrato nuevo: `n` se fija AL ANCLAR la compe,
  comp_week es siempre la última semana, y la semana vivida es `phasePlan(n)[weekIdx]`.
  **D13b:** `waveWeek` sin default — ausente → null honesto (el default 1 fabricaba la semana
  de más volumen desde dato faltante).
- **D14 · Unidad = SESIÓN, no semana (El Carnicero).** La tabla Prilepin es una heurística POR
  SESIÓN; `EngineWeek` es la dosis del lift para su sesión PRINCIPAL de la semana, y
  `withinRange` se lee contra esa unidad. El reparto multi-sesión (p.ej. ruso-5d entrena un
  lift 2-3×/sem) es del slice de cableado/peaking — si los audits llegan a superficie con la
  unidad sin resolver allá, es HIGH por HR-2.

## 8. Criterios de aceptación (TDD — los 9 del bundle, adaptados, + los de la casa)

1. `phasePlan(n)` correcto para n = 0..12 (largo = n; comp_week última y única; n=7 → 3·acc +
   4 finales; n=3 → `[intensification, peak, comp_week]`); n inválido (<1, no-entero, NaN) → `[]`.
   La secuencia VIVIDA (`generateWeek` con weekIdx 0..n−1) ES el array — el taper no reaparece
   en n=3; weekIdx fuera de rango/degenerado → null. Ningún set de ninguna fase supera 95%
   (test de propiedad). `athleteWeekView` expone SOLO phase/label/rationale/sets.
2. Con 3 semanas: intensificación → pico → semana de compe, sin reiniciar (el motor sólo lee
   `weeksToComp`).
3. `PHASE_PROFILE`: `taperFactor` estrictamente decreciente y `topPct` no-decreciente a lo largo
   de accumulation → … → comp_week (85 → 100); cada `zoneMix` suma 1.
4. ACWR > 1.3 reduce reps totales vs neutro; < 0.8 las sube; en banda o `null` → idéntico a
   neutro, con `inputs.acwr` reflejando el caso.
5. `readiness` amber/red reducen volumen; red + zona 90+ → `heavySinglesAdvisory: true`; el single
   top NO se borra (mover ≠ borrar — el aviso es para el cableado).
6. Toda zona prescrita produce su `EngineZoneAudit` con `withinRange` aritméticamente correcto.
7. `weightKg` redondea a 1 kg (caso que NO es múltiplo de 2.5: rm 91 @ 85% → 77).
8. arranque/envión usan ≤ reps/set que sentadilla/frente en 70-80 (2 vs 3).
9. `wavePhase` cicla la ola indefinidamente (semana 7 = accumulation, 11 = peak, 12 = deload);
   inválida → null.
10. Tope prescribible: en taper/comp_week el set más pesado queda a 95%, jamás 100; en
    intensificación el single top va @90 (= topPct de la fase).
11. Sin-dato/degenerado → `null` o `[]` honesto: `rmKg` ≤ 0/NaN, `weeksToComp` negativo/NaN,
    `waveWeek` inválida. Jamás un `EngineWeek` fabricado desde NaN.
12. El shape serializado de `EngineWeek` no contiene ninguna key `rpe` (guard de regresión).
13. `readinessBand`: 80→green, 79→amber, 70→amber, 69→red, undefined/NaN → null.

## 9. Encaje futuro (contexto, no alcance)

El consumidor natural es el slice **readiness→modulación** (el ajuste del paso 3 por día con
explicación visible) y luego **peaking** (que concilia `phasePlan` con `volumeCurve` y la
`Competencia`). Obligaciones del cableado que esta spec deja fijadas:
- El countdown (`weeksToComp` + `weekIdx`) se computa **UNA vez al anclar/re-anclar** la compe
  desde `Competencia.date` vía `schedule.ts` (verdad anclada a fecha, §2b) — jamás re-derivar
  semana a semana (D13).
- `waveWeek` se **persiste** como estado del plan en modo ola — el motor no acepta ausencia.
- El atleta consume `athleteWeekView`; los `audits`/`taper`/`inputs` van SOLO al peek del coach
  (D12). El fraseo del "por qué null" (sin RM vigente ≠ compe pasada) lo resuelve el cableado
  pre-validando inputs.
- Resolver la unidad sesión-vs-semana del reparto (D14) ANTES de poner `withinRange` en
  superficie. El `rationale`/`audits` alimentan el peek de app-viva ("¿por qué esta semana?").
