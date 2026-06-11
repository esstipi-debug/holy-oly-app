# Entrenamientos distintivos por escuela — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ADN declarativo por escuela + generador determinístico que produce las 23 recetas faltantes (`MacroRecipe`) con scores de carga, complejos y techos verificables — cero random, cero standard.

**Architecture:** Todo en `packages/core` (datos puros + lógica pura, patrón SP1/SP2). `ALL_RECIPES = curadas + generadas` en import; consumidores (api/web/seed) migran de `MACRO_RECIPES` a `ALL_RECIPES`. La UI existente se enciende sola; complejos se resuelven en `prescription.ts` (nombre/kg/warmup) sin tocar componentes web.

**Tech Stack:** TypeScript puro, vitest (`pnpm --filter @holy-oly/core test`), sin deps nuevas.

**Spec:** `docs/superpowers/specs/2026-06-11-entrenamientos-distintivos-design.md` (D1–D15).

---

## File Structure

```
packages/core/src/
  types/index.ts                 [M] MovementLoads, RepsMax, ComplexLink/Def, SchoolDNA, PhaseRole,
                                     SlotKind, SessionArchetype; MovementBase.baseLoads/repsMax;
                                     Movement.loads; SessionTemplate.day?/turno?
  data/movements.ts              [M] baseLoads+repsMax en 14 bases + 7 bases nuevas
  logic/movements.ts             [M] computeLoads + loads en buildMovements
  data/complexes.ts              [C] COMPLEXES (10 cx.*)
  logic/complexes.ts             [C] getComplex/totalReps/pctCeiling/weakRmRef/loads/complexity
  logic/prescription.ts          [M] resolveTargetKg + buildSessionViews complex-aware
  logic/warmup.ts                [M] warmupForExercise complex-aware (primer eslabón)
  data/schools.ts                [C] SCHOOL_DNA (10 familias, fuentes citadas)
  logic/recipeGen.ts             [C] phaseRole, hash djb2, dosis, generateRecipe
  data/recipesAll.ts             [C] ALL_RECIPES (curadas ganan, D4)
  data/*.test.ts / logic/*.test.ts  [C] tests por unidad (abajo)
apps/api/src/repo.ts             [M] MACRO_RECIPES → ALL_RECIPES
apps/api/prisma/seed.ts          [M] idem
apps/web/src/data/LocalRepository.ts [M] idem (×2)
apps/web/src/screens/coach/macros/MacroTemplateMap.tsx [M] idem
docs/domain/HOLY-OLY-DOMAIN.md   [M] §Scores · §Complejos · §Escuelas
```

Constantes de dosis (en `recipeGen.ts`, nombradas):
- `PCT_BIAS = { low: .25, mid: .5, high: .8 }` sobre el corredor `[imrLo, imrHi]`; clásicos/complejos cap **95** (precedente D4 del motor; la curada Ruso conserva sus 96/97 — curaduría manda).
- `PULL_PCT = { base: 92, fuerza: 100, intensidad: 105, peaking: 105, descarga: 90 }` (90–110).
- Sentadillas: `min(imrHi + 5, 100)` con bias; bisagra `{55,62,68,60,45}`; empuje `{55,62,68,70,45}`; metabólico `{60,60,55,55,50}`.
- Sets desde volRel: `volRel ≥85→5 · ≥60→4 · else 3`, `+setsBias`, clamp [2,6].
- Reps clásicos por pct: `≥88→1 · ≥80→2 · else 3`; tirones/sentadillas +1; bisagra/empuje 4–8 por rol; metabólico 8–10; TODO capado por `repsMax`; `singlesPhases` fuerza 1.
- `phaseRole`: descarga si `volRel≤40 && imrHi≤88` · peaking si `imrHi≥95` · intensidad si `imrHi≥87` · base si `(imrLo+imrHi)/2 < 74` · else fuerza.

---

### Task 1: Scores de carga (`computeLoads`)

**Files:** Modify `types/index.ts`, `data/movements.ts`, `logic/movements.ts` · Test `logic/movements.test.ts` (extender)

