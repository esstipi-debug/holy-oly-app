# Spec: Entrenamientos distintivos por escuela — ADN + generador determinístico (v1)

> Aprobado por el owner 2026-06-11 (brainstorming completo, decisiones D1–D15 abajo).
> Objetivo en sus palabras: **"un patrón de movimiento, creación de entrenamientos distintivos.
> no pueden ser standard y random"**. Alcance elegido: **todo de una** — modelo + las 10
> familias / 23 recetas faltantes en el mismo slice (Ruso 5D curado queda como verdad manual
> y benchmark). El owner delegó el cierre: "confío en tu criterio para que lo termines".

---

## 1. Qué es / qué no es

**ES:** un modelo declarativo de **ADN de escuela** (`SchoolDNA`, datos puros con fuentes
citadas) + un **generador determinístico** (`generateRecipe(dna, macro) → MacroRecipe`) que
produce las recetas de los 23 macros sin receta curada. Más las extensiones de librería que
el contenido exige: **scores de carga** (4 dimensiones), **complejos** como ejercicio
programable, **bases nuevas** (snatch balance, jerk dip, sots press, accesorios), y la rama
de **doble sesión por día** a nivel de shape.

**NO ES (este slice):**
- NO ondulación semana-a-semana dentro de una fase: las semanas de una fase repiten plantilla
  (igual que el Ruso 5D curado). Eso es del motor Prilepin + readiness→modulación (roadmap).
- NO toca el motor Prilepin dormant (`prilepin.ts`): su tabla se reusa como **auditoría en
  tests** del volumen generado, jamás como generador.
- NO UI completa de doble turno (calendario AM/PM): el shape queda listo (`day`/`turno`
  opcionales), la UI llega cuando la primera receta bi-diaria se habilite (D14).
- NO migraciones, NO API nueva: las recetas generadas viajan por los caminos existentes
  (`instantiatePrescription` → savePlan → prescripción del atleta editable por el coach).
- NO RPE en ninguna parte (regla intocable).

## 2. Decisiones cerradas con el owner (no re-litigar)

- **D1 · Camino C:** primero el modelo (ADN + generador), las escuelas se vierten en él.
- **D2 · Recetas materializadas, no prescripción viva** — con el shape preparado para que
  readiness→modulación module encima después. *Materialización elegida:* generación
  determinística **en import** (`recipesAll.ts`) + **snapshot commiteado en tests** como
  artefacto auditable/difeable. Equivale a datos commiteados sin paso de codegen que pueda
  desincronizarse (drift DNA↔receta imposible por construcción).
- **D3 · Todo de una:** las 10 familias / 23 recetas en este slice.
- **D4 · Curaduría manda:** si un macro tiene receta curada a mano (`recipes.ts`), esa gana;
  el generador llena sólo lo que falta. Ruso 5D curado = benchmark de regresión del modelo.
- **D5 · Dimensiones de carga A+B (4):** `tecnica` (= `complexity` existente, NO se toca),
  `snc` (demanda neural), `axial` (compresión columna / costo estructural), `metabolica`
  (volumen×músculo). Dimensiones DISTINTAS; mezclar dos en una = HIGH del Carnicero. Los
  scores informan generación/secuencia; **JAMÁS derivan kg** (kg = %×RM, siempre).
- **D6 · Complejos:** composición de movimientos existentes; notación `1+1+2`; UN kg de
  barra; % programado contra el **eslabón más débil** (min RM de los `rmRef` de los
  eslabones — calcularlo contra el fuerte = CRITICAL).
- **D7 · Techos de reps (validados por el owner):** por eslabón en complejo —
  clásicos/potencia 3 · jerk 2 · tirones 3 · sentadillas 3 · empuje/dip 3; aislados —
  clásicos 3 · tirones 5 · press/dip 5 (sentadillas/accesorios se rigen por fase+Prilepin).
  Complejo entero: **≤6 reps totales por serie**; **% máximo inverso al largo** (2 eslabones
  ≤90% · 3 ≤85% · 4+ ≤80% del eslabón débil).
- **D8 · Técnicos por sesión:** 1–2 norma; techo duro **3** (búlgaro lo alcanza porque no
  programa nada más). 4º técnico = HIGH.
- **D9 · Doble sesión:** `SessionTemplate` gana `day?` (1..7) y `turno?` ("AM"|"PM");
  ausentes = comportamiento actual (sesión n = día n). El ADN gana `sessionsPerDay`;
  presupuesto SNC por sesión **y por día** (turnos comparten el diario).
