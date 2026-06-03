# SP2 — Prescripción + autoría del coach · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give sessions real content. A macro carries a per-phase weekly recipe (Ruso 5D); assigning it instantiates the athlete's editable prescription (`kg = %×RM`); the coach views and edits any session anytime (movement picker + scheme/%/kg + substitution via SP1). Athlete stays read-only on the prescription (their execution + actuals = SP3).

**Architecture:** Three layers. **core** — recipe types + `MACRO_RECIPES` (Ruso 5D, in-code like SP1) + pure derivation/instantiation (`resolveTargetKg`, `sessionTemplateFor`, `instantiatePrescription`, `buildSessionViews`) + Zod wire schemas. **api** — Prisma `PrescribedExercise` + migration `5_prescription`; instantiation inside the existing `PUT /athletes/:id/plan` handler; coach-authorized `GET/PUT /athletes/:id/prescription`. **web** — extend the `Repository` contract (`getPrescriptionWeek`, `setSession`) in both `HttpRepository` (hits the API) and `LocalRepository` (local store + instantiate on `savePlan`); the drill-down gets a "Sesiones" section + a `SessionEditor`/`MovementPicker` using SP1.

**Tech Stack:** TypeScript (strict), Zod, Fastify 5, Prisma 6 + Postgres (embedded for tests), React 18 + Vitest/RTL. Builds on SP1 (`@holy-oly/core` movements).

**Spec:** [`docs/superpowers/specs/2026-06-03-sp2-prescription-design.md`](../specs/2026-06-03-sp2-prescription-design.md)

---

## File Structure

### `packages/core`
- **Modify** `src/types/index.ts` — `PrescribedExercise`, `SessionTemplate`, `PhaseTemplate`, `MacroRecipe`, `PrescriptionRow`, `PrescribedExerciseView`, `SessionView`.
- **Create** `src/data/recipes.ts` — `MACRO_RECIPES` (Ruso 5D).
- **Create** `src/logic/prescription.ts` — `resolveTargetKg`, `sessionTemplateFor`, `instantiatePrescription`, `buildSessionViews`.
- **Create** `src/logic/prescription.test.ts`, `src/data/recipes.test.ts`.
- **Modify** `src/schemas.ts` — `PrescribedExerciseSchema`, `PrescribedExercisesSchema`, `SessionViewSchema`, `SessionViewsSchema`.
- **Modify** `src/index.ts` — export `./data/recipes`, `./logic/prescription`.

### `apps/api`
- **Modify** `prisma/schema.prisma` — `model PrescribedExercise` + `Athlete.prescription`.
- **Create** `prisma/migrations/5_prescription/migration.sql`.
- **Modify** `src/repo.ts` — `getPrescriptionWeek`, `setSession`, `instantiateForPlan` (+ call it from `savePlan`).
- **Modify** `src/server.ts` — `GET/PUT /athletes/:id/prescription` routes.
- **Create** `src/prescription.int.test.ts`.

### `apps/web`
- **Modify** `packages/core/src/repository.ts` — add `getPrescriptionWeek`, `setSession` to the `Repository` interface.
- **Modify** `src/data/HttpRepository.ts`, `src/data/LocalRepository.ts`, `src/data/keys.ts` — implement the two methods; `LocalRepository.savePlan` instantiates.
- **Create** `src/screens/coach/sessions/SessionsSection.tsx`, `SessionEditor.tsx`, `MovementPicker.tsx`.
- **Modify** `src/screens/coach/Drilldown.tsx` — render `SessionsSection`.
- **Create** tests under `src/screens/coach/__tests__/` + `src/data/`.

Commands: `pnpm --filter @holy-oly/{core,web} test [filter]`, `… exec tsc --noEmit`, `pnpm --filter @holy-oly/api {test,verify}`, `… exec prisma generate`.

---

## Phase A — Core (types + recipe + logic + schemas)

### Task A1: Types

**Files:** Modify `packages/core/src/types/index.ts` (append at end)

- [ ] **Step 1: Append the types**

```typescript
// ── Prescription (SP2). The macro carries a recipe; assigning instantiates the athlete's
//    editable prescription; kg = %×RM (or an explicit override). Reuses SP1 movements. ──
export interface PrescribedExercise {
  movementId: string;        // SP1 movement id (e.g. "arranque", "tiron-arranque", "envion.tijera")
  sets: number;
  reps: number;
  pct?: number;              // %1RM (present when the movement derives from a RM)
  kgOverride?: number;       // explicit kg (accessories, or the coach pins the weight) — beats pct
  rpe?: number;              // by feel (accessories)
  flags?: MovementFlag[];
  notes?: string;
}
export interface SessionTemplate { label?: string; exercises: PrescribedExercise[] }
export interface PhaseTemplate { phaseKey: string; sessions: SessionTemplate[] } // sessions[idx], idx 0-based
export interface MacroRecipe { macroId: string; phases: PhaseTemplate[] }

/** A concrete prescription row of an athlete (a PrescribedExercise + its location). */
export interface PrescriptionRow extends PrescribedExercise { week: number; sessionIdx: number; order: number }
/** A prescribed exercise with its display name + derived target kg, for the front. */
export interface PrescribedExerciseView extends PrescribedExercise { movementName: string; targetKg?: number }
/** One instantiated session (a column in the week), kg already derived. */
export interface SessionView { week: number; sessionIdx: number; label?: string; exercises: PrescribedExerciseView[] }
```

- [ ] **Step 2: Type-check**

Run: `pnpm --filter @holy-oly/core exec tsc --noEmit`
Expected: PASS (types only).

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/types/index.ts
git commit -m "feat(core): tipos de prescripción (PrescribedExercise/SessionTemplate/MacroRecipe/SessionView)"
```

---

### Task A2: Derivation + instantiation logic

**Files:** Create `packages/core/src/logic/prescription.ts`, `packages/core/src/logic/prescription.test.ts`; Modify `packages/core/src/index.ts`

- [ ] **Step 1: Write the failing test** (`packages/core/src/logic/prescription.test.ts`)

```typescript
import { describe, it, expect } from "vitest";
import type { MacroRecipe, PrescribedExercise, RM } from "../types";
import { MACROCYCLES } from "../data/macrocycles";
import { resolveTargetKg, sessionTemplateFor, instantiatePrescription, buildSessionViews } from "./prescription";

const RMS: RM = { arranque: 80, envion: 100, sentadilla: 140, frente: 110 };
const ruso = MACROCYCLES.find((m) => m.id === "ruso-5d")!;

describe("resolveTargetKg", () => {
  it("derives pct × RM of the movement's reference, rounded to 1kg", () => {
    expect(resolveTargetKg({ movementId: "arranque", sets: 5, reps: 3, pct: 70 }, RMS)).toBe(56); // 70% of 80
    expect(resolveTargetKg({ movementId: "sentadilla", sets: 5, reps: 5, pct: 80 }, RMS)).toBe(112); // 80% of 140
    expect(resolveTargetKg({ movementId: "tiron-arranque", sets: 4, reps: 3, pct: 105 }, RMS)).toBe(84); // 105% of 80
  });
  it("kgOverride beats pct", () => {
    expect(resolveTargetKg({ movementId: "arranque", sets: 1, reps: 1, pct: 70, kgOverride: 62.5 }, RMS)).toBe(62.5);
  });
  it("rmRef 'none' (accessory) without override → undefined (use rpe/kg)", () => {
    expect(resolveTargetKg({ movementId: "peso-muerto-rumano", sets: 3, reps: 8, rpe: 7 }, RMS)).toBeUndefined();
    expect(resolveTargetKg({ movementId: "peso-muerto-rumano", sets: 3, reps: 8, kgOverride: 90 }, RMS)).toBe(90);
  });
});

describe("instantiatePrescription (Ruso 5D)", () => {
  it("produces rows for every week × session of the macro", () => {
    const rows = instantiatePrescription(MACRO_RECIPES_FIXTURE, ruso, 16);
    // 16 weeks; weeks 1-12 have 5-day phases (3 exercises each in this fixture), weeks 13-16 have 2-day…
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.week >= 1 && r.week <= 16)).toBe(true);
    const w1 = rows.filter((r) => r.week === 1);
    expect(new Set(w1.map((r) => r.sessionIdx)).size).toBe(2); // fixture: 2 sessions in the hipertrofia phase
    expect(w1.find((r) => r.sessionIdx === 0 && r.order === 0)!.movementId).toBe("arranque");
  });
  it("a macro with no recipe → []", () => {
    expect(instantiatePrescription([], ruso, 16)).toEqual([]);
  });
});

