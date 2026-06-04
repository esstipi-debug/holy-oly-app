# SP4 — Sustitución / ajuste en vivo del movimiento · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Athlete (in *Entreno*, in-session) and coach (in the *SessionEditor*) swap an exercise for an SP1-guided alternative — "bajar complejidad" (`simplerVariants`) or "sustituir" (`substitutesOf`). The athlete's swap records the **real movement done** (plan untouched); the coach's swap edits the plan. The coach sees "prescripto X → real Y (sustituido)" and "⚠ desfasado".

**Architecture:** **core** — `SessionActual.prescribedMovementId`, `ExerciseActual` gains `movementId/movementName/substituted/desfasado`, `mergeActuals` re-aligns by slot + flags substitution/desfase (resolving names via `getMovement`), schemas. **api** — migration `7_actual_substitution`; `setSessionActuals` stores both ids; `getPrescriptionWeek` maps them. **web** — a shared `SubstituteSheet` (SP1 suggestions); `EntrenoScreen` per-exercise "Ajustar"; `SessionEditor` per-exercise guided "sustituir/bajar complejidad"; `SessionsSection` shows substituido/desfasado.

**Tech Stack:** TS strict, Zod, Fastify 5 + Prisma 6 + Postgres (embedded tests), React 18 + Vitest/RTL. Builds on SP1 (`simplerVariants`/`substitutesOf`/`getMovement`), SP3 (`SessionActual`, `mergeActuals`, `EntrenoScreen`, `/me/session`), SP2 (`SessionEditor`, `getPrescriptionWeek`, `SessionsSection`).

**Spec:** [`docs/superpowers/specs/2026-06-04-sp4-live-substitution-design.md`](../specs/2026-06-04-sp4-live-substitution-design.md)

---

## File Structure
- **core:** modify `types/index.ts` (`SessionActual.prescribedMovementId?`; `ExerciseActual` + `movementId/movementName/substituted/desfasado`); `logic/actuals.ts` (`mergeActuals` re-align + name resolution); `schemas.ts` (`ExerciseActualInputSchema.prescribedMovementId`, `ExerciseActualSchema` additions).
- **api:** `prisma/schema.prisma` (+`prescribedMovementId`); migration `7_actual_substitution`; `src/repo.ts` (`setSessionActuals` + `getPrescriptionWeek` mapping); `src/actuals.int.test.ts`.
- **web:** create `src/ui/SubstituteSheet.tsx`; modify `src/screens/atleta/EntrenoScreen.tsx`; modify `src/screens/coach/sessions/SessionEditor.tsx` + `SessionsSection.tsx`; tests.

Commands: `pnpm --filter @holy-oly/{core,web} test [filter]`, `… exec tsc --noEmit`, `pnpm --filter @holy-oly/api {test,verify,e2e}`, `… exec prisma generate`.

---

## Phase A — Core

### Task A1: Types

**Files:** Modify `packages/core/src/types/index.ts`