- **D10 · Determinismo:** cero `Math.random`/`Date.now`. Rotación de variantes = índice
  derivado de hash `(macroId, phaseKey, sessionIdx, slotIdx)`. Mismo input → misma receta,
  bytes idénticos. Aleatoriedad = CRITICAL.
- **D11 · "No standard" verificable:** tests de huella por escuela (prohibiciones, firmas,
  secuencia) + distintividad pareada (dos escuelas difieren en fases comparables).
- **D12 · El Carnicero ganó el tercer lente 🏛️ Escuela** (ya commiteado en
  `.claude/agents/el-carnicero.md`) y el rulebook gana §Escuelas/§Scores/§Complejos en este
  slice — el Carnicero sólo hace cumplir lo que el rulebook respalda.
- **D13 · Sin-dato honesto:** macro sin ADN aplicable o fase sin esqueleto → receta ausente
  (la UI ya tiene el empty-state "aún no tiene el detalle sesión-por-sesión"), jamás una
  receta inventada genérica.
- **D14 · Búlgaro v1 = 6 sesiones (1/día):** el daily-max bi-diario real (AM arranque / PM
  envión) exige superficies de calendario que hoy mapean sesión→día 1:1 (`planHeat`,
  grilla de adherencia). v1 emite 6 sesiones diarias únicas con la identidad intacta
  (singles ≥90% + back-off, repertorio mínimo); el shape `day`/`turno` queda listo y la
  receta bi-diaria se habilita con la UI AM/PM (slice posterior).
- **D15 · Frecuencias no numéricas:** `usa-school` "4-5d/sem" → 5 · `hibrido-block`
  "variable" → 4 (overrides nombrados en config del generador, justificados en comentario).

## 3. Modelo de datos (todo en `packages/core`)

### 3.1 Scores de carga (`types` + `data/movements.ts` + `logic/movements.ts`)

```ts
export interface MovementLoads { snc: number; axial: number; metabolica: number } // 1..10
// MovementBase gana: baseLoads: MovementLoads
// Movement (variante generada) gana: loads: MovementLoads (derivado)
export function computeLoads(base: MovementLoads, m: MovementModifiers): MovementLoads;
```

Ajustes de modificadores (espejo de `computeComplexity`, clamp 1..10):
- `captura: "potencia"` → snc −1 (recepción menos profunda, menos costo de rebote)
- `origen: bloques/colgado` → snc −1, axial −1 (sin pickup del piso, tirón más corto)
- `tipoEnvion: "fuerza"` → snc −1 · `"empuje"/"potencia"` → snc −0 (queda igual)
- flags: `pausa`/`tempo` → metabolica +1 · `deficit` → axial +1 · `sin-recibida` → snc −1

`repsMax` por base: `{ enComplejo: number; aislado: number }` (tabla D7).

### 3.2 Bases nuevas (`data/movements.ts`)

| id | name | rmRef | notas |
|---|---|---|---|
| `snatch-balance` | Snatch balance | arranque | velocidad de recepción; china/coreana |
| `jerk-dip` | Dip de envión | envion | drive del jerk; se programa 90–105% |
| `sots-press` | Press Sots | arranque | movilidad/estabilidad overhead china; % bajo |
| `remo-menton` | Remo al mentón | envion | accesorio de tirón vertical (bloque chino) |
| `press-banca` | Press banca | none | accesorio GPP (kg los fija el coach) |
| `hiperextension` | Hiperextensión | none | espalda baja; peso corporal/disco |
| `salto-cajon` | Salto al cajón | none | velocidad cubana/china; sin barra |

Regla v1: el **generador sólo programa movimientos con `rmRef` ≠ "none"** (toda fila del
atleta conserva kg+discos derivables). Los `rmRef:"none"` quedan en la librería para uso
manual del coach y para el bloque metabólico con `kgOverride` ausente (la fila muestra el
movimiento y sets×reps sin kg — patrón ya soportado por `resolveTargetKg → undefined`).
Los scores/nombres exactos son curaduría del owner post-slice (ids congelados desde ya).

### 3.3 Complejos (`data/complexes.ts` + `logic/complexes.ts`)

