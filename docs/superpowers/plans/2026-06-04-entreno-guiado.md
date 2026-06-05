# Entreno guiado — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir el "Entreno" del atleta de lista plana a un reproductor guiado con calentamiento automático y registro por serie.

**Architecture:** La lógica de dominio (calentamiento, resumen de series) vive en `packages/core` (pura, testeable, corre en server y cliente). El calentamiento se computa server-side en `buildSessionViews` (tiene el RM) y viaja adjunto a la vista — el atleta nunca maneja el RM. El registro por serie agrega un array `sets` a `SessionActual` (1 fila por ejercicio intacta; merge posicional intacto); el resumen por ejercicio (top set) se deriva para coach/charts. El reproductor (web) se parte en componentes chicos (`ResumenDia`, `SessionPlayer`, `WarmupSection`, `WorkSetsSection`).

**Tech Stack:** TypeScript estricto · React 18 + Vite · Vitest + @testing-library/react · Fastify 5 + Prisma 6 + Postgres · Zod · monorepo pnpm.

**Spec:** `docs/superpowers/specs/2026-06-04-entreno-guiado-design.md`

**Convenciones (no negociables):**
- Discos SÓLO vía `apps/web/src/ui/Disc.tsx` (`DiscRow`) — nunca redibujar.
- kg = verdad; toda fila muestra kg + discos. Sin RPE. "N series × M repeticiones" explícito. Adherencia por defecto.
- Commits en español, conventional, **sin** `Co-Authored-By` (deshabilitado global).
- Migraciones: `scripts/make-migration.ts` (NUNCA `prisma migrate dev`).
- Correr `pnpm` SÓLO en este worktree (tiene `node_modules`).

---

## Fase 1 — Calentamiento (core)

### Task 1.1: `warmupSets` (primitivo de rampa)

**Files:**
- Create: `packages/core/src/logic/warmup.ts`
- Test: `packages/core/src/logic/warmup.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/logic/warmup.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { warmupSets } from "./warmup";

describe("warmupSets", () => {
  it("día liviano · Arranque @62% (1er mov) · rm 92 · barra 15", () => {
    expect(warmupSets(62, 92, 15, true)).toEqual([
      { pct: 0, kg: 15, reps: 5, label: "barra" },
      { pct: 31, kg: 29, reps: 5, label: "rampa" },
      { pct: 43, kg: 40, reps: 3, label: "rampa" },
      { pct: 53, kg: 48, reps: 2, label: "rampa" },
    ]);
  });
  it("día medio · Envión @78% (no 1er mov) · rm 116 · sin barra", () => {
    expect(warmupSets(78, 116, 15, false)).toEqual([
      { pct: 39, kg: 45, reps: 5, label: "rampa" },
      { pct: 55, kg: 63, reps: 3, label: "rampa" },
      { pct: 66, kg: 77, reps: 2, label: "rampa" },
    ]);
  });
  it("día pesado · Sentadilla @90% (1er mov) · rm 150 · incluye single de aproximación", () => {
    expect(warmupSets(90, 150, 15, true)).toEqual([
      { pct: 0, kg: 15, reps: 5, label: "barra" },
      { pct: 45, kg: 68, reps: 5, label: "rampa" },
      { pct: 63, kg: 95, reps: 3, label: "rampa" },
      { pct: 77, kg: 115, reps: 2, label: "rampa" },
      { pct: 84, kg: 126, reps: 1, label: "rampa" },
    ]);
  });
  it("sin-dato → [] (workingPct<=0, rm<=0)", () => {
    expect(warmupSets(0, 100, 20, true)).toEqual([]);
    expect(warmupSets(80, 0, 20, true)).toEqual([]);
  });
  it("día muy liviano (<=55%) → un solo set de aproximación", () => {
    expect(warmupSets(50, 100, 20, false)).toEqual([
      { pct: 38, kg: 38, reps: 3, label: "rampa" },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @holy-oly/core exec vitest run src/logic/warmup.test.ts`
Expected: FAIL — `Failed to resolve import "./warmup"` / `warmupSets is not a function`.

- [ ] **Step 3: Write minimal implementation**

Create `packages/core/src/logic/warmup.ts`:

```ts
import type { RM, WarmupSet } from "../types";
import { getMovement, getBase } from "./movements";

const FRACTIONS: ReadonlyArray<{ f: number; reps: number; minW?: number }> = [
  { f: 0.50, reps: 5 },
  { f: 0.70, reps: 3 },
  { f: 0.85, reps: 2 },
  { f: 0.93, reps: 1, minW: 85 }, // single de aproximación SÓLO en días pesados (W>=85)
];

/** Un set de rampa = fracción `f` del peso de trabajo (`f·W`). kg usa el pct sin redondear. */
function rampSet(f: number, reps: number, workingPct: number, rm: number): WarmupSet {
  const pct = f * workingPct;
  return { pct: Math.round(pct), kg: Math.round((pct / 100) * rm), reps, label: "rampa" };
}

/** Cada set < trabajo; sin kg duplicados (queda el de más reps); sin sets sub-barra. La barra pasa siempre. */
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

/** Rampa de calentamiento. Sets como fracción del peso de trabajo W (= workingPct), no %s fijos del RM.
 *  Barra vacía SÓLO en el 1er movimiento. Sin-dato → []. kg = round(pct/100·RM). */
export function warmupSets(workingPct: number, rm: number, barKg: number, isFirstMovement: boolean): WarmupSet[] {
  if (!Number.isFinite(workingPct) || !Number.isFinite(rm) || rm <= 0 || workingPct <= 0) return [];
  const workingKg = Math.round((workingPct / 100) * rm);
  const out: WarmupSet[] = [];
  if (isFirstMovement) out.push({ pct: 0, kg: barKg, reps: 5, label: "barra" });
  if (workingPct <= 55) {
    out.push(rampSet(0.75, 3, workingPct, rm));
    return dedupeAndGuard(out, workingKg, barKg);
  }
  for (const { f, reps, minW } of FRACTIONS) {
    if (minW != null && workingPct < minW) continue;
    out.push(rampSet(f, reps, workingPct, rm));
  }
  return dedupeAndGuard(out, workingKg, barKg);
}

export { rampSet, dedupeAndGuard, FRACTIONS };
```

> Note: `WarmupSet` y la firma de `warmupForExercise` se agregan en las tasks 1.2/1.3. `getMovement`/`getBase` ya se importan acá para la 1.2.

- [ ] **Step 4: Add the `WarmupSet` type so the import resolves**

Modify `packages/core/src/types/index.ts` — agregar al final del archivo:

```ts
/** Un set de calentamiento (se muestra, NO cuenta). `label:"barra"` = barra vacía del 1er movimiento. */
export interface WarmupSet { pct: number; kg: number; reps: number; label: "barra" | "rampa"; }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @holy-oly/core exec vitest run src/logic/warmup.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @holy-oly/core exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/logic/warmup.ts packages/core/src/logic/warmup.test.ts packages/core/src/types/index.ts
git commit -m "feat(core): warmupSets — rampa de calentamiento por fraccion del peso de trabajo"
```

---

### Task 1.2: `warmupForExercise` (orquestador)

**Files:**
- Modify: `packages/core/src/logic/warmup.ts`
- Test: `packages/core/src/logic/warmup.test.ts`

- [ ] **Step 1: Write the failing test** — agregar a `warmup.test.ts`:

```ts
import { warmupForExercise } from "./warmup";

const RMS = { arranque: 92, envion: 116, sentadilla: 150, frente: 130 };

describe("warmupForExercise", () => {
  it("lift principal 1er mov → rampa completa con barra", () => {
    const w = warmupForExercise({ movementId: "arranque", pct: 62, order: 0 }, RMS, 15);
    expect(w[0]).toEqual({ pct: 0, kg: 15, reps: 5, label: "barra" });
    expect(w.length).toBe(4);
  });
  it("accesorio (baseComplexity<=3) no-1er-mov → 1 feeler 0.6·W×5", () => {
    // press-empuje rmRef envion(116), @70% → 0.6·70=42% → round(0.42·116)=49
    const w = warmupForExercise({ movementId: "press-empuje", pct: 70, order: 2 }, RMS, 15);
    expect(w).toEqual([{ pct: 42, kg: 49, reps: 5, label: "rampa" }]);
  });
  it("OHS no-1er-mov → 2 feelers (0.5·W×5, 0.7·W×3)", () => {
    // sentadilla-overhead rmRef arranque(92), @80% → 0.5·80=40%→round(0.40·92)=37 ; 0.7·80=56%→round(0.56·92)=52
    const w = warmupForExercise({ movementId: "sentadilla-overhead", pct: 80, order: 3 }, RMS, 15);
    expect(w).toEqual([
      { pct: 40, kg: 37, reps: 5, label: "rampa" },
      { pct: 56, kg: 52, reps: 3, label: "rampa" },
    ]);
  });
  it("tirón no-1er-mov → rampa completa SIN barra", () => {
    // tiron-arranque rmRef arranque(92) @100% → ramp, no barra
    const w = warmupForExercise({ movementId: "tiron-arranque", pct: 100, order: 1 }, RMS, 15);
    expect(w.some((s) => s.label === "barra")).toBe(false);
    expect(w.length).toBeGreaterThanOrEqual(3);
  });
  it("sin-dato → [] (sin pct)", () => {
    expect(warmupForExercise({ movementId: "arranque", pct: undefined, order: 0 }, RMS, 15)).toEqual([]);
  });
  it("movimiento desconocido → []", () => {
    expect(warmupForExercise({ movementId: "no-existe", pct: 80, order: 0 }, RMS, 15)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @holy-oly/core exec vitest run src/logic/warmup.test.ts`
