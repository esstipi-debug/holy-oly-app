# Periodización adaptativa por competencia — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans / test-driven-development. Steps use `- [ ]`.

**Goal:** Al asignar un macro con fecha de competencia, calcular la periodización real (fiel a la escuela, adaptativa a N semanas, multi-pico) para picar en la fecha.

**Architecture:** Motor core puro (`rescaleSchoolPhases` + `buildAdaptivePlan`) que reescala el `phaseProfile` propio de cada escuela a las semanas disponibles; la prescripción se instancia contra ese plan. Spec: `docs/superpowers/specs/2026-06-19-periodizacion-adaptativa-competencia-design.md`.

**Scope v1 (seguro):** periodización adaptativa **al asignar** (no hay actuals/ediciones que preservar → sin el CRITICAL de re-instanciación). **v2 (diferido, documentado):** re-periodizar cuando se cambia la compe DESPUÉS de empezar (invariante futura-only D8). En v1, cambiar la compe post-asignación no re-periodiza.

**Tech:** TS monorepo (pnpm), vitest. core puro; API Fastify+Prisma; web React.

---

## Task 1: `rescaleSchoolPhases` (núcleo de compresión)

**Files:**
- Create: `packages/core/src/logic/adaptivePlan.ts`
- Test: `packages/core/src/logic/adaptivePlan.test.ts`

Firma:
```ts
export interface PlanWeek { week: number; phaseKey: string }
/** Reescala una lista ORDENADA de fases (base→pico) a `weeks` semanas.
 *  Proporcional al peso natural de cada fase; el pico (última) conserva ≥ su proporción
 *  (piso relativo); la base cede primero; si weeks < piso del pico → todo pico. Determinístico. */
export function rescaleSchoolPhases(phases: readonly MacrocyclePhase[], weeks: number): PlanWeek[]
```

- [ ] Test RED: `rescaleSchoolPhases([cim 4, trans 4, real 4], 12)` → 4/4/4 (sin cambios). `…,7)` → cim 2 · trans 2 · real 3 (pico protegido). `…,4)` → 1/1/2. `…,3)` → realización 3 (base desaparece). `…,1)` → realización 1. `weeks<=0` → []. Una sola fase → todas las semanas esa fase.
- [ ] Verificar falla.
- [ ] Implementar (proporción = (p.weeks[1]-p.weeks[0]+1)/macroLen; reparto con redondeo que protege la última fase; base cede primero).
- [ ] Verde. Commit.

## Task 2: `buildAdaptivePlan` (segmentación multi-pico + escuela plana)

**Files:** mismos que Task 1.

```ts
/** Plan de fases por semana para toda la línea de tiempo del atleta, fiel a la escuela.
 *  `compWeeks` = semanas (1-based, relativas al start) de las competencias PICO, ordenadas.
 *  Sin comps → phaseProfile natural por semana. peaks:false → fase plana en TODAS las semanas. */
export function buildAdaptivePlan(macro: Macrocycle, compWeeks: readonly number[]): PlanWeek[]
```

- [ ] Test RED:
  - Sin comps → igual a `phaseForWeek` por semana (natural).
  - `peaks:false` (Búlgaro, 1 fase) con comp en sem 6 → 6 semanas, TODAS la fase plana (sin re-pico).
  - peaks, 1 comp (sem 7) → bloque 1 = `rescaleSchoolPhases(phaseProfile, 7)`.
  - peaks, 2 comps (sem 7, 11) → bloque 1 [1..7] full; bloque 2 [8..11] = `rescaleSchoolPhases(phaseProfile.slice(1), 4)` (re-pico salta la base, sólo fases reales).
- [ ] Verificar falla. Implementar. Verde. Commit.

## Task 3: `effectiveTotalWeeks` + `availableWeeksToComp` (anclaje adaptativo)

**Files:**
- Modify: `packages/core/src/logic/schedule.ts` (junto a `anchorPlanToComp`)
- Test: `packages/core/src/logic/schedule.test.ts`

```ts
/** Semanas reales disponibles desde startDate (incl.) hasta la fecha de compe (1-based). */
export function availableWeeksToComp(startDate: string, compDate: string): number
/** Largo efectivo del plan: la semana de la última compe si hay; si no, el largo natural del macro. */
export function effectiveTotalWeeks(macro: Macrocycle, compWeeks: readonly number[]): number
```