describe("buildSessionViews", () => {
  it("groups week rows into sessions with movementName + derived targetKg", () => {
    const rows = instantiatePrescription(MACRO_RECIPES_FIXTURE, ruso, 16).filter((r) => r.week === 1);
    const views = buildSessionViews(rows, RMS);
    expect(views.length).toBe(2);
    const s0 = views.find((v) => v.sessionIdx === 0)!;
    expect(s0.exercises[0]!.movementName).toContain("Arranque");
    expect(s0.exercises[0]!.targetKg).toBe(54); // arranque 68% of 80 = 54.4 → 54
  });
});

// minimal fixture so the test doesn't depend on the full curated recipe
const MACRO_RECIPES_FIXTURE: MacroRecipe[] = [{
  macroId: "ruso-5d",
  phases: [
    { phaseKey: "hipertrofia", sessions: [
      { exercises: [{ movementId: "arranque", sets: 5, reps: 3, pct: 68 }, { movementId: "sentadilla", sets: 5, reps: 5, pct: 70 }] },
      { exercises: [{ movementId: "cargada-envion", sets: 5, reps: 2, pct: 68 }] },
    ] },
    { phaseKey: "fuerza-basica", sessions: [{ exercises: [{ movementId: "arranque", sets: 5, reps: 2, pct: 78 }] }] },
    { phaseKey: "fuerza-potencia", sessions: [{ exercises: [{ movementId: "arranque", sets: 6, reps: 1, pct: 88 }] }] },
    { phaseKey: "peaking", sessions: [{ exercises: [{ movementId: "arranque", sets: 5, reps: 1, pct: 93 }] }] },
  ],
}];
```

- [ ] **Step 2: Run it — verify it fails**

Run: `pnpm --filter @holy-oly/core test prescription`
Expected: FAIL — `Cannot find module './prescription'`.

- [ ] **Step 3: Implement `packages/core/src/logic/prescription.ts`**

```typescript
import type {
  MacroRecipe, Macrocycle, PrescribedExercise, PrescriptionRow, RM, SessionTemplate, SessionView,
} from "../types";
import { phaseForWeek } from "../data/macrocycles";
import { getMovement } from "./movements";

/** Target kg of a prescribed exercise: explicit override wins; else %1RM × the movement's reference RM
 *  (rounded to 1 kg). Accessories (rmRef "none") have no derivation → undefined (use kgOverride/rpe). */
export function resolveTargetKg(ex: PrescribedExercise, rms: RM): number | undefined {
  if (ex.kgOverride != null) return ex.kgOverride;
  const mv = getMovement(ex.movementId);
  if (!mv || mv.rmRef === "none" || ex.pct == null) return undefined;
  return Math.round((ex.pct / 100) * rms[mv.rmRef]);
}

/** The session templates for a given week = the recipe's templates for that week's phase ([] if none). */
export function sessionTemplateFor(recipe: MacroRecipe | undefined, macro: Macrocycle, week: number): SessionTemplate[] {
  if (!recipe) return [];
  const phase = phaseForWeek(macro, week);
  if (!phase) return [];
  return recipe.phases.find((p) => p.phaseKey === phase.key)?.sessions ?? [];
}

/** Instantiate the whole prescription: every week → its phase's session templates → flat rows. */
export function instantiatePrescription(recipes: MacroRecipe[], macro: Macrocycle, totalWeeks: number): PrescriptionRow[] {
  const recipe = recipes.find((r) => r.macroId === macro.id);
  if (!recipe) return [];
  const rows: PrescriptionRow[] = [];
  for (let week = 1; week <= totalWeeks; week++) {
    const sessions = sessionTemplateFor(recipe, macro, week);
    sessions.forEach((session, sessionIdx) => {
      session.exercises.forEach((ex, order) => rows.push({ ...ex, week, sessionIdx, order }));
    });
  }
  return rows;
}

/** Group a set of prescription rows (typically one week) into per-session views with name + derived kg. */
export function buildSessionViews(rows: PrescriptionRow[], rms: RM): SessionView[] {
  const byIdx = new Map<number, PrescriptionRow[]>();
  for (const r of rows) (byIdx.get(r.sessionIdx) ?? byIdx.set(r.sessionIdx, []).get(r.sessionIdx)!).push(r);
  const views: SessionView[] = [];
  for (const [sessionIdx, sRows] of [...byIdx.entries()].sort((a, b) => a[0] - b[0])) {
    const ordered = [...sRows].sort((a, b) => a.order - b.order);
    views.push({
      week: ordered[0]!.week,
      sessionIdx,
      exercises: ordered.map((r) => ({
        movementId: r.movementId, sets: r.sets, reps: r.reps, pct: r.pct, kgOverride: r.kgOverride,
        rpe: r.rpe, flags: r.flags, notes: r.notes,
        movementName: getMovement(r.movementId)?.name ?? r.movementId,
        targetKg: resolveTargetKg(r, rms),
      })),
    });
  }
  return views;
}
```

- [ ] **Step 4: Export + run tests**

In `packages/core/src/index.ts` append `export * from "./logic/prescription";` and `export * from "./data/recipes";` (the recipes file is created in Task A3 — add both exports now; if `recipes` doesn't exist yet, add its export in A3 instead to keep the build green). Run: `pnpm --filter @holy-oly/core test prescription` → PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/logic/prescription.ts packages/core/src/logic/prescription.test.ts packages/core/src/index.ts
git commit -m "feat(core): derivación kg + instanciación de prescripción (puro)"
```

---

### Task A3: Ruso 5D recipe

**Files:** Create `packages/core/src/data/recipes.ts`, `packages/core/src/data/recipes.test.ts`; Modify `packages/core/src/index.ts` (ensure `export * from "./data/recipes";`)

- [ ] **Step 1: Write the failing integrity test** (`packages/core/src/data/recipes.test.ts`)

```typescript
import { describe, it, expect } from "vitest";
import { MACRO_RECIPES } from "./recipes";
import { MACROCYCLES } from "./macrocycles";
import { getMovement } from "../logic/movements";

describe("MACRO_RECIPES integrity", () => {
  it("Ruso 5D recipe exists and references the real phase keys", () => {
    const r = MACRO_RECIPES.find((x) => x.macroId === "ruso-5d")!;
    expect(r).toBeDefined();
    const macro = MACROCYCLES.find((m) => m.id === "ruso-5d")!;
    const phaseKeys = new Set(macro.phaseProfile.map((p) => p.key));
    for (const ph of r.phases) expect(phaseKeys.has(ph.phaseKey)).toBe(true);
    expect(r.phases.map((p) => p.phaseKey)).toEqual(["hipertrofia", "fuerza-basica", "fuerza-potencia", "peaking"]);
  });
  it("every movementId in the recipe exists in the SP1 library", () => {
    for (const r of MACRO_RECIPES)
      for (const ph of r.phases)
        for (const s of ph.sessions)
          for (const ex of s.exercises)
            expect(getMovement(ex.movementId), `${ex.movementId} must exist`).toBeDefined();
  });
  it("pct (when present) is in 1..120; sets/reps ≥ 1", () => {
    for (const r of MACRO_RECIPES)
      for (const ph of r.phases)
        for (const s of ph.sessions)
          for (const ex of s.exercises) {
            if (ex.pct != null) expect(ex.pct).toBeGreaterThanOrEqual(1), expect(ex.pct).toBeLessThanOrEqual(120);
            expect(ex.sets).toBeGreaterThanOrEqual(1);
            expect(ex.reps).toBeGreaterThanOrEqual(1);
          }
  });
});
```

- [ ] **Step 2: Run it — verify it fails**

Run: `pnpm --filter @holy-oly/core test recipes`
Expected: FAIL — `Cannot find module './recipes'`.

- [ ] **Step 3: Create `packages/core/src/data/recipes.ts`** (the curated Ruso 5D recipe from the spec §4)

