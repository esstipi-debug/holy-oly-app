# Holy Oly — M3 · Equipo (coach triage) · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Continues the M1–M2 plan (`2026-05-31-holy-oly-foundation-coach.md`); task numbering picks up at **Task 15**.

**Goal:** Make the coach's entry screen real. Build the **data layer** (a `LocalRepository` over namespaced `localStorage` with deterministic seeds) and the **Equipo screen** at `/coach` — a roster heatmap + risk quadrant + pick detail — as a *thin consumer* that derives every rendered number from `@holy-oly/core`. Extend `core` (recovery + no-data state + IMR-to-fase adapter + cycle-privacy) test-first.

**Architecture:** Two layers. **(A)** a finished, framework-free contract in `packages/core` — types + pure functions + the `Repository` interface; the heatmap history, the quadrant dot, AND the roster buckets are *pure functions of `MonitorSeries`* derived through ONE rule (`seriesState` = worse-of load+recovery), so the dot color, the bucket counts, and the current-week heatmap cell always agree for the same athlete (the mockup's single-`curState` discipline, ported). Equipo and the M4 drill-down share one source of truth. **(B)** one `LocalRepository` in `apps/web/src/data/` over `ho:`-namespaced `localStorage`, behind a `RepositoryProvider` React context — **the single seam where `ApiRepository` swaps in**; screens import only `useRepository()` + `core`, never storage. Equipo is near-stateless: one async effect builds a `RosterRow[]` projection and three presentational sub-components read only that. State→color goes through one shared palette (`ui/status.ts`), deduped from `Badge`.

> **Two semantic corrections vs. an earlier draft of this plan (both verified empirically — see "Design decisions" 2/3/13 and "Mockup divergence"):** (1) the roster cell / quadrant dot / buckets are colored by the **worse-of(ACWR, recovery)** of the *last week* (`rosterStatus → seriesState(s, s.weeks)`), NOT by ACWR alone — otherwise a green dot could sit inside the red risk-zone (a color≠position violation). (2) `recoveryState` and the recovery branch of `seriesState` **guard non-finite input** (`Number.isFinite`), so a missing/short recovery week paints `"none"` (hollow), never green — the same trap `acwrStateSafe` closes for load. The seeded numbers are **derived from real telemetry and intentionally differ from the mockup's hand-set snapshot** (the quadrant shows the *current week*; for a deloading/tapering athlete that is structurally different from the mockup's single hand-set `acwr/rec`). The goal is "plausible seeded data with the right per-athlete current-week states", pinned by test — NOT pixel-parity with `equipo.html`.

**Tech Stack:** (unchanged from M1–M2) pnpm 10, Node 24, TypeScript 5, Vitest, Vite 5, React 18, Tailwind 3, React Router 6. `@testing-library/react` for render tests; an injected in-memory `Storage` shim for repository tests.