- [ ] **1.1 Test failing** — `computeLoads`: potencia −1 snc; bloques/colgado −1 snc −1 axial; fuerza −1 snc; pausa/tempo +1 met; deficit +1 axial; sin-recibida −1 snc; clamp 1..10; dimensiones independientes. Variantes generadas llevan `loads` (e.g. `arranque.potencia.colgado.rodilla` snc = 9−1−1 = 7).
- [ ] **1.2 Run** `pnpm --filter @holy-oly/core test -- movements` → FAIL.
- [ ] **1.3 Implementar**: tipos `MovementLoads`/`RepsMax`; `baseLoads`+`repsMax` en las 14 bases (tabla §Task 2); `computeLoads` espejo de `computeComplexity`; `buildMovements` deriva `loads`.
- [ ] **1.4 Run** → PASS. **1.5 Commit** `feat(core): scores de carga snc/axial/metabolica por movimiento (computeLoads)`

Tabla `baseLoads {snc, axial, metabolica}` + `repsMax {enComplejo, aislado}`:
| base | snc | ax | met | rMax |
|---|---|---|---|---|
| arranque | 9 | 6 | 4 | 3/3 |
| cargada | 8 | 7 | 5 | 3/3 |
| envion | 8 | 6 | 3 | 2/3 |
| cargada-envion | 10 | 8 | 6 | 2/2 |
| tiron-arranque | 6 | 7 | 5 | 3/5 |
| tiron-cargada | 6 | 8 | 5 | 3/5 |
| sentadilla | 7 | 9 | 7 | 3/10 |
| sentadilla-frente | 7 | 8 | 6 | 3/8 |
| sentadilla-overhead | 6 | 6 | 4 | 3/6 |
| press-empuje | 5 | 5 | 4 | 3/5 |
| press-hombros | 3 | 4 | 5 | 3/8 |
| peso-muerto-rumano | 4 | 7 | 7 | 3/10 |
| buenos-dias | 3 | 6 | 5 | 3/10 |
| remo | 2 | 4 | 6 | 3/12 |

### Task 2: Bases nuevas

**Files:** Modify `data/movements.ts` · Test `data/movements.catalog.test.ts` (nuevo)

- [ ] **2.1 Test failing**: existen `snatch-balance` (rmRef arranque), `jerk-dip` (envion), `sots-press` (arranque), `remo-menton` (envion), `press-banca`/`hiperextension`/`salto-cajon` (none); sustitutos válidos; loads presentes.
- [ ] **2.2 FAIL → 2.3 Implementar** (complexity/loads/repsMax): snatch-balance c7 {6,5,3} 3/5 sust [sentadilla-overhead] · jerk-dip c2 {4,6,3} 3/5 sust [press-empuje] · sots-press c6 {3,3,4} 3/6 sust [press-hombros] · remo-menton c2 {2,3,6} 3/12 sust [remo] · press-banca c1 {2,2,6} 3/12 · hiperextension c1 {1,4,6} 3/15 · salto-cajon c2 {4,2,3} 3/10. Sin axes (variante única).
- [ ] **2.4 PASS → 2.5 Commit** `feat(core): 7 bases nuevas (snatch balance, jerk dip, sots, accesorios)`

### Task 3: Complejos

**Files:** Create `data/complexes.ts`, `logic/complexes.ts` · Test `logic/complexes.test.ts`

- [ ] **3.1 Test failing**: catálogo íntegro (eslabones existen; 2..4; reps ≤ repsMax.enComplejo; total ≤6); `complexPctCeiling` 2→90/3→85/4→80; `complexWeakRmRef` con RM {a:100,e:120,s:150,f:130}: `cx.cargada+frontal+2t` → "envion"; `complexLoads` = max/max/Σcap10; `complexComplexity` = max+1 cap 12; nombre incluye notación `(1+1+1)`.
- [ ] **3.2 FAIL → 3.3 Implementar** los 10: `cx.tiron-arranque+arranque` (2+1) · `cx.arranque+ohs` (1+2) · `cx.arranque-potencia+arranque` (1+1) · `cx.arranque-colgado+arranque` (1+1, colgado.rodilla) · `cx.tiron-arranque+arranque+ohs` (1+1+1) · `cx.cargada+frontal+2t` (1+1+1) · `cx.cargada+2t-doble` (1+2) · `cx.tiron-cargada+cargada` (2+1) · `cx.cargada-potencia+frontal` (1+2) · `cx.press-empuje+2t` (1+1).
- [ ] **3.4 PASS → 3.5 Commit** `feat(core): complejos como composicion (catalogo cx.* + techos D7)`