```typescript
import type { MacroRecipe } from "../types";

/** Concrete session programs per macro (SP2). Starts with Ruso 5D; the coach owns/corrects these.
 *  %s of the competition lifts sit in each phase's imrPct corridor; pulls 90–110% of their lift;
 *  squats relative to their own RM; accessories by rpe. Movement ids are from SP1. */
export const MACRO_RECIPES: MacroRecipe[] = [
  {
    macroId: "ruso-5d",
    phases: [
      { phaseKey: "hipertrofia", sessions: [
        { exercises: [{ movementId: "arranque", sets: 5, reps: 3, pct: 68 }, { movementId: "tiron-arranque", sets: 4, reps: 4, pct: 80 }, { movementId: "sentadilla", sets: 5, reps: 5, pct: 70 }] },
        { exercises: [{ movementId: "cargada-envion", sets: 5, reps: 2, pct: 68 }, { movementId: "sentadilla-frente", sets: 4, reps: 4, pct: 70 }, { movementId: "peso-muerto-rumano", sets: 3, reps: 8, rpe: 7 }] },
        { exercises: [{ movementId: "arranque.potencia", sets: 5, reps: 2, pct: 62 }, { movementId: "tiron-cargada", sets: 4, reps: 4, pct: 85 }, { movementId: "press-empuje", sets: 4, reps: 5, rpe: 7 }] },
        { exercises: [{ movementId: "arranque", sets: 5, reps: 3, pct: 70 }, { movementId: "sentadilla", sets: 5, reps: 3, pct: 75 }, { movementId: "sentadilla-overhead", sets: 4, reps: 3, rpe: 6 }] },
        { exercises: [{ movementId: "cargada", sets: 5, reps: 2, pct: 70 }, { movementId: "envion.tijera", sets: 5, reps: 2, pct: 70 }, { movementId: "buenos-dias", sets: 3, reps: 8, rpe: 7 }] },
      ] },
      { phaseKey: "fuerza-basica", sessions: [
        { exercises: [{ movementId: "arranque", sets: 5, reps: 2, pct: 78 }, { movementId: "tiron-arranque", sets: 4, reps: 3, pct: 95 }, { movementId: "sentadilla", sets: 5, reps: 4, pct: 80 }] },
        { exercises: [{ movementId: "cargada-envion", sets: 5, reps: 2, pct: 78 }, { movementId: "sentadilla-frente", sets: 4, reps: 3, pct: 78 }, { movementId: "peso-muerto-rumano", sets: 3, reps: 6, rpe: 8 }] },
        { exercises: [{ movementId: "arranque.potencia", sets: 4, reps: 2, pct: 72 }, { movementId: "tiron-cargada", sets: 4, reps: 3, pct: 100 }, { movementId: "press-empuje", sets: 4, reps: 4, rpe: 8 }] },
        { exercises: [{ movementId: "arranque", sets: 5, reps: 2, pct: 80 }, { movementId: "sentadilla", sets: 5, reps: 3, pct: 82 }, { movementId: "sentadilla-overhead", sets: 3, reps: 3, rpe: 7 }] },
        { exercises: [{ movementId: "cargada", sets: 4, reps: 2, pct: 80 }, { movementId: "envion.tijera", sets: 5, reps: 2, pct: 78 }, { movementId: "buenos-dias", sets: 3, reps: 6, rpe: 8 }] },
      ] },
      { phaseKey: "fuerza-potencia", sessions: [
        { exercises: [{ movementId: "arranque", sets: 6, reps: 1, pct: 88 }, { movementId: "tiron-arranque", sets: 4, reps: 2, pct: 105 }, { movementId: "sentadilla", sets: 5, reps: 3, pct: 88 }] },
        { exercises: [{ movementId: "cargada-envion", sets: 5, reps: 1, pct: 88 }, { movementId: "sentadilla-frente", sets: 4, reps: 2, pct: 85 }, { movementId: "peso-muerto-rumano", sets: 3, reps: 5, rpe: 8 }] },
        { exercises: [{ movementId: "arranque.potencia", sets: 4, reps: 1, pct: 80 }, { movementId: "tiron-cargada", sets: 4, reps: 2, pct: 108 }, { movementId: "press-empuje", sets: 4, reps: 3, rpe: 8 }] },
        { exercises: [{ movementId: "arranque", sets: 5, reps: 1, pct: 90 }, { movementId: "sentadilla", sets: 4, reps: 2, pct: 90 }, { movementId: "sentadilla-overhead", sets: 3, reps: 2, rpe: 7 }] },
        { exercises: [{ movementId: "cargada", sets: 4, reps: 1, pct: 90 }, { movementId: "envion.tijera", sets: 5, reps: 1, pct: 88 }] },
      ] },
      { phaseKey: "peaking", sessions: [
        { exercises: [{ movementId: "arranque", sets: 5, reps: 1, pct: 93 }, { movementId: "sentadilla", sets: 3, reps: 2, pct: 92 }] },
        { exercises: [{ movementId: "cargada-envion", sets: 5, reps: 1, pct: 93 }, { movementId: "sentadilla-frente", sets: 3, reps: 1, pct: 90 }] },
        { exercises: [{ movementId: "arranque.potencia", sets: 3, reps: 1, pct: 85 }, { movementId: "tiron-arranque", sets: 3, reps: 1, pct: 100 }] },
        { exercises: [{ movementId: "arranque", sets: 4, reps: 1, pct: 96 }, { movementId: "sentadilla", sets: 2, reps: 1, pct: 95 }] },
        { exercises: [{ movementId: "cargada-envion", sets: 3, reps: 1, pct: 97 }] },
      ] },
    ],
  },
];
```

- [ ] **Step 4: Confirm the barrel export + run tests**

Ensure `packages/core/src/index.ts` has `export * from "./data/recipes";`. Run: `pnpm --filter @holy-oly/core test recipes` → PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/data/recipes.ts packages/core/src/data/recipes.test.ts packages/core/src/index.ts
git commit -m "feat(core): receta Ruso 5D (4 fases × 5 días) + integridad vs SP1"
```

---

### Task A4: Zod wire schemas

**Files:** Modify `packages/core/src/schemas.ts` (append); Create `packages/core/src/schemas.prescription.test.ts`

- [ ] **Step 1: Write the failing test** (`packages/core/src/schemas.prescription.test.ts`)

```typescript
import { describe, it, expect } from "vitest";
import { PrescribedExercisesSchema, SessionViewsSchema } from "./schemas";

describe("PrescribedExercisesSchema", () => {
  it("accepts a valid session body", () => {
    expect(PrescribedExercisesSchema.safeParse([
      { movementId: "arranque", sets: 5, reps: 2, pct: 80 },
      { movementId: "peso-muerto-rumano", sets: 3, reps: 8, rpe: 7, flags: ["pausa"] },
    ]).success).toBe(true);
  });
  it("rejects out-of-range pct / non-positive sets / bad rpe", () => {
    expect(PrescribedExercisesSchema.safeParse([{ movementId: "arranque", sets: 0, reps: 2 }]).success).toBe(false);
    expect(PrescribedExercisesSchema.safeParse([{ movementId: "arranque", sets: 5, reps: 2, pct: 130 }]).success).toBe(false);
    expect(PrescribedExercisesSchema.safeParse([{ movementId: "x", sets: 5, reps: 2, rpe: 11 }]).success).toBe(false);
  });
});

describe("SessionViewsSchema", () => {
  it("accepts a derived session view", () => {
    expect(SessionViewsSchema.safeParse([
      { week: 1, sessionIdx: 0, exercises: [{ movementId: "arranque", sets: 5, reps: 2, pct: 80, movementName: "Arranque", targetKg: 64 }] },
    ]).success).toBe(true);
  });
});
```

- [ ] **Step 2: Run it — verify it fails**

Run: `pnpm --filter @holy-oly/core test schemas.prescription`
Expected: FAIL — schemas not exported.

- [ ] **Step 3: Append to `packages/core/src/schemas.ts`**

```typescript
// ── Prescription wire shapes (SP2). The PUT body is untrusted coach input → bounded. ──
const MovementFlagSchema = z.enum(["pausa", "deficit", "tempo", "sin-recibida"]);
export const PrescribedExerciseSchema = z.object({
  movementId: z.string().min(1).max(60),
  sets: z.number().int().min(1).max(20),
  reps: z.number().int().min(1).max(50),
  pct: z.number().min(1).max(120).optional(),
  kgOverride: KgSchema.optional(),
  rpe: z.number().min(1).max(10).optional(),
  flags: z.array(MovementFlagSchema).max(4).optional(),
  notes: z.string().max(200).optional(),
});
export const PrescribedExercisesSchema = z.array(PrescribedExerciseSchema).max(15);

export const PrescribedExerciseViewSchema = PrescribedExerciseSchema.extend({
  movementName: z.string(),
  targetKg: z.number().optional(),
});
export const SessionViewSchema = z.object({
  week: z.number().int().min(1).max(104),
  sessionIdx: z.number().int().min(0).max(13),
  label: z.string().optional(),
  exercises: z.array(PrescribedExerciseViewSchema).max(15),
});
export const SessionViewsSchema = z.array(SessionViewSchema).max(14);
```

- [ ] **Step 4: Run tests + full core check**

Run: `pnpm --filter @holy-oly/core test schemas.prescription && pnpm --filter @holy-oly/core test && pnpm --filter @holy-oly/core exec tsc --noEmit`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/schemas.ts packages/core/src/schemas.prescription.test.ts
git commit -m "feat(core): schemas wire de prescripción (PrescribedExercise/SessionView)"
```

---

## Phase B — API (model + instantiation + endpoints)

### Task B1: `PrescribedExercise` Prisma model + migration

**Files:** Modify `apps/api/prisma/schema.prisma`; Create `apps/api/prisma/migrations/5_prescription/migration.sql`

- [ ] **Step 1: Add the relation to `Athlete`** — in `model Athlete`, add to the relation list:
```prisma
  prescription PrescribedExercise[]
```