Design doc: `docs/superpowers/specs/2026-05-31-holy-oly-app-design.md`. Synthesized M3 design + resolved decisions: see "Design decisions" at the foot of this file. Reference UI: `_mockup/equipo.html` (the screen to port) + `_mockup/coach.html` (Mara's real telemetry arrays). This plan covers **M3 (Equipo)** only; M4 (Drill-down) and M5 (Asignar plan) reuse this exact data layer and get their own plans.

---

## File Structure

**`packages/core` (extend — all test-first):**
- `src/types/index.ts` — add `recovery: number[]` (REQUIRED) to `MonitorSeries`; add `CycleShare`, `CycleState`, `CycleContext`.
- `src/logic/monitor.ts` (+ `monitor.test.ts`) — add `recoveryScore`, `recoverySeries`, `recoveryState` (non-finite-guarded), `CellState`, `acwrStateSafe`, `seriesState` (non-finite-guarded), `rosterStatus` (= `seriesState` of the last week, so buckets/dot/heatmap agree), `imrBandForWeek`, `imrStateForWeek`. Leave `acwrState` / `imrBandState` byte-for-byte.
- `src/repository.ts` — `getSeries` → `Promise<MonitorSeries | undefined>` (breaking, zero callers); add `getCycleShare`, `getCycleContext`. (Doc-drift note: design-doc §5 lists `savePlan(id, plan)` two-arg; the code uses one-arg `savePlan(plan)` keyed off `plan.atletaId`. Pre-existing, harmless; we keep the one-arg form and flag the doc for a one-line fix before M5 consumes `savePlan`.)

**`apps/web/src/data` (new — the data layer):**
- `storage.ts` — typed get/set JSON over `localStorage`, all keys `ho:`-prefixed, try/catch → documented default.
- `keys.ts` — central key map.
- `seeds.ts` — `SEED_ROSTER`, `ROSTER_META`, `SEED_SERIES`, `SEED_CYCLE`.
- `LocalRepository.ts` — `class LocalRepository implements Repository`; injectable `Storage`; idempotent `init()` guarded by `ho:seeded`.
- `LocalRepository.test.ts` — memory-shim round-trip + seed idempotency + cycle redaction + corrupt-storage.
- `RepositoryProvider.tsx` — React context + `useRepository()`.

**`apps/web/src/ui` (new — shared palette + charts):**
- `status.ts` — `STATUS` palette + `stateToInt`/`intToState` (deduped from `Badge`).
- `charts/Heatmap.tsx` (+ test) — presentational CSS-grid heatmap.
- `charts/RiskQuadrant.tsx` (+ test) — presentational SVG quadrant.

**`apps/web/src/screens/coach` (new — the screen):**
- `roster.ts` (+ test) — `getRosterRows(repo): Promise<RosterRow[]>` projection.
- `Equipo.tsx` (+ test) — the screen: `RosterHeader` + `Heatmap` + `RiskQuadrant` + `PickDetail`.
- `DrilldownPlaceholder.tsx` — `/coach/a/:id` stub (full drill-down is M4).

**`apps/web/src/app`:**
- `router.tsx` — wrap tree in `<RepositoryProvider>`; add `/coach` + `/coach/a/:id`; keep `/`→`Gallery` through M3. **Preserve** the `router: ReturnType<typeof createBrowserRouter>` annotation (dodges TS2742).

---

## Milestone 3 — Equipo (coach triage)

### Layer A — `packages/core`

### Task 15: `MonitorSeries.recovery` + cycle types

**Files:**
- Modify: `packages/core/src/types/index.ts`

This task is type-only (no behavior), so there is no RED step — the typecheck is the gate. Seeds in Layer B store `recovery`; the derivation fn lands in Task 16.

- [ ] **Step 1: Add `recovery` to `MonitorSeries`**
Edit `MonitorSeries` to add the field (0..100; the quadrant y-axis `rec`). REQUIRED, not optional: there are zero `MonitorSeries` literals outside seeds/tests, so making it required costs one line per seed and forces correctness. Do NOT add speculative `rpe?`/`compliance?`/`weight?`/`weightBand?` — those land append-only in M4 with the drill-down that consumes them.
```ts
export interface MonitorSeries {
  weeks: number;
  acute: number[];
  hrv: number[]; hrvBase: number;
  rhr: number[]; rhrBase: number;
  imr: number[];
  wellness: number[];
  recovery: number[];
}
```

- [ ] **Step 2: Add cycle types (redacted coach-facing view)**
Append below `MonitorSeries`. These are the mockup's exact enums plus a pre-redacted view; the *raw* phase/day/symptom never has a coach-facing shape.
```ts
export type CycleShare = "full" | "min" | "none";
export type CycleState = "regular" | "unreliable" | "amenorrhea";

/** Coach-facing, redacted by construction: never exposes phase/day/symptom. */
export interface CycleContext {
  share: CycleShare;
  inLutealNow: boolean | null;
  health: "ok" | "referral";
  reliable: boolean;
}
```

- [ ] **Step 3: Typecheck**
Run: `pnpm --filter @holy-oly/core typecheck`
Expected: no errors (no `MonitorSeries` literals exist in `core` yet, so nothing breaks).

- [ ] **Step 4: Commit**
```bash
git add packages/core/src/types/index.ts
git commit -m "$(cat <<'EOF'
feat(core): MonitorSeries.recovery + cycle types

Add required recovery:number[] to MonitorSeries (quadrant y-axis), and
the redacted coach-facing cycle types CycleShare/CycleState/CycleContext.
recovery is required (zero literals exist; forces seed correctness).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 16: Recovery logic (`recoveryScore` / `recoverySeries` / `recoveryState`)

**Files:**
- Modify: `packages/core/src/logic/monitor.ts`, `packages/core/src/logic/monitor.test.ts`

> `recoveryScore` is an engineering placeholder; the real coaching formula is open (see "Decisions needing the human"). It exists so a future `ApiRepository` can recompute and so it is unit-tested. Seeds STORE `recovery[]` (precomputed) → `getSeries` is a pure read and the quadrant needs no recompute. **The test pins BEHAVIOR, not a magic number:** for Mara, week-10 (the 700-load spike) is the recovery *minimum* and lands below the `alert` cutoff (70). The exact value of this formula is `67` (the full series is asserted below so the implementer is never guessing) — earlier drafts asserted `64`, which is the mockup's *hand-set* `rec` for Mara, a different quantity the formula does not (and need not) reproduce. Do NOT retune coefficients to chase 64.

- [ ] **Step 1: Append failing tests to `monitor.test.ts`**
**Extend the EXISTING import line** (`monitor.test.ts:2` already imports `acwrState, chronic, acwr, imrBandState` — adding a second import of those symbols is a TS2300 duplicate-identifier error). Add the `MonitorSeries` type import and a new `describe`; leave the existing `describe("monitor", …)` untouched.
```ts
// EDIT the existing line 2 — add only the new symbols, do not duplicate the four already there:
import {
  acwrState, chronic, acwr, imrBandState,
  recoveryScore, recoverySeries, recoveryState,
} from "./monitor";
import type { MonitorSeries } from "../types";

// Mara — real arrays from _mockup/coach.html (the seed's reference athlete)
const MARA: MonitorSeries = {
  weeks: 12,
  acute: [300, 320, 340, 300, 360, 380, 400, 320, 420, 700, 380, 340],
  hrv: [72, 71, 70, 73, 69, 70, 68, 72, 67, 62, 64, 69], hrvBase: 70,
  rhr: [49, 50, 50, 48, 51, 50, 52, 49, 53, 56, 54, 50], rhrBase: 50,
  imr: [66, 68, 70, 69, 76, 78, 80, 79, 86, 93, 88, 89],
  wellness: [82, 80, 78, 83, 74, 72, 70, 80, 66, 58, 62, 70],
  recovery: [],
};

describe("recovery", () => {
  it("recoveryState: cutoff 70 alert / 80 warn / else ok (matches risk-zone rec<70)", () => {
    expect(recoveryState(64)).toBe("alert");
    expect(recoveryState(76)).toBe("warn");
    expect(recoveryState(88)).toBe("ok");
    expect(recoveryState(70)).toBe("warn"); // boundary: not <70
    expect(recoveryState(80)).toBe("ok");   // boundary: not <80
  });
  it("recoveryScore is clamped to 0..100", () => {
    expect(recoveryScore(0, 70, 120, 50, 0)).toBeGreaterThanOrEqual(0);
    expect(recoveryScore(200, 70, 30, 50, 100)).toBeLessThanOrEqual(100);
  });
  it("recoverySeries: deterministic per-week output; week-10 spike is the alert minimum", () => {
    const rec = recoverySeries(MARA);
    expect(rec).toHaveLength(12);
    // Full expected output of the placeholder formula (computed, not hand-set):
    expect(rec).toEqual([82, 81, 79, 83, 77, 78, 75, 81, 73, 67, 70, 77]);
    // BEHAVIOR the chart relies on: the 700-load week is the recovery trough and is "alert".
    expect(Math.min(...rec)).toBe(rec[9]);   // week 10 is the series minimum
    expect(rec[9]!).toBeLessThan(70);        // → recoveryState(rec[9]) === "alert"
    expect(recoveryState(rec[9]!)).toBe("alert");
  });
});
```
> If a future product decision changes the coefficients, only the one `toEqual([...])` array and the asserted minimum move; the *behavioral* assertions (week-10 is the trough, < 70, `alert`) stay valid and are what the quadrant/heatmap actually depend on.

- [ ] **Step 2: Run to verify it fails**
Run: `pnpm --filter @holy-oly/core test monitor`
Expected: FAIL — `recoveryScore`/`recoverySeries`/`recoveryState` are not exported.

- [ ] **Step 3: Implement in `monitor.ts`**
Append below `imrBandState` (leave existing fns byte-for-byte). These coefficients yield the asserted `recoverySeries(MARA)` above; they are a placeholder, not a tuned target.
```ts
/**
 * Recovery 0..100 (the quadrant y-axis). PLACEHOLDER formula: HRV above base is
 * good, RHR above base is bad, wellness/100 blends in. The real clinical/coaching
 * formula is a product call; this is the single swappable derivation (seeds store
 * the result). NOT calibrated to the mockup's hand-set rec values.
 */
export function recoveryScore(
  hrv: number, hrvBase: number,
  rhr: number, rhrBase: number,
  wellness: number,
): number {
  const hrvRatio = hrv / hrvBase;          // >1 good
  const rhrRatio = rhrBase / rhr;          // >1 good (lower RHR is better)
  const physio = 50 * hrvRatio + 30 * rhrRatio; // ~80 at baseline
  const v = 0.7 * physio + 0.3 * wellness;
  return Math.max(0, Math.min(100, Math.round(v)));
}

/** Per-week recovery for a series (parallel to weeks). */
export function recoverySeries(s: MonitorSeries): number[] {
  return s.hrv.map((h, i) =>
    recoveryScore(h, s.hrvBase, s.rhr[i]!, s.rhrBase, s.wellness[i]!),
  );
}

/**
 * Recovery traffic light. Cutoff at 70 matches the mockup risk-zone (rec<70):
 * v<70 alert, v<80 warn, else ok. NON-FINITE INPUT (NaN/Infinity from a missing
 * or short recovery week) → "none", never "ok": a no-data week must not paint
 * green (the recovery twin of acwrStateSafe). Used by seriesState.
 */
export function recoveryState(v: number): CellState {
  if (!Number.isFinite(v)) return "none";
  return v < 70 ? "alert" : v < 80 ? "warn" : "ok";
}
```
Add the type import at the top of `monitor.ts`, and declare `CellState` here (its first consumer):
```ts
import type { Estado, MonitorSeries } from "../types";

/** Estado plus the render-only "no data" boundary state. */
export type CellState = Estado | "none";
```
> `recoveryState` returns `CellState` (it can now yield `"none"`). Tasks run 15→16→17 in order, so **`CellState` is declared HERE in Task 16** (recoveryState is its first user). **Task 17 does NOT re-declare it** — it imports/uses the same `CellState`. (If for some reason you implement Task 17 first, move the one-line declaration there instead; never declare it twice — that is a TS2300.)

- [ ] **Step 4: Run to verify it passes**
Run: `pnpm --filter @holy-oly/core test monitor`
Expected: PASS — `recoverySeries(MARA)` equals the asserted array verbatim (no coefficient tuning required).

- [ ] **Step 5: Commit**
```bash
git add packages/core/src/logic/monitor.ts packages/core/src/logic/monitor.test.ts
git commit -m "$(cat <<'EOF'
feat(core): recovery score/series/state

recoveryScore (HRV-vs-base up, RHR-vs-base down, wellness blend, clamp 0..100),
recoverySeries (per-week, pinned to its exact output by test), recoveryState
(cutoff 70 alert / 80 warn / else ok; NON-FINITE -> none, never ok). Placeholder
formula: week-10 spike is asserted as the recovery trough and "alert", not the
mockup's hand-set 64. Existing monitor fns untouched.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 17: No-data as a first-class state (`CellState` / `acwrStateSafe` / `rosterStatus` / `seriesState`)

**Files:**
- Modify: `packages/core/src/logic/monitor.ts`, `packages/core/src/logic/monitor.test.ts`

> This closes the documented `acwrState(NaN)==="ok"` trap on BOTH axes: a no-data athlete (or a no-data *week*) must never paint green in a triage tool. `Estado` stays 3-valued everywhere (the whole design system + `Badge` key off it); `"none"` is a render/display concern only. `acwrState` is left byte-for-byte so its existing tests stay green; `acwrStateSafe` is the guarded entry screens call. `seriesState` is the **derived per-cell rule**: `"none"` when load OR recovery is missing/non-finite, else the worse of load (ACWR) and recovery — a week flags `alert` if EITHER load spikes OR recovery craters. `rosterStatus` is **defined as `seriesState` of the LAST week** so the roster cell, the quadrant dot, and the heatmap's current-week column are the SAME color for the same athlete (the mockup colored everything from one `curState`; we keep that invariant). This is a conscious divergence from the mockup's hand-authored `h[]`; visual baselines come from this derived output.

- [ ] **Step 1: Append failing tests to `monitor.test.ts`**
```ts
import {
  acwrStateSafe, rosterStatus, seriesState, recoveryState,
  type CellState,
} from "./monitor";

describe("no-data state", () => {
  it("acwrStateSafe: finite → acwrState; NaN / Infinity / 0/0 → none", () => {
    expect(acwrStateSafe(1.0)).toBe("ok");
    expect(acwrStateSafe(1.6)).toBe("alert");
    expect(acwrStateSafe(NaN)).toBe("none");
    expect(acwrStateSafe(Infinity)).toBe("none");
    expect(acwrStateSafe(0 / 0)).toBe("none");
  });
  it("recoveryState: non-finite recovery → none (never green) — the recovery twin of the NaN trap", () => {
    expect(recoveryState(NaN)).toBe("none");
    expect(recoveryState(Infinity)).toBe("none");
    expect(recoveryState(64)).toBe("alert"); // finite still works
  });
  it("rosterStatus: undefined / zero-week → none, else worse-of(acwr,recovery) of the LAST week", () => {
    expect(rosterStatus(undefined)).toBe("none");
    expect(rosterStatus({ ...MARA, weeks: 0, acute: [], recovery: [] })).toBe("none");
    // Mara week-12 is a deload trough: acwr 0.739 (<0.8 → "warn") and rec 77 (<80 → "warn")
    // → worse-of = "warn". (NOT "~1.0"; the last week is a taper, not the week-10 spike.)
    const mara = { ...MARA, recovery: recoverySeries(MARA) };
    expect(rosterStatus(mara)).toBe("warn");
  });
  it("seriesState: none when missing / out of range / recovery hole; else worse-of(acwr, recovery)", () => {
    const mara = { ...MARA, recovery: recoverySeries(MARA) };
    expect(seriesState(undefined, 1)).toBe("none");
    expect(seriesState(mara, 99)).toBe("none"); // week out of range
    // week 10: recovery 67 → alert dominates whatever the acwr state is
    expect(seriesState(mara, 10)).toBe("alert");
    // recovery shorter than weeks: an in-range week with no recovery value paints "none", NOT "ok"
    const holed = { ...mara, recovery: mara.recovery.slice(0, 5) };
    expect(seriesState(holed, 8)).toBe("none"); // recovery[7] is undefined → none
  });
});
```
> The Mara assertions are pinned to the **computed** last-week derivation (acwr 0.739 / rec 77 → both `warn` → `warn`), verified against the real `acwr`/`chronic` in `monitor.ts`. Do not "fix" this to `ok`/`alert` — week-12 is intentionally a deload trough, which is exactly why a *current-week* triage view differs from the mockup's hand-set snapshot.

- [ ] **Step 2: Run to verify it fails**
Run: `pnpm --filter @holy-oly/core test monitor`
Expected: FAIL — symbols not exported.

- [ ] **Step 3: Implement in `monitor.ts`**
`CellState` was already declared in Task 16 (do NOT re-declare it here — TS2300). Append the rest:
```ts
/** Guarded acwrState: a non-finite ratio (no/zero data) is "none", never "ok". */
export function acwrStateSafe(v: number): CellState {
  return Number.isFinite(v) ? acwrState(v) : "none";
}

/** Worse-of two CellStates via an explicit rank so "none" can never out-rank a real state. */
const RANK: Record<CellState, number> = { none: -1, ok: 0, warn: 1, alert: 2 };
function worseOf(a: CellState, b: CellState): CellState {
  // If EITHER axis is "none" (missing data), the cell is "none" — never silently green.
  if (a === "none" || b === "none") return "none";
  return RANK[a] >= RANK[b] ? a : b;
}

/** Per-cell state: "none" when missing/out-of-range/recovery-hole, else worse-of(acwr, recovery). */
export function seriesState(s: MonitorSeries | undefined, week: number): CellState {
  if (!s) return "none";
  const i = week - 1;
  if (i < 0 || i >= s.weeks) return "none";
  const load = acwrStateSafe(acwr(s.acute)[i] ?? NaN);   // NaN → none
  const rec = recoveryState(s.recovery[i] ?? NaN);       // missing recovery week → none
  return worseOf(load, rec);
}

/** Roster cell = the LAST week's seriesState (worse-of), or "none" when there is no series.
 *  Single rule shared by the buckets, the quadrant dot, and the heatmap's current column. */
export function rosterStatus(s: MonitorSeries | undefined): CellState {
  if (!s || s.weeks === 0 || s.acute.length === 0) return "none";
  return seriesState(s, s.weeks);
}
```
> Both branches of `worseOf` are non-finite-guarded upstream (`acwrStateSafe`, `recoveryState`), and `worseOf` itself short-circuits to `"none"` if either axis is missing — so a within-range week with a short/missing `recovery[]` paints hollow, never green. This is the exact trap the task exists to kill, now closed on the recovery axis too.

- [ ] **Step 4: Run to verify it passes**
Run: `pnpm --filter @holy-oly/core test monitor`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add packages/core/src/logic/monitor.ts packages/core/src/logic/monitor.test.ts
git commit -m "$(cat <<'EOF'
feat(core): no-data as a first-class state

CellState = Estado | "none" (render-only). acwrStateSafe + recoveryState
both guard non-finite -> none (closing acwrState(NaN)==="ok" on BOTH axes).
seriesState(series, week) = none when missing/out-of-range/recovery-hole,
else worse-of(acwr, recovery). rosterStatus = seriesState of the LAST week,
so buckets/quadrant-dot/heatmap-current-column share one color. acwrState
untouched.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 18: IMR-to-fase adapter (`imrBandForWeek` / `imrStateForWeek`)

**Files:**
- Modify: `packages/core/src/logic/monitor.ts`, `packages/core/src/logic/monitor.test.ts`

> Composes the two existing pieces — `phaseForWeek` + `imrBandState` — zero new band logic. Shipped as the closed contract for M4's signature IMR-vs-fase chart; **Equipo itself does not call it.** CRITICAL: `phaseForWeek` (verified at `macrocycles.ts:574-579`) falls back to the LAST phase for out-of-range weeks and only returns `null` for an empty `phaseProfile` (which the catalog invariant test forbids). So the return type is `Estado`, NOT `CellState` — a non-empty macro always yields a real band. There is no `"none"` for an out-of-macro week (if "past peakWeek = un-assessable" is ever wanted, that's a deliberate product rule to add explicitly later — see "Decisions needing the human").

- [ ] **Step 1: Append failing tests to `monitor.test.ts`**
```ts
import { imrBandForWeek, imrStateForWeek } from "./monitor";
import { MACROCYCLES } from "../data/macrocycles";

describe("imr-to-fase adapter", () => {
  const ruso = MACROCYCLES.find((m) => m.id === "ruso-5d")!;
  it("imrBandForWeek returns the phase's imrPct (falls back to last phase out of range)", () => {
    expect(imrBandForWeek(ruso, 1)).toEqual([65, 72]);   // hipertrofia
    expect(imrBandForWeek(ruso, 14)).toEqual([92, 102]); // peaking
    expect(imrBandForWeek(ruso, 99)).toEqual([92, 102]); // out of range -> last phase, NOT none
  });
  it("imrStateForWeek = imrBandState over the phase band (Estado, never none)", () => {
    expect(imrStateForWeek(70, ruso, 1)).toBe("ok");    // in [65,72]±2
    expect(imrStateForWeek(80, ruso, 1)).toBe("warn");  // above band+2
    expect(imrStateForWeek(95, ruso, 14)).toBe("ok");   // in [92,102]±2
  });
  it("imrStateForWeek ±2 boundary: band[1]+2 is still ok, +3 is warn (week-1 band [65,72])", () => {
    expect(imrStateForWeek(74, ruso, 1)).toBe("ok");    // exactly band[1]+2 → not >, ok
    expect(imrStateForWeek(75, ruso, 1)).toBe("warn");  // band[1]+3 → warn
    expect(imrStateForWeek(63, ruso, 1)).toBe("ok");    // exactly band[0]-2 → not <, ok
    expect(imrStateForWeek(62, ruso, 1)).toBe("warn");  // band[0]-3 → warn
  });
});
```

- [ ] **Step 2: Run to verify it fails**
Run: `pnpm --filter @holy-oly/core test monitor`
Expected: FAIL — symbols not exported.