Expected: FAIL — `warmupForExercise is not a function`.

- [ ] **Step 3: Write minimal implementation** — agregar a `packages/core/src/logic/warmup.ts`:

```ts
/** Decide la forma del calentamiento por ejercicio:
 *  - OHS no-primero → 2 feelers (movilidad overhead)
 *  - accesorio (baseComplexity<=3) no-primero → 1 feeler (ya está caliente)
 *  - resto (lifts, sentadillas, tirones, y cualquiera cuando es el 1er mov) → rampa completa
 *  Sin movimiento / rmRef "none" / sin pct / RM<=0 → []. `order===0` = 1er movimiento. */
export function warmupForExercise(
  args: { movementId: string; pct?: number; order: number },
  rms: RM, barKg: number,
): WarmupSet[] {
  const mv = getMovement(args.movementId);
  if (!mv || mv.rmRef === "none" || args.pct == null) return [];
  const rm = rms[mv.rmRef];
  if (!Number.isFinite(rm) || rm <= 0) return [];
  const W = args.pct;
  const isFirst = args.order === 0;
  const workingKg = Math.round((W / 100) * rm);
  const base = getBase(mv.baseId);

  if (!isFirst && mv.baseId === "sentadilla-overhead") {
    return dedupeAndGuard([rampSet(0.5, 5, W, rm), rampSet(0.7, 3, W, rm)], workingKg, barKg);
  }
  if (!isFirst && base != null && base.baseComplexity <= 3) {
    return dedupeAndGuard([rampSet(0.6, 5, W, rm)], workingKg, barKg);
  }
  return warmupSets(W, rm, barKg, isFirst);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @holy-oly/core exec vitest run src/logic/warmup.test.ts`
Expected: PASS (todos).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/logic/warmup.ts packages/core/src/logic/warmup.test.ts
git commit -m "feat(core): warmupForExercise — orquestador (accesorio/OHS/tiron/sin-dato)"
```

---

### Task 1.3: Exponer warmup + campo `warmup` en la vista + schema

**Files:**
- Modify: `packages/core/src/index.ts`
- Modify: `packages/core/src/types/index.ts:211` (`PrescribedExerciseView`)
- Modify: `packages/core/src/schemas.ts:211` (`PrescribedExerciseViewSchema`)
- Test: `packages/core/src/schemas.test.ts` (puede existir; si no, crear)

- [ ] **Step 1: Export warmup logic** — agregar a `packages/core/src/index.ts` (al final):

```ts
export * from "./logic/warmup";
```

- [ ] **Step 2: Add `warmup` to the view type** — en `packages/core/src/types/index.ts`, modificar `PrescribedExerciseView` (línea ~211):

```ts
/** A prescribed exercise with its display name + derived target kg, for the front. */
export interface PrescribedExerciseView extends PrescribedExercise { movementName: string; targetKg?: number; actual?: ExerciseActual; warmup?: WarmupSet[] }
```

> `warmup` es opcional en el tipo (evita romper fixtures existentes) pero `buildSessionViews` lo setea siempre (Task 1.4) y el schema lo defaultea a `[]`.

- [ ] **Step 3: Write the failing schema test** — crear/agregar `packages/core/src/schemas.warmup.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { PrescribedExerciseViewSchema } from "./schemas";