- [ ] **Step 2: Add the model** (after `model DayLog`):
```prisma
/// One prescribed exercise of an athlete's plan (SP2). Coach-owned; the athlete is read-only.
model PrescribedExercise {
  id          String   @id @default(uuid())
  athleteId   String
  athlete     Athlete  @relation(fields: [athleteId], references: [id], onDelete: Cascade)
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

- [ ] **Step 3: Generate the migration** — Run: `pnpm --filter @holy-oly/api exec tsx scripts/make-migration.ts 5 prescription`
Expected: `prisma/migrations/5_prescription/migration.sql` ≈:
```sql
-- CreateTable
CREATE TABLE "PrescribedExercise" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "sessionIdx" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "movementId" TEXT NOT NULL,
    "sets" INTEGER NOT NULL,
    "reps" INTEGER NOT NULL,
    "pct" DOUBLE PRECISION,
    "kgOverride" DOUBLE PRECISION,
    "rpe" DOUBLE PRECISION,
    "flags" TEXT[],
    "notes" TEXT,
    CONSTRAINT "PrescribedExercise_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "PrescribedExercise_athleteId_week_idx" ON "PrescribedExercise"("athleteId", "week");
-- CreateIndex
CREATE UNIQUE INDEX "PrescribedExercise_athleteId_week_sessionIdx_order_key" ON "PrescribedExercise"("athleteId", "week", "sessionIdx", "order");
-- AddForeignKey
ALTER TABLE "PrescribedExercise" ADD CONSTRAINT "PrescribedExercise_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 4: Regenerate the client** — Run: `pnpm --filter @holy-oly/api exec prisma generate` (expect `prisma.prescribedExercise` delegate).

- [ ] **Step 5: Commit**
```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/5_prescription/migration.sql
git commit -m "feat(api): modelo PrescribedExercise + migración 5_prescription"
```

---

### Task B2: Failing integration test

**Files:** Create `apps/api/src/prescription.int.test.ts`

> Uses the seeded demo coach (`coach@holyoly.dev`) who has an active Vínculo to Mara (`mv`). The coach assigns Ruso 5D to Mara (→ instantiation), reads week 1, edits a session.

- [ ] **Step 1: Write the test**

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "./server";
import { prisma } from "./db/client";

type InjectRes = { cookies: Array<{ name: string; value: string }>; statusCode: number };
function sessionHeader(res: InjectRes): { cookie: string } {
  const c = res.cookies.find((x) => x.name === "session");
  if (!c) throw new Error("no session cookie");
  return { cookie: `session=${c.value}` };
}
const RMS = { arranque: 80, envion: 100, sentadilla: 140, frente: 110 };

describe("API integration — prescription (SP2)", () => {
  let app: FastifyInstance;
  beforeAll(async () => { app = buildServer(); await app.ready(); });
  afterAll(async () => { await app.close(); await prisma.$disconnect(); });

  async function coach(): Promise<{ cookie: string }> {
    const res = await app.inject({ method: "POST", url: "/auth/login", payload: { email: "coach@holyoly.dev", password: "holyoly-demo" } });
    expect(res.statusCode).toBe(200);
    return sessionHeader(res);
  }
  async function assignRuso(headers: { cookie: string }) {
    return app.inject({ method: "PUT", url: "/athletes/mv/plan", headers,
      payload: { atletaId: "mv", macroId: "ruso-5d", startWeek: 1, startDate: "2026-04-01", rms: RMS, comps: [] } });
  }

  it("assigning Ruso 5D instantiates the prescription; week 1 has the recipe's sessions with derived kg", async () => {
    const headers = await coach();
    expect((await assignRuso(headers)).statusCode).toBe(200);
    const res = await app.inject({ method: "GET", url: "/athletes/mv/prescription?week=1", headers });
    expect(res.statusCode).toBe(200);
    const sessions = res.json() as Array<{ sessionIdx: number; exercises: Array<{ movementId: string; targetKg?: number }> }>;
    expect(sessions.length).toBe(5); // 5 días/sem in the hipertrofia phase
    const s0 = sessions.find((s) => s.sessionIdx === 0)!;
    expect(s0.exercises[0]!.movementId).toBe("arranque");
    expect(s0.exercises[0]!.targetKg).toBe(54); // 68% of 80 = 54.4 → 54
  });

  it("the coach can edit a session (PUT replaces it)", async () => {
    const headers = await coach();
    await assignRuso(headers);
    const put = await app.inject({ method: "PUT", url: "/athletes/mv/prescription/1/0", headers,
      payload: [{ movementId: "arranque.potencia", sets: 4, reps: 2, pct: 65 }] });
    expect(put.statusCode).toBe(200);
    const res = await app.inject({ method: "GET", url: "/athletes/mv/prescription?week=1", headers });
    const s0 = (res.json() as Array<{ sessionIdx: number; exercises: Array<{ movementId: string }> }>).find((s) => s.sessionIdx === 0)!;
    expect(s0.exercises).toHaveLength(1);
    expect(s0.exercises[0]!.movementId).toBe("arranque.potencia");
  });

  it("requires week, validates the body, and is coach-only (athlete 401, no-Vínculo coach 403)", async () => {
    const headers = await coach();
    expect((await app.inject({ method: "GET", url: "/athletes/mv/prescription", headers })).statusCode).toBe(400);
    expect((await app.inject({ method: "PUT", url: "/athletes/mv/prescription/1/0", headers, payload: [{ movementId: "arranque", sets: 0, reps: 2 }] })).statusCode).toBe(400);
    // athlete session → 401 (no coachId)
    const aLogin = await app.inject({ method: "POST", url: "/auth/login", payload: { email: "atleta@holyoly.dev", password: "holyoly-demo" } });
    expect((await app.inject({ method: "GET", url: "/athletes/mv/prescription?week=1", headers: sessionHeader(aLogin) })).statusCode).toBe(401);
    // a second coach with no Vínculo to mv → 403
    const c2 = await app.inject({ method: "POST", url: "/auth/signup", payload: { email: `c2-${Date.now()}@x.dev`, password: "another-pass-1", role: "coach", name: "C2" } });
    expect((await app.inject({ method: "GET", url: "/athletes/mv/prescription?week=1", headers: sessionHeader(c2) })).statusCode).toBe(403);
  });
});
```

- [ ] **Step 2: Run it — verify it fails**

Run: `pnpm --filter @holy-oly/api verify`
Expected: FAIL — `/athletes/:id/prescription` 404 (not implemented).

---

### Task B3: repo functions + endpoints + instantiation

**Files:** Modify `apps/api/src/repo.ts`, `apps/api/src/server.ts`

- [ ] **Step 1: Extend `repo.ts` imports + add functions**

Extend the core imports at the top of `repo.ts`:
```typescript
import type { ... , PrescribedExercise, PrescriptionRow, SessionView } from "@holy-oly/core";
import { RMSchema, buildMePlanView, computeStreak, MACROCYCLES, MACRO_RECIPES, instantiatePrescription, buildSessionViews } from "@holy-oly/core";
```
Append at the end of `repo.ts`:
```typescript
// ── Prescription (SP2). Coach-owned. Assigning a plan (re)instantiates from the macro recipe. ──

/** (Re)instantiate the athlete's prescription from the macro recipe. Replaces all rows. No-op if
 *  the macro has no recipe (the coach builds from scratch). Called by savePlan. */
export async function instantiateForPlan(prisma: PrismaClient, athleteId: string, plan: Plan): Promise<void> {
  const macro = MACROCYCLES.find((m) => m.id === plan.macroId);
  const totalWeeks = macro ? (macro.phaseProfile[macro.phaseProfile.length - 1]?.weeks[1] ?? 0) : 0;
  const rows: PrescriptionRow[] = macro ? instantiatePrescription(MACRO_RECIPES, macro, totalWeeks) : [];
  await prisma.$transaction([
    prisma.prescribedExercise.deleteMany({ where: { athleteId } }),
    prisma.prescribedExercise.createMany({
      data: rows.map((r) => ({
        athleteId, week: r.week, sessionIdx: r.sessionIdx, order: r.order, movementId: r.movementId,
        sets: r.sets, reps: r.reps, pct: r.pct ?? null, kgOverride: r.kgOverride ?? null,
        rpe: r.rpe ?? null, flags: r.flags ?? [], notes: r.notes ?? null,
      })),
    }),
  ]);
}

/** A week's sessions with kg derived from the athlete's plan RMs. [] if no plan. */
export async function getPrescriptionWeek(prisma: PrismaClient, athleteId: string, week: number): Promise<SessionView[]> {
  const plan = await getPlan(prisma, athleteId);
  if (!plan) return [];
  const dbRows = await prisma.prescribedExercise.findMany({
    where: { athleteId, week }, orderBy: [{ sessionIdx: "asc" }, { order: "asc" }],
  });
  const rows: PrescriptionRow[] = dbRows.map((r) => ({
    week: r.week, sessionIdx: r.sessionIdx, order: r.order, movementId: r.movementId, sets: r.sets, reps: r.reps,
    pct: r.pct ?? undefined, kgOverride: r.kgOverride ?? undefined, rpe: r.rpe ?? undefined,
    flags: (r.flags as PrescribedExercise["flags"]) ?? undefined, notes: r.notes ?? undefined,
  }));
  return buildSessionViews(rows, plan.rms);
}