- [ ] **Step 3: Implement in `monitor.ts`**
Add the imports and the two fns.
```ts
import type { Macrocycle } from "../types";
import { phaseForWeek } from "../data/macrocycles";

/** The IMR band the program expects for `week` (falls back to the last phase). */
export function imrBandForWeek(macro: Macrocycle, week: number): [number, number] {
  return phaseForWeek(macro, week)!.imrPct;
}

/** Estado of `imr` vs the phase band for `week`. Always Estado (non-empty macro). */
export function imrStateForWeek(imr: number, macro: Macrocycle, week: number): Estado {
  return imrBandState(imr, imrBandForWeek(macro, week));
}
```
> `phaseForWeek` returns `null` only for an empty `phaseProfile`; the catalog invariant test (`macrocycles.test.ts`) guarantees every program has a non-empty profile, so the non-null assertion is safe for any real `Macrocycle`.

- [ ] **Step 4: Run to verify it passes**
Run: `pnpm --filter @holy-oly/core test monitor`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add packages/core/src/logic/monitor.ts packages/core/src/logic/monitor.test.ts
git commit -m "$(cat <<'EOF'
feat(core): IMR-to-fase adapter (closed contract for M4)

imrBandForWeek + imrStateForWeek compose phaseForWeek + imrBandState.
Return type is Estado (never none): phaseForWeek falls back to the last
phase for out-of-range weeks and only nulls on empty phaseProfile, which
the catalog invariant forbids. Equipo does not call this; M4's chart does.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 19: Repository contract — `getSeries` no-data + cycle methods

**Files:**
- Modify: `packages/core/src/repository.ts`

> The one breaking signature change (`getSeries` → `MonitorSeries | undefined`); blast radius is nil today (no caller) and it MUST land before M4's `getAthlete`/`getSeries` consume it. Cycle privacy is enforced **at the data boundary**: there is deliberately NO coach-reachable method returning phase/day/symptom, and NO coach-side setter (athlete owns it; setters land in the athlete slice). Equipo consumes neither cycle method (triage is cycle-blind by design); they exist so the `LocalRepository` author isn't guessing and so M4's drill-down can gate luteal bands on `share==="full" && state!=="amenorrhea"` while being structurally incapable of leaking detail.

- [ ] **Step 1: Edit `repository.ts`**
```ts
import type {
  Atleta, Plan, Medal, Competencia, MonitorSeries,
  CycleShare, CycleContext,
} from "./types";

export interface Repository {
  getRoster(): Promise<Atleta[]>;
  getAthlete(id: string): Promise<Atleta | undefined>;
  getSeries(id: string): Promise<MonitorSeries | undefined>;
  getPlan(id: string): Promise<Plan | undefined>;
  savePlan(plan: Plan): Promise<void>;
  getMedals(id: string): Promise<Medal[]>;
  addMedal(id: string, medal: Medal): Promise<void>;
  getComps(id: string): Promise<Competencia[]>;
  setComps(id: string, comps: Competencia[]): Promise<void>;
  /** Coach-visible sharing level (for UI copy "compartido" vs "reservado"). */
  getCycleShare(id: string): Promise<CycleShare>;
  /** Redacted coach-facing cycle view; undefined when share === "none". */
  getCycleContext(id: string): Promise<CycleContext | undefined>;
}
```

- [ ] **Step 2: Typecheck + full core test run**
Run: `pnpm --filter @holy-oly/core typecheck && pnpm --filter @holy-oly/core test`
Expected: typecheck clean (no implementor exists yet in `core`); all `core` suites PASS.

- [ ] **Step 3: Commit + push (Layer A complete)**
```bash
git add packages/core/src/repository.ts
git commit -m "$(cat <<'EOF'
feat(core): Repository no-data getSeries + cycle-privacy methods

getSeries -> MonitorSeries|undefined (breaking; zero callers). Add
getCycleShare + getCycleContext (redacted CycleContext, no coach-reachable
phase/day/symptom, no coach setter). Closes the core contract for M3/M4.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
git push origin main
```

> **Layer A done when:** `pnpm --filter @holy-oly/core test` is green and `core` exports `recovery*`, `CellState`, `acwrStateSafe`, `rosterStatus`, `seriesState`, `imrBandForWeek`, `imrStateForWeek`, `CycleShare`/`CycleState`/`CycleContext`, and the updated `Repository` (12 methods: the existing 10 + `getCycleShare` + `getCycleContext`).

---

### Layer B — `apps/web/src/data` (LocalRepository)

### Task 20: Storage + keys

**Files:**
- Create: `apps/web/src/data/storage.ts`, `apps/web/src/data/keys.ts`

> LOCATION decision: keep this in `apps/web/src/data/`, NOT a new `packages/data`. The design doc §3/§5 says "LocalRepository (en web)"; a separate package is scope creep for one impl with no second consumer. Storage is robust by construction (try/catch → documented default) so corrupt storage never throws into a screen. Keys are per-athlete `ho:`-namespaced — diverging from the mockup's GLOBAL `ho_cycle_*` and flat `ho_comps`/`ho_medals`; M3 is a fresh seeded store, so no auto-migration (flagged for the athlete-slice migration).

- [ ] **Step 1: Create `apps/web/src/data/keys.ts`**
```ts
export const KEYS = {
  roster: "ho:roster",
  seeded: "ho:seeded",
  series: (id: string) => `ho:series:${id}`,
  plan: (id: string) => `ho:plan:${id}`,
  medals: (id: string) => `ho:medals:${id}`,
  comps: (id: string) => `ho:comps:${id}`,
  cycleShare: (id: string) => `ho:cycleShare:${id}`,
  cycleState: (id: string) => `ho:cycleState:${id}`,
} as const;
```

- [ ] **Step 2: Create `apps/web/src/data/storage.ts`**
```ts
/** Typed JSON over a Storage (default localStorage). Corrupt/missing → fallback. */
export class JsonStore {
  constructor(private readonly backend: Storage) {}

  get<T>(key: string, fallback: T): T {
    try {
      const raw = this.backend.getItem(key);
      if (raw == null) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      // Corrupt JSON or unavailable storage: never throw into a screen.
      return fallback;
    }
  }

  /** Typed read for "maybe-absent" values: undefined when missing/corrupt (no `as never`). */
  getOptional<T>(key: string): T | undefined {
    try {
      const raw = this.backend.getItem(key);
      if (raw == null) return undefined;
      return JSON.parse(raw) as T;
    } catch {
      return undefined;
    }
  }

  set<T>(key: string, value: T): void {
    try {
      this.backend.setItem(key, JSON.stringify(value));
    } catch {
      // Quota/private-mode: swallow; UI stays functional this session.
    }
  }

  has(key: string): boolean {
    try {
      return this.backend.getItem(key) != null;
    } catch {
      return false;
    }
  }
}
```

- [ ] **Step 3: Typecheck**
Run: `pnpm --filter @holy-oly/web typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**
```bash
git add apps/web/src/data/keys.ts apps/web/src/data/storage.ts
git commit -m "$(cat <<'EOF'
feat(web): ho:-namespaced storage + key map

JsonStore: typed JSON over an injectable Storage, try/catch -> fallback so
corrupt storage never throws into a screen. KEYS: per-athlete ho:* namespace.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 21: Seeds (roster + per-athlete series + cycle)

**Files:**
- Create: `apps/web/src/data/seeds.ts`

> Deterministic seeded store. **Mara is pinned from `coach.html`'s real arrays** (`recovery` precomputed via `recoverySeries`). **The seeds do NOT pixel-reproduce `equipo.html`** — see the "Mockup divergence" box below. The quadrant/heatmap show each athlete's *current week* (worse-of ACWR+recovery of the last week); for Mara that is a deload trough (acwr 0.739 / rec 77 → `warn`), which is structurally different from the mockup's hand-set "current" snapshot (1.42 / 64). The honest goal: **plausible seeded telemetry whose DERIVED current-week cell hits a chosen per-athlete target, pinned by the roster test (Task 27)** — not back-solving to the mockup's exact `acwr`/`rec` floats. **Tomás is intentionally repurposed as the no-data exemplar** (the mockup gives him full data `acwr:0.68, rec:90`; we drop it to exercise the `"none"` path end-to-end). The per-athlete método string is NOT on `core.Atleta`; carry it in a side `ROSTER_META` map.
>
> **⚠️ Mockup divergence (intentional, do not "fix"):** (a) **Tomás** has telemetry in `equipo.html` but is seeded with NO series here (no-data demo). (b) The heatmap history is **derived worse-of(ACWR,recovery)**, not the mockup's hand-authored `h[]`. (c) Because the view is current-week, **derived per-athlete states will differ visually from `equipo.html`** (Mara plots far-left/safe at the deload trough, not in the risk zone). The visual-verify step (Task 29 Step 3) compares against THIS derived output, not the mockup. This box is the single source of truth for those three divergences; "Decisions needing the human" lists (b) for product confirmation.

- [ ] **Step 1: Create `apps/web/src/data/seeds.ts`**
The roster is the 8 athletes from `equipo.html` typed as `core.Atleta` (id = slug of initials; `nivel` inferred from método; `compite` from the mockup `comp`; `macroId` only for those with a real macro — Mara → `ruso-5d`). Tomás (`tl`) gets no `SEED_SERIES` entry → `getSeries` returns `undefined`.
```ts
import { recoverySeries, type Atleta, type MonitorSeries, type CycleShare, type CycleState } from "@holy-oly/core";

export interface RosterMeta { metodo: string; }

export const SEED_ROSTER: Atleta[] = [
  { id: "mv", nombre: "Mara V.",  iniciales: "MV", nivel: "intermediate", compite: true,  macroId: "ruso-5d" },
  { id: "ds", nombre: "Diego S.", iniciales: "DS", nivel: "intermediate", compite: true },
  { id: "lr", nombre: "Lucía R.", iniciales: "LR", nivel: "intermediate", compite: true },
  { id: "sm", nombre: "Sofía M.", iniciales: "SM", nivel: "advanced" },
  { id: "tl", nombre: "Tomás L.", iniciales: "TL", nivel: "beginner" }, // NO series → no-data exemplar
  { id: "ap", nombre: "Ana P.",   iniciales: "AP", nivel: "intermediate" },
  { id: "bg", nombre: "Bruno G.", iniciales: "BG", nivel: "intermediate" },
  { id: "cf", nombre: "Caro F.",  iniciales: "CF", nivel: "intermediate" },
];

export const ROSTER_META: Record<string, RosterMeta> = {
  mv: { metodo: "Ruso 5D" },        ds: { metodo: "USA Intermedio" },
  lr: { metodo: "Coreano 5D" },     sm: { metodo: "Búlgaro 6D" },
  tl: { metodo: "Polaco 5D" },      ap: { metodo: "Cubano Int." },
  bg: { metodo: "Híbrido 5D" },     cf: { metodo: "Colombiano 5D" },
};

// Mara — real 12-week arrays from _mockup/coach.html; recovery precomputed.
const MARA_BASE: Omit<MonitorSeries, "recovery"> = {
  weeks: 12,
  acute: [300, 320, 340, 300, 360, 380, 400, 320, 420, 700, 380, 340],
  hrv: [72, 71, 70, 73, 69, 70, 68, 72, 67, 62, 64, 69], hrvBase: 70,
  rhr: [49, 50, 50, 48, 51, 50, 52, 49, 53, 56, 54, 50], rhrBase: 50,
  imr: [66, 68, 70, 69, 76, 78, 80, 79, 86, 93, 88, 89],
  wellness: [82, 80, 78, 83, 74, 72, 70, 80, 66, 58, 62, 70],
};

const withRec = (b: Omit<MonitorSeries, "recovery">): MonitorSeries =>
  ({ ...b, recovery: recoverySeries({ ...b, recovery: [] }) });

export const SEED_SERIES: Record<string, MonitorSeries> = {
  mv: withRec(MARA_BASE),
  // ds/lr/sm/ap/bg/cf: DIRECT-AUTHOR each (typed MonitorSeries) toward a chosen
  // DERIVED CURRENT-WEEK CELL (rosterStatus = worse-of last-week acwr+recovery).
  // Do NOT chase the mockup's exact acwr/rec floats — for a tapering/ramping athlete
  // the last-week ACWR ratio sits near 1 (the 4-week chronic tracks the trend), so
  // 1.58 is not reachably the *last-week* ratio. Drive the CELL instead:
  //   - the LAST-WEEK CELL is dominated by whichever axis is worse;
  //   - recovery is the controllable lever: set the last hrv/rhr/wellness so
  //     recoverySeries(...).at(-1) lands in the target band (<70 alert / <80 warn / else ok);
  //   - for an alert *load* contribution, make the final week a clear spike over the
  //     prior 3 (acwr(acute).at(-1) > 1.5) AND/OR craters recovery.
  // Target current-week cells (pinned in Task 27's roster.test.ts — author to these,
  // then read the test output and pin the EXACT derived cell it reports):
  //   Diego  → "alert"  (low recovery tail < 70, e.g. rec ~54; optional final load spike)
  //   Lucía  → "ok"     (recovery ≥ 80 and acwr in 0.8..1.3 on the last week)
  //   Sofía  → "warn"   (recovery 70..79 on the last week)
  //   Ana    → "ok"
  //   Bruno  → "alert"  (recovery < 70 tail, e.g. rec ~69)
  //   Caro   → "ok"
  // tl: intentionally ABSENT → getSeries("tl") === undefined (no-data exemplar).
};

export const SEED_CYCLE: Record<string, { share: CycleShare; state: CycleState }> = {
  // Mara: full/regular reproduces the luteal context M4 consumes.
  mv: { share: "full", state: "regular" },
  // Default elsewhere is share "min"/state "regular" (LocalRepository fills the gap).
};
```