describe("PrescribedExerciseViewSchema · warmup", () => {
  it("acepta y conserva warmup", () => {
    const v = PrescribedExerciseViewSchema.parse({
      movementId: "arranque", sets: 5, reps: 2, pct: 80, movementName: "Arranque", targetKg: 64,
      warmup: [{ pct: 0, kg: 15, reps: 5, label: "barra" }],
    });
    expect(v.warmup).toHaveLength(1);
  });
  it("defaultea warmup a [] cuando falta", () => {
    const v = PrescribedExerciseViewSchema.parse({ movementId: "arranque", sets: 5, reps: 2, movementName: "Arranque" });
    expect(v.warmup).toEqual([]);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm --filter @holy-oly/core exec vitest run src/schemas.warmup.test.ts`
Expected: FAIL — `warmup` no existe en el schema (segundo test devuelve `undefined`).

- [ ] **Step 5: Add the schema** — en `packages/core/src/schemas.ts`, justo antes de `PrescribedExerciseViewSchema` (línea ~211):

```ts
export const WarmupSetSchema = z.object({
  pct: z.number(),
  kg: z.number(),
  reps: z.number().int(),
  label: z.enum(["barra", "rampa"]),
});
```

Y modificar `PrescribedExerciseViewSchema`:

```ts
export const PrescribedExerciseViewSchema = PrescribedExerciseSchema.extend({
  movementName: z.string(),
  targetKg: z.number().optional(),
  actual: ExerciseActualSchema.optional(),
  warmup: z.array(WarmupSetSchema).max(8).default([]),
});
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm --filter @holy-oly/core exec vitest run src/schemas.warmup.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/index.ts packages/core/src/types/index.ts packages/core/src/schemas.ts packages/core/src/schemas.warmup.test.ts
git commit -m "feat(core): campo warmup en la vista de ejercicio + WarmupSetSchema (default [])"
```

---

### Task 1.4: `buildSessionViews` adjunta el warmup (param `barKg`)

**Files:**
- Modify: `packages/core/src/logic/prescription.ts:39` (`buildSessionViews`)
- Test: `packages/core/src/logic/prescription.warmup.test.ts`

- [ ] **Step 1: Write the failing test** — crear `packages/core/src/logic/prescription.warmup.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { PrescriptionRow, RM } from "../types";
import { buildSessionViews } from "./prescription";

const RMS: RM = { arranque: 92, envion: 116, sentadilla: 150, frente: 130 };

describe("buildSessionViews · warmup", () => {
  it("adjunta el warmup del 1er movimiento (con barra) usando barKg", () => {
    const rows: PrescriptionRow[] = [
      { week: 1, sessionIdx: 0, order: 0, movementId: "arranque", sets: 5, reps: 2, pct: 62 },
    ];
    const v = buildSessionViews(rows, RMS, 15)[0]!.exercises[0]!;
    expect(v.warmup![0]).toEqual({ pct: 0, kg: 15, reps: 5, label: "barra" });
  });
  it("ejercicio sin pct → warmup []", () => {
    const rows: PrescriptionRow[] = [
      { week: 1, sessionIdx: 0, order: 0, movementId: "sentadilla", sets: 5, reps: 5, kgOverride: 100 },
    ];
    const v = buildSessionViews(rows, RMS, 20)[0]!.exercises[0]!;
    expect(v.warmup).toEqual([]);
  });
  it("barKg default 20 cuando no se pasa", () => {
    const rows: PrescriptionRow[] = [
      { week: 1, sessionIdx: 0, order: 0, movementId: "arranque", sets: 5, reps: 2, pct: 62 },
    ];
    const v = buildSessionViews(rows, RMS)[0]!.exercises[0]!;
    expect(v.warmup![0]!.kg).toBe(20);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @holy-oly/core exec vitest run src/logic/prescription.warmup.test.ts`
Expected: FAIL — `buildSessionViews` no acepta `barKg` / `v.warmup` es `undefined`.

- [ ] **Step 3: Implement** — en `packages/core/src/logic/prescription.ts`:

Agregar el import arriba:

```ts
import { warmupForExercise } from "./warmup";
```

Reemplazar `buildSessionViews` (líneas 39-60):

```ts
/** Group a set of prescription rows (typically one week) into per-session views with name + derived kg
 *  + the calentamiento (rampa) of each exercise. `barKg` = barra del atleta (20 ♂ / 15 ♀). */
export function buildSessionViews(rows: PrescriptionRow[], rms: RM, barKg = 20): SessionView[] {
  const byIdx = new Map<number, PrescriptionRow[]>();
  for (const r of rows) {
    if (!byIdx.has(r.sessionIdx)) byIdx.set(r.sessionIdx, []);
    byIdx.get(r.sessionIdx)!.push(r);
  }
  const views: SessionView[] = [];
  for (const [sessionIdx, sRows] of [...byIdx.entries()].sort((a, b) => a[0] - b[0])) {
    const ordered = [...sRows].sort((a, b) => a.order - b.order);
    views.push({
      week: ordered[0]!.week,
      sessionIdx,
      exercises: ordered.map((r, i) => ({
        movementId: r.movementId, sets: r.sets, reps: r.reps, pct: r.pct, kgOverride: r.kgOverride,
        flags: r.flags, notes: r.notes,
        movementName: getMovement(r.movementId)?.name ?? r.movementId,
        targetKg: resolveTargetKg(r, rms),
        warmup: warmupForExercise({ movementId: r.movementId, pct: r.pct, order: i }, rms, barKg),
      })),
    });
  }
  return views;
}
```

> Usa el índice del array ordenado (`i`) como `order` (la vista es contigua desde 0). Si la prescripción usa `kgOverride` sin `pct`, `warmupForExercise` devuelve `[]` (sin-dato).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @holy-oly/core exec vitest run src/logic/prescription.warmup.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the full core suite (no regressions)**

Run: `pnpm --filter @holy-oly/core test`
Expected: PASS (todo el core, incluidos los tests previos de prescription/actuals).

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @holy-oly/core exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/logic/prescription.ts packages/core/src/logic/prescription.warmup.test.ts
git commit -m "feat(core): buildSessionViews adjunta el calentamiento por ejercicio (param barKg)"
```

---

## Fase 2 — Registro por serie (core + api)

### Task 2.1: `SetActual` + `summarizeSets` (resumen = top set)

**Files:**
- Modify: `packages/core/src/types/index.ts` (`SetActual`, `SessionActual`, `ExerciseActual`)
- Modify: `packages/core/src/logic/actuals.ts` (`summarizeSets`)
- Test: `packages/core/src/logic/actuals.test.ts`

- [ ] **Step 1: Write the failing test** — agregar a `packages/core/src/logic/actuals.test.ts`:

```ts
import { summarizeSets } from "./actuals";
import type { SetActual } from "../types";

describe("summarizeSets", () => {
  it("resumen = top set (máximo kg hecho)", () => {
    const sets: SetActual[] = [
      { kg: 90, reps: 2, done: true }, { kg: 90, reps: 2, done: true }, { kg: 85, reps: 2, done: true },
    ];
    expect(summarizeSets(sets)).toEqual({ done: true, kg: 90, reps: 2 });
  });
  it("ninguna serie hecha → done:false sin kg", () => {
    expect(summarizeSets([{ kg: 90, reps: 2, done: false }])).toEqual({ done: false });
  });
  it("series hechas sin kg (sustituido) → done:true, kg undefined", () => {
    expect(summarizeSets([{ reps: 3, done: true }])).toEqual({ done: true, kg: undefined, reps: 3 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @holy-oly/core exec vitest run src/logic/actuals.test.ts`
Expected: FAIL — `summarizeSets is not a function` / `SetActual` no existe.

- [ ] **Step 3: Add the types** — en `packages/core/src/types/index.ts`, en la sección "SP3 actuals" (~línea 215):

```ts
/** Una serie de trabajo registrada (Opción B: registro por serie). */
export interface SetActual { kg?: number; reps?: number; done: boolean; }
```

Modificar `SessionActual` (agregar `sets?`):

```ts
export interface SessionActual {
  week: number; sessionIdx: number; order: number; movementId: string;
  prescribedMovementId?: string;
  done: boolean; actualKg?: number; actualReps?: number; note?: string; doneAt?: string;
  /** Detalle por serie (Opción B). El resumen (actualKg/actualReps/done) se deriva del top set. */
  sets?: SetActual[];
}
```

Modificar `ExerciseActual` (agregar `sets?`):

```ts
export interface ExerciseActual {
  done: boolean; kg?: number; reps?: number; note?: string;
  movementId: string;
  movementName: string;
  substituted: boolean;
  desfasado: boolean;
  /** Series registradas (Opción B), para el reproductor del atleta al reabrir. */
  sets?: SetActual[];
}
```

- [ ] **Step 4: Implement `summarizeSets`** — en `packages/core/src/logic/actuals.ts`, agregar al final + actualizar el import de tipos:

```ts
import type { ExerciseActual, SessionActual, SessionView, SetActual } from "../types";
```

```ts
/** Resumen por ejercicio a partir de las series (para coach/charts). Top set = máximo kg hecho. */
export function summarizeSets(sets: SetActual[]): { done: boolean; kg?: number; reps?: number } {
  const done = sets.filter((s) => s.done);
  if (done.length === 0) return { done: false };
  const top = done.reduce((a, b) => ((b.kg ?? -Infinity) > (a.kg ?? -Infinity) ? b : a));
  return { done: true, kg: top.kg, reps: top.reps };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @holy-oly/core exec vitest run src/logic/actuals.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/types/index.ts packages/core/src/logic/actuals.ts packages/core/src/logic/actuals.test.ts
git commit -m "feat(core): SetActual + summarizeSets (resumen por ejercicio = top set)"
```

---

### Task 2.2: Schemas wire para `sets`

**Files:**
- Modify: `packages/core/src/schemas.ts` (`SetActualInputSchema`, `ExerciseActualInputSchema`, `ExerciseActualSchema`)
- Test: `packages/core/src/schemas.actuals.test.ts` (existe; agregar)

- [ ] **Step 1: Write the failing test** — agregar a `packages/core/src/schemas.actuals.test.ts`:

```ts
import { ExerciseActualInputSchema } from "./schemas";

describe("ExerciseActualInputSchema · sets", () => {
  it("acepta sets acotados", () => {
    const r = ExerciseActualInputSchema.parse({
      order: 0, movementId: "arranque", done: true,
      sets: [{ kg: 90, reps: 2, done: true }, { reps: 0, done: false }],
    });
    expect(r.sets).toHaveLength(2);
  });
  it("rechaza más de 20 series", () => {
    const many = Array.from({ length: 21 }, () => ({ kg: 50, reps: 1, done: true }));
    expect(ExerciseActualInputSchema.safeParse({ order: 0, movementId: "x", done: true, sets: many }).success).toBe(false);
  });
});
```

> Si `schemas.actuals.test.ts` no tiene los imports `describe/it/expect`, agregarlos arriba: `import { describe, it, expect } from "vitest";`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @holy-oly/core exec vitest run src/schemas.actuals.test.ts`
Expected: FAIL — `sets` no está en el schema (se descarta, `r.sets` es `undefined`).

- [ ] **Step 3: Implement** — en `packages/core/src/schemas.ts`, en la sección "SP3 actuals wire shapes" (~línea 185), agregar antes de `ExerciseActualInputSchema`:

```ts
export const SetActualInputSchema = z.object({
  kg: KgSchema.optional(),
  reps: z.number().int().min(0).max(100).optional(),
  done: z.boolean(),
});
export const SetActualsSchema = z.array(SetActualInputSchema).max(20);
```

Modificar `ExerciseActualInputSchema` (agregar `sets`):

```ts
export const ExerciseActualInputSchema = z.object({
  order: z.number().int().min(0).max(20),
  movementId: z.string().min(1).max(60),
  prescribedMovementId: z.string().min(1).max(60).optional(),
  done: z.boolean(),
  kg: KgSchema.optional(),
  reps: z.number().int().min(0).max(100).optional(),
  note: z.string().max(200).optional(),
  sets: SetActualsSchema.optional(),
});
```

Modificar `ExerciseActualSchema` (read-side, agregar `sets`):

```ts
export const ExerciseActualSchema = z.object({
  done: z.boolean(),
  kg: z.number().optional(),
  reps: z.number().optional(),
  note: z.string().optional(),
  movementId: z.string(),
  movementName: z.string(),
  substituted: z.boolean(),
  desfasado: z.boolean(),
  sets: SetActualsSchema.optional(),
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @holy-oly/core exec vitest run src/schemas.actuals.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/schemas.ts packages/core/src/schemas.actuals.test.ts
git commit -m "feat(core): schemas wire de sets (SetActualInput + sets en input/read)"
```

---

### Task 2.3: `mergeActuals` adjunta `sets`

**Files:**
- Modify: `packages/core/src/logic/actuals.ts:13` (objeto `ExerciseActual` en `mergeActuals`)
- Test: `packages/core/src/logic/actuals.test.ts`

- [ ] **Step 1: Write the failing test** — agregar a `actuals.test.ts` (dentro de `describe("mergeActuals", ...)`):

```ts
it("adjunta las series (sets) del row al actual mergeado", () => {
  const r: SessionActual[] = [{
    week: 1, sessionIdx: 0, order: 0, movementId: "arranque", done: true, actualKg: 64,
    sets: [{ kg: 64, reps: 2, done: true }, { kg: 60, reps: 2, done: true }],
  }];
  const a = mergeActuals(views, r)[0]!.exercises[0]!.actual!;
  expect(a.sets).toHaveLength(2);
  expect(a.sets![1]).toEqual({ kg: 60, reps: 2, done: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @holy-oly/core exec vitest run src/logic/actuals.test.ts`
Expected: FAIL — `a.sets` es `undefined`.

- [ ] **Step 3: Implement** — en `packages/core/src/logic/actuals.ts`, modificar el objeto `actual` dentro de `mergeActuals` (agregar `sets`):

```ts
      const actual: ExerciseActual = {
        done: a.done, kg: a.actualKg, reps: a.actualReps, note: a.note,
        movementId: a.movementId,
        movementName: getMovement(a.movementId)?.name ?? a.movementId,
        substituted: a.movementId !== prescribed,
        desfasado: a.prescribedMovementId != null && a.prescribedMovementId !== e.movementId,
        sets: a.sets,
      };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @holy-oly/core exec vitest run src/logic/actuals.test.ts`
Expected: PASS.

- [ ] **Step 5: Run full core suite + typecheck**

Run: `pnpm --filter @holy-oly/core test && pnpm --filter @holy-oly/core exec tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/logic/actuals.ts packages/core/src/logic/actuals.test.ts
git commit -m "feat(core): mergeActuals adjunta las series (sets) al actual"
```

---

### Task 2.4: Migración 9 — `SessionActual.sets`

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (model `SessionActual`)
- Create: `apps/api/prisma/migrations/9_set_actuals/migration.sql` (generado)

- [ ] **Step 1: Add the column to the schema** — en `apps/api/prisma/schema.prisma`, model `SessionActual`, agregar después de `doneAt String?`:

```prisma
  sets        Json?
```

- [ ] **Step 2: Generate the migration (non-interactive)**

Run: `pnpm --filter @holy-oly/api exec tsx scripts/make-migration.ts 9 set_actuals`
Expected: crea `apps/api/prisma/migrations/9_set_actuals/migration.sql` con `ALTER TABLE "SessionActual" ADD COLUMN "sets" JSONB;` (o equivalente).

- [ ] **Step 3: Regenerate the Prisma client**

Run: `pnpm --filter @holy-oly/api exec prisma generate`
Expected: client regenerado con `sets` en `SessionActual`.

- [ ] **Step 4: Verify the column exists in a fresh ephemeral DB**

Run: `pnpm --filter @holy-oly/api verify`
Expected: PASS — migra 0..9, siembra, corre los int tests existentes en verde (todavía sin tocar la lógica de sets; este paso confirma que la migración aplica limpia).

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/9_set_actuals
git commit -m "feat(api): migracion 9 — SessionActual.sets (Json) para registro por serie"
```

---

### Task 2.5: Persistir/leer `sets` (repo) + barKg en `getPrescriptionWeek` + int test

**Files:**
- Modify: `apps/api/src/repo.ts` (`setSessionActuals`, `getPrescriptionWeek`)
- Test: `apps/api/src/actuals.int.test.ts`

- [ ] **Step 1: Write the failing integration test** — agregar a `apps/api/src/actuals.int.test.ts` (dentro del `describe`):

```ts
it("registra series (sets): resumen=top set, GET devuelve las series, warmup presente en la vista", async () => {
  const coach = sess(await login("coach@holyoly.dev"));
  expect((await app.inject({ method: "PUT", url: "/athletes/mv/plan", headers: coach,
    payload: { atletaId: "mv", macroId: "ruso-5d", startWeek: 1, startDate: "2026-04-01", rms: RMS, comps: [] } })).statusCode).toBe(200);
  const athlete = sess(await login("mara@holyoly.dev"));
  const put = await app.inject({ method: "PUT", url: "/me/session/1/0", headers: athlete,
    payload: [{ order: 0, movementId: "arranque", done: true, sets: [
      { kg: 64, reps: 2, done: true }, { kg: 64, reps: 2, done: true }, { kg: 60, reps: 2, done: true },
    ] }] });
  expect(put.statusCode).toBe(200);

  const mine = await app.inject({ method: "GET", url: "/me/sessions?week=1", headers: athlete });
  const s0 = (mine.json() as Array<{ sessionIdx: number; exercises: Array<{ warmup?: unknown[]; actual?: { kg?: number; sets?: unknown[] } }> }>).find((s) => s.sessionIdx === 0)!;
  expect(s0.exercises[0]!.actual?.kg).toBe(64);          // top set
  expect(s0.exercises[0]!.actual?.sets).toHaveLength(3); // series devueltas
  expect(Array.isArray(s0.exercises[0]!.warmup)).toBe(true); // la vista trae el calentamiento
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @holy-oly/api verify`
Expected: FAIL — el server no persiste `sets` (el GET devuelve `actual.sets` undefined) y el resumen no se deriva del top set.

- [ ] **Step 3: Implement `setSessionActuals`** — en `apps/api/src/repo.ts`:

Cambiar el import de `@prisma/client` para incluir el valor `Prisma` (para `Prisma.JsonNull`):

```ts
import { Prisma, type PrismaClient } from "@prisma/client";
```

> (Si ya importa `type { Prisma, PrismaClient }`, separar: `import { Prisma } from "@prisma/client"; import type { PrismaClient } from "@prisma/client";`)

Agregar `summarizeSets` al import de core:

```ts
import { RMSchema, buildMePlanView, computeStreak, MACROCYCLES, MACRO_RECIPES, instantiatePrescription, buildSessionViews, mergeActuals, summarizeSets, barKgForSexo, SetActualsSchema } from "@holy-oly/core";
```

Reemplazar el `createMany` dentro de `setSessionActuals`:

```ts
    prisma.sessionActual.createMany({
      data: actuals.map((a) => {
        const sum = a.sets && a.sets.length > 0 ? summarizeSets(a.sets) : { done: a.done, kg: a.kg, reps: a.reps };
        return {
          athleteId, week, sessionIdx, order: a.order, movementId: a.movementId,
          prescribedMovementId: a.prescribedMovementId ?? null,
          done: sum.done,
          actualKg: sum.kg ?? null, actualReps: sum.reps ?? null, note: a.note ?? null,
          sets: a.sets && a.sets.length > 0 ? (a.sets as Prisma.InputJsonValue) : Prisma.JsonNull,
          doneAt: sum.done ? today : null,
        };
      }),
    }),
```

- [ ] **Step 4: Implement `getPrescriptionWeek`** — en el mismo archivo, dentro de `getPrescriptionWeek`:

Mapear `sets` desde el Json del row (con parse defensivo) — modificar el `.map` de `actualRows`:

```ts
  const actuals: SessionActual[] = actualRows.map((a) => {
    const parsedSets = a.sets != null ? SetActualsSchema.safeParse(a.sets) : null;
    return {
      week: a.week, sessionIdx: a.sessionIdx, order: a.order, movementId: a.movementId, done: a.done,
      prescribedMovementId: a.prescribedMovementId ?? undefined,
      actualKg: a.actualKg ?? undefined, actualReps: a.actualReps ?? undefined,
      note: a.note ?? undefined, doneAt: a.doneAt ?? undefined,
      sets: parsedSets && parsedSets.success ? parsedSets.data : undefined,
    };
  });
```

Pasar `barKg` (del sexo del atleta) a `buildSessionViews` — reemplazar la última línea de la función:

```ts
  const athlete = await prisma.athlete.findUnique({ where: { id: athleteId }, select: { sexo: true } });
  const barKg = barKgForSexo((athlete?.sexo as "M" | "F" | undefined) ?? "M");
  return mergeActuals(buildSessionViews(rows, plan.rms, barKg), actuals);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @holy-oly/api verify`
Expected: PASS — el round-trip de series, el resumen top-set y el warmup presente en la vista.

- [ ] **Step 6: Typecheck the api**

Run: `pnpm --filter @holy-oly/api exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/repo.ts apps/api/src/actuals.int.test.ts
git commit -m "feat(api): persistir/leer series (sets) + resumen top-set + barKg en la vista del atleta"
```

---

## Fase 3 — Reproductor (web)

> Componentes nuevos en `apps/web/src/screens/atleta/entreno/`. Tests en `apps/web/src/screens/atleta/__tests__/`.
> **Nota de scope:** el reproductor NO incluye nota libre del atleta por ejercicio (el spec no la pide; el `notes` del coach se muestra read-only). Es una omisión deliberada vs el `EntrenoScreen` viejo.

### Task 3.1: `WarmupSection`

**Files:**
- Create: `apps/web/src/screens/atleta/entreno/WarmupSection.tsx`
- Test: `apps/web/src/screens/atleta/__tests__/warmupSection.test.tsx`

- [ ] **Step 1: Write the failing test** — crear `apps/web/src/screens/atleta/__tests__/warmupSection.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import type { WarmupSet } from "@holy-oly/core";
import { WarmupSection } from "../entreno/WarmupSection";

const SETS: WarmupSet[] = [
  { pct: 0, kg: 15, reps: 5, label: "barra" },
  { pct: 39, kg: 45, reps: 5, label: "rampa" },
];

test("renderiza sets con kg, % y discos; marca 'no cuenta'", () => {
  render(<WarmupSection sets={SETS} barKg={15} />);
  expect(screen.getByText(/no cuenta/i)).toBeInTheDocument();
  expect(screen.getByText("Barra")).toBeInTheDocument();
  expect(screen.getByText("39%")).toBeInTheDocument();
  expect(document.querySelectorAll("svg").length).toBeGreaterThanOrEqual(1); // discos
});

test("sets vacío → no renderiza nada", () => {
  const { container } = render(<WarmupSection sets={[]} barKg={20} />);
  expect(container).toBeEmptyDOMElement();
});

test("es salteable: el toggle colapsa los sets", () => {
  render(<WarmupSection sets={SETS} barKg={15} />);
  expect(screen.getByText("Barra")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /calentamiento/i }));
  expect(screen.queryByText("Barra")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @holy-oly/web exec vitest run src/screens/atleta/__tests__/warmupSection.test.tsx`
Expected: FAIL — `Failed to resolve import "../entreno/WarmupSection"`.

- [ ] **Step 3: Implement** — crear `apps/web/src/screens/atleta/entreno/WarmupSection.tsx`:

```tsx
import { useState } from "react";
import type { WarmupSet } from "@holy-oly/core";
import { DiscRow } from "../../../ui/Disc";

/** Calentamiento: se muestra y NO cuenta. Salteable (colapsable). Discos vía DiscRow. */
export function WarmupSection({ sets, barKg }: { sets: WarmupSet[]; barKg: number }) {
  const [open, setOpen] = useState(true);
  if (sets.length === 0) return null;
  return (
    <div style={{ marginTop: 12 }}>
      <button
        type="button"
        aria-label="calentamiento"
        onClick={() => setOpen((o) => !o)}
        style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center", border: 0, background: "transparent", padding: 0, cursor: "pointer", fontFamily: "var(--wl-display)", fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--wl-muted)" }}
      >
        <span>Calentamiento · no cuenta</span>
        <span>{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
          {sets.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontFamily: "var(--wl-display)", fontSize: 12, color: "var(--wl-muted)", minWidth: 44 }}>
                {s.label === "barra" ? "Barra" : `${s.pct}%`}
              </span>
              <DiscRow kg={s.kg} barKg={barKg} />
              <span style={{ fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 15, color: "var(--wl-text)", whiteSpace: "nowrap" }}>
                {s.kg}<span style={{ fontSize: 11, color: "var(--wl-muted)" }}> kg × {s.reps}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @holy-oly/web exec vitest run src/screens/atleta/__tests__/warmupSection.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/screens/atleta/entreno/WarmupSection.tsx apps/web/src/screens/atleta/__tests__/warmupSection.test.tsx
git commit -m "feat(web): WarmupSection — calentamiento con discos, salteable, no cuenta"
```

---

### Task 3.2: `WorkSetsSection` (series por separado + modificar)

**Files:**
- Create: `apps/web/src/screens/atleta/entreno/WorkSetsSection.tsx`
- Test: `apps/web/src/screens/atleta/__tests__/workSetsSection.test.tsx`

- [ ] **Step 1: Write the failing test** — crear `apps/web/src/screens/atleta/__tests__/workSetsSection.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { WorkSetsSection, type SetRow } from "../entreno/WorkSetsSection";

const SERIES: SetRow[] = [
  { kg: 90, reps: 2, done: true },
  { kg: 90, reps: 2, done: true },
  { kg: 90, reps: 2, done: true },
];

test("renderiza N filas de serie con kg, reps y discos", () => {
  render(<WorkSetsSection series={SERIES} barKg={15} onPatchSet={() => {}} />);
  expect(screen.getByText("Serie 1/3")).toBeInTheDocument();
  expect(screen.getByText("Serie 3/3")).toBeInTheDocument();
  expect(screen.getAllByText("90").length).toBeGreaterThanOrEqual(3);
  expect(document.querySelectorAll("svg").length).toBeGreaterThanOrEqual(3);
});

test("modificar serie 2 → cambiar kg llama onPatchSet(1, {kg})", () => {
  const onPatchSet = vi.fn();
  render(<WorkSetsSection series={SERIES} barKg={15} onPatchSet={onPatchSet} />);
  fireEvent.click(screen.getByRole("button", { name: /modificar serie 2/i }));
  fireEvent.change(screen.getByLabelText(/kg serie 2/i), { target: { value: "85" } });
  expect(onPatchSet).toHaveBeenCalledWith(1, { kg: 85 });
});

test("'no la hice' en una serie llama onPatchSet(i, {done:false})", () => {
  const onPatchSet = vi.fn();
  render(<WorkSetsSection series={SERIES} barKg={15} onPatchSet={onPatchSet} />);
  fireEvent.click(screen.getByRole("button", { name: /modificar serie 3/i }));
  fireEvent.click(screen.getByRole("button", { name: /^no la hice$/i }));
  expect(onPatchSet).toHaveBeenCalledWith(2, { done: false });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @holy-oly/web exec vitest run src/screens/atleta/__tests__/workSetsSection.test.tsx`
Expected: FAIL — import no resuelve.

- [ ] **Step 3: Implement** — crear `apps/web/src/screens/atleta/entreno/WorkSetsSection.tsx`:

```tsx
import { useState, type CSSProperties } from "react";
import { DiscRow } from "../../../ui/Disc";

export interface SetRow { kg?: number; reps?: number; done: boolean; }

const num: CSSProperties = { width: 64, boxSizing: "border-box", padding: "6px 7px", borderRadius: 8, textAlign: "center", border: "1px solid color-mix(in srgb,var(--wl-text) 16%,transparent)", background: "var(--wl-bg)", color: "var(--wl-text)", fontFamily: "var(--wl-display)", fontSize: 14 };
const chip: CSSProperties = { border: "1px solid color-mix(in srgb,var(--wl-text) 16%,transparent)", borderRadius: 999, background: "var(--wl-bg)", color: "var(--wl-text)", fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 12.5, padding: "6px 11px", cursor: "pointer" };

/** Series de trabajo: cada serie nace hecha al target (adherencia por defecto). ✎ modifica esa serie
 *  (kg/reps o "no la hice"), independiente de las demás. Discos por serie. */
export function WorkSetsSection({
  series, barKg, onPatchSet,
}: {
  series: SetRow[]; barKg: number;
  onPatchSet: (i: number, p: Partial<SetRow>) => void;
}) {
  const [openSet, setOpenSet] = useState<number | null>(null);
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontFamily: "var(--wl-display)", fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--wl-muted)" }}>Series de trabajo</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
        {series.map((s, i) => {
          const open = openSet === i;
          return (
            <div key={i} style={{ background: "var(--wl-surface)", borderRadius: 10, padding: "9px 11px", opacity: s.done ? 1 : 0.55 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontFamily: "var(--wl-display)", fontSize: 12, color: "var(--wl-muted)" }}>Serie {i + 1}/{series.length}</span>
                <span style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 18, color: "var(--wl-text)" }}>{s.kg != null ? s.kg : "—"}<span style={{ fontSize: 11, color: "var(--wl-muted)", fontWeight: 600 }}> kg</span></span>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 6 }}>
                {s.kg != null ? <DiscRow kg={s.kg} barKg={barKg} /> : <span />}
                <span style={{ fontFamily: "var(--wl-display)", fontSize: 13, color: "var(--wl-muted)" }}>{s.done ? `${s.reps ?? "—"} reps` : "no la hice"}</span>
              </div>
              {!open ? (
                <button type="button" onClick={() => setOpenSet(i)} aria-label={`modificar serie ${i + 1}`} style={{ marginTop: 8, border: 0, background: "transparent", color: "var(--wl-accent)", fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 13, cursor: "pointer", padding: 0 }}>✎ modificar</button>
              ) : (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <input style={num} type="number" inputMode="decimal" aria-label={`kg serie ${i + 1}`} value={s.kg ?? ""} onChange={(e) => onPatchSet(i, { kg: e.target.value ? Number(e.target.value) : undefined })} /><span style={{ color: "var(--wl-muted)", fontSize: 12 }}>kg</span>
                    <input style={num} type="number" inputMode="numeric" aria-label={`reps serie ${i + 1}`} value={s.reps ?? ""} onChange={(e) => onPatchSet(i, { reps: e.target.value === "" ? undefined : Number(e.target.value) })} /><span style={{ color: "var(--wl-muted)", fontSize: 12 }}>reps</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                    <button type="button" style={chip} onClick={() => onPatchSet(i, { done: !s.done })}>{s.done ? "no la hice" : "sí la hice"}</button>
                    <button type="button" aria-label={`listo serie ${i + 1}`} style={chip} onClick={() => setOpenSet(null)}>✓ listo</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @holy-oly/web exec vitest run src/screens/atleta/__tests__/workSetsSection.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/screens/atleta/entreno/WorkSetsSection.tsx apps/web/src/screens/atleta/__tests__/workSetsSection.test.tsx
git commit -m "feat(web): WorkSetsSection — series por separado, modificar independiente, discos"
```

---

### Task 3.3: `ResumenDia` (entrada)

**Files:**
- Create: `apps/web/src/screens/atleta/entreno/ResumenDia.tsx`
- Test: `apps/web/src/screens/atleta/__tests__/resumenDia.test.tsx`

- [ ] **Step 1: Write the failing test** — crear `apps/web/src/screens/atleta/__tests__/resumenDia.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { ResumenDia, type ResumenRow } from "../entreno/ResumenDia";

const ROWS: ResumenRow[] = [
  { movementName: "Cargada y Envión", sets: 5, reps: 2, kg: 90 },
];

test("muestra el botón iniciar y la lista con kg/discos/series×reps", () => {
  render(<ResumenDia rows={ROWS} barKg={15} onStart={() => {}} />);
  expect(screen.getByRole("button", { name: /iniciar entrenamiento/i })).toBeInTheDocument();
  expect(screen.getByText("Cargada y Envión")).toBeInTheDocument();
  expect(screen.getByText(/5 series × 2 repeticiones/)).toBeInTheDocument();
  expect(screen.getByText("90")).toBeInTheDocument();
  expect(document.querySelectorAll("svg").length).toBeGreaterThanOrEqual(1);
});

test("iniciar llama onStart", () => {
  const onStart = vi.fn();
  render(<ResumenDia rows={ROWS} barKg={15} onStart={onStart} />);
  fireEvent.click(screen.getByRole("button", { name: /iniciar entrenamiento/i }));
  expect(onStart).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @holy-oly/web exec vitest run src/screens/atleta/__tests__/resumenDia.test.tsx`
Expected: FAIL — import no resuelve.

- [ ] **Step 3: Implement** — crear `apps/web/src/screens/atleta/entreno/ResumenDia.tsx`:

```tsx
import { DiscRow } from "../../../ui/Disc";

export interface ResumenRow { movementName: string; sets: number; reps: number; kg?: number; }

/** Entrada del Entreno guiado: la lista del día + "▶ Iniciar entrenamiento". */
export function ResumenDia({ rows, barKg, onStart }: { rows: ResumenRow[]; barKg: number; onStart: () => void }) {
  return (
    <div>
      <button type="button" className="wl-btn wl-btn--primary" onClick={onStart} style={{ width: "100%" }}>▶ Iniciar entrenamiento</button>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
        {rows.map((r, i) => (
          <div key={i} style={{ background: "var(--wl-surface)", borderRadius: 12, padding: "11px 13px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 16, color: "var(--wl-text)" }}>{r.movementName}</span>
              <span style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 20, color: "var(--wl-text)" }}>{r.kg != null ? r.kg : "—"}<span style={{ fontSize: 11, color: "var(--wl-muted)", fontWeight: 600 }}> kg</span></span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 8 }}>
              {r.kg != null ? <DiscRow kg={r.kg} barKg={barKg} /> : <span />}
              <span style={{ fontFamily: "var(--wl-display)", fontSize: 13, color: "var(--wl-muted)" }}>{r.sets} series × {r.reps} repeticiones</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @holy-oly/web exec vitest run src/screens/atleta/__tests__/resumenDia.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/screens/atleta/entreno/ResumenDia.tsx apps/web/src/screens/atleta/__tests__/resumenDia.test.tsx
git commit -m "feat(web): ResumenDia — entrada del Entreno guiado con boton iniciar"
```

---

### Task 3.4: `SessionPlayer` (header + warmup + series + nav)

**Files:**
- Create: `apps/web/src/screens/atleta/entreno/SessionPlayer.tsx`
- Test: `apps/web/src/screens/atleta/__tests__/sessionPlayer.test.tsx`

- [ ] **Step 1: Write the failing test** — crear `apps/web/src/screens/atleta/__tests__/sessionPlayer.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { SessionPlayer, type PlayerRow } from "../entreno/SessionPlayer";

function row(over: Partial<PlayerRow> = {}): PlayerRow {
  return {
    movementId: "cargada-envion", movementName: "Cargada y Envión", prescribedMovementId: "cargada-envion",
    sets: 3, reps: 2, targetKg: 90, pct: 78, notes: "pecho alto en el catch",
    warmup: [{ pct: 0, kg: 15, reps: 5, label: "barra" }],
    series: [{ kg: 90, reps: 2, done: true }, { kg: 90, reps: 2, done: true }, { kg: 90, reps: 2, done: true }],
    ...over,
  };
}

const cbs = () => ({ onPatchSet: vi.fn(), onSubstitute: vi.fn(), onMovementNotDone: vi.fn(), onPrev: vi.fn(), onNext: vi.fn(), onFinish: vi.fn() });

test("header: Movimiento X/Y, nombre, series×reps·%, cue del coach", () => {
  render(<SessionPlayer row={row()} index={0} total={3} barKg={15} busy={false} {...cbs()} />);
  expect(screen.getByText("Movimiento 1/3")).toBeInTheDocument();
  expect(screen.getByText("Cargada y Envión")).toBeInTheDocument();
  expect(screen.getByText(/3 series × 2 reps · 78%/)).toBeInTheDocument();
  expect(screen.getByText(/pecho alto en el catch/)).toBeInTheDocument();
  expect(screen.getByText(/Calentamiento/)).toBeInTheDocument();
  expect(screen.getByText("Serie 1/3")).toBeInTheDocument();
});

test("primer movimiento: Ant deshabilitado; muestra 'Siguiente movimiento'", () => {
  const c = cbs();
  render(<SessionPlayer row={row()} index={0} total={3} barKg={15} busy={false} {...c} />);
  expect(screen.getByRole("button", { name: /movimiento anterior/i })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: /siguiente movimiento/i }));
  expect(c.onNext).toHaveBeenCalled();
});

test("último movimiento: muestra 'Fin · Guardar' y llama onFinish", () => {
  const c = cbs();
  render(<SessionPlayer row={row()} index={2} total={3} barKg={15} busy={false} {...c} />);
  fireEvent.click(screen.getByRole("button", { name: /guardar entreno/i }));
  expect(c.onFinish).toHaveBeenCalled();
});

test("sustituido: oculta el calentamiento y muestra el prescripto", () => {
  const c = cbs();
  render(<SessionPlayer row={row({ movementId: "press-empuje", movementName: "Push press", prescribedMovementId: "cargada-envion" })} index={0} total={1} barKg={15} busy={false} {...c} />);
  expect(screen.queryByText(/Calentamiento/)).not.toBeInTheDocument();
  expect(screen.getByText(/prescripto: Cargada y Envión/)).toBeInTheDocument();
});

test("⇄ cambiar y 'no la hice (todo)' llaman sus callbacks", () => {
  const c = cbs();
  render(<SessionPlayer row={row()} index={0} total={1} barKg={15} busy={false} {...c} />);
  fireEvent.click(screen.getByRole("button", { name: /cambiar movimiento/i }));
  expect(c.onSubstitute).toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: /no la hice \(todo\)/i }));
  expect(c.onMovementNotDone).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @holy-oly/web exec vitest run src/screens/atleta/__tests__/sessionPlayer.test.tsx`
Expected: FAIL — import no resuelve.

- [ ] **Step 3: Implement** — crear `apps/web/src/screens/atleta/entreno/SessionPlayer.tsx`:

```tsx
import { useEffect, useState, type CSSProperties } from "react";
import { getMovement, type WarmupSet } from "@holy-oly/core";
import { WarmupSection } from "./WarmupSection";
import { WorkSetsSection, type SetRow } from "./WorkSetsSection";

export interface PlayerRow {
  movementId: string; movementName: string; prescribedMovementId: string;
  sets: number; reps: number; targetKg?: number; pct?: number; notes?: string;
  warmup: WarmupSet[]; series: SetRow[];
}

const chip: CSSProperties = { border: "1px solid color-mix(in srgb,var(--wl-text) 16%,transparent)", borderRadius: 999, background: "var(--wl-bg)", color: "var(--wl-text)", fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 12.5, padding: "6px 11px", cursor: "pointer" };

function mmss(s: number): string {
  const m = Math.floor(s / 60); const r = s % 60;
  return `${m}:${r < 10 ? "0" : ""}${r}`;
}

/** Reproductor de un movimiento: header (nombre · esquema · % · X/Y) + crono + cue del coach +
 *  calentamiento (oculto si está sustituido) + series de trabajo + navegación. */
export function SessionPlayer({
  row, index, total, barKg, busy,
  onPatchSet, onSubstitute, onMovementNotDone, onPrev, onNext, onFinish,
}: {
  row: PlayerRow; index: number; total: number; barKg: number; busy: boolean;
  onPatchSet: (i: number, p: Partial<SetRow>) => void;
  onSubstitute: () => void; onMovementNotDone: () => void;
  onPrev: () => void; onNext: () => void; onFinish: () => void;
}) {
  const [secs, setSecs] = useState(0);
  useEffect(() => { const id = setInterval(() => setSecs((s) => s + 1), 1000); return () => clearInterval(id); }, []);

  const isFirst = index === 0;
  const isLast = index === total - 1;
  const substituted = row.movementId !== row.prescribedMovementId;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontFamily: "var(--ho-mono)", fontSize: 11, color: "var(--wl-muted)" }}>Movimiento {index + 1}/{total}</span>
        <span style={{ fontFamily: "var(--ho-mono)", fontSize: 12, color: "var(--wl-muted)" }}>{mmss(secs)}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginTop: 4 }}>
        <span style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 20, color: "var(--wl-text)" }}>{row.movementName}</span>
        <span style={{ fontFamily: "var(--wl-display)", fontSize: 13, color: "var(--wl-muted)", whiteSpace: "nowrap" }}>{row.sets} series × {row.reps} reps{row.pct != null ? ` · ${row.pct}%` : ""}</span>
      </div>
      {substituted && (
        <div style={{ fontFamily: "var(--wl-display)", fontSize: 11, color: "var(--wl-muted)", marginTop: 4 }}>prescripto: {getMovement(row.prescribedMovementId)?.name ?? row.prescribedMovementId}</div>
      )}
      {row.notes && !substituted && (
        <div style={{ fontFamily: "var(--wl-display)", fontSize: 12.5, color: "var(--wl-text)", marginTop: 8, padding: "8px 10px", background: "var(--wl-surface)", borderRadius: 10 }}>
          <span style={{ color: "var(--wl-accent)", fontWeight: 700 }}>Coach:</span> {row.notes}
        </div>
      )}

      {!substituted && <WarmupSection sets={row.warmup} barKg={barKg} />}
      <WorkSetsSection series={row.series} barKg={barKg} onPatchSet={onPatchSet} />

      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <button type="button" style={chip} onClick={onSubstitute} aria-label={`cambiar movimiento de ${row.movementName}`}>⇄ cambiar</button>
        <button type="button" style={chip} onClick={onMovementNotDone}>no la hice (todo)</button>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button type="button" className="wl-btn" disabled={isFirst} onClick={onPrev} aria-label="movimiento anterior" style={{ flex: "0 0 auto", opacity: isFirst ? 0.4 : 1 }}>‹ Ant</button>
        {isLast ? (
          <button type="button" className="wl-btn wl-btn--primary" disabled={busy} onClick={onFinish} style={{ flex: 1, opacity: busy ? 0.6 : 1 }}>{busy ? "Guardando…" : "Fin · Guardar entreno"}</button>
        ) : (
          <button type="button" className="wl-btn wl-btn--primary" onClick={onNext} aria-label="siguiente movimiento" style={{ flex: 1 }}>Siguiente movimiento ›</button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @holy-oly/web exec vitest run src/screens/atleta/__tests__/sessionPlayer.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/screens/atleta/entreno/SessionPlayer.tsx apps/web/src/screens/atleta/__tests__/sessionPlayer.test.tsx
git commit -m "feat(web): SessionPlayer — reproductor por movimiento (header/crono/cue/warmup/series/nav)"
```

---

### Task 3.5: `EntrenoScreen` container (compone + carga + guarda) + integración

**Files:**
- Modify: `apps/web/src/screens/atleta/EntrenoScreen.tsx` (reescritura)
- Test: `apps/web/src/screens/atleta/__tests__/entreno.test.tsx` (reescritura)

- [ ] **Step 1: Rewrite the integration test** — reemplazar TODO el contenido de `apps/web/src/screens/atleta/__tests__/entreno.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { afterEach, beforeEach, test, expect, vi, type MockInstance } from "vitest";
import type { ExerciseActualInput, MePlanView, SessionView } from "@holy-oly/core";
import * as me from "../../../data/meClient";
import { EntrenoScreen } from "../EntrenoScreen";

const PLAN_FIXTURE: MePlanView = {
  athlete: { nombre: "Mara V.", iniciales: "MV", sexo: "F" },
  plan: { macroName: "Ruso 5D", totalWeeks: 12, currentWeek: 8, currentPhase: "Fuerza", phases: [], comps: [] },
};

const SESSION_FIXTURE: SessionView[] = [
  {
    week: 8, sessionIdx: 0,
    exercises: [
      {
        movementId: "arranque", movementName: "Arranque", sets: 3, reps: 2, pct: 80, targetKg: 64,
        warmup: [{ pct: 0, kg: 15, reps: 5, label: "barra" }, { pct: 40, kg: 26, reps: 5, label: "rampa" }],
      },
    ],
  },
];

let put: MockInstance<any>;

beforeEach(() => {
  vi.spyOn(me, "getMePlan").mockResolvedValue(PLAN_FIXTURE);
  vi.spyOn(me, "getMeSessions").mockResolvedValue(SESSION_FIXTURE);
  put = vi.spyOn(me, "putMeSession").mockResolvedValue(undefined);
});
afterEach(() => vi.restoreAllMocks());

function renderEntreno() {
  return render(
    <MemoryRouter initialEntries={["/atleta/entreno/8/0"]}>
      <Routes>
        <Route path="/atleta/entreno/:week/:idx" element={<EntrenoScreen />} />
        <Route path="/atleta" element={<div>HOY</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function start() {
  renderEntreno();
  fireEvent.click(await screen.findByRole("button", { name: /iniciar entrenamiento/i }));
}

test("entrada: resumen con iniciar; tras iniciar entra al reproductor", async () => {
  renderEntreno();
  expect(await screen.findByRole("button", { name: /iniciar entrenamiento/i })).toBeInTheDocument();
  expect(screen.getByText("Arranque")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /iniciar entrenamiento/i }));
  expect(screen.getByText("Movimiento 1/1")).toBeInTheDocument();
  expect(screen.getByText("Serie 1/3")).toBeInTheDocument();
  expect(screen.getByText(/Calentamiento/)).toBeInTheDocument();
});

test("guardar sin modificar → sets de 3 series done@target, top-level done:true", async () => {
  await start();
  fireEvent.click(screen.getByRole("button", { name: /guardar entreno/i }));
  await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
  const sent = (put.mock.calls[0]![2] as ExerciseActualInput[])[0]!;
  expect(sent.done).toBe(true);
  expect(sent.movementId).toBe("arranque");
  expect(sent.sets).toHaveLength(3);
  expect(sent.sets!.every((s) => s.done && s.kg === 64 && s.reps === 2)).toBe(true);
});

test("modificar la serie 2 (kg=60) → guardar → sólo esa serie cambia (independiente)", async () => {
  await start();
  fireEvent.click(screen.getByRole("button", { name: /modificar serie 2/i }));
  fireEvent.change(screen.getByLabelText(/kg serie 2/i), { target: { value: "60" } });
  fireEvent.click(screen.getByRole("button", { name: /listo serie 2/i }));
  fireEvent.click(screen.getByRole("button", { name: /guardar entreno/i }));
  await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
  const sets = (put.mock.calls[0]![2] as ExerciseActualInput[])[0]!.sets!;
  expect(sets[0]!.kg).toBe(64);
  expect(sets[1]!.kg).toBe(60); // sólo la 2
  expect(sets[2]!.kg).toBe(64);
});

test("'no la hice (todo)' → todas las series done:false, exercise done:false", async () => {
  await start();
  fireEvent.click(screen.getByRole("button", { name: /no la hice \(todo\)/i }));
  fireEvent.click(screen.getByRole("button", { name: /guardar entreno/i }));
  await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
  const sent = (put.mock.calls[0]![2] as ExerciseActualInput[])[0]!;
  expect(sent.done).toBe(false);
  expect(sent.sets!.every((s) => s.done === false)).toBe(true);
});

test("sustituir → kg de las series se limpia → cargar kg en serie 1 → guardar → movementId correcto", async () => {
  await start();
  fireEvent.click(screen.getByRole("button", { name: /cambiar movimiento de Arranque/i }));
  // simplerVariants("arranque")[0] = "arranque.colgado.bajo" → "Arranque colgado (bajo)"
  fireEvent.click(await screen.findByRole("button", { name: /Arranque colgado \(bajo\)/i }));
  // las series quedan sin kg
  fireEvent.click(screen.getByRole("button", { name: /modificar serie 1/i }));
  fireEvent.change(screen.getByLabelText(/kg serie 1/i), { target: { value: "50" } });
  fireEvent.click(screen.getByRole("button", { name: /listo serie 1/i }));
  fireEvent.click(screen.getByRole("button", { name: /guardar entreno/i }));
  await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
  const sent = (put.mock.calls[0]![2] as ExerciseActualInput[])[0]!;
  expect(sent.movementId).toBe("arranque.colgado.bajo");
  expect(sent.prescribedMovementId).toBe("arranque");
  expect(sent.sets![0]!.kg).toBe(50);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @holy-oly/web exec vitest run src/screens/atleta/__tests__/entreno.test.tsx`
Expected: FAIL — el `EntrenoScreen` viejo no tiene "Iniciar entrenamiento" ni series.

- [ ] **Step 3: Rewrite `EntrenoScreen`** — reemplazar TODO el contenido de `apps/web/src/screens/atleta/EntrenoScreen.tsx`:

```tsx
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { SessionView, ExerciseActualInput, MePlanView } from "@holy-oly/core";
import { getMovement, barKgForSexo } from "@holy-oly/core";
import * as me from "../../data/meClient";
import { SubstituteSheet } from "../../ui/SubstituteSheet";
import { ResumenDia } from "./entreno/ResumenDia";
import { SessionPlayer, type PlayerRow } from "./entreno/SessionPlayer";
import type { SetRow } from "./entreno/WorkSetsSection";

export function EntrenoScreen() {
  const { week: weekP, idx: idxP } = useParams();
  const navigate = useNavigate();
  const week = Number(weekP);
  const idx = Number(idxP);
  const [rows, setRows] = useState<PlayerRow[] | null>(null);
  const [barKg, setBarKg] = useState(20);
  const [started, setStarted] = useState(false);
  const [cur, setCur] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subOpen, setSubOpen] = useState(false);

  useEffect(() => {
    if (!Number.isInteger(week) || !Number.isInteger(idx)) { navigate("/atleta", { replace: true }); return; }
    let on = true;
    Promise.all([me.getMePlan().catch(() => null), me.getMeSessions(week)])
      .then(([plan, views]: [MePlanView | null, SessionView[]]) => {
        if (!on) return;
        setBarKg(barKgForSexo(plan?.athlete.sexo ?? "M"));
        const s = views.find((v) => v.sessionIdx === idx);
        setRows((s?.exercises ?? []).map((e) => {
          const fromActual = e.actual?.sets;
          const series: SetRow[] = fromActual && fromActual.length > 0
            ? fromActual.map((x) => ({ kg: x.kg, reps: x.reps, done: x.done }))
            : Array.from({ length: e.sets }, () => ({ kg: e.targetKg, reps: e.reps, done: true }));
          return {
            movementId: e.actual?.movementId ?? e.movementId,
            movementName: e.actual?.movementName ?? e.movementName,
            prescribedMovementId: e.movementId,
            sets: e.sets, reps: e.reps, targetKg: e.targetKg, pct: e.pct, notes: e.notes,
            warmup: e.warmup ?? [],
            series,
          };
        }));
      })
      .catch(() => { if (on) setRows([]); });
    return () => { on = false; };
  }, [week, idx, navigate]);

  const patchSet = (setIdx: number, p: Partial<SetRow>): void =>
    setRows((rs) => rs ? rs.map((r, j) => j === cur ? { ...r, series: r.series.map((s, k) => k === setIdx ? { ...s, ...p } : s) } : r) : rs);

  const movementNotDone = (): void =>
    setRows((rs) => rs ? rs.map((r, j) => j === cur ? { ...r, series: r.series.map((s) => ({ ...s, done: false })) } : r) : rs);

  const pickSub = (id: string): void =>
    setRows((rs) => rs ? rs.map((r, j) => j === cur ? { ...r, movementId: id, movementName: getMovement(id)?.name ?? id, series: r.series.map((s) => ({ ...s, kg: undefined })) } : r) : rs);

  const save = useCallback(async () => {
    if (!rows) return;
    setBusy(true); setError(null);
    try {
      const actuals: ExerciseActualInput[] = rows.map((r, order) => {
        const sets = r.series.map((s) => ({ kg: s.kg, reps: s.reps, done: s.done }));
        return { order, movementId: r.movementId, prescribedMovementId: r.prescribedMovementId, done: sets.some((s) => s.done), sets };
      });
      await me.putMeSession(week, idx, actuals);
      navigate("/atleta");
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar"); }
    finally { setBusy(false); }
  }, [rows, week, idx, navigate]);

  if (rows === null) return <div style={{ padding: 20, color: "var(--wl-muted)", fontFamily: "var(--ho-mono)" }}>Cargando…</div>;

  // NOTE: rendered inside AthleteShell's `<main className="ho-scroll">` — no agregar otro wrapper ho-scroll.
  return (
    <div>
      <button type="button" aria-label="volver" onClick={() => (started ? setStarted(false) : navigate("/atleta"))} style={{ border: 0, background: "transparent", color: "var(--wl-text)", fontSize: 22, cursor: "pointer", padding: 0, marginBottom: 6 }}>‹</button>
      <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 20, color: "var(--wl-text)" }}>Entreno · sem {week} · día {idx + 1}</div>

      {rows.length === 0 ? (
        <div style={{ marginTop: 14, fontFamily: "var(--ho-mono)", fontSize: 11, color: "var(--wl-muted)" }}>No hay sesión para este día.</div>
      ) : !started ? (
        <div style={{ marginTop: 12 }}>
          <ResumenDia
            rows={rows.map((r) => ({ movementName: r.movementName, sets: r.sets, reps: r.reps, kg: r.series[0]?.kg ?? r.targetKg }))}
            barKg={barKg}
            onStart={() => { setCur(0); setStarted(true); }}
          />
        </div>
      ) : (
        <div style={{ marginTop: 12 }}>
          <SessionPlayer
            row={rows[cur]!} index={cur} total={rows.length} barKg={barKg} busy={busy}
            onPatchSet={patchSet}
            onSubstitute={() => setSubOpen(true)}
            onMovementNotDone={movementNotDone}
            onPrev={() => setCur((c) => Math.max(0, c - 1))}
            onNext={() => setCur((c) => Math.min(rows.length - 1, c + 1))}
            onFinish={() => void save()}
          />
          {error && <div role="alert" style={{ marginTop: 10, color: "#ff3b46", fontFamily: "var(--ho-mono)", fontSize: 11 }}>{error}</div>}
        </div>
      )}

      {subOpen && rows[cur] && (
        <SubstituteSheet open movementId={rows[cur]!.movementId} onClose={() => setSubOpen(false)} onPick={pickSub} />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @holy-oly/web exec vitest run src/screens/atleta/__tests__/entreno.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Run the full web suite + typecheck + lint**

Run: `pnpm --filter @holy-oly/web test && pnpm --filter @holy-oly/web exec tsc --noEmit && pnpm --filter @holy-oly/web exec eslint src`
Expected: PASS, no type errors, no lint errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/screens/atleta/EntrenoScreen.tsx apps/web/src/screens/atleta/__tests__/entreno.test.tsx
git commit -m "feat(web): Entreno guiado — reproductor (resumen→iniciar→series por serie) reemplaza la lista plana"
```

---

## Fase 4 — Verificación integral

### Task 4.1: Suites completas + prod-bundle sanity

**Files:** (ninguno — sólo gates)

- [ ] **Step 1: Core + web unit suites**

Run: `pnpm --filter @holy-oly/core test && pnpm --filter @holy-oly/web test`
Expected: PASS (core con los nuevos tests de warmup/summarize/merge; web con player).

- [ ] **Step 2: API unit + integración + e2e (Postgres embebido)**

Run: `pnpm --filter @holy-oly/api test && pnpm --filter @holy-oly/api verify && pnpm --filter @holy-oly/api e2e`
Expected: PASS — incluye el round-trip de series (int) y el e2e coach↔API↔PG.

- [ ] **Step 3: Typecheck de los 3 paquetes**

Run: `pnpm --filter @holy-oly/core exec tsc --noEmit && pnpm --filter @holy-oly/api exec tsc --noEmit && pnpm --filter @holy-oly/web exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Web build + lint**

Run: `pnpm --filter @holy-oly/web exec eslint src && pnpm --filter @holy-oly/web build`
Expected: lint limpio; build OK.

- [ ] **Step 5: Prod-bundle sanity (core inlineado en el bundle de la API)**

Run: `pnpm --filter @holy-oly/api build`
Luego verificar que `@holy-oly/core` quedó inlineado (debe dar VACÍO):
Run: `grep -nE "(require\(|from )['\"]@holy-oly/core['\"]" apps/api/dist/main.js`
Expected: sin salida (core inlineado por tsup `noExternal`).

- [ ] **Step 6: Commit (si hubo algún fix de verificación; si no, omitir)**

```bash
git add -A
git commit -m "test: verificacion integral del Entreno guiado (suites + prod-bundle sanity)"
```

---

## Post-implementación (fuera del plan de código)

1. **El Carnicero** (revisor de dominio): dispatch `general-purpose` (model opus) cargando `.claude/agents/el-carnicero.md` + `docs/domain/HOLY-OLY-DOMAIN.md`. Verificar: invariantes del calentamiento (shown-not-counted, sin-dato→[]), **resumen = top set**, OHS "al final" = `!isFirst`. Advisory — verificar cada hallazgo.
2. **Deploy:** `git push origin HEAD:main` (Render auto-deploya: `prisma migrate deploy` aplica la migración 9 + `node dist/main.js`). Poll `GET https://api.render.com/v1/services/srv-d8etrvvavr4c73954o4g/deploys?limit=1` (Bearer key en `C:\Users\Gamer\Videos\.render-key.txt`, leer sin imprimir).
3. **Smoke live:** Playwright MCP contra holy-oly.onrender.com como `mara@holyoly.dev` / `holyoly-demo` → abrir el día → "▶ Iniciar entrenamiento" → ver calentamiento con discos → modificar una serie → Fin → recargar y confirmar persistencia. (Mara puede necesitar re-asignación del plan para que los accesorios tengan kg, ver memoria.)
4. **Actualizar memoria** (`MEMORY.md` + `[[athlete-app-and-execution-pillar]]`): Entreno guiado shipped + live.

## Self-Review (del autor del plan)

- **Spec coverage:** §4 calentamiento → Tasks 1.1–1.4. §5 registro por serie → Tasks 2.1–2.5. §6 reproductor → Tasks 3.1–3.5. §7 casos borde (sin-dato→[], sustituido oculta warmup, guardar falla, sin sesión, todas-no-hechas) → cubiertos en 1.2/3.4/3.5 + tests. §8 tests → cada task TDD. §9 no-negociables → DiscRow (1.4/3.x), sin RPE (no se introduce), N×M explícito (ResumenDia/SessionPlayer), adherencia por defecto (3.5). ✓
- **Placeholders:** ninguno — todo paso con código trae el código completo.
- **Type consistency:** `SetRow` (web) ↔ `SetActual`/`SetActualInput` (core) estructuralmente iguales; `PlayerRow.warmup: WarmupSet[]`; `buildSessionViews(rows, rms, barKg)`; `summarizeSets` firma usada en repo == definida en core; `warmupForExercise({movementId, pct, order}, rms, barKg)` consistente entre 1.2/1.4. ✓