/** Replace one session's exercises (coach edit). Transactional. */
export async function setSession(prisma: PrismaClient, athleteId: string, week: number, sessionIdx: number, exercises: PrescribedExercise[]): Promise<void> {
  await prisma.$transaction([
    prisma.prescribedExercise.deleteMany({ where: { athleteId, week, sessionIdx } }),
    prisma.prescribedExercise.createMany({
      data: exercises.map((ex, order) => ({
        athleteId, week, sessionIdx, order, movementId: ex.movementId, sets: ex.sets, reps: ex.reps,
        pct: ex.pct ?? null, kgOverride: ex.kgOverride ?? null, rpe: ex.rpe ?? null, flags: ex.flags ?? [], notes: ex.notes ?? null,
      })),
    }),
  ]);
}
```
And modify the existing `savePlan` to instantiate after the upsert (add the last line):
```typescript
export async function savePlan(prisma: PrismaClient, athleteId: string, plan: Plan): Promise<void> {
  const data = { macroId: plan.macroId, startWeek: plan.startWeek, startDate: plan.startDate ?? null, rms: plan.rms as unknown as Prisma.InputJsonValue };
  await prisma.plan.upsert({ where: { athleteId }, create: { athleteId, ...data }, update: data });
  await instantiateForPlan(prisma, athleteId, plan); // assigning a plan (re)instantiates the prescription
}
```

- [ ] **Step 2: Add the endpoints in `server.ts`** — extend the core import (`import { PlanSchema, MedalSchema, CompsSchema, SessionLogSchema, PrescribedExercisesSchema } from "@holy-oly/core";`) and add after the `PUT /athletes/:id/sessions` route:
```typescript
  app.get<{ Params: { id: string }; Querystring: { week?: string } }>("/athletes/:id/prescription", async (req, reply) => {
    if (!(await guardAthlete(req, reply, req.params.id))) return;
    const week = Number(req.query.week);
    if (!Number.isInteger(week) || week < 1 || week > 104) return reply.code(400).send({ error: "week required (1..104)" });
    return repo.getPrescriptionWeek(prisma, req.params.id, week);
  });

  app.put<{ Params: { id: string; week: string; idx: string } }>("/athletes/:id/prescription/:week/:idx", async (req, reply) => {
    if (!(await guardAthlete(req, reply, req.params.id))) return;
    const week = Number(req.params.week);
    const idx = Number(req.params.idx);
    if (!Number.isInteger(week) || week < 1 || week > 104 || !Number.isInteger(idx) || idx < 0 || idx > 13) {
      return reply.code(400).send({ error: "bad week/idx" });
    }
    const parsed = PrescribedExercisesSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid session" });
    await repo.setSession(prisma, req.params.id, week, idx, parsed.data);
    return reply.code(200).send({ ok: true });
  });
```

- [ ] **Step 3: Run the integration suite — verify it passes**

Run: `pnpm --filter @holy-oly/api verify`
Expected: PASS (the 3 new prescription.int cases + existing). Note: the existing `writes.int` savePlan test still passes (savePlan now also instantiates; for its macro that has no recipe → 0 rows, no impact; if it uses `ruso-5d`, rows are created but the plan assertion is unaffected).

- [ ] **Step 4: Unit + typecheck + commit**

Run: `pnpm --filter @holy-oly/api test && pnpm --filter @holy-oly/api exec tsc --noEmit`
```bash
git add apps/api/src/repo.ts apps/api/src/server.ts apps/api/src/prescription.int.test.ts
git commit -m "feat(api): /athletes/:id/prescription (instanciar al asignar + ver + editar sesión)"
```

---

## Phase C — Web (Repository contract + coach session view & editor)

### Task C1: Extend the `Repository` contract (interface + Http + Local)

**Files:** Modify `packages/core/src/repository.ts`, `apps/web/src/data/keys.ts`, `apps/web/src/data/HttpRepository.ts`, `apps/web/src/data/LocalRepository.ts`; Create `apps/web/src/data/prescription.test.ts`

- [ ] **Step 1: Write the failing test** (`apps/web/src/data/prescription.test.ts`)

```typescript
import { describe, it, expect, vi, afterEach } from "vitest";
import { LocalRepository } from "./LocalRepository";
import { HttpRepository } from "./HttpRepository";
import { MemStorage } from "../test-utils/MemStorage";
import type { Plan } from "@holy-oly/core";

const RMS = { arranque: 80, envion: 100, sentadilla: 140, frente: 110 };
const plan: Plan = { atletaId: "mv", macroId: "ruso-5d", startWeek: 1, startDate: "2026-04-01", rms: RMS, comps: [] };

describe("LocalRepository prescription", () => {
  it("savePlan instantiates the recipe; getPrescriptionWeek derives kg", async () => {
    const repo = new LocalRepository(new MemStorage());
    // seed a roster entry for mv so getPlan/getPrescription have an athlete context
    await repo.savePlan(plan);
    const week1 = await repo.getPrescriptionWeek("mv", 1);
    expect(week1.length).toBe(5);
    expect(week1[0]!.exercises[0]!.movementId).toBe("arranque");
    expect(week1[0]!.exercises[0]!.targetKg).toBe(54); // 68% of 80
  });
  it("setSession replaces one session", async () => {
    const repo = new LocalRepository(new MemStorage());
    await repo.savePlan(plan);
    await repo.setSession("mv", 1, 0, [{ movementId: "arranque.potencia", sets: 4, reps: 2, pct: 65 }]);
    const s0 = (await repo.getPrescriptionWeek("mv", 1)).find((s) => s.sessionIdx === 0)!;
    expect(s0.exercises).toHaveLength(1);
    expect(s0.exercises[0]!.movementId).toBe("arranque.potencia");
  });
});

describe("HttpRepository prescription", () => {
  afterEach(() => vi.restoreAllMocks());
  it("getPrescriptionWeek GETs ?week and parses; setSession PUTs to /:week/:idx", async () => {
    let seen = "";
    global.fetch = vi.fn(async (url: string, init?: { method?: string }) => {
      seen = `${init?.method ?? "GET"} ${url}`;
      if ((init?.method ?? "GET") === "GET") return { ok: true, status: 200, json: async () => [{ week: 1, sessionIdx: 0, exercises: [{ movementId: "arranque", sets: 5, reps: 2, pct: 80, movementName: "Arranque", targetKg: 64 }] }] } as Response;
      return { ok: true, status: 200, json: async () => ({ ok: true }) } as Response;
    }) as unknown as typeof fetch;
    const repo = new HttpRepository("");
    const wk = await repo.getPrescriptionWeek("mv", 1);
    expect(wk[0]!.exercises[0]!.targetKg).toBe(64);
    expect(seen).toContain("/athletes/mv/prescription?week=1");
    await repo.setSession("mv", 1, 0, [{ movementId: "arranque", sets: 5, reps: 2, pct: 80 }]);
    expect(seen).toBe("PUT /athletes/mv/prescription/1/0");
  });
});
```

- [ ] **Step 2: Run it — verify it fails**

Run: `pnpm --filter @holy-oly/web test prescription`
Expected: FAIL — `getPrescriptionWeek`/`setSession` not on the repos.

- [ ] **Step 3: Add to the `Repository` interface** (`packages/core/src/repository.ts`) — extend the import to include `SessionView`, `PrescribedExercise`, and add to the interface:
```typescript
  getPrescriptionWeek(id: string, week: number): Promise<SessionView[]>;
  setSession(id: string, week: number, sessionIdx: number, exercises: PrescribedExercise[]): Promise<void>;
```

- [ ] **Step 4: `keys.ts`** — add a key builder:
```typescript
  prescription: (id: string) => `holyoly:prescription:${id}`,
```

- [ ] **Step 5: `HttpRepository.ts`** — extend the import (`SessionViewsSchema`, types `SessionView`, `PrescribedExercise`) and add the methods:
```typescript
  async getPrescriptionWeek(id: string, week: number): Promise<SessionView[]> {
    return this.get(`${this.athletePath(id, "prescription")}?week=${week}`, SessionViewsSchema);
  }
  async setSession(id: string, week: number, sessionIdx: number, exercises: PrescribedExercise[]): Promise<void> {
    return this.mutate(`${this.athletePath(id, "prescription")}/${week}/${sessionIdx}`, "PUT", exercises);
  }