- [ ] **Step 2: Typecheck**
Run: `pnpm --filter @holy-oly/web typecheck`
Expected: no errors. (The 6 non-Mara athletes' derived current-week cells are PINNED in the roster projection test in Task 27; author the arrays toward the target cells above, then run Task 27 and pin the exact derived cell it reports. If a cell is off, tune that athlete's `hrv`/`rhr`/`wellness` tail (recovery is the controllable lever) and/or the final `acute` value here.)

- [ ] **Step 3: Commit**
```bash
git add apps/web/src/data/seeds.ts
git commit -m "$(cat <<'EOF'
feat(web): deterministic seeds (roster + series + cycle)

8 athletes from equipo.html as core.Atleta; método in a side ROSTER_META map
(not on the domain type). Mara from coach.html's real arrays (recovery
precomputed); 6 others direct-authored toward a chosen derived current-week
cell (pinned in Task 27), NOT the mockup's exact acwr/rec floats; Tomás
intentionally seeded with NO series (no-data exemplar, diverging from the
mockup where he has data). Mara cycle full/regular; min/regular default
elsewhere.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 22: `LocalRepository` + tests

**Files:**
- Create: `apps/web/src/data/LocalRepository.ts`, `apps/web/src/data/LocalRepository.test.ts`

> `implements Repository`; injectable `Storage` (default `localStorage`) for a vitest memory shim; idempotent `init()` guarded by `ho:seeded` so a refresh doesn't clobber edits (an added medal, an assigned comp). The cycle methods perform the **redaction**: `getCycleContext` returns `undefined` for `none`, `inLutealNow:null` for `min`, a populated view for `full`, and `health:"referral"` for `amenorrhea`.
>
> NOTE on `__setCycleForTest`: it is a test-only writer that DOES exist on the production class (name-flagged with `__`), so the "no coach-side cycle setter" guarantee is enforced by the `Repository` *interface* (which has no setter) and by convention, not by the class being physically incapable of writing. Acceptable for M3 (the seam that matters is the interface screens consume); if a future audit wants the production class itself clean, move it to a vitest-only subclass. The `ds` amenorrhea and `lr` none assertions rely on it.

- [ ] **Step 1: Write the failing test `LocalRepository.test.ts`**
```ts
import { beforeEach, describe, it, expect } from "vitest";
import { LocalRepository } from "./LocalRepository";
import type { Medal } from "@holy-oly/core";

// In-memory Storage shim (no jsdom localStorage needed).
class MemStorage implements Storage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.get(k) ?? null; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  removeItem(k: string) { this.m.delete(k); }
  setItem(k: string, v: string) { this.m.set(k, v); }
}

const medal: Medal = { comp: "Nacional", date: "2026-03-01", cat: "73kg", medal: "oro", sn: 90, cj: 115, place: "1" };

describe("LocalRepository", () => {
  let store: MemStorage;
  let repo: LocalRepository;
  beforeEach(() => { store = new MemStorage(); repo = new LocalRepository(store); repo.init(); });

  it("seeds a roster of 8 with Mara having a series", async () => {
    expect((await repo.getRoster())).toHaveLength(8);
    expect(await repo.getSeries("mv")).toBeDefined();
  });

  it("getSeries is undefined for the no-data athlete (Tomás)", async () => {
    expect(await repo.getSeries("tl")).toBeUndefined();
  });

  it("init is idempotent: re-init does not clobber an added medal", async () => {
    await repo.addMedal("mv", medal);
    new LocalRepository(store).init(); // simulate refresh
    expect(await repo.getMedals("mv")).toHaveLength(1);
  });

  it("cycle redaction: min→populated (luteal null), full→populated, amenorrhea→referral, none→undefined", async () => {
    // Default policy: athletes with no SEED_CYCLE entry are seeded share="min".
    // min is SHARED-but-redacted → a populated CONTEXT with inLutealNow:null + health "ok"
    // (it is NOT undefined; only share="none" yields undefined).
    const tomas = await repo.getCycleContext("tl");
    expect(tomas?.share).toBe("min");
    expect(tomas?.inLutealNow).toBeNull();
    expect(tomas?.health).toBe("ok");
    // Mara is full/regular:
    const mara = await repo.getCycleContext("mv");
    expect(mara?.share).toBe("full");
    expect(mara?.health).toBe("ok");
    // amenorrhea athlete (set directly via the test-only writer) -> referral
    await repo.__setCycleForTest("ds", "full", "amenorrhea");
    expect((await repo.getCycleContext("ds"))?.health).toBe("referral");
    // a TRULY-none athlete (set directly) -> undefined (the only undefined case)
    await repo.__setCycleForTest("lr", "none", "regular");
    expect(await repo.getCycleContext("lr")).toBeUndefined();
  });

  it("corrupt JSON falls back instead of throwing", async () => {
    store.setItem("ho:roster", "{not json");
    await expect(repo.getRoster()).resolves.toBeInstanceOf(Array);
  });
});
```
> Pinned correctly up front (no "adjust during GREEN"): the seed default is `min`, so `getCycleContext("tl")` is a populated, redacted view (`inLutealNow:null`, `health:"ok"`), and the *only* `undefined` case is a genuine `share==="none"` set via `__setCycleForTest`. `__setCycleForTest` is a thin test-only writer over `KEYS.cycleShare`/`cycleState` (no coach-facing cycle setter exists on the Repository surface by design — see Task 22 note on the production class).

- [ ] **Step 2: Run to verify it fails**
Run: `pnpm --filter @holy-oly/web test LocalRepository`
Expected: FAIL — no `LocalRepository`.

- [ ] **Step 3: Implement `LocalRepository.ts`**
```ts
import type {
  Repository, Atleta, Plan, Medal, Competencia, MonitorSeries,
  CycleShare, CycleState, CycleContext,
} from "@holy-oly/core";
import { JsonStore } from "./storage";
import { KEYS } from "./keys";
import { SEED_ROSTER, SEED_SERIES, SEED_CYCLE } from "./seeds";

export class LocalRepository implements Repository {
  private s: JsonStore;
  constructor(backend: Storage = localStorage) { this.s = new JsonStore(backend); }

  /** Idempotent: seeds once, guarded by ho:seeded so refresh keeps edits. */
  init(): void {
    if (this.s.has(KEYS.seeded)) return;
    this.s.set(KEYS.roster, SEED_ROSTER);
    for (const a of SEED_ROSTER) {
      const series = SEED_SERIES[a.id];
      if (series) this.s.set(KEYS.series(a.id), series);
      const cyc = SEED_CYCLE[a.id] ?? { share: "min" as CycleShare, state: "regular" as CycleState };
      this.s.set(KEYS.cycleShare(a.id), cyc.share);
      this.s.set(KEYS.cycleState(a.id), cyc.state);
    }
    this.s.set(KEYS.seeded, true);
  }

  async getRoster(): Promise<Atleta[]> { return this.s.get<Atleta[]>(KEYS.roster, []); }
  async getAthlete(id: string): Promise<Atleta | undefined> {
    return (await this.getRoster()).find((a) => a.id === id);
  }
  async getSeries(id: string): Promise<MonitorSeries | undefined> {
    return this.s.getOptional<MonitorSeries>(KEYS.series(id));
  }
  async getPlan(id: string): Promise<Plan | undefined> {
    return this.s.getOptional<Plan>(KEYS.plan(id));
  }
  async savePlan(plan: Plan): Promise<void> { this.s.set(KEYS.plan(plan.atletaId), plan); }
  async getMedals(id: string): Promise<Medal[]> { return this.s.get<Medal[]>(KEYS.medals(id), []); }
  async addMedal(id: string, medal: Medal): Promise<void> {
    this.s.set(KEYS.medals(id), [...(await this.getMedals(id)), medal]);
  }
  async getComps(id: string): Promise<Competencia[]> { return this.s.get<Competencia[]>(KEYS.comps(id), []); }
  async setComps(id: string, comps: Competencia[]): Promise<void> { this.s.set(KEYS.comps(id), comps); }

  async getCycleShare(id: string): Promise<CycleShare> {
    return this.s.get<CycleShare>(KEYS.cycleShare(id), "none");
  }
  /** Redaction by construction: never exposes phase/day/symptom. */
  async getCycleContext(id: string): Promise<CycleContext | undefined> {
    const share = await this.getCycleShare(id);
    if (share === "none") return undefined;
    const state = this.s.get<CycleState>(KEYS.cycleState(id), "regular");
    const reliable = state === "regular";
    const health: CycleContext["health"] = state === "amenorrhea" ? "referral" : "ok";
    // "min" share never reveals the luteal flag; "full" could (placeholder false until the athlete slice computes it).
    const inLutealNow = share === "full" ? false : null;
    return { share, inLutealNow, health, reliable };
  }

  /** Test-only cycle writer (no coach-facing cycle setter exists by design). */
  __setCycleForTest(id: string, share: CycleShare, state: CycleState): void {
    this.s.set(KEYS.cycleShare(id), share);
    this.s.set(KEYS.cycleState(id), state);
  }
}
```

- [ ] **Step 4: Run to verify it passes**
Run: `pnpm --filter @holy-oly/web test LocalRepository`
Expected: PASS (the cycle assertions are pinned in Step 1 to the seed default; no GREEN-time adjustment needed).

- [ ] **Step 5: Commit**
```bash
git add apps/web/src/data/LocalRepository.ts apps/web/src/data/LocalRepository.test.ts
git commit -m "$(cat <<'EOF'
feat(web): LocalRepository over ho: storage

implements core.Repository; injectable Storage (memory shim for tests);
idempotent init() guarded by ho:seeded (refresh keeps added medals/comps).
getSeries undefined for the no-data athlete; getCycleContext redacts by
construction (none→undefined, min→null luteal, amenorrhea→referral).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 23: `RepositoryProvider` (the ApiRepository seam)

**Files:**
- Create: `apps/web/src/data/RepositoryProvider.tsx`, `apps/web/src/data/__tests__/RepositoryProvider.test.tsx`

> The single seam where `ApiRepository` swaps in. Screens import only `useRepository()` + `core`, never `storage`/`keys`/`LocalRepository`. The provider runs `init()` once. This task DOES have runtime behavior (the throw-outside-provider guard and the once-only `init()` memoization), so it gets a small direct test — cheap, and the kind of behavior the plan tests elsewhere.

- [ ] **Step 1: Write the failing test `__tests__/RepositoryProvider.test.tsx`**
```tsx
import { render, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { RepositoryProvider, useRepository } from "../RepositoryProvider";
import type { Repository } from "@holy-oly/core";

test("useRepository outside a provider throws", () => {
  // renderHook with no wrapper → the hook runs outside any provider.
  expect(() => renderHook(() => useRepository())).toThrow(/RepositoryProvider/);
});

test("init() runs exactly once, even across re-renders", () => {
  let inits = 0;
  // Minimal stub implementing just enough of Repository + an init() the provider calls.
  const repo = { init: () => { inits += 1; } } as unknown as Repository & { init(): void };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <RepositoryProvider repo={repo}>{children}</RepositoryProvider>
  );
  const { rerender } = render(<div />, { wrapper });
  rerender(<div />); // same repo prop → useMemo must not re-run init
  expect(inits).toBe(1);
});
```

- [ ] **Step 2: Run to verify it fails**
Run: `pnpm --filter @holy-oly/web test RepositoryProvider`
Expected: FAIL — no `RepositoryProvider`/`useRepository`.