- [ ] Test RED: comp 7 semanas después de start → 7; mismo lunes → 1; `effectiveTotalWeeks(coreano12, [7])` → 7; `(coreano12, [])` → 12; `(coreano12, [16])` → 16 (estiramiento). 
- [ ] Falla. Implementar. Verde. Commit.

## Task 4: instanciar la prescripción contra el plan adaptativo

**Files:**
- Modify: `packages/core/src/logic/prescription.ts` (`instantiatePrescription`)
- Test: `packages/core/src/logic/prescription.test.ts`

Cambio: `instantiatePrescription` acepta un plan de fases opcional; si se pasa, usa `planWeek.phaseKey` por semana en vez de `phaseForWeek` fijo.
```ts
export function instantiatePrescription(
  recipes: readonly MacroRecipe[], macro: Macrocycle, totalWeeks: number,
  plan?: readonly PlanWeek[], // ← nuevo; ausente = comportamiento actual (natural)
): PrescriptionRow[]
```

- [ ] Test RED: con un `plan` que pone realización en sem 1, la sem 1 trae las sesiones de la receta de realización (no las de cimentación). Sin `plan` → idéntico a hoy (test existente sigue verde).
- [ ] Falla. Implementar (usar `recipe.phases.find(p=>p.phaseKey === planWeek.phaseKey)`). Verde. Commit.

## Task 5: API — instanciación adaptativa AL ASIGNAR (seguro)

**Files:**
- Modify: `apps/api/src/repo.ts` (`savePlan`, `instantiateForPlan`)
- Modify: `apps/api/src/server.ts` (ruta PUT plan ya pasa el plan; comps llegan en el body o vía un orden atómico)
- Test: `apps/api/src/writes.int.test.ts`

Cambio: `instantiateForPlan` calcula `compWeeks` desde las comps del plan (el body del plan trae `comps`), arma `buildAdaptivePlan`, usa `effectiveTotalWeeks`, e instancia adaptativo. **Sólo en asignación** (no hay actuals aún). `setComps` NO re-instancia (v1).

- [ ] Test RED (int, Postgres embebido): asignar coreano con comp a 7 semanas → la prescripción tiene 7 semanas y la sem 7 es realización (pico). Asignar sin comp → 12 semanas natural (comportamiento actual intacto).
- [ ] Falla. Implementar. Verde. Commit.

## Task 6: Web — AssignSheet usa anclaje adaptativo + preview nuevo

**Files:**
- Modify: `apps/web/src/screens/coach/macros/AssignSheet.tsx`
- Test: `apps/web/src/screens/coach/macros/AssignSheet.test.tsx`

Cambio: modo competencia → `startDate = lunes de hoy`; `availableWeeks = availableWeeksToComp(hoy, compDate)`; el plan se arma adaptativo. Preview: "N semanas hasta la compe · [escuela] se ajusta · pico en la fecha" (reemplaza completo/recortado). El plan guardado lleva `comps:[{name,date,week:availableWeeks}]`.

- [ ] Test RED: elegir comp a 7 semanas → preview muestra "7 semanas"; submit guarda plan con startDate=hoy y comp week=7.
- [ ] Falla. Implementar. Verde. Commit.

## Task 7: Web — MacroTimeline + copy (una sola verdad)

**Files:**
- Modify: `apps/web/src/ui/charts/MacroTimeline.tsx` (deriva volumen del plan adaptativo, no de `volumeCurve` caps)
- Modify: `apps/web/src/screens/coach/CompSheet.tsx` (copy alineado)
- Modify: `docs/domain/HOLY-OLY-DOMAIN.md` (§2 taper = fuente única: el plan)

- [ ] MacroTimeline: barras de volumen = `volRel` de la fase del plan por semana. Test de que coincide con el plan instanciado.
- [ ] Copy CompSheet sin prometer reestructuración que no aplica en v1 para cambios post-hoc.
- [ ] Commit.

## Task 8: Suite completa + typecheck + gate El Carnicero + deploy

- [ ] `pnpm -r test` + `pnpm -r typecheck` verdes.
- [ ] El Carnicero (agente) revisa el DIFF; resolver CRITICAL/HIGH.
- [ ] PR a main, merge (autoDeploy), verificar `/health` + bundle.

## Diferido a v2 (documentado, NO en v1)
- Re-periodizar al cambiar la compe DESPUÉS de empezar (invariante futura-only D8: sólo semanas futuras, preservar actuals/registros/ediciones).
- Tope del caso "sobra tiempo" afinado por el coach.