```

- [ ] **Step 6: `LocalRepository.ts`** — extend the import (`MACROCYCLES, MACRO_RECIPES, instantiatePrescription, buildSessionViews`, types `SessionView, PrescribedExercise, PrescriptionRow`), make `savePlan` instantiate, and add the two methods:
```typescript
  async savePlan(plan: Plan): Promise<void> {
    this.s.set(KEYS.plan(plan.atletaId), plan);
    const macro = MACROCYCLES.find((m) => m.id === plan.macroId);
    const totalWeeks = macro ? (macro.phaseProfile[macro.phaseProfile.length - 1]?.weeks[1] ?? 0) : 0;
    const rows: PrescriptionRow[] = macro ? instantiatePrescription(MACRO_RECIPES, macro, totalWeeks) : [];
    this.s.set(KEYS.prescription(plan.atletaId), rows);
  }
  async getPrescriptionWeek(id: string, week: number): Promise<SessionView[]> {
    const plan = await this.getPlan(id);
    if (!plan) return [];
    const all = this.s.getOptional<PrescriptionRow[]>(KEYS.prescription(id)) ?? [];
    return buildSessionViews(all.filter((r) => r.week === week), plan.rms);
  }
  async setSession(id: string, week: number, sessionIdx: number, exercises: PrescribedExercise[]): Promise<void> {
    const all = this.s.getOptional<PrescriptionRow[]>(KEYS.prescription(id)) ?? [];
    const kept = all.filter((r) => !(r.week === week && r.sessionIdx === sessionIdx));
    const added: PrescriptionRow[] = exercises.map((ex, order) => ({ ...ex, week, sessionIdx, order }));
    this.s.set(KEYS.prescription(id), [...kept, ...added]);
  }
```

- [ ] **Step 7: Run tests + typecheck + commit**

Run: `pnpm --filter @holy-oly/web test prescription && pnpm --filter @holy-oly/web exec tsc --noEmit`
```bash
git add packages/core/src/repository.ts apps/web/src/data/keys.ts apps/web/src/data/HttpRepository.ts apps/web/src/data/LocalRepository.ts apps/web/src/data/prescription.test.ts
git commit -m "feat(web): Repository.getPrescriptionWeek + setSession (Http + Local; savePlan instancia)"
```

---

### Task C2: `MovementPicker` (SP1-powered selector)

**Files:** Create `apps/web/src/screens/coach/sessions/MovementPicker.tsx`, `apps/web/src/screens/coach/__tests__/movementPicker.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { MovementPicker } from "../sessions/MovementPicker";

test("busca por término bilingüe y elige un movimiento", () => {
  const onPick = vi.fn();
  render(<MovementPicker open onClose={() => {}} onPick={onPick} />);
  fireEvent.change(screen.getByPlaceholderText(/buscar movimiento/i), { target: { value: "hang power snatch" } });
  const hit = screen.getByRole("button", { name: /Arranque de potencia colgado \(rodilla\)/i });
  fireEvent.click(hit);
  expect(onPick).toHaveBeenCalledWith("arranque.potencia.colgado.rodilla");
});
```

- [ ] **Step 2: Run it — verify it fails** — `pnpm --filter @holy-oly/web test movementPicker` → FAIL (no module).

- [ ] **Step 3: Implement `MovementPicker.tsx`**

```tsx
import { useState, type CSSProperties } from "react";
import { searchMovements, MOVEMENTS } from "@holy-oly/core";
import { BottomSheet } from "../../../ui/BottomSheet";

const item: CSSProperties = {
  display: "block", width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: 10, marginTop: 6,
  border: "1px solid color-mix(in srgb,var(--wl-text) 12%,transparent)", background: "var(--wl-surface)",
  color: "var(--wl-text)", fontFamily: "var(--wl-display)", fontWeight: 600, fontSize: 14, cursor: "pointer",
};

/** SP1-powered movement selector. Empty query → the canonical lifts; otherwise bilingual search. */
export function MovementPicker({ open, onClose, onPick }: {
  open: boolean; onClose: () => void; onPick: (movementId: string) => void;
}) {
  const [q, setQ] = useState("");
  const results = q.trim() ? searchMovements(q).slice(0, 30) : MOVEMENTS.filter((m) => m.id === m.baseId).slice(0, 30);
  return (
    <BottomSheet open={open} onClose={onClose}>
      <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 18, color: "var(--wl-text)" }}>Elegí un movimiento</div>
      <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar movimiento…"
        aria-label="Buscar movimiento"
        style={{ width: "100%", boxSizing: "border-box", marginTop: 10, padding: "10px 12px", borderRadius: 10,
          border: "1px solid color-mix(in srgb,var(--wl-text) 16%,transparent)", background: "var(--wl-bg)", color: "var(--wl-text)",
          fontFamily: "var(--wl-display)", fontSize: 15 }} />
      <div style={{ marginTop: 8, maxHeight: 360, overflowY: "auto" }}>
        {results.map((m) => (
          <button key={m.id} type="button" style={item} onClick={() => { onPick(m.id); onClose(); }}>{m.name}</button>
        ))}
        {results.length === 0 && <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)", marginTop: 10 }}>Sin resultados.</div>}
      </div>
    </BottomSheet>
  );
}
```

- [ ] **Step 4: Run + commit**

Run: `pnpm --filter @holy-oly/web test movementPicker && pnpm --filter @holy-oly/web exec tsc --noEmit` → PASS.
```bash
git add apps/web/src/screens/coach/sessions/MovementPicker.tsx apps/web/src/screens/coach/__tests__/movementPicker.test.tsx
git commit -m "feat(web): MovementPicker (selector de movimientos vía SP1, búsqueda bilingüe)"
```

---

### Task C3: `SessionEditor` (edit a session)

**Files:** Create `apps/web/src/screens/coach/sessions/SessionEditor.tsx`, `apps/web/src/screens/coach/__tests__/sessionEditor.test.tsx`

> Edits one session's exercises: add (via `MovementPicker`), remove, reorder (↑/↓), set sets×reps, set % or kg (toggle). "Bajar complejidad"/"sustituir" = swap a row's movement via `simplerVariants`/`substitutesOf` (also surfaced through the picker). On save → `onSave(exercises)`.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import type { PrescribedExerciseView } from "@holy-oly/core";
import { SessionEditor } from "../sessions/SessionEditor";

const exs: PrescribedExerciseView[] = [
  { movementId: "arranque", sets: 5, reps: 3, pct: 70, movementName: "Arranque", targetKg: 56 },
];

test("edita reps y guarda los ejercicios", async () => {
  const onSave = vi.fn().mockResolvedValue(undefined);
  render(<SessionEditor open week={1} sessionIdx={0} exercises={exs} onClose={() => {}} onSave={onSave} />);
  fireEvent.change(screen.getByLabelText("reps de Arranque"), { target: { value: "2" } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar sesión" }));
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  expect(onSave.mock.calls[0][0][0]).toMatchObject({ movementId: "arranque", sets: 5, reps: 2, pct: 70 });
});

test("quita un ejercicio", () => {
  render(<SessionEditor open week={1} sessionIdx={0} exercises={exs} onClose={() => {}} onSave={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Quitar Arranque" }));
  expect(screen.queryByLabelText("reps de Arranque")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run it — verify it fails** — `pnpm --filter @holy-oly/web test sessionEditor` → FAIL.

- [ ] **Step 3: Implement `SessionEditor.tsx`**

```tsx
import { useState, type CSSProperties } from "react";
import { getMovement, type PrescribedExercise, type PrescribedExerciseView } from "@holy-oly/core";
import { BottomSheet } from "../../../ui/BottomSheet";
import { MovementPicker } from "./MovementPicker";

interface Draft { movementId: string; movementName: string; sets: number; reps: number; pct?: number; kgOverride?: number; rpe?: number; }

const num: CSSProperties = {
  width: 52, boxSizing: "border-box", padding: "6px 8px", borderRadius: 8, textAlign: "center",
  border: "1px solid color-mix(in srgb,var(--wl-text) 16%,transparent)", background: "var(--wl-bg)", color: "var(--wl-text)",
  fontFamily: "var(--wl-display)", fontSize: 14,
};
const mini: CSSProperties = {
  border: 0, background: "transparent", color: "var(--wl-muted)", cursor: "pointer", fontFamily: "var(--mono)", fontSize: 13, padding: 4,
};

function toDraft(id: string): Draft {
  const mv = getMovement(id);
  const usesPct = !!mv && mv.rmRef !== "none";
  return { movementId: id, movementName: mv?.name ?? id, sets: 3, reps: 3, ...(usesPct ? { pct: 70 } : { rpe: 7 }) };
}