### Task 4: Prescription/warmup complex-aware

**Files:** Modify `logic/prescription.ts`, `logic/warmup.ts` · Test `logic/prescription.test.ts` (extender)

- [ ] **4.1 Test failing**: `resolveTargetKg({movementId:"cx.cargada+frontal+2t", pct:80}, rms)` = `0.8×min(rms.envion, rms.frente, rms.envion)`; `buildSessionViews` da `movementName` del complejo y `warmup` con rampa del 1er eslabón; `kgOverride` sigue ganando; ids `cx.` desconocidos → kg undefined + name = id (sin throw).
- [ ] **4.2 FAIL → 4.3 Implementar**: helper `resolveProgrammable(id)` → `{kind:"movement"|"complex"}`; en `resolveTargetKg` rama cx → `min(rms[rmRef(link)])`; en `warmupForExercise` rama cx → delegar al primer eslabón con el MISMO pct efectivo sobre el RM débil (rampa hacia el kg de trabajo del complejo).
- [ ] **4.4 PASS → 4.5 Commit** `feat(core): prescripcion complex-aware (kg vs eslabon debil, warmup 1er eslabon)`

### Task 5: SessionTemplate.day/turno + phaseRole + hash

**Files:** Modify `types/index.ts` · Create `logic/recipeGen.ts` · Test `logic/recipeGen.test.ts`

- [ ] **5.1 Test failing**: `phaseRole` sobre fases clave (bulgaro dailymax→peaking · ruso hipertrofia→base, fuerza-basica→fuerza, fuerza-potencia→intensidad, peaking→peaking · chino descarga→descarga · polaco singles→peaking · usa-master realizacion→intensidad · hibrido transmutacion→fuerza · coreano cimentacion→base [mid 73<74]); `hashIdx("a","b",0,1)` estable y ≠ con otro input; `day?/turno?` compilan en SessionTemplate.
- [ ] **5.2 FAIL → 5.3 Implementar** (djb2 → uint32). **5.4 PASS → 5.5 Commit** `feat(core): phaseRole + hash deterministico + shape doble-sesion`

### Task 6: SchoolDNA — tipos + las 10 familias

**Files:** Modify `types/index.ts` · Create `data/schools.ts` · Test `data/schools.test.ts`

- [ ] **6.1 Test failing** (integridad): 10 familias = `MACROCYCLE_FAMILIES`; todo id de repertorio resuelve (`getMovement` o `getComplex`); `forbidden` ∩ repertorio = ∅ (por baseId, incluyendo eslabones de cx); `sources.length ≥ 1`; arquetipos cubren los roles que sus macros producen vía `phaseRole` (con fallback descarga→base, peaking→intensidad declarado en generador); presupuestos > 0; `tecnicosMax ≤ 3`.
- [ ] **6.2 FAIL → 6.3 Implementar** ADNs (contenido investigado, resumen — el TS lleva comentario con fuente):