- [ ] **Step 3: Create `apps/web/src/data/RepositoryProvider.tsx`**
```tsx
import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Repository } from "@holy-oly/core";
import { LocalRepository } from "./LocalRepository";

const RepoContext = createContext<Repository | null>(null);

export function RepositoryProvider({ children, repo }: { children: ReactNode; repo?: Repository }) {
  const value = useMemo(() => {
    const r = repo ?? new LocalRepository();
    (r as LocalRepository).init?.();
    return r;
  }, [repo]);
  return <RepoContext.Provider value={value}>{children}</RepoContext.Provider>;
}

export function useRepository(): Repository {
  const r = useContext(RepoContext);
  if (!r) throw new Error("useRepository must be used within <RepositoryProvider>");
  return r;
}
```
> `repo` prop lets tests inject a memory-backed `LocalRepository`; production uses the default (`localStorage`). `init()` runs inside `useMemo([repo])`, so it fires once per repo identity (the once-only test), and the missing-context branch throws (the outside-provider test).

- [ ] **Step 4: Run to verify it passes + typecheck**
Run: `pnpm --filter @holy-oly/web test RepositoryProvider && pnpm --filter @holy-oly/web typecheck`
Expected: both tests PASS; typecheck clean.

- [ ] **Step 5: Commit**
```bash
git add apps/web/src/data/RepositoryProvider.tsx "apps/web/src/data/__tests__/RepositoryProvider.test.tsx"
git commit -m "$(cat <<'EOF'
feat(web): RepositoryProvider (single ApiRepository seam)

React context + useRepository(); runs LocalRepository.init() once (useMemo).
Screens consume only useRepository() + core, never storage. Injectable repo
for tests. Tested: throws outside a provider; init() runs exactly once.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

> **Layer B done when:** `pnpm --filter @holy-oly/web test LocalRepository RepositoryProvider` is green (round-trip + idempotency + cycle redaction + corrupt-storage + outside-provider-throws + init-once) and `useRepository()` returns a seeded repo.

---

### Equipo screen — `apps/web/src/screens/coach`

### Task 24: Shared status palette (`ui/status.ts`)

**Files:**
- Create: `apps/web/src/ui/status.ts`

> The ONE place estado→color is hardcoded for status (mirrors `MacroTimeline`'s discipline: charts use color=estado, chrome uses `--wl-*` tokens; never `--wl-accent` for status). Deduped from `Badge`'s tones; `Badge` keeps its own literals for now (refactoring `Badge` to import `STATUS` is optional and out of M3 scope). The four-state `none` uses the muted token.

- [ ] **Step 1: Create `apps/web/src/ui/status.ts`**
```ts
import type { CellState } from "@holy-oly/core";

/** estado → color. Single source for status color across the new charts. */
export const STATUS: Record<CellState, string> = {
  ok: "#1bc98a",
  warn: "#ffab2e",
  alert: "#ff3b46",
  none: "var(--wl-muted)",
};

/** Mockup compat: 0=ok, 1=warn, 2=alert (history arrays were ints). */
export function intToState(n: number): CellState {
  return n === 2 ? "alert" : n === 1 ? "warn" : "ok";
}
export function stateToInt(s: CellState): number {
  return s === "alert" ? 2 : s === "warn" ? 1 : 0;
}
```

- [ ] **Step 2: Typecheck**
Run: `pnpm --filter @holy-oly/web typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**
```bash
git add apps/web/src/ui/status.ts
git commit -m "$(cat <<'EOF'
feat(web): shared STATUS palette (estado -> color)

ui/status.ts: the single place estado->color is hardcoded for status charts
(mirrors MacroTimeline discipline). Deduped from Badge tones; none=--wl-muted.
intToState/stateToInt for mockup int-history compat.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 25: `Heatmap` chart (presentational)

**Files:**
- Create: `apps/web/src/ui/charts/Heatmap.tsx`, `apps/web/src/ui/__tests__/heatmap.test.tsx`

> Presentational (no fetching). Props `{ rows, weeks, onPick }`. CSS-grid port of `.hm`: sticky 104px name column, horizontal-scroll week columns, week-number header row, 22×22 cells gap 3px. Cell bg = `STATUS[cell]` with the mockup opacity rule (ok→.55, warn/alert→.92); the 4th case `cell==="none"` → transparent fill + 1px dashed `--wl-muted` border (hollow, no estado color). Competidor flag = reuse `Medal` (`metal="oro"` size 14) pinned top-right of the name cell — NOTE: this renders a `role="img" aria-label="Oro"` node per competidor (3 in the seed), so never query the competidor flag with a bare `getByRole("img",{name:"Oro"})`; it would throw on the duplicate accessible name. The name cell carries `role="button"` + `aria-label={nombre}` so clicks target it unambiguously. Name cell `onClick` → `onPick(id)`. Wrap in `Card`.

- [ ] **Step 1: Write the failing test `heatmap.test.tsx`**
```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { Heatmap } from "../charts/Heatmap";
import type { RosterRow } from "../../screens/coach/roster";

const rows: RosterRow[] = [
  { id: "mv", nombre: "Mara V.", iniciales: "MV", metodo: "Ruso 5D", compite: true,
    acwr: 0.74, rec: 77, cell: "warn", history: ["ok","ok","warn","ok","ok","warn","ok","warn","warn","alert","warn","warn"] },
  { id: "tl", nombre: "Tomás L.", iniciales: "TL", metodo: "Polaco 5D", compite: false,
    acwr: undefined, rec: undefined, cell: "none", history: ["none","none","none","none","none","none","none","none","none","none","none","none"] },
];

test("renders one name cell per row and calls onPick with the athlete id", () => {
  const picked: string[] = [];
  render(<Heatmap rows={rows} weeks={12} onPick={(id) => picked.push(id)} />);
  // Query the role=button name cell (the click target), not the inner <b> text node.
  fireEvent.click(screen.getByRole("button", { name: "Mara V." }));
  expect(picked).toEqual(["mv"]);
  expect(screen.getAllByRole("button")).toHaveLength(2); // one name cell per row
});

test("renders a week-number header with exactly `weeks` cells", () => {
  const { container } = render(<Heatmap rows={rows} weeks={12} onPick={() => {}} />);
  // Assert the COUNT of header cells (proves it is the week header), not a bare text match
  // on "12" (which could collide with método/acwr/rec numerics elsewhere on screen).
  const headerCells = container.querySelectorAll('[data-testid="hm-week"]');
  expect(headerCells).toHaveLength(12);
  expect(headerCells[11]).toHaveTextContent("12");
});
```

- [ ] **Step 2: Run to verify it fails**
Run: `pnpm --filter @holy-oly/web test heatmap`
Expected: FAIL — no `Heatmap` (and `RosterRow` type lands in Task 27; if the import errors, define a local minimal type in the test and switch to the real one after Task 27, or implement Task 27's `roster.ts` type export first — see note).

> NOTE on ordering: `RosterRow` is defined in `screens/coach/roster.ts` (Task 27). To keep tasks independently runnable, **create the `RosterRow` interface export in `roster.ts` as the first sub-step here** (just the type, no `getRosterRows` yet), then implement the full projection in Task 27. The type is tiny and shared by Heatmap, RiskQuadrant, and Equipo.

- [ ] **Step 3: Implement `Heatmap.tsx`**
```tsx
import { Card } from "../Card";
import { Medal } from "../Medal";
import { STATUS } from "../status";
import type { RosterRow } from "../../screens/coach/roster";

const NAME_W = 104;
const CELL = 22;

function cellStyle(c: RosterRow["history"][number]): React.CSSProperties {
  if (c === "none") {
    return { width: CELL, height: CELL, borderRadius: 4, flex: "0 0 auto",
      background: "transparent", border: "1px dashed var(--wl-muted)" };
  }
  return { width: CELL, height: CELL, borderRadius: 4, flex: "0 0 auto",
    background: STATUS[c], opacity: c === "ok" ? 0.55 : 0.92 };
}