```ts
export interface ComplexLink { movementId: string; reps: number } // reps ≤ repsMax.enComplejo
export interface ComplexDef {
  id: string;                 // namespace "cx." — p.ej. "cx.tiron-arranque+arranque"
  name: string;               // "Tirón de arranque + Arranque (1+1)" — notación EN el nombre
  links: ComplexLink[];       // 2..4 eslabones, orden de ejecución
  notes?: string;
}
export function getComplex(id): ComplexDef | undefined;
export function complexTotalReps(c): number;          // ≤ 6
export function complexPctCeiling(c): number;          // 2→90 · 3→85 · 4+→80
export function complexWeakRmRef(c, rms: RM): RmRef;   // rmRef del eslabón con menor RM
export function complexLoads(c): MovementLoads;        // snc = max, axial = max, metabolica = suma capada 10
export function complexComplexity(c): number;          // max(complexity de eslabones) + 1 (transición), cap 12
```

Catálogo inicial (10, validado con el owner): tirón+arranque · arranque+OHS ·
potencia+arranque · colgado+arranque · tirón+arranque+OHS · cargada+frontal+2°tiempo ·
cargada+2°tiempo×2 · tirón+cargada · potencia-cargada+frontal · press-empuje+2°tiempo.

**Integración (la clave para que la UI no cambie):** las recetas referencian complejos por
`movementId: "cx.*"` en el `PrescribedExercise` existente, con `reps` = **total** de reps
de la serie (suma de eslabones — coherente con tonelaje: cada rep mueve la barra).
`prescription.ts` se vuelve complex-aware:
- `resolveTargetKg`: id `cx.*` → `pct/100 × min(rms[rmRef de cada eslabón])`, capado por
  `complexPctCeiling` en generación (el cap vive en el generador+tests, no en resolve).
- `movementName`: nombre del complejo (incluye la notación `(1+1+2)`).
- `warmupForExercise`: rampa contra el kg objetivo del complejo usando el primer eslabón.
- Sustitución del atleta: `simplerVariants("cx.*") = []` (honesto; un complejo no se
  sustituye en v1 — se marca no-hecho o el coach lo edita).

### 3.4 ADN de escuela (`data/schools.ts`)

```ts
export type PhaseRole = "base" | "fuerza" | "intensidad" | "peaking" | "descarga";
export type SlotKind = "olimpico" | "tiron" | "rodilla" | "empuje" | "bisagra" | "complejo" | "metabolico";

export interface SessionArchetype {
  key: string;                       // "A-arranque", "B-envion", …
  slots: SlotKind[];                 // orden DESEADO (el generador reordena por demanda si hace falta)
  focus?: "arranque" | "envion" | "mixto";
}
export interface SchoolDNA {
  family: MacrocycleFamily;
  character: string;                 // 1 línea es-CL (va al rulebook §Escuelas)
  repertoire: Partial<Record<SlotKind, { id: string; weight: number }[]>>; // ids de variantes o "cx.*"
  forbidden: string[];               // baseIds/ids que la escuela JAMÁS programa
  archetypes: Partial<Record<PhaseRole, SessionArchetype[]>>;  // ciclo de sesiones por rol de fase
  sessionsPerDay: number;            // 1 (todas) — la rama 2 queda lista (D14)
  tecnicosMax: 1 | 2 | 3;
  sncBudget: Record<PhaseRole, number>;   // presupuesto por sesión (suma de snc de los ejercicios)
  dosage: {                          // carácter de dosis (dentro del corredor imrPct de la fase)
    mainBias: "low" | "mid" | "high";     // dónde del corredor se paran los lifts (búlgaro high, cubano low)
    setsBias: -1 | 0 | 1;                 // ± sets sobre la base derivada de volRel
    singlesPhases: PhaseRole[];           // roles donde los clásicos van a singles
  };
  sources: string[];                 // literatura citada (va al dato y al rulebook)
}
```

**Clasificador de rol de fase** (`phaseRole(phase: MacrocyclePhase): PhaseRole`) — del dato,
no de mapeos a mano: `volRel ≤ 40 && imrHi ≤ 88` → descarga · `imrHi ≥ 93` → peaking ·
`imrHi ≥ 86` → intensidad · `imrMid < 72` → base · resto → fuerza. (Los 81 phases del
catálogo caen en un rol; test exhaustivo lo fija con tabla esperada por macro.)

### 3.5 Doble sesión (`types`)

`SessionTemplate` gana `day?: number; turno?: "AM" | "PM"` — opcionales, ausentes =
comportamiento actual. Ningún consumidor cambia en v1 (D14).

## 4. El generador (`logic/recipeGen.ts`)

`generateRecipe(dna: SchoolDNA, macro: Macrocycle): MacroRecipe | null` — puro:

1. **Sesiones/semana** = entero de `frequency` (overrides D15). Por fase del
   `phaseProfile`: rol = `phaseRole(fase)`; arquetipos = `dna.archetypes[rol]` (fallback al
   rol vecino: descarga→base, peaking→intensidad, si la escuela no define el rol); se toman
   las primeras N del ciclo (N = sesiones/semana, ciclando si N > arquetipos).
2. **Relleno por slot**: candidato = pick ponderado del `repertoire[slot]` con índice
   `hash(macroId, phaseKey, archetypeKey, slotIdx) % totalWeight` (djb2 — determinístico).
   Sin repetir base dentro de la sesión; respetando `forbidden` (defensa en profundidad:
   el ADN no debería listarlos, el generador igual filtra).
3. **Dosis por slot** (dentro del corredor `[imrLo, imrHi]` de la fase):
   - olímpico/complejo: pct = lo + (hi−lo)·bias (low .25 / mid .5 / high .8), redondeado;
     complejos capados por `complexPctCeiling`; en `singlesPhases` los clásicos van 1 rep.
   - tirón: 90–110% según rol (base 90–95 · fuerza 95–105 · intensidad+ 100–110).
   - rodilla (sentadillas): corredor de la fase +5 (su RM propio es mayor — patrón del
     Ruso 5D curado); bisagra/empuje: 40–70% según rol; metabólico: 50–65% (siempre %-able en v1 — §3.2).
   - sets×reps: base por `volRel` de la fase (≥85→5 sets · ≥60→4 · resto→3, + `setsBias`,
     min 2) × reps por zona Prilepin del pct (≥90→1 · ≥80→2 · resto→3 para clásicos;
     tirones/sentadillas +1; accesorios 6–10) — capadas SIEMPRE por `repsMax`.
4. **Orden y presupuesto**: la sesión se ordena por `(snc, complexity)` descendente con
   los `metabolico` SIEMPRE al final; si `Σ snc` de la sesión excede `sncBudget[rol]`, se
   recorta el slot más barato (último no-firmado) hasta caber — jamás el primero.
5. **Salida**: `PhaseTemplate[]` con `phaseKey` reales del macro. Macro con receta curada
   en `MACRO_RECIPES` → el generador lo salta (D4).

`data/recipesAll.ts`: `ALL_RECIPES = [...MACRO_RECIPES, ...generados]` (computado en
import; congelado con `Object.freeze`). Consumidores migran de `MACRO_RECIPES` a
`ALL_RECIPES`: `apps/api/src/repo.ts`, `apps/api/prisma/seed.ts`,
`apps/web/src/data/LocalRepository.ts` (×2), `apps/web/.../MacroTemplateMap.tsx`.
(`recipes.test.ts` sigue testeando el curado; tests nuevos cubren el resto.)

## 5. Las 10 escuelas (investigación → ADN; fuentes citadas en el dato)

| Familia | Firma (lo inconfundible) | Prohibiciones | Fuentes ancla |
|---|---|---|---|
| Búlgaro | sólo SN/CJ/FS, singles ≥90 diarios + back-off, cero variedad | tirones, bisagras, accesorios, complejos | sistema Abadjiev (daily max) |
| Ruso | waviness, GPP ancha, tirones 90–110, mucha sentadilla, complejos en base | — | Medvedev (multi-year system), Roman, tabla Prilepin |
| Chino | técnica×fuerza diaria, squat-dominante, segmentos/pausas, sots/balance, **bloque metabólico al cierre** | — | sistema chino moderno (Cao Wenyuan; análisis occidentales: Ma strength/Kim Goss) |
| Cubano | complejos de velocidad, potencia/colgado, saltos, calidad>cantidad, % moderados | — | escuela cubana/LATAM (manuales Federación Cubana) |
| Colombiano | prioridad C&J, volumen de piernas extremo, frontal dominante, empuje fuerte | — | método Urrutia (catálogo lo cita) |
| Coreano | tirones pesados >100%, pausas posicionales, estructura rígida, OHS | — | escuela coreana (fuerza posicional) |
| Polaco | singles y series cortas, pulls desde bloques, % alto temprano | reps >3 en clásicos (toda fase) | escuela polaca (ciclos cortos de choque) |
| Ucraniano | densidad (EMOM como nota), pocos ejercicios por sesión, dobles/triples | — | adaptación casa (catálogo: EMOM-heavy) |
| Híbrido | bloques A/T/R, complejos por eficiencia de tiempo, compuestos grandes | — | Issurin (block periodization) + casa |
| USA | lineal 50:50 fuerza:oly, complejos en desarrollo, powers en master, test Epley | — | USAW/LSUS lineal (catálogo: USA_SCHOOL_COMPLETE) |