| Familia | Arquetipos (ciclo; F=focos) | Repertorio firmado (pesos altos) | forbidden | bias/singles | Fuentes |
|---|---|---|---|---|---|
| Búlgaro | peaking: A[oli(arranque)+rodilla(frente)] B[oli(c&j)+rodilla(sentadilla)] | sólo SN/CJ/FS/BS | tiron-*, bisagras, press*, remo*, cx, accesorios | high; singles TODAS | Sistema Abadjiev (daily max búlgaro 1970-88) |
| Ruso | base/fuerza: A[oli+tiron+rodilla] B[oli+rodilla+bisagra] C[cx+tiron+empuje] D[oli+rodilla+rodilla] E[oli+oli+bisagra]; intensidad sin cx; peaking: pares [oli+rodilla]/[oli] | arranque w3, c&j w2, cargada w2, potencias w1, envion.tijera w1, tirones w3, sent/frente w3, rdl/bd, press-empuje, ohs, cx.tiron+arranque, cx.c+f+2t | — | mid; singles peaking | Medvedev (multi-year), Roman, Prilepin |
| Chino | TODAS las fases cierran metabolico: A[oli+rodilla+met] B[oli+tiron+met] C[cx+rodilla+met] D[oli+empuje+met] E[tiron+rodilla+met] | potencias w2, balance/sots w2, frente w3, tirones bloques/colgado w2, remo-menton w2, remo w2, cx.arranque+ohs, cx.cargada-potencia+frontal | — | mid; singles peaking | Sistema chino moderno (Cao Wenyuan; análisis Ma-strength/Kim Goss) |
| Cubano | base/fuerza abren con cx velocidad: A[cx+rodilla] B[oli(potencia)+tiron+empuje] C[oli+rodilla+bisagra]; peaking [oli+rodilla] | potencias w3, colgado w2, cx.potencia+arranque w2, cx.tiron-cargada+cargada, frente w2 | — | low (calidad>cantidad); singles peaking | Escuela cubana (manuales Federación; tradición LATAM de complejos) |
| Colombiano | TODO archetype lleva rodilla; A[oli(c&j)+rodilla+rodilla] B[oli(arranque)+tiron+rodilla] C[oli(2t/empuje)+rodilla+bisagra] | c&j w4, envion w2, cargada w2, frente w4, sentadilla w3, jerk-dip w2, press-empuje w2 | — | mid; singles peaking | Método Urrutia (prioridad C&J + volumen de piernas) |
| Coreano | A[oli+tiron+rodilla(ohs)] B[oli+tiron+empuje] C[oli+rodilla+tiron]; tirones SIEMPRE presentes | tirones (piso+bloques) w4, ohs w2, arranque w3, cargada w2, press-empuje w2 | — | mid; singles peaking | Escuela coreana (fuerza posicional, tirones supra-máximos) |
| Polaco | A[oli+tiron(bloques)+rodilla] B[oli+oli+tiron(bloques)]; series cortas | arranque w3, cargada w3, envion w2, tirones .bloques w4, frente w2 | — | high; singles fuerza+intensidad+peaking | Escuela polaca (ciclos cortos, singles, bloques) |
| Ucraniano | densidad, 2-3 slots: A[oli+oli+rodilla] B[oli+tiron] C[oli+rodilla]; notes "EMOM" en olímpicos | arranque w3, cargada w3, c&j w2, potencias w2, frente w2 | bisagras (densidad pura) | mid; singles peaking | Adaptación casa (catálogo: EMOM-heavy, alta densidad) |
| Híbrido | A[cx+rodilla] B[oli+tiron+rodilla] C[oli+empuje+bisagra]; compuestos grandes | c&j w2, arranque w2, potencias w2, cx.c+f+2t w2, cx.press-empuje+2t, sentadilla w3 | — | mid; singles peaking | Issurin (block periodization) + diseño casa A/T/R |
| USA | base 50:50: A[oli(potencia)+rodilla+empuje] B[oli+tiron+bisagra] C[oli+rodilla+bisagra]; fuerza agrega cx: D[cx+rodilla+empuje] | potencias w3, completos w2, sentadilla w3, press-empuje w2, rdl w2, cx.tiron+arranque, jerk-dip | — | mid; singles peaking | USAW lineal / LSUS (50:50 fuerza:oly; complexes en desarrollo) |

  `sncBudget` por rol (sesión): genéricas {base 26, fuerza 26, intensidad 24, peaking 22, descarga 18}; búlgaro 30 flat; chino 28 (paga su metabólico); ucraniano 24 (pocas piezas). `sessionsPerDay: 1` (D14).
- [ ] **6.4 PASS → 6.5 Commit** `feat(core): ADN de las 10 escuelas con fuentes (schools.ts)`

### Task 7: Generador

**Files:** Modify `logic/recipeGen.ts` · Test `logic/recipeGen.test.ts` (extender)

- [ ] **7.1 Tests failing** (unidad, con DNA sintética + reales):
  - determinismo: dos llamadas deep-equal;
  - corredor: clásicos `pct ∈ [imrLo, min(imrHi,95)]`; sentadillas `≤ min(imrHi+5,100)`; tirones ∈ [90,110];
  - repsMax/total≤6/pctCeiling de cx respetados; técnicos ≤ 3; cero `rmRef:"none"`;
  - orden: `(snc, complexity)` no-creciente con metabólicos al final;
  - presupuesto: Σsnc ≤ budget (DNA sintética con slot optionalFrom que fuerza un recorte);
  - sin base repetida en sesión (probe lineal);
  - `frequency` "2d/sem"→2 arquetipos; overrides usa-school→5, hibrido-block→4;
  - fases: `phaseKey`s = las del macro; macro curado → null (lo salta).