export function Heatmap({ rows, weeks, onPick }:
  { rows: RosterRow[]; weeks: number; onPick: (id: string) => void }) {
  return (
    <Card>
      <div style={{ fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 13.5, color: "var(--wl-text)" }}>
        Estado del plantel
      </div>
      <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--wl-muted)", margin: "3px 0 9px" }}>
        una fila por atleta · color = estado · deslizá → para ver historial
      </div>
      <div style={{ overflowX: "auto" }}>
        {/* week-number header */}
        <div style={{ display: "flex", alignItems: "center", height: 20 }}>
          <div style={{ position: "sticky", left: 0, zIndex: 2, flex: `0 0 ${NAME_W}px`, width: NAME_W, background: "var(--wl-surface)" }} />
          <div style={{ display: "flex", gap: 3, padding: "0 10px 0 4px" }}>
            {Array.from({ length: weeks }).map((_, i) => (
              <span key={i} data-testid="hm-week" style={{ width: CELL, textAlign: "center", fontFamily: "var(--mono)", fontSize: 7.5, color: "var(--wl-muted)", flex: "0 0 auto" }}>{i + 1}</span>
            ))}
          </div>
        </div>
        {/* rows */}
        {rows.map((r) => (
          <div key={r.id} style={{ display: "flex", alignItems: "center", height: 34, borderTop: "1px solid color-mix(in srgb,var(--wl-text) 6%,transparent)" }}>
            <div onClick={() => onPick(r.id)} role="button" aria-label={r.nombre}
              style={{ position: "sticky", left: 0, zIndex: 2, flex: `0 0 ${NAME_W}px`, width: NAME_W, padding: "0 10px", background: "var(--wl-surface)", cursor: "pointer" }}>
              {r.compite && (
                <span style={{ position: "absolute", top: 5, right: 6, lineHeight: 0 }} title="Compite">
                  <Medal metal="oro" size={14} />
                </span>
              )}
              <b style={{ fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 11.5, color: "var(--wl-text)", display: "block", lineHeight: 1.05, paddingRight: 16 }}>{r.nombre}</b>
              <span style={{ fontFamily: "var(--mono)", fontSize: 8, color: "var(--wl-muted)" }}>{r.metodo}</span>
            </div>
            <div style={{ display: "flex", gap: 3, padding: "0 10px 0 4px" }}>
              {r.history.map((c, i) => <div key={i} style={cellStyle(c)} />)}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
```

- [ ] **Step 4: Run to verify it passes**
Run: `pnpm --filter @holy-oly/web test heatmap`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add apps/web/src/ui/charts/Heatmap.tsx apps/web/src/ui/__tests__/heatmap.test.tsx apps/web/src/screens/coach/roster.ts
git commit -m "$(cat <<'EOF'
feat(web): Heatmap chart (presentational)

CSS-grid port of equipo.html .hm: sticky 104px name column, 22x22 cells,
opacity .55/.92 by estado, hollow dashed cell for none, Medal competidor
flag, name onClick -> onPick. Reads RosterRow only; wrapped in Card.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 26: `RiskQuadrant` chart (presentational SVG)

**Files:**
- Create: `apps/web/src/ui/charts/RiskQuadrant.tsx`, `apps/web/src/ui/__tests__/risk-quadrant.test.tsx`

> Presentational SVG following the `MacroTimeline` idiom (viewBox + `--wl-*` chrome + hardcoded estado dots). Props `{ points, noData, onPick }`. Hardcode the mockup bounds as named consts (`AXLO=0.6, AXHI=1.7, RYLO=48, RYHI=94`); `x(v)`/`y(v)`; safe-zone rect (ACWR .8–1.3 fill `STATUS.ok` @.10), risk-zone rect (ACWR>1.3 ∧ rec<70 fill `STATUS.alert` @.12) + "zona de riesgo" label; 1.0 ref line; X ticks `[.8,1.0,1.3,1.5]`; axes "CARGA · ACWR →" / "← RECUPERACIÓN". Each assessed athlete = `<g onClick>` circle r=11 fill `STATUS[cell]` + initials; **BOTH axes clamped** — ACWR to `[AXLO,AXHI]` (an extreme value stays on-canvas) AND recovery to `[RYLO,RYHI]` (hand-authored seeds aren't guaranteed in 48..94, so an out-of-range `rec` would otherwise draw a dot above/below the plot). **dot color = `point.cell` = `rosterStatus` = worse-of(ACWR,recovery) of the last week**, so the dot color is consistent with its position in the ACWR×recovery plane (a dot inside the risk-zone rect can never be green). **No-data athletes are NOT plotted** — instead a small "sin datos (n): …" tray under the SVG. Wrap in `Card` titled "Riesgo ahora".

- [ ] **Step 1: Write the failing test `risk-quadrant.test.tsx`**
```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { RiskQuadrant, type QuadPoint } from "../charts/RiskQuadrant";

const points: QuadPoint[] = [
  // A risk-zone athlete: high load + low recovery. cell is worse-of = "alert".
  { id: "ds", iniciales: "DS", acwr: 1.55, rec: 54, cell: "alert" },
  { id: "mv", iniciales: "MV", acwr: 0.74, rec: 77, cell: "warn" },
];

test("plots one dot per assessed athlete and calls onPick", () => {
  const picked: string[] = [];
  const { container } = render(<RiskQuadrant points={points} noData={[]} onPick={(id) => picked.push(id)} />);
  expect(container.querySelectorAll("circle").length).toBe(2);
  fireEvent.click(screen.getByText("MV"));
  expect(picked).toEqual(["mv"]);
});

test("a risk-zone athlete (high acwr + low rec) is colored alert — dot color matches position", () => {
  const { container } = render(<RiskQuadrant points={points} noData={[]} onPick={() => {}} />);
  // The DS dot is in the risk zone; its fill must be STATUS.alert, never green.
  const dsCircle = container.querySelector('g[data-id="ds"] circle') as SVGCircleElement;
  expect(dsCircle).toBeTruthy();
  expect(dsCircle.style.fill).toContain("#ff3b46"); // STATUS.alert; not STATUS.ok
});

test("shows a 'sin datos' tray for no-data athletes (not plotted)", () => {
  render(<RiskQuadrant points={points} noData={[{ id: "tl", iniciales: "TL" }]} onPick={() => {}} />);
  expect(screen.getByText(/sin datos/i)).toBeInTheDocument();
  expect(screen.getByText(/TL/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify it fails**
Run: `pnpm --filter @holy-oly/web test risk-quadrant`
Expected: FAIL — no `RiskQuadrant`.

- [ ] **Step 3: Implement `RiskQuadrant.tsx`**
Port `quad()` from `equipo.html` (lines 119-137) to JSX, swapping the mockup `ST`/`STC` for the shared `STATUS` and the global bounds for named consts. Geometry verbatim: `S=300, pad=30`.
```tsx
import { Card } from "../Card";
import { STATUS } from "../status";
import type { CellState } from "@holy-oly/core";

export interface QuadPoint { id: string; iniciales: string; acwr: number; rec: number; cell: CellState; }
export interface NoDataPoint { id: string; iniciales: string; }

const S = 300, PAD = 30;
const AXLO = 0.6, AXHI = 1.7, RYLO = 48, RYHI = 94;
const x = (v: number) => PAD + ((v - AXLO) / (AXHI - AXLO)) * (S - PAD - 12);
const y = (v: number) => 12 + (1 - (v - RYLO) / (RYHI - RYLO)) * (S - PAD - 12);
const clampX = (v: number) => Math.max(AXLO, Math.min(AXHI, v));
const clampY = (v: number) => Math.max(RYLO, Math.min(RYHI, v));

export function RiskQuadrant({ points, noData, onPick }:
  { points: QuadPoint[]; noData: NoDataPoint[]; onPick: (id: string) => void }) {
  return (
    <Card>
      <div style={{ fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 13.5, color: "var(--wl-text)" }}>Riesgo ahora</div>
      <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--wl-muted)", margin: "3px 0 9px" }}>carga (ACWR) × recuperación · tocá un punto</div>
      <div style={{ padding: "0 10px" }}>
        <svg data-testid="risk-quadrant" viewBox={`0 0 ${S} ${S}`} width="100%" height={S} role="img" aria-label="Cuadrante de riesgo ACWR × recuperación">
          {/* safe band ACWR 0.8–1.3 */}
          <rect x={x(0.8)} y={12} width={x(1.3) - x(0.8)} height={S - PAD - 12} style={{ fill: STATUS.ok, opacity: 0.1 }} />
          {/* risk zone ACWR>1.3 ∧ rec<70 */}
          <rect x={x(1.3)} y={y(70)} width={x(AXHI) - x(1.3)} height={y(RYLO) - y(70)} style={{ fill: STATUS.alert, opacity: 0.12 }} />
          <text x={x(AXHI) - 4} y={y(RYLO) - 6} textAnchor="end" fontSize={8.5} style={{ fill: STATUS.alert }} fontFamily="JetBrains Mono">zona de riesgo</text>
          {/* refs + axes */}
          <line x1={x(1.0)} x2={x(1.0)} y1={12} y2={S - PAD} style={{ stroke: "var(--wl-muted)", opacity: 0.2 }} strokeDasharray="2 3" />
          <line x1={PAD} x2={S - 12} y1={S - PAD} y2={S - PAD} style={{ stroke: "var(--wl-muted)", opacity: 0.3 }} />
          <line x1={PAD} x2={PAD} y1={12} y2={S - PAD} style={{ stroke: "var(--wl-muted)", opacity: 0.3 }} />
          {[0.8, 1.0, 1.3, 1.5].map((t) => (
            <text key={t} x={x(t)} y={S - PAD + 12} textAnchor="middle" fontSize={8} style={{ fill: "var(--wl-muted)" }} fontFamily="JetBrains Mono">{t.toFixed(1)}</text>
          ))}
          <text x={(PAD + S - 12) / 2} y={S - 4} textAnchor="middle" fontSize={8.5} style={{ fill: "var(--wl-muted)" }} fontFamily="Chakra Petch" letterSpacing=".05em">CARGA · ACWR →</text>
          <text x={11} y={(S - PAD) / 2} fontSize={8.5} style={{ fill: "var(--wl-muted)" }} fontFamily="Chakra Petch" transform={`rotate(-90 11 ${((S - PAD) / 2).toFixed(1)})`} textAnchor="middle">← RECUPERACIÓN</text>
          {/* dots — clamp BOTH axes so extremes/out-of-range values stay on canvas */}
          {points.map((p) => {
            const cx = x(clampX(p.acwr)), cy = y(clampY(p.rec));
            return (
              <g key={p.id} data-id={p.id} style={{ cursor: "pointer" }} onClick={() => onPick(p.id)}>
                <circle cx={cx} cy={cy} r={11} style={{ fill: STATUS[p.cell], opacity: 0.9 }} />
                <text x={cx} y={cy + 3} textAnchor="middle" fontSize={8.5} fontWeight={800} fill="#0b0b11" fontFamily="Chakra Petch">{p.iniciales}</text>
              </g>
            );
          })}
        </svg>
      </div>
      {noData.length > 0 && (
        <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--wl-muted)", padding: "6px 13px 0" }}>
          sin datos ({noData.length}): {noData.map((n) => n.iniciales).join(", ")}
        </div>
      )}
    </Card>
  );
}
```

- [ ] **Step 4: Run to verify it passes**
Run: `pnpm --filter @holy-oly/web test risk-quadrant`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add apps/web/src/ui/charts/RiskQuadrant.tsx apps/web/src/ui/__tests__/risk-quadrant.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): RiskQuadrant chart (presentational SVG)

Port of equipo.html quad() to the MacroTimeline idiom: named bounds
(AXLO/AXHI/RYLO/RYHI), safe + risk-zone rects, 1.0 ref, ticks, axes. Dots
colored via STATUS[cell] (worse-of acwr+recovery) so color matches position
(no green dot in the red zone); BOTH axes clamped on-canvas (clampX/clampY).
No-data athletes are not plotted; shown in a 'sin datos' tray. onPick by id.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 27: Roster projection (`screens/coach/roster.ts`)

**Files:**
- Create/extend: `apps/web/src/screens/coach/roster.ts`, `apps/web/src/screens/coach/roster.test.ts`

> The thin-consumer core: one async helper builds the `RosterRow[]` the three sub-components read. `getRoster()` then `Promise.all(getSeries(id))`, deriving per athlete via `core` (`rosterStatus`, `acwr`, `recoverySeries` last value, `seriesState` per week). **No stored acwr/rec duplication** — the series is the single source of truth. The `RosterRow` interface was stubbed in Task 25; this task fills in `getRosterRows`. método comes from `ROSTER_META`. **This test is the GREEN gate for the seeds (Task 21):** it pins the DERIVED current-week `cell` for ALL 8 athletes — the headline triage output — so a garbage/empty hand-authored array cannot ship green. The pinned cells are the **derived** worse-of states (Mara `warn` at her deload trough, NOT the mockup's hand-set snapshot); for the 6 direct-authored athletes, author toward the target cells in Task 21, run this test, then pin the exact cell it reports.

- [ ] **Step 1: Ensure `roster.ts` exports the `RosterRow` type (from Task 25), then write the failing test `roster.test.ts`**
```ts
import { describe, it, expect } from "vitest";
import type { CellState } from "@holy-oly/core";
import { LocalRepository } from "../../data/LocalRepository";
import { getRosterRows } from "./roster";

class MemStorage implements Storage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.get(k) ?? null; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  removeItem(k: string) { this.m.delete(k); }
  setItem(k: string, v: string) { this.m.set(k, v); }
}

describe("getRosterRows", () => {
  it("derives a row per athlete; the no-data athlete has undefined acwr/rec and cell none", async () => {
    const repo = new LocalRepository(new MemStorage()); repo.init();
    const rows = await getRosterRows(repo);
    expect(rows).toHaveLength(8);
    const tomas = rows.find((r) => r.id === "tl")!;
    expect(tomas.acwr).toBeUndefined();
    expect(tomas.rec).toBeUndefined();
    expect(tomas.cell).toBe("none");
    expect(tomas.history.every((c) => c === "none")).toBe(true);
    const mara = rows.find((r) => r.id === "mv")!;
    expect(mara.metodo).toBe("Ruso 5D");
    expect(typeof mara.acwr).toBe("number");
    expect(mara.history).toHaveLength(12);
  });

  it("pins the DERIVED current-week cell for every athlete (the triage headline)", async () => {
    const repo = new LocalRepository(new MemStorage()); repo.init();
    const rows = await getRosterRows(repo);
    const cellOf = (id: string) => rows.find((r) => r.id === id)!.cell;
    // Derived worse-of(acwr,recovery) of the LAST week — these are the seeds' GREEN gate.
    // Mara week-12 is a deload trough: acwr 0.739 / rec 77 → both warn → "warn" (verified).
    const expected: Record<string, CellState> = {
      mv: "warn",   // Mara — pinned to the real derivation, NOT the mockup snapshot
      ds: "alert",  // Diego — low-recovery tail
      lr: "ok",     // Lucía
      sm: "warn",   // Sofía
      tl: "none",   // Tomás — no series
      ap: "ok",     // Ana
      bg: "alert",  // Bruno — low-recovery tail
      cf: "ok",     // Caro
    };
    for (const [id, cell] of Object.entries(expected)) {
      expect(cellOf(id), `athlete ${id} current-week cell`).toBe(cell);
    }
  });
});
```
> The 6 non-Mara cells are the **authoring contract for Task 21**: implement the seeds so these hold. If a derived cell differs after honest authoring (e.g. you choose a different plausible state for an athlete), update BOTH this `expected` map AND the four-bucket counts in Task 28 — they must stay consistent (the buckets are just the tally of these cells). Mara/Tomás are fixed (real data / no data) and must not change.

- [ ] **Step 2: Run to verify it fails**
Run: `pnpm --filter @holy-oly/web test roster`
Expected: FAIL — `getRosterRows` not implemented.

- [ ] **Step 3: Implement `getRosterRows` in `roster.ts`**
```ts
import { acwr, rosterStatus, seriesState, type CellState, type Repository } from "@holy-oly/core";
import { ROSTER_META } from "../../data/seeds";

export interface RosterRow {
  id: string;
  nombre: string;
  iniciales: string;
  metodo: string;
  compite: boolean;
  acwr: number | undefined;
  rec: number | undefined;
  cell: CellState;
  history: CellState[];
}

export async function getRosterRows(repo: Repository): Promise<RosterRow[]> {
  const roster = await repo.getRoster();
  const seriesList = await Promise.all(roster.map((a) => repo.getSeries(a.id)));
  return roster.map((a, i) => {
    const s = seriesList[i];
    const weeks = s?.weeks ?? 0;
    const lastAcwr = s ? acwr(s.acute).at(-1) : undefined;
    return {
      id: a.id,
      nombre: a.nombre,
      iniciales: a.iniciales,
      metodo: ROSTER_META[a.id]?.metodo ?? "",
      compite: !!a.compite,
      acwr: lastAcwr != null && Number.isFinite(lastAcwr) ? lastAcwr : undefined,
      rec: s ? s.recovery.at(-1) : undefined,
      cell: rosterStatus(s),
      history: Array.from({ length: weeks }, (_, w) => seriesState(s, w + 1)),
    };
  });
}
```

- [ ] **Step 4: Run to verify it passes**
Run: `pnpm --filter @holy-oly/web test roster`
Expected: PASS. If a non-Mara seed's derived `acwr`/`rec` is far from the mockup target, tune that athlete's arrays in `seeds.ts` (Task 21) and re-run.

- [ ] **Step 5: Commit**
```bash
git add apps/web/src/screens/coach/roster.ts apps/web/src/screens/coach/roster.test.ts
git commit -m "$(cat <<'EOF'
feat(web): roster projection (thin-consumer source of truth)

getRosterRows(repo): getRoster + Promise.all(getSeries), deriving acwr/rec/
cell/history per athlete via core (rosterStatus/acwr/seriesState). Series is
the single source of truth (no stored acwr/rec). método from ROSTER_META.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 28: `Equipo` screen + `DrilldownPlaceholder`

**Files:**
- Create: `apps/web/src/screens/coach/Equipo.tsx`, `apps/web/src/screens/coach/DrilldownPlaceholder.tsx`, `apps/web/src/screens/coach/__tests__/equipo.test.tsx`

> Composition top→bottom inside the existing device/hobar chrome, all M2 components reused: **RosterHeader** (title "Plantel", sub "N atletas · semana en curso", FOUR-bucket count strip: n en alerta · n a vigilar · n ok · n sin datos — no-data visible, not hidden; reuse `Badge` for the three status pills, muted `none` for "sin datos"), **Heatmap**, **RiskQuadrant**, **PickDetail** (the mockup `#pick` line as React state; Equipo owns `picked`; both heatmap-name and quadrant-dot clicks `setPicked`). Both clicks also `navigate('/coach/a/'+id)` (athlete id, not row index — deep-linkable, stable). PickDetail no-data: "…sin datos de monitoreo aún — ver perfil ›" (no fake numbers).

- [ ] **Step 1: Write the failing test `equipo.test.tsx`**
```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { RepositoryProvider } from "../../../data/RepositoryProvider";
import { LocalRepository } from "../../../data/LocalRepository";
import { Equipo } from "../Equipo";

class MemStorage implements Storage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.get(k) ?? null; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  removeItem(k: string) { this.m.delete(k); }
  setItem(k: string, v: string) { this.m.set(k, v); }
}

function renderEquipo() {
  const repo = new LocalRepository(new MemStorage());
  return render(
    <RepositoryProvider repo={repo}>
      <MemoryRouter initialEntries={["/coach"]}>
        <Routes>
          <Route path="/coach" element={<Equipo />} />
          <Route path="/coach/a/:id" element={<div>DRILLDOWN</div>} />
        </Routes>
      </MemoryRouter>
    </RepositoryProvider>,
  );
}

test("shows the four-bucket counts derived from the seeds (the triage headline)", async () => {
  const { container } = renderEquipo();
  // Wait for the projection effect to populate. The header pill carries data-testid="bucket-none".
  await waitFor(() => expect(container.querySelector('[data-testid="bucket-none"]')).toBeInTheDocument());
  // Counts are the tally of the per-athlete cells pinned in Task 27:
  //   alert {ds,bg}=2 · warn {mv,sm}=2 · ok {lr,ap,cf}=3 · none {tl}=1
  expect(container.querySelector('[data-testid="bucket-alert"]')).toHaveTextContent("2 en alerta");
  expect(container.querySelector('[data-testid="bucket-warn"]')).toHaveTextContent("2 a vigilar");
  expect(container.querySelector('[data-testid="bucket-ok"]')).toHaveTextContent("3 ok");
  expect(container.querySelector('[data-testid="bucket-none"]')).toHaveTextContent("1 sin datos");
});

test("the quadrant plots exactly 7 dots and Tomás (no-data) is absent from the canvas", async () => {
  const { container } = renderEquipo();
  // Scope to the quadrant SVG via data-testid — the Medal competidor flags also render
  // <circle> elements (6 each), so an unscoped "svg circle" query would over-count.
  await waitFor(() => expect(container.querySelector('[data-testid="risk-quadrant"]')).toBeInTheDocument());
  const quad = container.querySelector('[data-testid="risk-quadrant"]')!;
  // 8 athletes, 1 no-data (Tomás) → 7 plotted dots; Tomás lands in the tray instead.
  expect(quad.querySelectorAll("circle").length).toBe(7);
  // Tomás's dot group is never rendered on the canvas.
  expect(quad.querySelector('g[data-id="tl"]')).toBeNull();
});

test("clicking a name navigates to /coach/a/:id", async () => {
  renderEquipo();
  // role=button name cell (unambiguous; avoids matching the inner <b> or a PickDetail echo).
  await waitFor(() => screen.getByRole("button", { name: "Mara V." }));
  fireEvent.click(screen.getByRole("button", { name: "Mara V." }));
  await waitFor(() => expect(screen.getByText("DRILLDOWN")).toBeInTheDocument());
});
```

- [ ] **Step 2: Run to verify it fails**
Run: `pnpm --filter @holy-oly/web test equipo`
Expected: FAIL — no `Equipo`.

- [ ] **Step 3: Implement `DrilldownPlaceholder.tsx`**
```tsx
import { useParams } from "react-router-dom";
export function DrilldownPlaceholder() {
  const { id } = useParams();
  return (
    <div style={{ padding: 24, color: "var(--wl-text)", fontFamily: "var(--wl-display)" }}>
      <h1 style={{ color: "var(--wl-accent)" }}>Drill-down · {id}</h1>
      <p style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)" }}>Pantalla del atleta (M4).</p>
    </div>
  );
}
```

- [ ] **Step 4: Implement `Equipo.tsx`**
Build the projection in one effect, derive the four buckets from `row.cell`, render header + Heatmap + RiskQuadrant + PickDetail. Both pick paths set `picked` and navigate.
```tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRepository } from "../../data/RepositoryProvider";
import { getRosterRows, type RosterRow } from "./roster";
import { Heatmap } from "../../ui/charts/Heatmap";
import { RiskQuadrant, type QuadPoint, type NoDataPoint } from "../../ui/charts/RiskQuadrant";
import { Badge } from "../../ui/Badge";
import { STATUS } from "../../ui/status";

export function Equipo() {
  const repo = useRepository();
  const navigate = useNavigate();
  const [rows, setRows] = useState<RosterRow[]>([]);
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => { let on = true; getRosterRows(repo).then((r) => { if (on) setRows(r); }); return () => { on = false; }; }, [repo]);

  const counts = useMemo(() => ({
    alert: rows.filter((r) => r.cell === "alert").length,
    warn: rows.filter((r) => r.cell === "warn").length,
    ok: rows.filter((r) => r.cell === "ok").length,
    none: rows.filter((r) => r.cell === "none").length,
  }), [rows]);

  const points: QuadPoint[] = rows
    .filter((r) => r.acwr != null && r.rec != null && r.cell !== "none")
    .map((r) => ({ id: r.id, iniciales: r.iniciales, acwr: r.acwr!, rec: r.rec!, cell: r.cell }));
  const noData: NoDataPoint[] = rows.filter((r) => r.cell === "none").map((r) => ({ id: r.id, iniciales: r.iniciales }));

  const onPick = (id: string) => { setPicked(id); navigate(`/coach/a/${id}`); };
  const sel = rows.find((r) => r.id === picked) ?? null;

  return (
    <div style={{ padding: "14px 13px 26px", color: "var(--wl-text)", background: "var(--wl-bg)", minHeight: "100vh", maxWidth: 390, margin: "0 auto" }}>
      {/* RosterHeader */}
      <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 22, lineHeight: 1 }}>Plantel</div>
      <div style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--wl-muted)", marginTop: 6 }}>{rows.length} atletas · semana en curso</div>
      <div style={{ display: "flex", gap: 8, marginTop: 11, flexWrap: "wrap" }}>
        <span data-testid="bucket-alert"><Badge tone="alert">{counts.alert} en alerta</Badge></span>
        <span data-testid="bucket-warn"><Badge tone="warn">{counts.warn} a vigilar</Badge></span>
        <span data-testid="bucket-ok"><Badge tone="ok">{counts.ok} ok</Badge></span>
        <span data-testid="bucket-none" style={{ color: STATUS.none, border: `1px solid color-mix(in srgb,var(--wl-text) 16%,transparent)`, fontFamily: "var(--mono)", fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 99 }}>
          {counts.none} sin datos
        </span>
      </div>

      <Heatmap rows={rows} weeks={12} onPick={onPick} />
      <RiskQuadrant points={points} noData={noData} onPick={onPick} />

      {/* PickDetail (inline, not a BottomSheet) */}
      {sel && (
        <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-muted)", padding: "8px 0 0" }}>
          {sel.cell === "none" ? (
            <><b style={{ color: "var(--wl-text)" }}>{sel.nombre}</b> · {sel.metodo} · sin datos de monitoreo aún — ver perfil ›</>
          ) : (
            <><b style={{ color: "var(--wl-text)" }}>{sel.nombre}</b> · {sel.metodo} · ACWR {sel.acwr!.toFixed(2)} · recup. {sel.rec}% · <span style={{ color: STATUS[sel.cell] }}>{sel.cell === "alert" ? "alerta" : sel.cell === "warn" ? "vigilar" : "ok"}</span> — ver drill-down ›</>
          )}
        </div>
      )}
    </div>
  );
}
```
> NOTE: clicking a row sets `picked` AND navigates immediately — the inline PickDetail is effectively a transient pre-nav echo. If a "select without leaving" interaction is wanted later, split `onSelect` (sets picked) from `onOpen` (navigates); for M3 the mockup behavior (click → drill-down) is preserved and the test asserts navigation.

- [ ] **Step 4b: Optional cycle-aware referral line**
If `getCycleContext(picked)?.health === "referral"`, append a sober one-liner to PickDetail showing ONLY what `CycleContext` exposes (never phase/day). This is optional for M3 and can be deferred; if added, fetch the context in the pick handler and store it alongside `picked`.

- [ ] **Step 5: Run to verify it passes**
Run: `pnpm --filter @holy-oly/web test equipo`
Expected: PASS — buckets read 2 alerta / 2 vigilar / 3 ok / 1 sin datos (the tally of Task 27's pinned cells), the quadrant has exactly 7 circles with Tomás absent, and a name click navigates. If the seeds were authored to different (but still consistent) cells, the bucket counts and the Task 27 `expected` map must move together.

- [ ] **Step 6: Commit**
```bash
git add apps/web/src/screens/coach/Equipo.tsx apps/web/src/screens/coach/DrilldownPlaceholder.tsx "apps/web/src/screens/coach/__tests__/equipo.test.tsx"
git commit -m "$(cat <<'EOF'
feat(web): Equipo screen (coach triage) + drill-down placeholder

Thin consumer: one RosterRow[] projection feeds RosterHeader (four buckets
incl. sin datos), Heatmap, RiskQuadrant, inline PickDetail. Equipo owns picked
state; name/dot clicks navigate by athlete id to /coach/a/:id (M4 placeholder).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 29: Routing — mount `/coach`, keep `/`→Gallery, milestone push

**Files:**
- Modify: `apps/web/src/app/router.tsx`

> Wrap the tree in `<RepositoryProvider>`; add `/coach` (Equipo) + `/coach/a/:id` (M4 placeholder). **PRESERVE** the `router: ReturnType<typeof createBrowserRouter>` annotation (it dodges TS2742 under pnpm). Keep `/`→Gallery through M3 for visual regression (the design doc retires Gallery "when screens land"; track it so a coach build doesn't ship Gallery at `/`).

- [ ] **Step 1: Edit `apps/web/src/app/router.tsx`**
```tsx
import { createBrowserRouter } from "react-router-dom";
import { App } from "./App";
import { Gallery } from "../ui/Gallery";
import { RepositoryProvider } from "../data/RepositoryProvider";
import { Equipo } from "../screens/coach/Equipo";
import { DrilldownPlaceholder } from "../screens/coach/DrilldownPlaceholder";
// Explicit type annotation avoids TS2742 (pnpm virtual store internal type).
export const router: ReturnType<typeof createBrowserRouter> = createBrowserRouter([
  {
    path: "/",
    element: (
      <RepositoryProvider>
        <App />
      </RepositoryProvider>
    ),
    children: [
      { index: true, element: <Gallery /> }, // kept through M3 for visual regression (TODO: retire when coach build ships)
      { path: "coach", element: <Equipo /> },
      { path: "coach/a/:id", element: <DrilldownPlaceholder /> },
    ],
  },
]);
```

- [ ] **Step 2: Typecheck + full test run**
Run: `pnpm --filter @holy-oly/web typecheck && pnpm -r test`
Expected: typecheck clean; all core + web suites PASS.

- [ ] **Step 3: Visual verify (against the DERIVED output, not the mockup — see "Mockup divergence" in Task 21)**
Run: `pnpm --filter @holy-oly/web dev` → open `:8743/coach`. Confirm: header shows "Plantel · 8 atletas" and the four buckets read **2 en alerta · 2 a vigilar · 3 ok · 1 sin datos**; the heatmap renders 8 rows (Tomás hollow/dashed), sticky names with the oro medal on the 3 competidores, horizontal scroll; the quadrant plots 7 dots (Tomás in the "sin datos" tray, not on-canvas), with dot colors matching the worse-of cells and any clamped values sitting on the edge. NOTE the intentional divergences from `equipo.html`: Mara plots on the **safe-left** side (her current week is a deload trough at acwr≈0.74 / rec≈77, colored `warn`), NOT in the mockup's risk zone; cell colors come from derived worse-of(ACWR,recovery), not the mockup's hand-set `h[]`. Clicking a name or dot lands on `/coach/a/:id`. Check `:8743/` still shows the Gallery. Stop server.

- [ ] **Step 4: Commit + push milestone**
```bash
git add apps/web/src/app/router.tsx
git commit -m "$(cat <<'EOF'
feat(web): mount /coach (Equipo) + /coach/a/:id, wrap in RepositoryProvider

Add the coach routes and the M4 drill-down placeholder; wrap the tree in
RepositoryProvider (the ApiRepository seam). Keep /->Gallery through M3 for
visual regression. TS2742 router annotation preserved.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
git push origin main
```

> **M3 done when:** `pnpm -r test` is green; `pnpm --filter @holy-oly/web dev` boots; `/coach` renders the seeded plantel (heatmap + quadrant + four-bucket header reading 2/2/3/1) in Neon PR, every per-athlete current-week cell matches the Task 27 pins, the quadrant plots exactly 7 dots with colors consistent with position (no green dot in the risk zone), the no-data athlete is visible (hollow heatmap row + "sin datos" tray, absent from the quadrant), and clicking a name/dot navigates to `/coach/a/:id`.

---

## Next plan (M4–M5)
Once M3 is green: **M4 Drill-down** (the 8 athlete charts incl. the IMR-vs-fase chart built on `imrStateForWeek`, the macro restructure reusing `MacroTimeline`, palmarés/medallas via `getMedals`/`addMedal`, asignar competencia via `getComps`/`setComps`, luteal gating via `getCycleContext` on `share==="full" && state!=="amenorrhea"`) and **M5 Asignar plan** (RM + macro + start week via `getPlan`/`savePlan`). Both reuse this exact data layer (`LocalRepository` + `RepositoryProvider`) with no rework. At the start of M4, **retire Gallery from `/`** (or move it to `/gallery`) so a coach build doesn't ship it at the root.

## Design decisions (resolved with engineering judgment)
1. **recovery** — STORED `recovery: number[]` on `MonitorSeries` (REQUIRED) + pure `recoveryScore`/`recoverySeries`/`recoveryState` in `monitor.ts`. Seeds store it (pure read for the quadrant); the fn exists for recompute/tests. No speculative `rpe?`/`compliance?`/`weight?` now (YAGNI; M4 append-only).
2. **no-data** — `getSeries → MonitorSeries | undefined`; `CellState = Estado | "none"`; `acwrStateSafe` (NaN/Infinity→none) AND `recoveryState` (non-finite→none), so BOTH axes are guarded; `rosterStatus`, `seriesState`. `Estado` stays 3-valued; `"none"` is render-only. Fixes the `acwrState(NaN)==="ok"` trap on load AND recovery (a within-range week with a short/missing `recovery[]` paints hollow, never green). One breaking signature change, zero current callers.
3. **heatmap history** — DERIVED from telemetry (worse-of `acwrStateSafe` vs `recoveryState` per week, where either axis missing → `"none"`), not a stored hand-authored `h[]`. One source of truth; visual baselines come from derived output.
4. **IMR→fase** — `imrBandForWeek` + `imrStateForWeek` composing existing `phaseForWeek` + `imrBandState`, return type **`Estado`**. CORRECTED Design C: `phaseForWeek` (verified `macrocycles.ts:574-579`) falls back to the last phase and never nulls for out-of-range (only for empty `phaseProfile`, which the catalog test forbids) — so "none for out-of-macro week" was dead code. Shipped as the closed contract for M4; Equipo doesn't call it.
5. **cycle privacy** — redaction-by-construction: `getCycleShare` + `getCycleContext` (none→undefined, min→`inLutealNow:null`+health, full→populated, amenorrhea→`health:"referral"`). No coach-reachable phase/day/symptom method, no coach setter. Equipo is cycle-blind; M4 gates luteal bands on `share==="full" && state!=="amenorrhea"`. Structural over policy for sensitive health data.
6. **LocalRepository LOCATION** — `apps/web/src/data/` (storage + keys + seeds + LocalRepository + RepositoryProvider), NOT a new `packages/data`. Matches design doc §3/§5; rejected the extra package as scope creep (one impl, no second consumer). Injectable `Storage`; idempotent `ho:seeded` guard; try/catch→default.
7. **keys** — per-athlete `ho:*` namespace. Diverges from the mockup's GLOBAL `ho_cycle_*` and flat `ho_comps`/`ho_medals` — fresh seeded store, no auto-migration; flagged for the athlete slice.
8. **método label** — side `ROSTER_META` map in `seeds.ts`, NOT a new field on `core.Atleta`. Keeps the domain type clean while the screen shows "Ruso 5D".
9. **seeds (NOT mockup-parity)** — Mara from `coach.html`'s real arrays (recovery precomputed); the other 6 **direct-authored** as typed `MonitorSeries` toward a chosen DERIVED current-week cell, pinned in the roster test (Task 27) — NOT back-solved to the mockup's exact acwr/rec floats (a last-week ratio for a taper sits near 1, so 1.58 is not reachable as the *current-week* ACWR; full per-athlete telemetry = M4). Tomás intentionally seeded with no series as the no-data exemplar (he has data in the mockup; we drop it). See the "Mockup divergence" box in Task 21.
10. **screen** — thin consumer: one `RosterRow[]` projection (`roster.ts`) feeds `RosterHeader` (four buckets incl. sin datos) + `Heatmap` + `RiskQuadrant` + `PickDetail`; Equipo owns `picked`; shared `STATUS` palette in `ui/status.ts` (deduped from `Badge`); charts presentational + `onPick` only.
11. **routing** — wrap tree in `RepositoryProvider`; add `/coach` + `/coach/a/:id` (M4 placeholder); navigate by athlete id; PRESERVE the TS2742 router annotation; keep `/`→Gallery through M3 (tracked for removal).
12. **testing** — core fns (none-branch on BOTH axes incl. `recoveryState(NaN)` and a recovery-hole `seriesState`, recovery series pinned to its exact output, imr-fase fall-back); `LocalRepository` round-trip + seed idempotency + cycle redaction (pinned up front) + corrupt-storage; `RepositoryProvider` outside-throws + init-once; roster projection pins the derived current-week cell for ALL 8 athletes; Equipo four-bucket counts + 7-dot/Tomás-absent + name-click navigation; charts' onPick + no-data tray + risk-zone-dot-is-alert.
13. **one color rule (dot = buckets = heatmap current cell)** — `rosterStatus` is DEFINED as `seriesState(s, s.weeks)` (worse-of ACWR+recovery of the last week), so the quadrant dot color, the four bucket counts, and the heatmap's current-week column are the SAME for an athlete. This ports the mockup's single-`curState` discipline and removes the silent contradiction of coloring the dot by ACWR-only while the heatmap used worse-of (which could paint a green dot inside the red risk-zone). The quadrant also clamps recovery (`clampY`) so an out-of-range hand-authored `rec` stays on-canvas.

## Decisions needing the human (do not block M3; confirm before this drives a real athlete)
- **Recovery formula:** `recoveryScore`'s HRV/RHR/wellness weighting and the `recoveryState` cutoffs (70 alert / 80 warn) are an engineering placeholder, NOT calibrated to the mockup's hand-set values. Its exact output for Mara is pinned by test (`recoverySeries(MARA) = [82,81,79,83,77,78,75,81,73,67,70,77]`; the week-10 spike → 67, a `recoveryState` `alert`). The real clinical/coaching formula — and whether recovery is absolute % or per-athlete-baseline relative — is a product call. M3 is unblocked (seeds store explicit `recovery[]`; the fn is swappable, and only the one pinned array + the buckets/Task-27 cells move if the formula changes).
- **Heatmap week-state semantics:** M3 derives each cell as the WORSE of load-state (ACWR) and recovery-state, replacing the mockup's hand-authored `h[]`. Confirm the coach agrees a week should flag alert when EITHER load spikes OR recovery craters (vs ACWR-only or another blend) — it changes which cells light up.
- **No-data athletes on the quadrant:** intentionally NOT plotted (heatmap row + "sin datos" tray only). A coach might expect every roster member as a dot — confirm the tray treatment vs plotting at a parked/hollow position.
- **Current-week vs snapshot (mockup divergence):** the quadrant/buckets show each athlete's *current week* (worse-of of the last week), so a deloading/tapering athlete (e.g. Mara at acwr≈0.74) plots safe-left even if mid-macro they spiked — this differs from `equipo.html`'s hand-set "current" snapshot, and Tomás (full data in the mockup) is repurposed as the no-data exemplar. Confirm the coach wants "this week's state" (current) rather than e.g. "worst of the last N weeks" as the triage summary; the latter would be a different `rosterStatus` rule.
- **"Past peakWeek / outside the macro" = un-assessable for IMR:** a deliberate product rule, not inferred. `phaseForWeek` currently always returns a real phase (the last) for any week. If out-of-range weeks should be no-signal, that rule is added explicitly in M4 (not needed for M3).

## Self-review notes
- **Spec coverage:** M3 covers (a) the core extensions (recovery, no-data state, IMR-to-fase, cycle types/methods), (b) the data layer (`storage`/`keys`/`seeds`/`LocalRepository`/`RepositoryProvider`), (c) the Equipo screen (header/heatmap/quadrant/pick with explicit no-data states), and (d) `/coach` mounted with Gallery kept at `/`. M4/M5 deferred, consistent with the design doc's slice sequencing.
- **Type consistency:** `CellState`, `Estado`, `MonitorSeries`, `CycleContext`, `Repository`, `RosterRow`, `QuadPoint` names match between core, the data layer, and the screen.
- **Grounded in actual code (verified):** Badge's exact tones `{ok:#1bc98a,warn:#ffab2e,alert:#ff3b46}` → `ui/status.ts` (Badge.tsx:2); `MacroTimeline`'s SVG idiom (viewBox + `--wl-*` chrome + hardcoded estado) is the pattern for `RiskQuadrant`; `Card` wraps both charts; `Medal({metal:"oro",size:14})` is the competidor flag (renders `role="img" aria-label="Oro"` — never queried by accessible name, since 3 exist); the router's TS2742 annotation is preserved. The quadrant geometry (`S=300, pad=30`, bounds, ticks) and Mara's *raw telemetry arrays* are verbatim from `_mockup/equipo.html` and `_mockup/coach.html`; the *derived* per-athlete states are NOT the mockup's hand-set `h[]`/`acwr`/`rec` (see "Mockup divergence"). Verified against code: `phaseForWeek` falls back to the last phase and only nulls on empty `phaseProfile` (macrocycles.ts:574-579) → `imrBandForWeek(ruso,1)=[65,72]` / `(ruso,14)=[92,102]` / `(ruso,99)=[92,102]`; `recoverySeries(MARA)[9]=67` and `recoveryState(NaN)="none"` after the guard; `core` resolves via `main→./src/index.ts` so no core build step is needed between Layer A and B; `rosterStatus(MARA)="warn"` (last-week acwr 0.739 / rec 77).
- **TDD:** every behavioral task writes a failing test (RED) before implementation (GREEN), including Task 23 (`RepositoryProvider` outside-throws + init-once) which has real runtime behavior. Type-only tasks (15, 19, 20, 24) gate on `typecheck` instead, as those add no runtime behavior to assert. Task 16's RED test pins the recovery series to its EXACT computed output (`[82,81,…,77]`) plus the behavioral fact (week-10 is the trough and `< 70`), so the GREEN step passes with the given coefficients — no chasing a magic number.
- **Placeholders called out:** the 6 non-Mara seed series are direct-authored toward a chosen derived current-week cell, and the roster projection test (Task 27) PINS that cell for all 8 athletes (the seeds' GREEN gate), with the four-bucket counts in Task 28 as the consistent tally — so a garbage array cannot ship green; the fix for any drift is local to `seeds.ts`. `RosterRow` is stubbed in Task 25 and filled in Task 27 (noted in both) so tasks stay independently runnable. Note the two files Task 25 and Task 27 both touch `roster.ts` (type-then-impl); this is a deliberate small coupling for subagent-driven execution, called out in both tasks.