export function SessionEditor({ open, week, sessionIdx, exercises, onClose, onSave }: {
  open: boolean; week: number; sessionIdx: number; exercises: PrescribedExerciseView[];
  onClose: () => void; onSave: (exercises: PrescribedExercise[]) => Promise<void> | void;
}) {
  const [rows, setRows] = useState<Draft[]>(() =>
    exercises.map((e) => ({ movementId: e.movementId, movementName: e.movementName, sets: e.sets, reps: e.reps, pct: e.pct, kgOverride: e.kgOverride, rpe: e.rpe })));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patch = (i: number, p: Partial<Draft>): void => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...p } : r)));
  const remove = (i: number): void => setRows((rs) => rs.filter((_, idx) => idx !== i));
  const move = (i: number, d: -1 | 1): void => setRows((rs) => {
    const j = i + d; if (j < 0 || j >= rs.length) return rs;
    const next = [...rs]; [next[i], next[j]] = [next[j]!, next[i]!]; return next;
  });

  async function save(): Promise<void> {
    setBusy(true); setError(null);
    try {
      await onSave(rows.map((r) => ({ movementId: r.movementId, sets: r.sets, reps: r.reps, pct: r.pct, kgOverride: r.kgOverride, rpe: r.rpe })));
      onClose();
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar"); }
    finally { setBusy(false); }
  }

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 18, color: "var(--wl-text)" }}>Sesión · sem {week} · día {sessionIdx + 1}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
        {rows.map((r, i) => (
          <div key={i} style={{ background: "var(--wl-surface)", borderRadius: 10, padding: "8px 10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ flex: 1, fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 14, color: "var(--wl-text)" }}>{r.movementName}</span>
              <button type="button" style={mini} aria-label={`subir ${r.movementName}`} onClick={() => move(i, -1)}>↑</button>
              <button type="button" style={mini} aria-label={`bajar ${r.movementName}`} onClick={() => move(i, 1)}>↓</button>
              <button type="button" style={{ ...mini, color: "#ff5e5e" }} aria-label={`Quitar ${r.movementName}`} onClick={() => remove(i)}>✕</button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)" }}>
              <input style={num} type="number" aria-label={`sets de ${r.movementName}`} value={r.sets} onChange={(e) => patch(i, { sets: Number(e.target.value) })} />×
              <input style={num} type="number" aria-label={`reps de ${r.movementName}`} value={r.reps} onChange={(e) => patch(i, { reps: Number(e.target.value) })} />
              {r.pct != null && <>@<input style={num} type="number" aria-label={`% de ${r.movementName}`} value={r.pct} onChange={(e) => patch(i, { pct: Number(e.target.value) })} />%</>}
              {r.rpe != null && <>RPE<input style={num} type="number" aria-label={`rpe de ${r.movementName}`} value={r.rpe} onChange={(e) => patch(i, { rpe: Number(e.target.value) })} /></>}
              <input style={{ ...num, width: 64 }} type="number" placeholder="kg" aria-label={`kg de ${r.movementName}`} value={r.kgOverride ?? ""} onChange={(e) => patch(i, { kgOverride: e.target.value ? Number(e.target.value) : undefined })} />
            </div>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => setPickerOpen(true)}
        style={{ width: "100%", marginTop: 10, padding: 10, borderRadius: 10, border: "1px dashed color-mix(in srgb,var(--wl-text) 24%,transparent)", background: "transparent", color: "var(--wl-muted)", fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>+ Agregar ejercicio</button>
      {error && <div role="alert" style={{ marginTop: 8, color: "#ff3b46", fontFamily: "var(--mono)", fontSize: 11 }}>{error}</div>}
      <button type="button" disabled={busy} onClick={() => void save()}
        style={{ width: "100%", marginTop: 12, padding: 13, borderRadius: 12, border: 0, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1, background: "var(--wl-accent)", color: "var(--wl-bg)", fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 15 }}>
        {busy ? "Guardando…" : "Guardar sesión"}
      </button>
      <MovementPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onPick={(id) => setRows((rs) => [...rs, toDraft(id)])} />
    </BottomSheet>
  );
}
```

- [ ] **Step 4: Run + commit**

Run: `pnpm --filter @holy-oly/web test sessionEditor && pnpm --filter @holy-oly/web exec tsc --noEmit` → PASS.
```bash
git add apps/web/src/screens/coach/sessions/SessionEditor.tsx apps/web/src/screens/coach/__tests__/sessionEditor.test.tsx
git commit -m "feat(web): SessionEditor (editar ejercicios: esquema/%/kg + agregar/quitar/reordenar)"
```

---

### Task C4: `SessionsSection` in the drill-down

**Files:** Create `apps/web/src/screens/coach/sessions/SessionsSection.tsx`, `apps/web/src/screens/coach/__tests__/sessionsSection.test.tsx`; Modify `apps/web/src/screens/coach/Drilldown.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RepositoryProvider } from "../../../data/RepositoryProvider";
import { LocalRepository } from "../../../data/LocalRepository";
import { MemStorage } from "../../../test-utils/MemStorage";
import { SessionsSection } from "../sessions/SessionsSection";

async function repoWithPlan() {
  const repo = new LocalRepository(new MemStorage());
  await repo.savePlan({ atletaId: "mv", macroId: "ruso-5d", startWeek: 1, startDate: "2026-04-01", rms: { arranque: 80, envion: 100, sentadilla: 140, frente: 110 }, comps: [] });
  return repo;
}

test("muestra las sesiones de la semana con kg derivado", async () => {
  const repo = await repoWithPlan();
  render(<RepositoryProvider repo={repo}><SessionsSection athleteId="mv" hoyWeek={1} totalWeeks={16} /></RepositoryProvider>);
  expect(await screen.findByText(/Arranque/)).toBeInTheDocument();
  expect(screen.getByText(/54 kg/)).toBeInTheDocument(); // 68% of 80
});

test("editar una sesión la persiste y re-renderiza", async () => {
  const repo = await repoWithPlan();
  render(<RepositoryProvider repo={repo}><SessionsSection athleteId="mv" hoyWeek={1} totalWeeks={16} /></RepositoryProvider>);
  await screen.findByText(/Arranque/);
  fireEvent.click(screen.getAllByRole("button", { name: /editar sesión/i })[0]!);
  fireEvent.click(screen.getByRole("button", { name: "Guardar sesión" }));
  await waitFor(() => expect(screen.getByText(/Arranque/)).toBeInTheDocument());
});
```

- [ ] **Step 2: Run it — verify it fails** — `pnpm --filter @holy-oly/web test sessionsSection` → FAIL.

- [ ] **Step 3: Implement `SessionsSection.tsx`**

```tsx
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import type { PrescribedExercise, SessionView } from "@holy-oly/core";
import { useRepository } from "../../../data/RepositoryProvider";
import { SessionEditor } from "./SessionEditor";

const sec: CSSProperties = { fontFamily: "var(--wl-display)", fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--wl-muted)", margin: "22px 0 10px" };
const card: CSSProperties = { background: "var(--wl-surface)", borderRadius: "var(--wl-radius)", padding: "10px 12px", marginTop: 8 };

function load(targetKg: number | undefined, rpe: number | undefined): string {
  return targetKg != null ? `${targetKg} kg` : rpe != null ? `RPE ${rpe}` : "—";
}

export function SessionsSection({ athleteId, hoyWeek, totalWeeks }: { athleteId: string; hoyWeek: number; totalWeeks: number }) {
  const repo = useRepository();
  const [week, setWeek] = useState(Math.min(Math.max(hoyWeek, 1), totalWeeks));
  const [sessions, setSessions] = useState<SessionView[] | null>(null);
  const [editing, setEditing] = useState<SessionView | null>(null);

  const refresh = useCallback(() => { repo.getPrescriptionWeek(athleteId, week).then(setSessions).catch(() => setSessions([])); }, [repo, athleteId, week]);
  useEffect(() => { setSessions(null); refresh(); }, [refresh]);

  const onSave = useCallback(async (exercises: PrescribedExercise[]) => {
    if (!editing) return;
    await repo.setSession(athleteId, editing.week, editing.sessionIdx, exercises);
    setEditing(null);
    refresh();
  }, [repo, athleteId, editing, refresh]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={sec}>Sesiones</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)" }}>
          <button type="button" aria-label="semana anterior" onClick={() => setWeek((w) => Math.max(1, w - 1))} style={{ border: 0, background: "transparent", color: "var(--wl-text)", cursor: "pointer", fontSize: 16 }}>‹</button>
          Sem {week}
          <button type="button" aria-label="semana siguiente" onClick={() => setWeek((w) => Math.min(totalWeeks, w + 1))} style={{ border: 0, background: "transparent", color: "var(--wl-text)", cursor: "pointer", fontSize: 16 }}>›</button>
        </div>
      </div>
      {sessions === null ? (
        <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)" }}>Cargando…</div>
      ) : sessions.length === 0 ? (
        <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)" }}>Sin sesiones para esta semana (asigná un macro con receta o armalas a mano).</div>
      ) : (
        sessions.map((s) => (
          <div key={s.sessionIdx} style={card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 13, color: "var(--wl-text)" }}>Día {s.sessionIdx + 1}</span>
              <button type="button" aria-label={`editar sesión día ${s.sessionIdx + 1}`} onClick={() => setEditing(s)} style={{ border: 0, background: "transparent", color: "var(--wl-accent)", cursor: "pointer", fontFamily: "var(--mono)", fontSize: 11 }}>editar ›</button>
            </div>
            {s.exercises.map((e, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)", marginTop: 4 }}>
                <span style={{ color: "var(--wl-text)" }}>{e.movementName}</span>
                <span>{e.sets}×{e.reps} · {load(e.targetKg, e.rpe)}</span>
              </div>
            ))}
          </div>
        ))
      )}
      {editing && (
        <SessionEditor open week={editing.week} sessionIdx={editing.sessionIdx} exercises={editing.exercises} onClose={() => setEditing(null)} onSave={onSave} />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Wire into `Drilldown.tsx`** — import `SessionsSection` and render it after the `SessionAdherence`/Palmarés area (it already computes `hoyWeek` and `maxWeek`):
```tsx
import { SessionsSection } from "./sessions/SessionsSection";
// …in the JSX, after the existing sessions/adherence block:
<SessionsSection athleteId={athlete.id} hoyWeek={hoyWeek} totalWeeks={maxWeek} />
```

- [ ] **Step 5: Run + full web check + commit**

Run: `pnpm --filter @holy-oly/web test sessionsSection && pnpm --filter @holy-oly/web test && pnpm --filter @holy-oly/web exec tsc --noEmit && pnpm --filter @holy-oly/web exec eslint src && pnpm --filter @holy-oly/web build`
Expected: all green.
```bash
git add apps/web/src/screens/coach/sessions/SessionsSection.tsx apps/web/src/screens/coach/__tests__/sessionsSection.test.tsx apps/web/src/screens/coach/Drilldown.tsx
git commit -m "feat(web): sección de sesiones en el drill-down (ver + editar prescripción)"
```

---

## Phase D — Verify · El Carnicero · Deploy

### Task D1: Full local verification (no-Docker)

- [ ] **Step 1: Whole suite + the embedded-Postgres integration + e2e** — run, in order (all must pass):
```bash
pnpm --filter @holy-oly/core test
pnpm --filter @holy-oly/web test
pnpm --filter @holy-oly/api test
pnpm --filter @holy-oly/api verify   # embedded PG: migrates 0_init…5_prescription, seeds, runs *.int.test
pnpm --filter @holy-oly/api e2e       # HttpRepository ↔ Fastify ↔ embedded PG
pnpm --filter @holy-oly/core exec tsc --noEmit
pnpm --filter @holy-oly/api exec tsc --noEmit
pnpm --filter @holy-oly/web exec tsc --noEmit
pnpm --filter @holy-oly/web exec eslint src
pnpm --filter @holy-oly/web build
```
Expected: green throughout. `verify` proves migration `5_prescription` applies to a clean DB and the prescription endpoints work end-to-end.

- [ ] **Step 2: Sanity-check the real prod bundle** (tests use `tsx`, which would mask a bundling break):
```bash
pnpm --filter @holy-oly/api build && node -e "require('./apps/api/dist/main.js')" 2>&1 | Select-String -Pattern "ERR_UNKNOWN_FILE_EXTENSION" -Quiet
```
> **CRITICAL:** `tsup` must bundle `@holy-oly/core` (`noExternal` in `apps/api/tsup.config.ts`). The new `recipes`/`prescription` exports ride the same barrel; if the bundle throws `ERR_UNKNOWN_FILE_EXTENSION`, core leaked as external — fix `noExternal` before deploying (this broke the first deploy historically). Commit any lint/format fixups.

---

### Task D2: El Carnicero domain review (advisory)

> `subagent_type: el-carnicero` does **not** resolve on this machine. Dispatch a **general-purpose** agent carrying the persona + rulebook.

- [ ] **Step 1: Dispatch the review** — `Agent(subagent_type: "general-purpose")` with a prompt that:
  1. Reads `.claude/agents/el-carnicero.md` (persona) and `docs/domain/HOLY-OLY-DOMAIN.md` (rulebook).
  2. Reviews the SP2 diff: `packages/core/src/{data/recipes.ts,logic/prescription.ts}` and `apps/web/src/screens/coach/sessions/*`.
  3. Checks specifically:
     - **HR-1** — the athlete never sees the prescription as gameable numbers; confirm every prescription write is behind `guardAthlete` (coach-only) and the athlete `/me/*` surface has no writer.
     - **kg = truth** — derived kg rounded to 1 kg; the editor shows kg, not plates (discs are a downstream approximation, untouched).
     - **Ruso 5D realism** — per-phase %s sit inside each phase's IMR corridor; pulls 90–110% of their lift; squats relative to their own RM; the jerk is `envion.tijera`, never a bare `envion`.
     - **Substitution direction** — `simplerVariants`/`substitutesOf` offer regressions/alternatives, never the full competition lift as a "substitute".
     - **Sin-dato honesty** — no plan / no recipe → "Sin sesiones", never zeros or fabricated kg.
  4. Returns findings as CRITICAL / HIGH / coach-decision with `file:line`.

- [ ] **Step 2: Triage + fix** — El Carnicero is advisory, not infallible: verify each finding against the rulebook before acting. Fix CRITICAL/HIGH; record coach-decisions in the spec's notes. Re-run affected tests. Commit:
```bash
git commit -am "fix(sp2): correcciones de dominio El Carnicero"
```

> **Deferred to SP3 (documented, not built here):** the `SessionActual` model ("lo que levanté") is *designed* in the spec but intentionally **not** added to Prisma in SP2 — an unused table is dead schema. SP3 (athlete execution + actuals) creates it (next migration `6_session_actual`). SP2 ships the prescription contract the athlete will read against.

---

### Task D3: Deploy to production (Render auto-deploy)

> Established workflow. The Render API key is at `C:\Users\Gamer\Videos\.render-key.txt` — read it **without printing it**; rotate/delete when done. Service `srv-d8etrvvavr4c73954o4g`. The repo `esstipi-debug/holy-oly-app` is public → a push to `main` triggers auto-deploy. Migration `5_prescription` runs via `start:prod` (`prisma migrate deploy`) against Render Postgres (UTF8).

- [ ] **Step 1: Fast-forward `main` to the verified branch HEAD and push** (only after D1/D2 green). FF-merge `claude/quizzical-cori-663e55` → `main`, `git push origin main`.

- [ ] **Step 2: Poll the deploy** — `GET https://api.render.com/v1/services/srv-d8etrvvavr4c73954o4g/deploys?limit=1` (Bearer = key file) until `status: live` for the pushed commit (free tier: build + `migrate deploy` + cold-start ≈ a few minutes).

- [ ] **Step 3: Live smoke** — against `https://holy-oly.onrender.com`:
  - `GET /health` → 200.
  - `POST /auth/login` (coach demo `coach@holyoly.dev` / `holyoly-demo`) → 200 + session cookie.
  - `PUT /athletes/mv/plan` (assign `ruso-5d` with RMs) → 200, then `GET /athletes/mv/prescription?week=1` → 5 sessions, `arranque` first, `targetKg` derived.
  - Optional UI pass (Playwright MCP): open Mara's drill-down → "Sesiones" shows the week → "editar" opens the editor → save persists.

- [ ] **Step 4: Update memory** — append SP2-shipped status to `athlete-app-and-execution-pillar.md` + the `MEMORY.md` pointer (recipe in `core/data/recipes.ts`; prescription endpoints; editor in the drill-down; `SessionActual` deferred to SP3).

---

## Notes / decisions locked by this plan

- **Hybrid model:** the macro carries a per-phase weekly recipe (`MACRO_RECIPES`); assigning instantiates the athlete's editable rows. Only Ruso 5D ships a recipe; other macros instantiate empty (coach builds by hand) — no crash, `getPrescriptionWeek` returns `[]`.
- **Coach edits anytime, no lock:** `setSession` replaces a session unconditionally (the athlete may have "finished" it; the coach corrects afterward — SP3 actuals are separate rows, untouched).
- **Athlete read-only on the prescription:** every prescription write is behind `guardAthlete` (coach session + active Vínculo). The athlete's `/me/*` (A1) never exposes a prescription writer.
- **kg = `kgOverride ?? round(pct/100 × RM)`**; accessories (`rmRef: "none"`) derive nothing → show RPE/kg. Rounded to 1 kg (discs downstream, unchanged).
- **Re-assign reinstantiates** (`savePlan` → `instantiateForPlan` replaces all rows) — a documented overwrite of prior edits, acceptable because re-assigning a macro is a deliberate reset.