- [ ] **7.2 FAIL → 7.3 Implementar** `generateRecipe` (pipeline §4 del spec: rol→arquetipos→relleno hash→dosis→orden→presupuesto→PhaseTemplate[]).
- [ ] **7.4 PASS → 7.5 Commit** `feat(core): generador deterministico ADN+fase → MacroRecipe`

### Task 8: ALL_RECIPES + huellas + distintividad + regresión + Prilepin-audit + snapshot

**Files:** Create `data/recipesAll.ts`, `data/recipesAll.test.ts`

- [ ] **8.1 Tests failing**:
  - 24/24 macros con receta; curada de ruso-5d intacta (la generada NO la reemplaza);
  - huellas: búlgaro sin {tiron, bisagra, press, remo, cx} y singles ≥90 fuera de descarga; chino `metabolico` ≥80% de sesiones; cubano cx en base/fuerza; polaco clásicos ≤2 reps en fuerza+; colombiano rodilla en 100% sesiones base; ucraniano notes EMOM presentes;
  - distintividad: Jaccard de tuplas `(baseId, zona)` entre pares de familias con mismo rol ≤ 0.7;
  - regresión Ruso: generada-del-ADN vs curada — solape baseIds por fase ≥60%, pcts clásicos dentro del corredor de fase;
  - Prilepin-audit: reps totales de clásicos por zona ∈ [min,max] de la tabla (descarga exenta);
  - snapshot `toMatchFileSnapshot("__snapshots__/recipes-gen.snap")`.
- [ ] **8.2 FAIL → 8.3 Implementar** `ALL_RECIPES` + ajustar pesos/presupuestos del ADN hasta que TODAS las propiedades pasen (iterar acá, NO relajar tests salvo error del test).
- [ ] **8.4 PASS → 8.5 Commit** `feat(core): ALL_RECIPES — 23 recetas generadas + huellas/distintividad/regresion/snapshot`

### Task 9: Integración api/web/seed

**Files:** Modify `apps/api/src/repo.ts`, `apps/api/prisma/seed.ts`, `apps/web/src/data/LocalRepository.ts`, `apps/web/src/screens/coach/macros/MacroTemplateMap.tsx`

- [ ] **9.1** Cambiar import/uso `MACRO_RECIPES` → `ALL_RECIPES` (5 sitios). Test humo web: `MacroTemplateMap` con `coreano-5d` (antes vacío) renderiza el mapa (extender test existente del archivo o crear `macroTemplateMap.test.tsx` siguiendo el patrón de tests web).
- [ ] **9.2** Suites completas: `pnpm -r test` → verdes; `pnpm typecheck`; `pnpm lint`.
- [ ] **9.3 Commit** `feat(app): catalogo completo con recetas en todas las superficies (ALL_RECIPES)`

### Task 10: Rulebook + reviews + cierre

**Files:** Modify `docs/domain/HOLY-OLY-DOMAIN.md`

- [ ] **10.1** §Scores de carga (4 dimensiones; jamás kg) · §Complejos (techos D7) · §Escuelas (tabla firma/prohibiciones/fuentes + ≤3 técnicos + secuencia neural + determinismo).
- [ ] **10.2** Review `el-carnicero` (tercer lente) sobre ADN+rulebook+generador; `code-reviewer` sobre el diff. CRITICAL/HIGH → arreglar y re-correr suites.
- [ ] **10.3** Commit final `docs(domain): §Escuelas/§Scores/§Complejos` + memoria de sesión.

## Self-Review (hecho)
- Cobertura spec: §3.1→T1 · §3.2→T2 · §3.3→T3/T4 · §3.4→T6 · §3.5/§4→T5/T7 · D2/§7→T8 · consumidores→T9 · §6/§8→T10. Sin huecos.
- Sin placeholders; firmas consistentes (`generateRecipe(dna, macro)`, `ALL_RECIPES`, `complexWeakRmRef(c, rms)`).
- Riesgo conocido: T8 es iterativo (afinar pesos/presupuestos contra las propiedades) — es la naturaleza del trabajo, no un hueco del plan.