- [ ] **Step 1:** In the existing `SessionActual` interface add `prescribedMovementId?: string;` (the plan's movement at that slot when recorded; SP3 rows omit it). In the existing `ExerciseActual` interface, add: `movementId: string; movementName: string; substituted: boolean; desfasado: boolean;` (keep the existing `done/kg?/reps?/rpe?/note?`).
- [ ] **Step 2:** `pnpm --filter @holy-oly/core exec tsc --noEmit` — will FAIL until `mergeActuals` (A2) populates the new `ExerciseActual` fields; that's expected, continue to A2 before committing. (Type-only; no separate commit.)

### Task A2: `mergeActuals` re-align + flags

**Files:** Modify `packages/core/src/logic/actuals.ts` + `actuals.test.ts`

- [ ] **Step 1: Extend the failing test** (`actuals.test.ts`) — add cases:
```typescript
import { getMovement } from "./movements"; // (only if needed by fixtures)

it("flags a substitution: actual.movementId ≠ prescribedMovementId", () => {
  const v: SessionView[] = [{ week: 1, sessionIdx: 0, exercises: [
    { movementId: "arranque", sets: 5, reps: 2, pct: 80, movementName: "Arranque", targetKg: 64 },
  ] }];
  const rows: SessionActual[] = [{ week: 1, sessionIdx: 0, order: 0, movementId: "arranque.potencia.colgado.rodilla", prescribedMovementId: "arranque", done: true, actualKg: 55 }];
  const a = mergeActuals(v, rows)[0]!.exercises[0]!.actual!;
  expect(a.substituted).toBe(true);
  expect(a.desfasado).toBe(false);
  expect(a.movementId).toBe("arranque.potencia.colgado.rodilla");
  expect(a.movementName).toMatch(/Arranque de potencia colgado/);
});

it("flags desfase: prescribedMovementId ≠ the current slot's movement (coach edited after)", () => {
  const v: SessionView[] = [{ week: 1, sessionIdx: 0, exercises: [
    { movementId: "sentadilla", sets: 5, reps: 5, pct: 80, movementName: "Sentadilla", targetKg: 112 },
  ] }];
  const rows: SessionActual[] = [{ week: 1, sessionIdx: 0, order: 0, movementId: "arranque", prescribedMovementId: "arranque", done: true, actualKg: 60 }];
  const a = mergeActuals(v, rows)[0]!.exercises[0]!.actual!;
  expect(a.desfasado).toBe(true);
});

it("SP3 rows (no prescribedMovementId) are not substituted/desfasado", () => {
  const v: SessionView[] = [{ week: 1, sessionIdx: 0, exercises: [
    { movementId: "arranque", sets: 5, reps: 3, pct: 70, movementName: "Arranque", targetKg: 56 },
  ] }];
  const rows: SessionActual[] = [{ week: 1, sessionIdx: 0, order: 0, movementId: "arranque", done: true, actualKg: 58 }];
  const a = mergeActuals(v, rows)[0]!.exercises[0]!.actual!;
  expect(a.substituted).toBe(false);
  expect(a.desfasado).toBe(false);
  expect(a.movementName).toMatch(/Arranque/);
});
```
(Keep the existing SP3 merge/no-op/out-of-range tests — they still pass with the added fields.)

- [ ] **Step 2:** `pnpm --filter @holy-oly/core test actuals` → FAIL (the new `ExerciseActual` fields aren't built).

- [ ] **Step 3: Update `mergeActuals` in `actuals.ts`** — import `getMovement` from `./movements`; in the attach block build the richer actual:
```typescript
import type { ExerciseActual, SessionActual, SessionView } from "../types";
import { getMovement } from "./movements";

export function mergeActuals(views: SessionView[], rows: SessionActual[]): SessionView[] {
  return views.map((v) => ({
    ...v,
    exercises: v.exercises.map((e, i) => {
      const a = rows.find((r) => r.week === v.week && r.sessionIdx === v.sessionIdx && r.order === i);
      if (!a) return e;
      const prescribed = a.prescribedMovementId ?? e.movementId;
      const actual: ExerciseActual = {
        done: a.done, kg: a.actualKg, reps: a.actualReps, rpe: a.actualRpe, note: a.note,
        movementId: a.movementId,
        movementName: getMovement(a.movementId)?.name ?? a.movementId,
        substituted: a.movementId !== prescribed,
        desfasado: a.prescribedMovementId != null && a.prescribedMovementId !== e.movementId,
      };
      return { ...e, actual };
    }),
  }));
}
```
(`kgDeviation` is unchanged; callers will skip it when `substituted`.)

- [ ] **Step 4:** `pnpm --filter @holy-oly/core test actuals && pnpm --filter @holy-oly/core exec tsc --noEmit` → green.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(core): mergeActuals marca sustitución/desfase + tipos (SP4)"`

### Task A3: Schemas

**Files:** Modify `packages/core/src/schemas.ts` + `schemas.actuals.test.ts`

- [ ] **Step 1: Extend the test** — add to the actuals schema test: `SessionActualsInputSchema` accepts an item with `prescribedMovementId`; and `ExerciseActualSchema` (the view) accepts the new `movementId/movementName/substituted/desfasado`. (Mirror the existing assertion style.)
- [ ] **Step 2:** `pnpm --filter @holy-oly/core test schemas.actuals` → FAIL.
- [ ] **Step 3: Edit `schemas.ts`** — to `ExerciseActualInputSchema` add `prescribedMovementId: z.string().min(1).max(60).optional(),`. To `ExerciseActualSchema` (the view-side) add:
```typescript
  movementId: z.string(),
  movementName: z.string(),
  substituted: z.boolean(),
  desfasado: z.boolean(),
```
(`ExerciseActualInput` type via `z.infer` updates automatically.)
- [ ] **Step 4:** `pnpm --filter @holy-oly/core test && pnpm --filter @holy-oly/core exec tsc --noEmit` → green.
- [ ] **Step 5: Commit** — `git commit -am "feat(core): schemas — prescribedMovementId (input) + flags de sustitución (vista)"`

---

## Phase B — API

### Task B1: migration `7_actual_substitution`

**Files:** Modify `apps/api/prisma/schema.prisma`; create migration

- [ ] **Step 1:** Add `prescribedMovementId String?` to `model SessionActual` (after `movementId`).
- [ ] **Step 2:** `pnpm --filter @holy-oly/api exec tsx scripts/make-migration.ts 7 actual_substitution` (mirror prior migrations). Expected SQL: `ALTER TABLE "SessionActual" ADD COLUMN "prescribedMovementId" TEXT;`.
- [ ] **Step 3:** `pnpm --filter @holy-oly/api exec prisma generate`.
- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat(api): SessionActual.prescribedMovementId + migración 7_actual_substitution"`

### Task B2: Failing integration test

**Files:** Modify `apps/api/src/actuals.int.test.ts`

- [ ] **Step 1: Add cases** (reuse the file's `login`/`sess`/coach-assign-plan helpers + the `mara@holyoly.dev` athlete login):
```typescript
  it("athlete substitutes a movement in-session; coach sees it as substituted (real movement + kg, no false deviation)", async () => {
    const coach = sess(await login("coach@holyoly.dev"));
    await app.inject({ method: "PUT", url: "/athletes/mv/plan", headers: coach, payload: { atletaId: "mv", macroId: "ruso-5d", startWeek: 1, startDate: "2026-04-01", rms: RMS, comps: [] } });
    const athlete = sess(await login("mara@holyoly.dev"));
    // prescribed slot 0 of week-1 día-1 is "arranque"; the athlete did "arranque.potencia.colgado.rodilla" instead
    await app.inject({ method: "PUT", url: "/me/session/1/0", headers: athlete,
      payload: [{ order: 0, movementId: "arranque.potencia.colgado.rodilla", prescribedMovementId: "arranque", done: true, kg: 50 }] });
    const coachView = await app.inject({ method: "GET", url: "/athletes/mv/prescription?week=1", headers: coach });
    const s0 = (coachView.json() as Array<{ sessionIdx: number; exercises: Array<{ movementId: string; actual?: { substituted: boolean; movementId: string; movementName: string; kg?: number } }> }>).find((s) => s.sessionIdx === 0)!;
    expect(s0.exercises[0]!.actual?.substituted).toBe(true);
    expect(s0.exercises[0]!.actual?.movementId).toBe("arranque.potencia.colgado.rodilla");
    expect(s0.exercises[0]!.actual?.kg).toBe(50);
  });
```
- [ ] **Step 2:** `pnpm --filter @holy-oly/api verify` → FAIL (prescribedMovementId not stored/returned → substituted false).

### Task B3: repo

**Files:** Modify `apps/api/src/repo.ts`

- [ ] **Step 1:** In `setSessionActuals`, add `prescribedMovementId: a.prescribedMovementId ?? null` to the `createMany` row mapping (input type `ExerciseActualInput` now carries it).
- [ ] **Step 2:** In `getPrescriptionWeek`, the `sessionActual.findMany` → map: add `prescribedMovementId: a.prescribedMovementId ?? undefined` to the core `SessionActual[]` mapping (so `mergeActuals` sees it).
- [ ] **Step 3:** `pnpm --filter @holy-oly/api verify && pnpm --filter @holy-oly/api exec tsc --noEmit` → green (the new case + SP3 + SP2 suites pass; SP3 rows have null prescribedMovementId → not substituted).
- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat(api): persistir+devolver prescribedMovementId (sustitución del atleta)"`

---

## Phase C — Web (shared sheet + athlete Entreno)

### Task C1: `SubstituteSheet` (shared, SP1-guided)

**Files:** Create `apps/web/src/ui/SubstituteSheet.tsx` + `apps/web/src/ui/__tests__/substitute-sheet.test.tsx`

- [ ] **Step 1: Failing test** (`substitute-sheet.test.tsx`)
```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { SubstituteSheet } from "../SubstituteSheet";

test("ofrece bajar-complejidad + sustituir y elige uno", () => {
  const onPick = vi.fn();
  render(<SubstituteSheet open movementId="arranque" onClose={() => {}} onPick={onPick} />);
  expect(screen.getByText(/Bajar complejidad/i)).toBeInTheDocument();
  expect(screen.getByText(/Sustituir/i)).toBeInTheDocument();
  // arranque's simplerVariants include the hang/power variants; pick one
  const opt = screen.getByRole("button", { name: /Arranque de potencia colgado \(rodilla\)/i });
  fireEvent.click(opt);
  expect(onPick).toHaveBeenCalledWith("arranque.potencia.colgado.rodilla");
});
```
(If that exact variant isn't under "bajar complejidad" for `arranque`, pick whatever `simplerVariants("arranque")[0]`/`substitutesOf("arranque")[0]` actually returns — run it; the behavior under test is "the two SP1 groups render and clicking calls `onPick(id)`". Adjust the asserted name/id to the real output, keep the assertion meaningful.)

- [ ] **Step 2:** `pnpm --filter @holy-oly/web test substitute-sheet` → FAIL.

- [ ] **Step 3: Implement `SubstituteSheet.tsx`** (uses `BottomSheet`; globally-available tokens only — `--wl-*` + `--wl-display`, NOT `--mono`/`--ho-mono` since it renders in both the coach and athlete shells):
```tsx
import { type CSSProperties } from "react";
import { simplerVariants, substitutesOf, getMovement } from "@holy-oly/core";
import { BottomSheet } from "./BottomSheet";

const item: CSSProperties = { display: "block", width: "100%", textAlign: "left", padding: "9px 12px", borderRadius: 10, marginTop: 6, border: "1px solid color-mix(in srgb,var(--wl-text) 12%,transparent)", background: "var(--wl-surface)", color: "var(--wl-text)", fontFamily: "var(--wl-display)", fontWeight: 600, fontSize: 14, cursor: "pointer" };
const grp: CSSProperties = { fontFamily: "var(--wl-display)", fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--wl-muted)", marginTop: 14 };
const empty: CSSProperties = { fontFamily: "var(--wl-display)", fontSize: 12, color: "var(--wl-muted)", marginTop: 6 };

/** SP1-guided movement swap: "bajar complejidad" (simpler variants of the same base) + "sustituir"
 *  (alternative movements). Shared by the coach editor and the athlete Entreno. */
export function SubstituteSheet({ open, onClose, movementId, onPick }: {
  open: boolean; onClose: () => void; movementId: string; onPick: (id: string) => void;
}) {
  const simpler = simplerVariants(movementId);
  const subs = substitutesOf(movementId);
  const choose = (id: string): void => { onPick(id); onClose(); };
  return (
    <BottomSheet open={open} onClose={onClose} ariaLabel="Cambiar movimiento">
      <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 18, color: "var(--wl-text)" }}>Cambiar movimiento</div>
      <div style={{ fontFamily: "var(--wl-display)", fontSize: 12, color: "var(--wl-muted)", marginTop: 2 }}>Actual: {getMovement(movementId)?.name ?? movementId}</div>
      <div style={{ maxHeight: 380, overflowY: "auto" }}>
        <div style={grp}>Bajar complejidad</div>
        {simpler.length ? simpler.map((m) => <button key={m.id} type="button" style={item} onClick={() => choose(m.id)}>{m.name}</button>) : <div style={empty}>Sin variantes más simples.</div>}
        <div style={grp}>Sustituir por</div>
        {subs.length ? subs.map((m) => <button key={m.id} type="button" style={item} onClick={() => choose(m.id)}>{m.name}</button>) : <div style={empty}>Sin sustitutos sugeridos.</div>}
      </div>
    </BottomSheet>
  );
}
```
- [ ] **Step 4:** `pnpm --filter @holy-oly/web test substitute-sheet && pnpm --filter @holy-oly/web exec tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(web): SubstituteSheet — cambio de movimiento guiado por SP1 (compartido)"`

### Task C2: Athlete `EntrenoScreen` — "Ajustar / no puedo"

**Files:** Modify `apps/web/src/screens/atleta/EntrenoScreen.tsx` + its test

- [ ] **Step 1: Extend the test** (`__tests__/entreno.test.tsx`) — add a case: render the one-exercise (`arranque`) session, click an "Ajustar" / "cambiar movimiento" button on the row → the `SubstituteSheet` opens → pick a variant → the row's shown movement changes and the kg field clears → mark done + save → assert the sent actual has `movementId` = the chosen variant and `prescribedMovementId: "arranque"`. (Use the real variant id from `simplerVariants`/`substitutesOf`.)
- [ ] **Step 2:** `pnpm --filter @holy-oly/web test entreno` → FAIL.
- [ ] **Step 3: Implement** in `EntrenoScreen.tsx`:
  - Import `getMovement` from `@holy-oly/core` and `SubstituteSheet` from `../../ui/SubstituteSheet`.
  - `Row` gains `prescribedMovementId: string`.
  - On load (the `.map`): set `prescribedMovementId: e.movementId`; `movementId: e.actual?.movementId ?? e.movementId`; `movementName: e.actual?.movementName ?? e.movementName`. (kg line unchanged.)
  - Add state `const [subFor, setSubFor] = useState<number | null>(null);`.
  - In each row's header (next to the done checkbox / name), add a small button `aria-label={\`cambiar movimiento de ${r.movementName}\`}` (e.g. "⇄ cambiar") → `setSubFor(i)`.
  - When `r.movementId !== r.prescribedMovementId`, show a small muted line: `prescripto: {getMovement(r.prescribedMovementId)?.name ?? r.prescribedMovementId}`.
  - At the end of the component (before the closing `</div>`), render: `{subFor !== null && rows[subFor] && (<SubstituteSheet open movementId={rows[subFor]!.movementId} onClose={() => setSubFor(null)} onPick={(id) => { patch(subFor, { movementId: id, movementName: getMovement(id)?.name ?? id, kg: undefined }); setSubFor(null); }} />)}`.
  - In `save()`, add `prescribedMovementId: r.prescribedMovementId,` to each mapped `ExerciseActualInput`.
- [ ] **Step 4:** `pnpm --filter @holy-oly/web test entreno && pnpm --filter @holy-oly/web test && pnpm --filter @holy-oly/web exec tsc --noEmit` → green.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(web): Entreno — ajustar/sustituir movimiento en vivo (SP4)"`

---

## Phase D — Web (coach editor + sessions view)

### Task D1: `SessionEditor` — guided substitute per exercise

**Files:** Modify `apps/web/src/screens/coach/sessions/SessionEditor.tsx` + its test

- [ ] **Step 1: Extend the test** (`__tests__/sessionEditor.test.tsx`) — add a case: render the editor with one `arranque` exercise, click its "cambiar/sustituir" button → `SubstituteSheet` → pick a variant → assert the row now shows the new movement name and (on save) `onSave` receives that row with the new `movementId` and the scheme (sets/reps) preserved.
- [ ] **Step 2:** `pnpm --filter @holy-oly/web test sessionEditor` → FAIL.
- [ ] **Step 3: Implement** in `SessionEditor.tsx`:
  - Import `SubstituteSheet` from `../../../ui/SubstituteSheet` (already imports `getMovement`).
  - Add a helper that swaps a draft's movement keeping the scheme, re-deriving the load mode from the new movement's `rmRef`:
```tsx
function swapMovement(d: Draft, id: string): Draft {
  const mv = getMovement(id);
  const usesPct = !!mv && mv.rmRef !== "none";
  return {
    ...d, movementId: id, movementName: mv?.name ?? id, kgOverride: undefined,
    pct: usesPct ? (d.pct ?? 70) : undefined,
    rpe: usesPct ? undefined : (d.rpe ?? 7),
  };
}
```
  - Add state `const [subFor, setSubFor] = useState<number | null>(null);`.
  - In each row's header (next to ↑/↓/✕), add a small button `aria-label={\`cambiar ${r.movementName}\`}` (e.g. "⇄") → `setSubFor(i)`.
  - Before the closing `</BottomSheet>` (alongside `<MovementPicker .../>`), render: `{subFor !== null && rows[subFor] && (<SubstituteSheet open movementId={rows[subFor]!.movementId} onClose={() => setSubFor(null)} onPick={(id) => { patch(subFor, swapMovement(rows[subFor]!, id)); setSubFor(null); }} />)}`. (Note: `patch` merges a partial; here pass the full swapped fields — call `setRows` directly or make `patch(subFor, swapMovement(...))` where swapMovement returns the changed keys. Simplest: `setRows((rs) => rs.map((r, j) => (j === subFor ? swapMovement(r, id) : r)))`.)
- [ ] **Step 4:** `pnpm --filter @holy-oly/web test sessionEditor && pnpm --filter @holy-oly/web exec tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(web): SessionEditor — sustituir/bajar-complejidad guiado por SP1 (SP4)"`

### Task D2: `SessionsSection` — show substituido / desfasado

**Files:** Modify `apps/web/src/screens/coach/sessions/SessionsSection.tsx` + its test

- [ ] **Step 1: Extend the test** (`__tests__/sessionsSection.test.tsx`) — add a case where an exercise's `actual` has `substituted: true, movementId: "arranque.potencia.colgado.rodilla", movementName: "Arranque de potencia colgado (rodilla)", kg: 50` → assert the coach view shows `/sustituido/` + the substitute name, and does NOT show a `↑/↓` marker. Add a `desfasado: true` case → assert it shows `/desfasado/`.
- [ ] **Step 2:** `pnpm --filter @holy-oly/web test sessionsSection` → FAIL.
- [ ] **Step 3: Implement** in `SessionsSection.tsx` — replace the current real/deviation render block (the `e.actual?.done && …` + `!e.actual.done` lines) with the SP4 logic (substitution + desfase take precedence over the kg deviation):
```tsx
                      {e.actual?.desfasado ? (
                        <span style={{ color: "var(--wl-muted)" }}>{" · ⚠ desfasado · registró "}{e.actual.movementName}{e.actual.kg != null ? ` ${e.actual.kg} kg` : ""}</span>
                      ) : e.actual?.substituted ? (
                        <span style={{ color: "var(--wl-accent)" }}>{" · real "}{e.actual.movementName}{e.actual.kg != null ? ` ${e.actual.kg} kg` : ""}{" (sustituido)"}</span>
                      ) : e.actual?.done && e.actual.kg != null ? (
                        <span style={{ color: "var(--wl-accent)" }}>{" · real "}{e.actual.kg} kg {marker}</span>
                      ) : e.actual && !e.actual.done ? (
                        <span style={{ color: "var(--wl-muted)" }}>{" · no hecho"}</span>
                      ) : null}
```
(Keep the `📝 {e.actual.note}` line below as-is. `marker` already comes from `kgDeviation` computed only when not substituted — confirm `dev`/`marker` is still computed; with substitution, the marker isn't shown.)
- [ ] **Step 4:** `pnpm --filter @holy-oly/web test sessionsSection && pnpm --filter @holy-oly/web test && pnpm --filter @holy-oly/web exec tsc --noEmit && pnpm --filter @holy-oly/web exec eslint src && pnpm --filter @holy-oly/web build` → green.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(web): coach ve sustituido/desfasado en Sesiones (SP4)"`

---

## Phase E — Verify · El Carnicero · Deploy

### Task E1: Full local verification
- [ ] **Step 1:** Run all green: `pnpm --filter @holy-oly/core test`; `pnpm --filter @holy-oly/web test`; `pnpm --filter @holy-oly/api test`; `pnpm --filter @holy-oly/api verify`; `pnpm --filter @holy-oly/api e2e`; `tsc --noEmit` (core/api/web); `pnpm --filter @holy-oly/web exec eslint src`; `pnpm --filter @holy-oly/web build`.
- [ ] **Step 2: Prod-bundle sanity** — `pnpm --filter @holy-oly/api build`, Grep `apps/api/dist/main.js` confirms core inlined (`@holy-oly/core` import ABSENT). Migration `7_actual_substitution` applied by `verify`.

### Task E2: El Carnicero domain review (advisory)
- [ ] **Step 1:** Dispatch a `general-purpose` agent with the persona (`.claude/agents/el-carnicero.md`) + rulebook (`docs/domain/HOLY-OLY-DOMAIN.md`). Review the SP4 diff. Check: **substitution direction** (SP1's `simplerVariants`/`substitutesOf` are domain-correct regressions — never the full competition lift as a "substitute" for an assistance; this is the surface that exposes them); **HR-1** (athlete sees only their plan + their real + SP1 movements — no gameable coach figures); **read-only plan** (the athlete's swap writes only `SessionActual`; the coach swap edits the plan); **kg=truth** (substituted → athlete logs the real kg; no fabricated/auto kg; coach swap recomputes %×RM); **sin-dato** (substituted shows the real movement, not a false deviation; desfasado is flagged, not invented). Returns CRITICAL/HIGH/coach-decision.
- [ ] **Step 2:** Triage + fix CRITICAL/HIGH (verify each vs the rulebook). Re-run affected tests. Commit `fix(sp4): correcciones de dominio El Carnicero`.

### Task E3: Deploy + live smoke
- [ ] **Step 1: FF + push** `main` → Render auto-deploy (migration `7` via `start:prod`). Poll the Render API (`srv-d8etrvvavr4c73954o4g`, key at `C:\Users\Gamer\Videos\.render-key.txt`, read WITHOUT printing) until `live`.
- [ ] **Step 2: Live smoke (Playwright MCP)** — login `mara@holyoly.dev` → Entreno → on an exercise tap "cambiar" → pick a simpler variant → kg clears, enter a real kg, save; login `coach@holyoly.dev` → Mara's drill-down "Sesiones" shows "real: [variante] (sustituido)". Also test the coach editor: open a session "editar" → "cambiar" an exercise → pick a substitute → save → the prescription updates. Screenshot both.
- [ ] **Step 3: Update memory** — append SP4-shipped status to `athlete-app-and-execution-pillar.md` + the `MEMORY.md` pointer (SubstituteSheet; `prescribedMovementId`; athlete in-session swap; coach guided swap; substituido/desfasado; SP3 positional-merge debt CLOSED; next = SP5 autorregulación/RM).

---

## Notes / decisions
- The athlete's swap is **structured** (records the real movement) and **read-only on the plan** (`SessionActual` only). kg **clears** on swap (the athlete logs the real; the substitute may have a different RM).
- The coach's swap **edits the plan**, keeps the `pct`, recomputes `kg = pct × RM(new)` (clears `kgOverride`; `rmRef "none"` → rpe) — reuses SP2's derivation.
- `prescribedMovementId` distinguishes **substituted** (athlete did ≠ plan-at-record) from **desfasado** (coach edited the slot after the athlete recorded) — closing the SP3 positional-merge debt. SP3 rows (null) read as not-substituted.
- `SubstituteSheet` is shared (both shells) → uses only globally-available `--wl-*` tokens.
- Out of scope: per-series, auto-suggesting the substitute's kg to the athlete, molestia-driven suggestions, RM update (SP5).