Cada ADN lleva `sources` y su párrafo en el rulebook §Escuelas. Afirmaciones que no pude
fundar quedan marcadas "criterio del coach" para curaduría del owner.

## 6. Rulebook (`docs/domain/HOLY-OLY-DOMAIN.md`) — secciones nuevas

- **§Scores de carga**: las 4 dimensiones, qué mide cada una, "informan secuencia/presupuesto,
  jamás kg", técnica ≠ SNC.
- **§Complejos**: techos D7 (reps por eslabón, ≤6/serie, % inverso al largo, eslabón débil).
- **§Escuelas**: tabla §5 (firma/prohibiciones/fuentes por familia) + "≤3 técnicos/sesión" +
  secuencia neural descendente + determinismo del generador.

## 7. Tests (TDD; suite existente intacta)

1. `computeLoads`: ajustes por modificador, clamp 1..10, dimensiones independientes.
2. Complejos: integridad del catálogo (eslabones existen, reps ≤ repsMax.enComplejo, total
   ≤6, 2..4 eslabones); `complexWeakRmRef` con RMs reales (jerk limita C+F+2T);
   `resolveTargetKg` para `cx.*` (kg = pct × min RM); nombre con notación; warmup del
   primer eslabón; pctCeiling por largo.
3. ADN: ids del repertorio existen (variantes o `cx.*`), `forbidden` ∩ repertorio = ∅,
   presupuestos > 0, fuentes no vacías, arquetipos no vacíos para los roles que sus macros
   usan, `phaseRole` exhaustivo sobre los 81 phases del catálogo (tabla esperada).
4. Generador: **24/24 macros con receta** (curada o generada); phaseKeys = los del macro;
   determinismo (dos corridas deep-equal + snapshot estable); corredor (olímpicos dentro de
   `imrPct±0`, sentadillas ≤ hi+5, tirones 90–110); ≤3 técnicos; secuencia
   `(snc, complexity)` no-creciente con metabólicos al final; presupuesto SNC respetado;
   repsMax/≤6/pctCeiling jamás violados; cero `rmRef:"none"` en filas generadas.
5. Huellas: búlgaro sin {tirones, bisagras, accesorios, complejos} y con singles ≥90 en
   toda fase no-descarga; chino con `metabolico` en ≥80% de sesiones; cubano con `cx.*` en
   fases base/fuerza; polaco reps ≤3 en clásicos siempre; colombiano ≥1 slot rodilla por
   sesión en base.
6. Distintividad pareada: para cada par de familias con rol comparable, el solape de
   (baseId, zona de pct) entre sus sesiones ≤70% (≥30% distinto).
7. Regresión Ruso: receta generada del ADN ruso vs curada — solape de baseIds por fase
   ≥60% y pcts de clásicos dentro del corredor de la misma fase.
8. Prilepin-audit: para clásicos generados, reps totales por zona dentro de [min, max] de
   la tabla (tolerancia: sesiones de descarga exentas).
9. Snapshot: `ALL_RECIPES` → `toMatchFileSnapshot` (artefacto auditable commiteado, D2).
10. Web/api: suites existentes verdes; `MacroTemplateMap` muestra detalle para un macro
    antes-vacío (test de humo con `ALL_RECIPES`).

## 8. Revisiones

`el-carnicero` (tercer lente 🏛️) sobre: ADN de las 10 escuelas + rulebook + generador +
complejos. `code-reviewer`/`typescript-reviewer` sobre el código. CRITICAL/HIGH se arreglan
antes del commit final.

## 9. Encaje futuro (contexto, no alcance)

- **readiness→modulación**: modula los kg/sets de la receta materializada por día (el shape
  `PrescribedExercise` ya lo permite vía ediciones del coach; el motor decide → propone).
- **Peaking**: concilia `phasePlan` del motor con `volumeCurve` y la `Competencia`; la
  ondulación intra-fase llega ahí — el generador NO la duplica hoy.
- **UI AM/PM**: cuando se habilite la receta búlgara bi-diaria (D14), `planHeat` mapea por
  `day` y las superficies de sesión etiquetan turno.
- **i18n**: nombres de movimientos/complejos nuevos entran al pipeline pendiente igual que
  los existentes (claves desde core).
