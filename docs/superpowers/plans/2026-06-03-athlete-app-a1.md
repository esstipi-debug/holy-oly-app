# App del atleta (bienestar) — A1: shell + Hoy + check-in · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the athlete's daily loop — Shell (brand bar + bottom-nav) + Hoy (estado de hoy, check-in CTA, constancia/racha, camino a la comp) + Check-in overlay + Cuenta mínima — wired to a real athlete-self backend (`DayLog` + `/me/*` under `requireAthlete`), faithful to the Claude Design "bienestar" handoff.

**Architecture:** Three layers, bottom-up. **(1) `core`** gains pure, unit-tested logic (`wellnessScore`, `WELLNESS_ITEMS`, `computeStreak`, `calendarWeeks`, `buildMePlanView`) + DTO types + Zod wire-schemas. **(2) `apps/api`** gains a `DayLog` table (migration `4_day_log`), repo functions, and a `meRoutes` module exposing `GET /me/plan|series|daylog` + `PUT /me/daylog`, all scoped to `req.athleteId` from the session (never body/path → no IDOR), reusing the existing series mapping + auth hook. **(3) `apps/web`** gains a `meClient` (modeled on `authClient`/`vinculoClient`) and the athlete screens under `src/screens/atleta/`, ported faithfully from the design's `ho-*` CSS + components (globals → props, `window.HO` → `meClient`). Routing: `/atleta` becomes `AthleteShell` with nested `hoy`/`progreso`/`cuenta`, replacing the current code-entry `AtletaScreen` (its vincular flow moves into Cuenta mínima).

**Tech Stack:** TypeScript (strict), Zod, Fastify 5, Prisma 6 + Postgres, React 18 + react-router + Vite, Vitest (+ @testing-library/react for web, embedded-postgres for api integration). No Tailwind — inline styles + `--wl-*` CSS custom properties + ported `ho-*` classes.

**Domain guardrails (El Carnicero will check these):** HR-1 — the athlete sees their wellness + streak, NEVER an ACWR ratio or gameable figure; the caritas are **monochrome** (not a state palette), `color=estado` only on the Titular dot. Sin-dato honesto — every Hoy card has an explicit empty variant for the new athlete; never a false-green. Ciclo — hidden in A1 (no cycle card renders). Authz — `requireAthlete` scope-self, no Vínculo needed (the athlete owns their data); screens never `fetch` directly (they go through `meClient`). Verdad anclada a fecha — current week/streak derive from the server's date.

**Out of A1 (later slices):** coach-sees-wellness (needs the physiological-signals-optional refactor + `DayLog→MonitorWeek` rollup) · Mi progreso/charts (A2) · ciclo module + rich Cuenta export/borrar (A3) · mockup chrome (iOS status bar, 390px phone frame, Tweaks panel — NOT ported).

**Spec:** [`docs/superpowers/specs/2026-06-02-athlete-app-a1-design.md`](../specs/2026-06-02-athlete-app-a1-design.md)

**Design source (read-only fidelity reference, may be cleaned):** `C:\Holy Oly 0017\.claude\worktrees\magical-allen-dd70fe\.design-tmp\pk-ql-hoho\project\assets\` (`app.css`, `ui.jsx`, `home.jsx`, `checkin.jsx`, `charts.jsx`, `account.jsx`, `data.js`). This plan embeds the final ported code, so the reference is optional.

---

## File Structure

### `packages/core` (pure logic, types, schemas)
- **Modify** `src/types/index.ts` — add `WellnessField`, `WellnessItemDef`, `WellnessAnswers`, `DayLog`, `DayLogInput`, `DayLogView`, `DayLogResult`, `MePlanView`.
- **Create** `src/logic/wellness.ts` — `WELLNESS_ITEMS` (the 6 items + polarity), `goodness`, `wellnessScore`.
- **Create** `src/logic/wellness.test.ts`.
- **Modify** `src/logic/schedule.ts` — add `computeStreak`, `calendarWeeks`.
- **Create** `src/logic/schedule.test.ts` (or extend if present).
- **Create** `src/logic/mePlan.ts` — `buildMePlanView` (reuses `MACROCYCLES`, `phaseForWeek`, `weekOfDate`).
- **Create** `src/logic/mePlan.test.ts`.
- **Modify** `src/schemas.ts` — add `DayLogInputSchema`, `DayLogSchema`, `DayLogViewSchema`, `DayLogResultSchema`, `MePlanViewSchema`.
- **Create** `src/schemas.daylog.test.ts`.
- **Modify** `src/index.ts` — export `./logic/wellness`, `./logic/mePlan`.

### `apps/api` (persistence + endpoints)
- **Modify** `prisma/schema.prisma` — add `model DayLog` + `dayLogs DayLog[]` on `Athlete`.
- **Create** `prisma/migrations/4_day_log/migration.sql`.
- **Modify** `src/repo.ts` — add `getMePlanView`, `getDayLogView`, `upsertDayLog` (+ `toDayLog`).
- **Create** `src/me/routes.ts` — `meRoutes` (the 4 endpoints, `requireAthlete`).
- **Modify** `src/server.ts` — register `meRoutes`.
- **Create** `src/me.int.test.ts` — integration test (embedded PG, seeded demo athlete).

### `apps/web` (client + screens)
- **Create** `src/data/meClient.ts` + `src/data/meClient.test.ts`.
- **Create** `src/screens/atleta/atleta.css` — ported `ho-*` classes.
- **Create** `src/screens/atleta/prefs.ts` — skin + check-in variant persistence (localStorage).
- **Create** `src/screens/atleta/primitives.tsx` — `Face`, `NavIcon`, `Check`.
- **Create** `src/screens/atleta/AthleteShell.tsx` — brand bar + `<Outlet/>` + bottom nav; owns skin/variant; exports `AtletaOutletCtx`.
- **Create** `src/screens/atleta/HomeScreen.tsx` — loads `meClient`, composes Hoy, owns Check-in overlay.
- **Create** `src/screens/atleta/hoy/Titular.tsx`, `ConstanciaCard.tsx`, `CaminoCard.tsx` (each small, presentational).
- **Create** `src/screens/atleta/CheckIn.tsx` — overlay (FaceRow/FaceDial/WeightStep/done).
- **Create** `src/screens/atleta/CuentaMin.tsx` — vincular form (ported from `AtletaScreen`) + skin picker + variant toggle + logout.
- **Create** `src/screens/atleta/ProgresoPlaceholder.tsx` — A2 stub.
- **Create** tests: `src/screens/atleta/__tests__/home.test.tsx`, `checkin.test.tsx`, `cuenta.test.tsx`.
- **Modify** `src/app/router.tsx` — nested `/atleta` routes; drop `AtletaScreen` import.
- **Delete** `src/screens/atleta/AtletaScreen.tsx` (+ its test if any) — logic moved to `CuentaMin`.

### docs (already present in this worktree)
- `docs/superpowers/specs/2026-06-02-athlete-app-a1-design.md` (spec, uncommitted — commit in Phase E).
- `docs/superpowers/plans/2026-06-03-athlete-app-a1.md` (this file).

---

## Phase A — Core (pure logic + types + schemas)

### Task A1: Core DTO + item types

**Files:**
- Modify: `packages/core/src/types/index.ts` (append after the `Atleta` interface, ~line 87)

- [ ] **Step 1: Append the new types**

```typescript
// ── Athlete self-report (Proyecto A). `field` is the canonical key (DB column, DTO, answers map);
//    `label` is the display name AND the existing MonitorSeries.wellnessItems key (for the future
//    rollup). `highBad` polarity: true ⇒ a HIGH value is BAD (Fatiga/Dolor/Estrés). ──
export type WellnessField = "fatiga" | "dolor" | "estres" | "humor" | "motivacion" | "sueno";

export interface WellnessItemDef {
  field: WellnessField;
  label: string;
  q: string;
  lo: string;
  hi: string;
  highBad: boolean;
}

export type WellnessAnswers = Record<WellnessField, number>;

/** One athlete-day self-report (private to the athlete, anchored to a calendar date). */
export interface DayLog {
  date: string; // ISO YYYY-MM-DD
  fatiga: number; dolor: number; estres: number; humor: number; motivacion: number; sueno: number; // 1..5
  weight?: number; // kg, optional (athlete may skip)
}

/** PUT /me/daylog body: the 6 items + optional weight. Date is server-assigned (today). */
export interface DayLogInput {
  fatiga: number; dolor: number; estres: number; humor: number; motivacion: number; sueno: number;
  weight?: number;
}

/** GET /me/daylog response. `today` is the server's date — anchors the client heatmap/streak frame. */
export interface DayLogView {
  entry: DayLog | null;
  streak: number;
  days: string[]; // ISO dates with a logged entry (for the heatmap)
  today: string;  // ISO
}

/** PUT /me/daylog response. */
export interface DayLogResult {
  entry: DayLog;
  streak: number;
}

/** GET /me/plan response: a redaction-free, purpose-built view for the athlete's own Home. */
export interface MePlanView {
  athlete: { nombre: string; iniciales: string };
  plan: {
    macroName: string;
    totalWeeks: number;
    currentWeek: number;
    currentPhase: string;
    phases: { name: string; from: number; to: number; imr: number }[];
    comps: { name: string; week: number }[];
  } | null;
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm --filter @holy-oly/core exec tsc --noEmit`
Expected: PASS (types only, no usages yet).

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/types/index.ts
git commit -m "feat(core): tipos del self-report del atleta (DayLog/MePlanView/wellness items)"
```

---

### Task A2: `wellnessScore` + `WELLNESS_ITEMS` + `goodness`

**Files:**
- Create: `packages/core/src/logic/wellness.ts`
- Create: `packages/core/src/logic/wellness.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write the failing test**

`packages/core/src/logic/wellness.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { WELLNESS_ITEMS, goodness, wellnessScore } from "./wellness";
import type { WellnessAnswers } from "../types";

const ALL_GOOD: WellnessAnswers = { fatiga: 1, dolor: 1, estres: 1, humor: 5, motivacion: 5, sueno: 5 };
const ALL_BAD: WellnessAnswers = { fatiga: 5, dolor: 5, estres: 5, humor: 1, motivacion: 1, sueno: 1 };

describe("WELLNESS_ITEMS", () => {
  it("are the 6 canonical items with the expected polarity", () => {
    expect(WELLNESS_ITEMS.map((i) => i.field)).toEqual(["fatiga", "dolor", "estres", "humor", "motivacion", "sueno"]);
    const highBad = Object.fromEntries(WELLNESS_ITEMS.map((i) => [i.field, i.highBad]));
    expect(highBad).toEqual({ fatiga: true, dolor: true, estres: true, humor: false, motivacion: false, sueno: false });
    // labels match the existing MonitorSeries.wellnessItems keys (for the future rollup)
    expect(WELLNESS_ITEMS.map((i) => i.label)).toEqual(["Fatiga", "Dolor", "Estrés", "Humor", "Motivación", "Sueño"]);
  });
});

describe("goodness", () => {
  it("inverts highBad items (5 fatiga = a bad day = goodness 1)", () => {
    expect(goodness(5, true)).toBe(1);
    expect(goodness(1, true)).toBe(5);
  });
  it("passes through non-highBad items (5 humor = a good day = goodness 5)", () => {
    expect(goodness(5, false)).toBe(5);
    expect(goodness(1, false)).toBe(1);
  });
});

describe("wellnessScore", () => {
  it("all-good → 100", () => expect(wellnessScore(ALL_GOOD)).toBe(100));
  it("all-bad → 0", () => expect(wellnessScore(ALL_BAD)).toBe(0));
  it("neutral (all 3) → 50", () => {
    expect(wellnessScore({ fatiga: 3, dolor: 3, estres: 3, humor: 3, motivacion: 3, sueno: 3 })).toBe(50);
  });
  it("averages only the answered items, ignoring missing/NaN", () => {
    expect(wellnessScore({ humor: 5 } as Partial<WellnessAnswers> as WellnessAnswers)).toBe(100);
    expect(wellnessScore({} as WellnessAnswers)).toBe(0);
  });
});
```

- [ ] **Step 2: Run it — verify it fails**

Run: `pnpm --filter @holy-oly/core test wellness`
Expected: FAIL — `Cannot find module './wellness'`.

- [ ] **Step 3: Implement `wellness.ts`**

`packages/core/src/logic/wellness.ts`:
```typescript
import type { WellnessItemDef, WellnessAnswers } from "../types";

/** The 6 daily self-report items. `field` = canonical key; `label` = display name (and the
 *  existing MonitorSeries.wellnessItems key). `highBad` true ⇒ a HIGH value is bad. Copy ported
 *  verbatim from the Claude Design check-in (`data.js` checkinItems). */
export const WELLNESS_ITEMS: WellnessItemDef[] = [
  { field: "fatiga",     label: "Fatiga",     q: "¿Qué tan cansada te sentís?", lo: "Con energía", hi: "Agotada",       highBad: true },
  { field: "dolor",      label: "Dolor",      q: "¿Tenés molestias o dolor?",   lo: "Nada",        hi: "Mucho",         highBad: true },
  { field: "estres",     label: "Estrés",     q: "¿Cómo está tu cabeza hoy?",   lo: "Tranquila",   hi: "Muy estresada", highBad: true },
  { field: "humor",      label: "Humor",      q: "¿Cómo es tu ánimo?",          lo: "Bajón",       hi: "Genial",        highBad: false },
  { field: "motivacion", label: "Motivación", q: "¿Con cuántas ganas venís?",   lo: "Pocas",       hi: "A full",        highBad: false },
  { field: "sueno",      label: "Sueño",      q: "¿Cómo dormiste?",             lo: "Mal",         hi: "Like a baby",   highBad: false },
];

/** Maps a raw 1-5 answer to its "good" value 1-5 (sonrisa = buen día), inverting highBad items. */
export function goodness(val: number, highBad: boolean): number {
  return highBad ? 6 - val : val;
}

/** Composite wellness 0-100: each answered item normalized to "good" (1-5 → 0-1), averaged ×100.
 *  All-good → 100, all-bad → 0. Missing/non-finite items are skipped; no items → 0. */
export function wellnessScore(answers: Partial<WellnessAnswers>): number {
  const goods: number[] = [];
  for (const item of WELLNESS_ITEMS) {
    const v = answers[item.field];
    if (v == null || !Number.isFinite(v)) continue;
    goods.push((goodness(v, item.highBad) - 1) / 4); // 0..1
  }
  if (goods.length === 0) return 0;
  return Math.round((goods.reduce((a, b) => a + b, 0) / goods.length) * 100);
}
```

- [ ] **Step 4: Export from the barrel**

In `packages/core/src/index.ts`, add after line 8 (`export * from "./logic/readiness";`):
```typescript
export * from "./logic/wellness";
```

- [ ] **Step 5: Run tests — verify they pass**

Run: `pnpm --filter @holy-oly/core test wellness`
Expected: PASS (all cases).

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/logic/wellness.ts packages/core/src/logic/wellness.test.ts packages/core/src/index.ts
git commit -m "feat(core): wellnessScore + WELLNESS_ITEMS (polaridad highBad, fuente única)"
```

---

### Task A3: `computeStreak` + `calendarWeeks` (date logic)

**Files:**
- Modify: `packages/core/src/logic/schedule.ts` (append; reuses the existing private `ms`, `toISO`, `DAY`)
- Modify: `packages/core/src/logic/schedule.test.ts` (EXISTS — has tests for `weekOfDate`/`dateOfWeek`/`defaultStartDate`/`sessionsPerWeek`; do NOT overwrite)

- [ ] **Step 1: Extend the existing test file**

(a) Extend the import on **line 2** of `packages/core/src/logic/schedule.test.ts` to add the two new functions:
```typescript
import { weekOfDate, dateOfWeek, defaultStartDate, sessionsPerWeek, computeStreak, calendarWeeks } from "./schedule";
```
(b) Append these two `describe` blocks at the end of the file (`describe`/`it`/`expect` are already imported on line 1):
```typescript
describe("computeStreak", () => {
  it("counts the consecutive run ending today", () => {
    expect(computeStreak(["2026-06-01", "2026-06-02", "2026-06-03"], "2026-06-03")).toBe(3);
  });
  it("stays alive when the last log was yesterday (today not yet logged)", () => {
    expect(computeStreak(["2026-06-01", "2026-06-02"], "2026-06-03")).toBe(2);
  });
  it("is broken (0) when the last log is older than yesterday", () => {
    expect(computeStreak(["2026-05-30", "2026-05-31"], "2026-06-03")).toBe(0);
  });
  it("stops at the first gap", () => {
    expect(computeStreak(["2026-05-31", "2026-06-02", "2026-06-03"], "2026-06-03")).toBe(2);
  });
  it("ignores duplicates and unsorted input", () => {
    expect(computeStreak(["2026-06-03", "2026-06-02", "2026-06-03"], "2026-06-03")).toBe(2);
  });
  it("empty history → 0", () => expect(computeStreak([], "2026-06-03")).toBe(0));
});

describe("calendarWeeks", () => {
  it("returns `weeks` Monday-first rows of 7 ISO dates", () => {
    const grid = calendarWeeks("2026-06-03", 8); // 2026-06-03 is a Wednesday
    expect(grid).toHaveLength(8);
    grid.forEach((row) => expect(row).toHaveLength(7));
    // the last row contains today, Monday-first
    const last = grid[grid.length - 1]!;
    expect(last).toContain("2026-06-03");
    expect(last[0]).toBe("2026-06-01"); // Monday of that week
    expect(last[6]).toBe("2026-06-07"); // Sunday
  });
});
```

- [ ] **Step 2: Run it — verify it fails**

Run: `pnpm --filter @holy-oly/core test schedule`
Expected: FAIL — `computeStreak`/`calendarWeeks` not exported.

- [ ] **Step 3: Implement (append to `schedule.ts`)**

Append to `packages/core/src/logic/schedule.ts`:
```typescript
/** Consecutive-day streak ending at the most recent logged day — counted only if that day is
 *  today or yesterday (else the streak is broken → 0). Dates are ISO YYYY-MM-DD. Rest days are
 *  not modeled in A1, so any calendar gap breaks the run. */
export function computeStreak(loggedDates: string[], today: string): number {
  if (loggedDates.length === 0) return 0;
  const set = new Set(loggedDates);
  const todayMs = ms(today);
  let cur: number;
  if (set.has(today)) cur = todayMs;
  else if (set.has(toISO(todayMs - DAY))) cur = todayMs - DAY;
  else return 0;
  let count = 0;
  while (set.has(toISO(cur))) {
    count++;
    cur -= DAY;
  }
  return count;
}

/** `weeks` Monday-first rows of 7 ISO dates, the last row containing `today`. Backs the heatmap. */
export function calendarWeeks(today: string, weeks: number): string[][] {
  const todayMs = ms(today);
  const dow = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7; // 0=Mon … 6=Sun
  const mondayMs = todayMs - dow * DAY;
  const rows: string[][] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const start = mondayMs - w * 7 * DAY;
    const row: string[] = [];
    for (let d = 0; d < 7; d++) row.push(toISO(start + d * DAY));
    rows.push(row);
  }
  return rows;
}
```

- [ ] **Step 4: Run tests — verify they pass**

Run: `pnpm --filter @holy-oly/core test schedule`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/logic/schedule.ts packages/core/src/logic/schedule.test.ts
git commit -m "feat(core): computeStreak + calendarWeeks (racha y heatmap del atleta)"
```

---

### Task A4: `buildMePlanView`

**Files:**
- Create: `packages/core/src/logic/mePlan.ts`
- Create: `packages/core/src/logic/mePlan.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write the failing test**

`packages/core/src/logic/mePlan.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { buildMePlanView } from "./mePlan";
import { defaultStartDate } from "./schedule";
import type { Plan } from "../types";

const ATH = { nombre: "Mara V.", iniciales: "MV" };

describe("buildMePlanView", () => {
  it("no plan → plan: null", () => {
    expect(buildMePlanView(ATH, undefined, "2026-06-03")).toEqual({ athlete: ATH, plan: null });
  });

  it("unknown macroId → plan: null", () => {
    const plan: Plan = { atletaId: "mv", macroId: "does-not-exist", startWeek: 1, rms: { arranque: 1, envion: 1, sentadilla: 1, frente: 1 }, comps: [] };
    expect(buildMePlanView(ATH, plan, "2026-06-03").plan).toBeNull();
  });

  it("anchors the current week to the plan's startDate (ruso-5d is 16 weeks)", () => {
    // startDate chosen so today is week 12
    const startDate = defaultStartDate("2026-06-03", 12);
    const plan: Plan = {
      atletaId: "mv", macroId: "ruso-5d", startWeek: 1, startDate,
      rms: { arranque: 80, envion: 100, sentadilla: 140, frente: 110 },
      comps: [{ name: "Nacional", week: 16 }],
    };
    const view = buildMePlanView(ATH, plan, "2026-06-03");
    expect(view.plan).not.toBeNull();
    expect(view.plan!.totalWeeks).toBe(16);
    expect(view.plan!.currentWeek).toBe(12);
    expect(view.plan!.currentPhase).not.toBe("");
    expect(view.plan!.phases.length).toBeGreaterThan(0);
    expect(view.plan!.comps).toEqual([{ name: "Nacional", week: 16 }]);
  });

  it("falls back to startWeek when there is no startDate", () => {
    const plan: Plan = { atletaId: "mv", macroId: "ruso-5d", startWeek: 5, rms: { arranque: 80, envion: 100, sentadilla: 140, frente: 110 }, comps: [] };
    expect(buildMePlanView(ATH, plan, "2026-06-03").plan!.currentWeek).toBe(5);
  });
});
```

- [ ] **Step 2: Run it — verify it fails**

Run: `pnpm --filter @holy-oly/core test mePlan`
Expected: FAIL — `Cannot find module './mePlan'`.

- [ ] **Step 3: Implement `mePlan.ts`**

`packages/core/src/logic/mePlan.ts`:
```typescript
import type { MePlanView, Plan } from "../types";
import { MACROCYCLES, phaseForWeek } from "../data/macrocycles";
import { weekOfDate } from "./schedule";

/** Build the athlete-facing plan view: current week (anchored to the plan's startDate, falling
 *  back to startWeek), current phase, the phase ribbon, and the upcoming competitions. Pure: the
 *  caller passes the server's `today`. Returns `plan: null` when there is no plan or no macro. */
export function buildMePlanView(
  athlete: { nombre: string; iniciales: string },
  plan: Plan | undefined,
  today: string,
): MePlanView {
  if (!plan) return { athlete, plan: null };
  const macro = MACROCYCLES.find((m) => m.id === plan.macroId);
  if (!macro) return { athlete, plan: null };
  const last = macro.phaseProfile[macro.phaseProfile.length - 1];
  const totalWeeks = last ? last.weeks[1] : plan.startWeek;
  const currentWeek = plan.startDate
    ? weekOfDate(plan.startDate, today, totalWeeks)
    : Math.min(Math.max(plan.startWeek, 1), totalWeeks);
  const phase = phaseForWeek(macro, currentWeek);
  return {
    athlete,
    plan: {
      macroName: macro.name,
      totalWeeks,
      currentWeek,
      currentPhase: phase?.name ?? "",
      phases: macro.phaseProfile.map((p) => ({ name: p.name, from: p.weeks[0], to: p.weeks[1], imr: p.imrPct[1] })),
      comps: plan.comps.map((c) => ({ name: c.name, week: c.week })),
    },
  };
}
```

- [ ] **Step 4: Export from the barrel**

In `packages/core/src/index.ts`, add after the `wellness` export:
```typescript
export * from "./logic/mePlan";
```

- [ ] **Step 5: Run tests — verify they pass**

Run: `pnpm --filter @holy-oly/core test mePlan`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/logic/mePlan.ts packages/core/src/logic/mePlan.test.ts packages/core/src/index.ts
git commit -m "feat(core): buildMePlanView (saludo + camino, semana anclada a fecha)"
```

---

### Task A5: Zod wire-schemas for `/me/*`

**Files:**
- Modify: `packages/core/src/schemas.ts` (append at end; reuses the module-private `IsoDateSchema` (line 54) and `KgSchema` (line 69))
- Create: `packages/core/src/schemas.daylog.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/core/src/schemas.daylog.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { DayLogInputSchema, DayLogViewSchema, MePlanViewSchema } from "./schemas";

describe("DayLogInputSchema", () => {
  it("accepts 6 items 1-5 + optional weight", () => {
    expect(DayLogInputSchema.safeParse({ fatiga: 2, dolor: 1, estres: 3, humor: 4, motivacion: 5, sueno: 4, weight: 80.8 }).success).toBe(true);
    expect(DayLogInputSchema.safeParse({ fatiga: 2, dolor: 1, estres: 3, humor: 4, motivacion: 5, sueno: 4 }).success).toBe(true);
  });
  it("rejects out-of-range or non-integer values", () => {
    expect(DayLogInputSchema.safeParse({ fatiga: 0, dolor: 1, estres: 3, humor: 4, motivacion: 5, sueno: 4 }).success).toBe(false);
    expect(DayLogInputSchema.safeParse({ fatiga: 6, dolor: 1, estres: 3, humor: 4, motivacion: 5, sueno: 4 }).success).toBe(false);
    expect(DayLogInputSchema.safeParse({ fatiga: 2.5, dolor: 1, estres: 3, humor: 4, motivacion: 5, sueno: 4 }).success).toBe(false);
    expect(DayLogInputSchema.safeParse({ fatiga: 2, dolor: 1, estres: 3, humor: 4, motivacion: 5, sueno: 4, weight: -1 }).success).toBe(false);
  });
});

describe("DayLogViewSchema", () => {
  it("accepts a null entry with streak + days + today", () => {
    expect(DayLogViewSchema.safeParse({ entry: null, streak: 0, days: [], today: "2026-06-03" }).success).toBe(true);
  });
});

describe("MePlanViewSchema", () => {
  it("accepts a null plan", () => {
    expect(MePlanViewSchema.safeParse({ athlete: { nombre: "Mara", iniciales: "MV" }, plan: null }).success).toBe(true);
  });
});
```

- [ ] **Step 2: Run it — verify it fails**

Run: `pnpm --filter @holy-oly/core test schemas.daylog`
Expected: FAIL — schemas not exported.

- [ ] **Step 3: Implement (append to `schemas.ts`)**

Append to `packages/core/src/schemas.ts`:
```typescript
// ── Athlete self-report wire shapes (Proyecto A · /me/*). Items 1-5 + optional weight. The 6
//    items are untrusted writer input → bound each value; date is server-assigned, not in the body. ──
const WellnessValueSchema = z.number().int().min(1).max(5);

export const DayLogInputSchema = z.object({
  fatiga: WellnessValueSchema, dolor: WellnessValueSchema, estres: WellnessValueSchema,
  humor: WellnessValueSchema, motivacion: WellnessValueSchema, sueno: WellnessValueSchema,
  weight: KgSchema.optional(),
});

export const DayLogSchema = z.object({
  date: IsoDateSchema,
  fatiga: WellnessValueSchema, dolor: WellnessValueSchema, estres: WellnessValueSchema,
  humor: WellnessValueSchema, motivacion: WellnessValueSchema, sueno: WellnessValueSchema,
  weight: KgSchema.optional(),
});

export const DayLogViewSchema = z.object({
  entry: DayLogSchema.nullable(),
  streak: z.number().int().nonnegative(),
  days: z.array(IsoDateSchema).max(2000),
  today: IsoDateSchema,
});

export const DayLogResultSchema = z.object({
  entry: DayLogSchema,
  streak: z.number().int().nonnegative(),
});

export const MePlanViewSchema = z.object({
  athlete: z.object({ nombre: z.string(), iniciales: z.string() }),
  plan: z.object({
    macroName: z.string(),
    totalWeeks: z.number().int(),
    currentWeek: z.number().int(),
    currentPhase: z.string(),
    phases: z.array(z.object({
      name: z.string(), from: z.number().int(), to: z.number().int(), imr: z.number(),
    })).max(20),
    comps: z.array(z.object({ name: z.string(), week: z.number().int() })).max(50),
  }).nullable(),
});
```

- [ ] **Step 4: Run tests — verify they pass**

Run: `pnpm --filter @holy-oly/core test schemas.daylog`
Expected: PASS.

- [ ] **Step 5: Full core check + commit**

Run: `pnpm --filter @holy-oly/core test && pnpm --filter @holy-oly/core exec tsc --noEmit`
Expected: all green (existing 45 + new wellness/schedule/mePlan/schemas cases).

```bash
git add packages/core/src/schemas.ts packages/core/src/schemas.daylog.test.ts
git commit -m "feat(core): schemas wire de /me/* (DayLog input/view/result + MePlanView)"
```

---

## Phase B — Backend (`DayLog` + `/me/*` endpoints)

### Task B1: `DayLog` Prisma model + migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (add `model DayLog` after `WellnessItem`, ~line 195; add the relation field to `Athlete`)
- Create: `apps/api/prisma/migrations/4_day_log/migration.sql` (generated)

- [ ] **Step 1: Add the relation field to `Athlete`**

In `model Athlete` (~line 92-111), add to the relation list (e.g. after `cycle CycleConsent?`):
```prisma
  dayLogs      DayLog[]
```

- [ ] **Step 2: Add the `DayLog` model**

After `model WellnessItem { … }` (~line 195):
```prisma
/// One athlete-day self-report (Proyecto A). Private to the athlete; one row per (athlete, date).
model DayLog {
  id         String  @id @default(uuid())
  athleteId  String
  athlete    Athlete @relation(fields: [athleteId], references: [id], onDelete: Cascade)
  date       String  // ISO YYYY-MM-DD
  fatiga     Int
  dolor      Int
  estres     Int
  humor      Int
  motivacion Int
  sueno      Int
  weight     Float?

  @@unique([athleteId, date])
  @@index([athleteId])
}
```

- [ ] **Step 3: Generate the migration SQL (non-interactive, embedded PG)**

Run: `pnpm --filter @holy-oly/api exec tsx scripts/make-migration.ts 4 day_log`
Expected: `✅ Wrote prisma/migrations/4_day_log/migration.sql`. It should match:
```sql
-- CreateTable
CREATE TABLE "DayLog" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "fatiga" INTEGER NOT NULL,
    "dolor" INTEGER NOT NULL,
    "estres" INTEGER NOT NULL,
    "humor" INTEGER NOT NULL,
    "motivacion" INTEGER NOT NULL,
    "sueno" INTEGER NOT NULL,
    "weight" DOUBLE PRECISION,

    CONSTRAINT "DayLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DayLog_athleteId_idx" ON "DayLog"("athleteId");

-- CreateIndex
CREATE UNIQUE INDEX "DayLog_athleteId_date_key" ON "DayLog"("athleteId", "date");

-- AddForeignKey
ALTER TABLE "DayLog" ADD CONSTRAINT "DayLog_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 4: Regenerate the Prisma client**

Run: `pnpm --filter @holy-oly/api exec prisma generate`
Expected: client regenerated with the `DayLog` delegate (`prisma.dayLog`).

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/4_day_log/migration.sql
git commit -m "feat(api): modelo DayLog + migración 4_day_log (self-report del atleta)"
```

---

### Task B2: Failing integration test for `/me/*`

**Files:**
- Create: `apps/api/src/me.int.test.ts`

> Uses the seeded demo athlete `atleta@holyoly.dev` / `holyoly-demo` (athlete id `demo-atleta`, **no plan, no series** — exactly the new-athlete A1 path). Auth is real: login → session cookie → call `/me/*` (mirrors `server.int.test.ts`).

- [ ] **Step 1: Write the test**

`apps/api/src/me.int.test.ts`:
```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "./server";
import { prisma } from "./db/client";

type InjectRes = { cookies: Array<{ name: string; value: string }>; statusCode: number };
function sessionHeader(res: InjectRes): { cookie: string } {
  const c = res.cookies.find((x) => x.name === "session");
  if (!c) throw new Error("no session cookie was set");
  return { cookie: `session=${c.value}` };
}

describe("API integration — athlete self (/me/*)", () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = buildServer();
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  async function loginDemoAthlete(): Promise<{ cookie: string }> {
    const res = await app.inject({
      method: "POST", url: "/auth/login",
      payload: { email: "atleta@holyoly.dev", password: "holyoly-demo" },
    });
    expect(res.statusCode).toBe(200);
    return sessionHeader(res);
  }

  it("rejects unauthenticated /me/daylog with 401", async () => {
    const res = await app.inject({ method: "GET", url: "/me/daylog" });
    expect(res.statusCode).toBe(401);
  });

  it("a coach session cannot use the athlete surface (no athleteId → 401)", async () => {
    const login = await app.inject({ method: "POST", url: "/auth/login", payload: { email: "coach@holyoly.dev", password: "holyoly-demo" } });
    const res = await app.inject({ method: "GET", url: "/me/daylog", headers: sessionHeader(login) });
    expect(res.statusCode).toBe(401);
  });

  it("GET /me/plan → plan: null for an unassigned athlete (honest, no fake plan)", async () => {
    const headers = await loginDemoAthlete();
    const res = await app.inject({ method: "GET", url: "/me/plan", headers });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { athlete: { nombre: string }; plan: unknown };
    expect(body.athlete.nombre).toBe("Demo Atleta");
    expect(body.plan).toBeNull();
  });

  it("GET /me/series → 404 for an athlete with no series (sin-dato honesto)", async () => {
    const headers = await loginDemoAthlete();
    const res = await app.inject({ method: "GET", url: "/me/series", headers });
    expect(res.statusCode).toBe(404);
  });

  it("daylog round-trip: empty → PUT → streak 1, entry present", async () => {
    const headers = await loginDemoAthlete();

    const empty = await app.inject({ method: "GET", url: "/me/daylog", headers });
    expect(empty.statusCode).toBe(200);
    const emptyBody = empty.json() as { entry: unknown; streak: number; days: string[]; today: string };
    expect(emptyBody.entry).toBeNull();
    expect(emptyBody.streak).toBe(0);
    expect(typeof emptyBody.today).toBe("string");

    const put = await app.inject({
      method: "PUT", url: "/me/daylog", headers,
      payload: { fatiga: 2, dolor: 1, estres: 3, humor: 4, motivacion: 5, sueno: 4, weight: 80.8 },
    });
    expect(put.statusCode).toBe(200);
    const putBody = put.json() as { entry: { fatiga: number; weight?: number }; streak: number };
    expect(putBody.entry.fatiga).toBe(2);
    expect(putBody.entry.weight).toBe(80.8);
    expect(putBody.streak).toBe(1);

    const after = await app.inject({ method: "GET", url: "/me/daylog", headers });
    const afterBody = after.json() as { entry: { fatiga: number } | null; streak: number; days: string[] };
    expect(afterBody.entry?.fatiga).toBe(2);
    expect(afterBody.streak).toBe(1);
    expect(afterBody.days.length).toBe(1);
  });

  it("PUT is an upsert (re-submitting the same day overwrites, not duplicates)", async () => {
    const headers = await loginDemoAthlete();
    await app.inject({ method: "PUT", url: "/me/daylog", headers, payload: { fatiga: 5, dolor: 5, estres: 5, humor: 1, motivacion: 1, sueno: 1 } });
    const res = await app.inject({ method: "GET", url: "/me/daylog", headers });
    const body = res.json() as { entry: { fatiga: number; weight?: number }; days: string[] };
    expect(body.entry.fatiga).toBe(5);
    expect(body.entry.weight).toBeUndefined(); // weight omitted on the second PUT
    expect(body.days.length).toBe(1); // still one row for today
  });

  it("rejects an out-of-range daylog with 400", async () => {
    const headers = await loginDemoAthlete();
    const res = await app.inject({ method: "PUT", url: "/me/daylog", headers, payload: { fatiga: 9, dolor: 1, estres: 3, humor: 4, motivacion: 5, sueno: 4 } });
    expect(res.statusCode).toBe(400);
  });
});
```

- [ ] **Step 2: Run it — verify it fails**

Run: `pnpm --filter @holy-oly/api verify`
Expected: FAIL — `/me/*` routes return 404 (not implemented). (The harness boots embedded PG, migrates incl. `4_day_log`, seeds, runs integration.)

---

### Task B3: Implement repo functions + `meRoutes` + register

**Files:**
- Modify: `apps/api/src/repo.ts` (add imports + 3 functions + `toDayLog`)
- Create: `apps/api/src/me/routes.ts`
- Modify: `apps/api/src/server.ts` (import + register)

- [ ] **Step 1: Add repo functions**

In `apps/api/src/repo.ts`, extend the core imports at the top:
```typescript
import type {
  Atleta, MacrocycleLevel, MonitorSeries, Medal, Competencia, Plan, CycleContext, SessionLog,
  DayLog, DayLogView, DayLogResult, MePlanView, DayLogInput,
} from "@holy-oly/core";
import { RMSchema, buildMePlanView, computeStreak } from "@holy-oly/core";
```

Append at the end of `repo.ts`:
```typescript
// ── Athlete self (Proyecto A). Scoped to athleteId by the caller (req.athleteId from session). ──

interface DayLogRow {
  date: string; fatiga: number; dolor: number; estres: number;
  humor: number; motivacion: number; sueno: number; weight: number | null;
}
function toDayLog(r: DayLogRow): DayLog {
  return {
    date: r.date, fatiga: r.fatiga, dolor: r.dolor, estres: r.estres,
    humor: r.humor, motivacion: r.motivacion, sueno: r.sueno, weight: r.weight ?? undefined,
  };
}

/** The athlete's own plan view (greeting + camino). `plan: null` when unassigned. */
export async function getMePlanView(prisma: PrismaClient, athleteId: string, today: string): Promise<MePlanView | undefined> {
  const a = await prisma.athlete.findUnique({ where: { id: athleteId } });
  if (!a) return undefined;
  const plan = await getPlan(prisma, athleteId);
  return buildMePlanView({ nombre: a.nombre, iniciales: a.iniciales }, plan, today);
}

/** Today's entry (or the requested date) + streak + logged days (heatmap), all as of `today`. */
export async function getDayLogView(prisma: PrismaClient, athleteId: string, today: string, date?: string): Promise<DayLogView> {
  const target = date ?? today;
  const rows = await prisma.dayLog.findMany({ where: { athleteId }, select: { date: true } });
  const days = rows.map((r) => r.date);
  const entry = await prisma.dayLog.findUnique({ where: { athleteId_date: { athleteId, date: target } } });
  return { entry: entry ? toDayLog(entry) : null, streak: computeStreak(days, today), days, today };
}

/** Upsert the athlete's entry for `today` (one row per athlete-day), then recompute the streak. */
export async function upsertDayLog(prisma: PrismaClient, athleteId: string, today: string, input: DayLogInput): Promise<DayLogResult> {
  const data = {
    fatiga: input.fatiga, dolor: input.dolor, estres: input.estres,
    humor: input.humor, motivacion: input.motivacion, sueno: input.sueno,
    weight: input.weight ?? null,
  };
  const row = await prisma.dayLog.upsert({
    where: { athleteId_date: { athleteId, date: today } },
    create: { athleteId, date: today, ...data },
    update: data,
  });
  const rows = await prisma.dayLog.findMany({ where: { athleteId }, select: { date: true } });
  return { entry: toDayLog(row), streak: computeStreak(rows.map((r) => r.date), today) };
}
```

- [ ] **Step 2: Create `me/routes.ts`**

`apps/api/src/me/routes.ts`:
```typescript
import type { FastifyInstance } from "fastify";
import { DayLogInputSchema } from "@holy-oly/core";
import { prisma } from "../db/client";
import { requireAthlete } from "../auth/guards";
import * as repo from "../repo";

/** Server's calendar date (UTC). A1 anchors the athlete loop to this; per-athlete timezones are a
 *  later refinement. */
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Athlete-self surface (Proyecto A). The principal is the athlete's own session: `req.athleteId`
 * comes from the session cookie, NEVER from the body or path — so there is no cross-athlete write.
 * No Vínculo is required (the athlete owns their data).
 */
export async function meRoutes(app: FastifyInstance): Promise<void> {
  app.get("/me/plan", async (req, reply) => {
    const athleteId = requireAthlete(req, reply);
    if (!athleteId) return;
    const view = await repo.getMePlanView(prisma, athleteId, todayISO());
    if (!view) return reply.code(404).send({ error: "no athlete" });
    return view;
  });

  app.get("/me/series", async (req, reply) => {
    const athleteId = requireAthlete(req, reply);
    if (!athleteId) return;
    const s = await repo.getSeries(prisma, athleteId);
    if (!s) return reply.code(404).send({ error: "no series" });
    return s;
  });

  app.get<{ Querystring: { date?: string } }>("/me/daylog", async (req, reply) => {
    const athleteId = requireAthlete(req, reply);
    if (!athleteId) return;
    return repo.getDayLogView(prisma, athleteId, todayISO(), req.query.date);
  });

  app.put("/me/daylog", async (req, reply) => {
    const athleteId = requireAthlete(req, reply);
    if (!athleteId) return;
    const parsed = DayLogInputSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid daylog" });
    return repo.upsertDayLog(prisma, athleteId, todayISO(), parsed.data);
  });
}
```

- [ ] **Step 3: Register in `server.ts`**

In `apps/api/src/server.ts`, add the import after `import { vinculoRoutes } from "./vinculo/routes";` (line 13):
```typescript
import { meRoutes } from "./me/routes";
```
And register it after `app.register(vinculoRoutes);` (line 69):
```typescript
  app.register(meRoutes);
```

- [ ] **Step 4: Run the integration suite — verify it passes**

Run: `pnpm --filter @holy-oly/api verify`
Expected: PASS (the new `me.int.test.ts` cases + the existing integration tests, all green).

- [ ] **Step 5: Unit + typecheck**

Run: `pnpm --filter @holy-oly/api test && pnpm --filter @holy-oly/api exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/repo.ts apps/api/src/me/routes.ts apps/api/src/server.ts apps/api/src/me.int.test.ts
git commit -m "feat(api): endpoints /me/* (plan/series/daylog) scope-self con requireAthlete"
```

---

## Phase C — Web client (`meClient`)

### Task C1: `meClient` + tests

**Files:**
- Create: `apps/web/src/data/meClient.ts`
- Create: `apps/web/src/data/meClient.test.ts`

> Modeled on `authClient`/`vinculoClient`: a flat module of typed async functions (NOT the `Repository` class — the athlete surface is separate). `BASE = import.meta.env.VITE_API_URL ?? ""`, `credentials: "include"`, every response validated against a core Zod schema; 404 → `undefined` only for `/me/series`.

- [ ] **Step 1: Write the failing test**

`apps/web/src/data/meClient.test.ts`:
```typescript
import { describe, it, expect, vi, afterEach } from "vitest";
import * as me from "./meClient";

afterEach(() => vi.restoreAllMocks());

function res(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe("meClient", () => {
  it("getMePlan parses the view (plan may be null)", async () => {
    global.fetch = vi.fn(async () => res(200, { athlete: { nombre: "Demo", iniciales: "DA" }, plan: null })) as unknown as typeof fetch;
    expect((await me.getMePlan()).plan).toBeNull();
  });

  it("getMeSeries returns undefined on 404", async () => {
    global.fetch = vi.fn(async () => res(404, { error: "no series" })) as unknown as typeof fetch;
    expect(await me.getMeSeries()).toBeUndefined();
  });

  it("getDayLog parses the view", async () => {
    global.fetch = vi.fn(async () => res(200, { entry: null, streak: 0, days: [], today: "2026-06-03" })) as unknown as typeof fetch;
    const v = await me.getDayLog();
    expect(v.streak).toBe(0);
    expect(v.today).toBe("2026-06-03");
  });

  it("putDayLog PUTs the body with credentials and returns the result", async () => {
    let seen: { method?: string; credentials?: string; body?: string } = {};
    global.fetch = vi.fn(async (_u: string, init: { method?: string; credentials?: string; body?: string }) => {
      seen = init;
      return res(200, { entry: { date: "2026-06-03", fatiga: 2, dolor: 1, estres: 3, humor: 4, motivacion: 5, sueno: 4, weight: 80.8 }, streak: 1 });
    }) as unknown as typeof fetch;
    const r = await me.putDayLog({ fatiga: 2, dolor: 1, estres: 3, humor: 4, motivacion: 5, sueno: 4, weight: 80.8 });
    expect(r.streak).toBe(1);
    expect(seen.method).toBe("PUT");
    expect(seen.credentials).toBe("include");
    expect(JSON.parse(seen.body ?? "{}").fatiga).toBe(2);
  });

  it("surfaces the API error message on failure", async () => {
    global.fetch = vi.fn(async () => res(400, { error: "invalid daylog" })) as unknown as typeof fetch;
    await expect(me.putDayLog({ fatiga: 9, dolor: 1, estres: 3, humor: 4, motivacion: 5, sueno: 4 })).rejects.toThrow(/invalid daylog/);
  });
});
```

- [ ] **Step 2: Run it — verify it fails**

Run: `pnpm --filter @holy-oly/web test meClient`
Expected: FAIL — `Cannot find module './meClient'`.

- [ ] **Step 3: Implement `meClient.ts`**

`apps/web/src/data/meClient.ts`:
```typescript
import {
  MePlanViewSchema, MonitorSeriesSchema, DayLogViewSchema, DayLogResultSchema,
  type MePlanView, type MonitorSeries, type DayLogView, type DayLogResult, type DayLogInput,
} from "@holy-oly/core";

const BASE = import.meta.env.VITE_API_URL ?? "";

async function fail(res: Response): Promise<never> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  throw new Error(body?.error ?? `request failed (${res.status})`);
}

/** The athlete's own plan view (greeting + camino). plan is null when unassigned. */
export async function getMePlan(): Promise<MePlanView> {
  const res = await fetch(`${BASE}/me/plan`, { credentials: "include" });
  if (!res.ok) return fail(res);
  return MePlanViewSchema.parse(await res.json());
}

/** The athlete's own series (Titular state). undefined when there is none (404). */
export async function getMeSeries(): Promise<MonitorSeries | undefined> {
  const res = await fetch(`${BASE}/me/series`, { credentials: "include" });
  if (res.status === 404) return undefined;
  if (!res.ok) return fail(res);
  return MonitorSeriesSchema.parse(await res.json());
}

/** Today's entry (or `date`) + streak + logged days + server today. */
export async function getDayLog(date?: string): Promise<DayLogView> {
  const q = date ? `?date=${encodeURIComponent(date)}` : "";
  const res = await fetch(`${BASE}/me/daylog${q}`, { credentials: "include" });
  if (!res.ok) return fail(res);
  return DayLogViewSchema.parse(await res.json());
}

/** Upsert today's self-report. */
export async function putDayLog(input: DayLogInput): Promise<DayLogResult> {
  const res = await fetch(`${BASE}/me/daylog`, {
    method: "PUT",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) return fail(res);
  return DayLogResultSchema.parse(await res.json());
}
```

- [ ] **Step 4: Run tests — verify they pass**

Run: `pnpm --filter @holy-oly/web test meClient`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/data/meClient.ts apps/web/src/data/meClient.test.ts
git commit -m "feat(web): meClient (/me/* con validación Zod; 404→undefined en series)"
```

---

## Phase D — Web UI (faithful port of the bienestar design)

> The screens use the ported `ho-*` CSS classes (faithful to the design) + `--wl-*` tokens, so they work in any skin (default neon). `window.HO` globals become props/`meClient`; the mockup chrome (iOS status bar, 390px phone frame, Tweaks panel) is NOT ported.

### Task D1: `atleta.css` (port the `ho-*` classes)

**Files:**
- Create: `apps/web/src/screens/atleta/atleta.css`

> Port of the design's `app.css` minus the mockup-only blocks (`html,body`, `body` centering, `.ho-app` phone frame + its `@media`, `.ho-status*`). Frameless adaptations: `.ho-scroll` loses the flex/overflow (the app uses normal page scroll), `.ho-nav` is `fixed` + centered to the column, `.ho-checkin`/`.ho-sheet*` are `fixed` (viewport overlays). Everything else is verbatim. The `:root{--ho-mono}` and the cycle/sheet classes are kept (harmless; A2/A3 reuse them with zero CSS work).

- [ ] **Step 1: Create the file with this content**

`apps/web/src/screens/atleta/atleta.css`:
```css
/* Holy Oly · atleta.css — port del prototipo de bienestar (lee --wl-* → anda en cualquier skin).
   Sin el chrome del mockup (status-bar, marco de teléfono, tweaks). Mobile-first, una columna. */

:root { --ho-mono: 'JetBrains Mono', ui-monospace, monospace; }
* { box-sizing: border-box; }

/* shell (frameless: columna centrada, scroll de página) */
.ho-shell { min-height: 100vh; max-width: 460px; margin: 0 auto; position: relative; background: var(--wl-bg); color: var(--wl-text); font-family: var(--wl-body); }
.ho-scroll { padding: 4px 14px 96px; }

/* brand bar */
.ho-hobar { display: flex; align-items: center; gap: 11px; padding: 12px 16px; background: var(--wl-bg); }
.ho-hobar__logo { width: 30px; height: 30px; flex: 0 0 auto; }
.ho-hobar__brand { display: flex; flex-direction: column; line-height: 1; }
.ho-hobar__name { font-family: var(--wl-display); font-weight: 800; font-size: 16px; letter-spacing: .05em; color: var(--wl-text); }
.wl--neon .ho-hobar__name, .wl--neonlight .ho-hobar__name, .wl--chalk .ho-hobar__name { text-transform: uppercase; }
.ho-hobar__motto { font-family: var(--ho-mono); font-size: 8.5px; letter-spacing: .07em; color: var(--wl-accent); margin-top: 4px; }
.ho-hobar__spacer { flex: 1; }
.ho-hobar__avatar {
  width: 34px; height: 34px; border-radius: 50%; flex: 0 0 auto;
  display: flex; align-items: center; justify-content: center;
  font-family: var(--wl-display); font-weight: 800; font-size: 15px;
  background: color-mix(in srgb, var(--wl-accent) 16%, var(--wl-surface)); color: var(--wl-accent);
  border: 1px solid color-mix(in srgb, var(--wl-accent) 35%, transparent); cursor: pointer;
}

/* greeting */
.ho-greet { margin: 6px 2px 12px; }
.ho-greet__h { font-family: var(--wl-display); font-weight: 800; font-size: 22px; color: var(--wl-text); line-height: 1; }
.wl--neon .ho-greet__h, .wl--neonlight .ho-greet__h, .wl--chalk .ho-greet__h { text-transform: uppercase; }
.ho-greet__s { font-family: var(--ho-mono); font-size: 10.5px; color: var(--wl-muted); margin-top: 7px; letter-spacing: .02em; }

/* generic card */
.ho-card { background: var(--wl-surface); border: 1px solid color-mix(in srgb, var(--wl-text) 7%, transparent); border-radius: var(--wl-radius); padding: 14px 14px 13px; margin-top: 12px; }
.wl--neon .ho-card { background: rgba(255, 255, 255, .02); border-color: rgba(255, 255, 255, .07); }
.wl--chalk .ho-card { border: 3px solid var(--wl-ink); box-shadow: 5px 5px 0 var(--wl-ink); border-radius: 0; }
.wl--premium .ho-card { border: var(--wl-hair); }
.wl--neonlight .ho-card { background: #fff; border-color: rgba(58, 28, 64, .08); box-shadow: 0 8px 24px rgba(255, 46, 154, .08); }
.ho-card--tap { cursor: pointer; transition: transform .12s var(--ease-out), box-shadow .2s; -webkit-tap-highlight-color: transparent; }
.ho-card--tap:active { transform: scale(.985); }
.ho-card__head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-bottom: 3px; }
.ho-card__t { font-family: var(--wl-display); font-weight: 700; font-size: 14px; letter-spacing: .03em; color: var(--wl-text); white-space: nowrap; flex: 0 0 auto; }
.ho-card__end { font-family: var(--ho-mono); font-size: 11px; font-weight: 600; white-space: nowrap; text-align: right; }
.ho-card__sub { font-family: var(--ho-mono); font-size: 9px; color: var(--wl-muted); margin-bottom: 9px; display: flex; align-items: center; gap: 5px; }

/* titular — estado de hoy */
.ho-titular { border-radius: var(--wl-radius); padding: 16px 15px; margin-top: 4px; border: 1px solid; }
.wl--chalk .ho-titular { border-radius: 0; border-width: 3px; }
.ho-titular__row { display: flex; align-items: center; gap: 12px; }
.ho-titular__dot { width: 36px; height: 36px; border-radius: 50%; flex: 0 0 auto; }
.ho-titular__lbl { font-family: var(--ho-mono); font-size: 9px; letter-spacing: .18em; text-transform: uppercase; opacity: .75; }
.ho-titular__st { font-family: var(--wl-display); font-weight: 800; font-size: 21px; letter-spacing: .03em; text-transform: uppercase; line-height: 1; margin-top: 3px; }
.ho-titular__msg { font-size: 13px; line-height: 1.5; margin: 12px 0 0; color: var(--wl-text); }
.ho-titular__msg b { color: var(--wl-accent); }

/* check-in CTA */
.ho-cta { width: 100%; margin-top: 14px; }
.ho-cta__done {
  width: 100%; margin-top: 14px; display: flex; align-items: center; gap: 11px;
  padding: 14px 16px; border-radius: var(--wl-radius); cursor: pointer;
  background: color-mix(in srgb, var(--wl-accent) 8%, var(--wl-surface));
  border: 1px solid color-mix(in srgb, var(--wl-accent) 30%, transparent); color: var(--wl-text);
  font-family: var(--wl-body); text-align: left;
}
.ho-cta__done b { display: block; font-family: var(--wl-display); font-weight: 700; font-size: 14px; }
.ho-cta__done span { font-family: var(--ho-mono); font-size: 9.5px; color: var(--wl-muted); }
.ho-cta__check { width: 28px; height: 28px; border-radius: 50%; flex: 0 0 auto; display: flex; align-items: center; justify-content: center; background: var(--ho-ok, #1bc98a); color: var(--wl-bg); }

/* streak */
.ho-streak { display: flex; align-items: center; gap: 9px; margin-bottom: 11px; }
.ho-streak b { font-family: var(--wl-display); font-weight: 800; font-size: 22px; color: var(--wl-accent); line-height: 1; }
.ho-streak span { font-family: var(--ho-mono); font-size: 9.5px; color: var(--wl-muted); line-height: 1.3; }

/* calendar heatmap */
.ho-calhd { display: grid; grid-template-columns: repeat(7, 32px); gap: 6px; margin-bottom: 6px; justify-content: space-between; }
.ho-calhd span { text-align: center; font-family: var(--ho-mono); font-size: 8px; color: var(--wl-muted); }
.ho-cal { display: grid; grid-template-columns: repeat(7, 32px); gap: 6px; justify-content: space-between; }
.ho-cal__c { height: 32px; border-radius: 5px; }
.wl--chalk .ho-cal__c { border-radius: 0; }
.ho-cal__c.on { background: var(--wl-accent); }
.ho-cal__c.rest { background: color-mix(in srgb, var(--wl-text) 12%, transparent); position: relative; }
.ho-cal__c.rest::after { content: ''; position: absolute; inset: 40%; border-radius: 50%; background: var(--wl-muted); opacity: .7; }
.ho-cal__c.miss { border: 1px dashed color-mix(in srgb, var(--wl-text) 22%, transparent); }
.ho-cal__c.fut { background: color-mix(in srgb, var(--wl-text) 5%, transparent); }

/* camino — countdown */
.ho-count { display: flex; align-items: baseline; gap: 10px; margin-bottom: 10px; }
.ho-count b { font-family: var(--wl-display); font-weight: 800; font-size: 34px; color: var(--wl-accent); line-height: .9; }
.ho-count span { font-family: var(--ho-mono); font-size: 10.5px; color: var(--wl-muted); line-height: 1.4; }
.ho-count span b { color: var(--wl-text); font-weight: 700; font-size: inherit; }

/* ribbon */
.ho-ribbon__seg { position: relative; min-width: 0; border-radius: 6px; padding: 8px 6px 9px; background: color-mix(in srgb, var(--wl-text) 6%, transparent); border: 1px solid color-mix(in srgb, var(--wl-text) 9%, transparent); overflow: hidden; }
.wl--chalk .ho-ribbon__seg { border-radius: 0; }
.ho-ribbon__seg.now { border-color: var(--wl-accent); }
.ho-ribbon__seg::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: var(--fill, 30%); background: var(--wl-accent); opacity: .18; }
.ho-ribbon__nm { position: relative; z-index: 1; font-family: var(--wl-display); font-weight: 700; font-size: 9px; line-height: 1.05; color: var(--wl-text); overflow-wrap: anywhere; }
.ho-ribbon__wk { position: relative; z-index: 1; font-family: var(--ho-mono); font-size: 8px; color: var(--wl-muted); margin-top: 3px; }

/* "sin dato" honesto */
.ho-nodata { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 22px 14px; text-align: center; }
.ho-nodata__icon { width: 34px; height: 34px; border-radius: 50%; border: 1.5px dashed color-mix(in srgb, var(--wl-text) 26%, transparent); color: var(--wl-muted); display: flex; align-items: center; justify-content: center; font-size: 17px; }
.ho-nodata__t { font-family: var(--wl-display); font-weight: 700; font-size: 13px; color: var(--wl-text); }
.ho-nodata__b { font-family: var(--ho-mono); font-size: 9.5px; color: var(--wl-muted); line-height: 1.5; max-width: 230px; }

/* ── bottom nav (frameless: fixed, centrado a la columna) ── */
.ho-nav {
  position: fixed; left: 50%; transform: translateX(-50%); bottom: 0; z-index: 30; width: 100%; max-width: 460px;
  display: flex; padding: 8px 14px calc(12px + env(safe-area-inset-bottom, 0px));
  background: color-mix(in srgb, var(--wl-bg) 86%, transparent);
  backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
  border-top: 1px solid color-mix(in srgb, var(--wl-text) 9%, transparent);
}
.wl--chalk .ho-nav { background: var(--wl-bg); border-top: 3px solid var(--wl-ink); }
.ho-nav__btn { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; background: none; border: none; cursor: pointer; padding: 6px 0; color: var(--wl-muted); -webkit-tap-highlight-color: transparent; text-decoration: none; }
.ho-nav__btn svg { width: 23px; height: 23px; display: block; }
.ho-nav__btn span { font-family: var(--wl-display); font-size: 9.5px; letter-spacing: .04em; font-weight: 600; }
.ho-nav__btn.is-on { color: var(--wl-accent); }
.wl--neon .ho-nav__btn.is-on { filter: drop-shadow(0 0 8px color-mix(in srgb, var(--wl-accent) 60%, transparent)); }

/* ── check-in flow (overlay full-screen, frameless: fixed) ── */
.ho-checkin {
  position: fixed; inset: 0; z-index: 50; display: flex; flex-direction: column;
  background: var(--wl-bg); animation: hoCheckinIn .32s var(--ease-out);
}
@keyframes hoCheckinIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
.ho-ci__top { flex: 0 0 auto; display: flex; align-items: center; gap: 12px; padding: 16px 18px 8px; }
.ho-ci__close { width: 36px; height: 36px; flex: 0 0 auto; border-radius: 50%; border: 1px solid color-mix(in srgb, var(--wl-text) 16%, transparent); background: transparent; color: var(--wl-text); font-size: 17px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.ho-ci__seg { flex: 1; display: flex; gap: 5px; }
.ho-ci__seg i { flex: 1; height: 5px; border-radius: 99px; background: color-mix(in srgb, var(--wl-text) 14%, transparent); transition: background .3s; }
.ho-ci__seg i.done { background: var(--wl-accent); }
.ho-ci__seg i.cur { background: color-mix(in srgb, var(--wl-accent) 55%, transparent); }
.ho-ci__count { font-family: var(--ho-mono); font-size: 10px; color: var(--wl-muted); flex: 0 0 auto; }
.ho-ci__body { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; position: relative; overflow: hidden; }
.ho-ci__card { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; padding: 18px 24px 28px; max-width: 460px; margin: 0 auto; width: 100%; }
.ho-ci__q { font-family: var(--wl-display); font-weight: 800; font-size: 26px; line-height: 1.1; color: var(--wl-text); text-align: center; }
.wl--neon .ho-ci__q, .wl--neonlight .ho-ci__q, .wl--chalk .ho-ci__q { text-transform: uppercase; }
.ho-ci__item { font-family: var(--ho-mono); font-size: 10px; letter-spacing: .2em; text-transform: uppercase; color: var(--wl-accent); text-align: center; margin-bottom: 14px; }

/* faces — variante A (tap): fila de 5 */
.ho-faces { display: flex; justify-content: center; gap: 9px; margin-top: 30px; }
.ho-face {
  flex: 1 1 0; max-width: 60px; aspect-ratio: 1; border-radius: 50%; padding: 0; cursor: pointer;
  background: color-mix(in srgb, var(--wl-text) 5%, transparent);
  border: 2px solid color-mix(in srgb, var(--wl-text) 14%, transparent);
  color: var(--wl-muted); display: flex; align-items: center; justify-content: center;
  transition: transform .14s var(--ease-spring), border-color .18s, background .18s, color .18s, box-shadow .2s;
}
.wl--chalk .ho-face { border-radius: 0; border-width: 3px; }
.ho-face svg { width: 70%; height: 70%; }
.ho-face.sel {
  border-color: var(--wl-accent); color: var(--wl-accent);
  background: color-mix(in srgb, var(--wl-accent) 12%, transparent); transform: scale(1.12);
}
.wl--neon .ho-face.sel, .wl--neonlight .ho-face.sel { box-shadow: 0 0 22px color-mix(in srgb, var(--wl-accent) 55%, transparent); }
.ho-facescale { display: flex; justify-content: space-between; margin-top: 16px; font-family: var(--ho-mono); font-size: 9.5px; color: var(--wl-muted); padding: 0 4px; }

/* variante B (dial): cara grande + escala arrastrable */
.ho-bigface { display: flex; flex-direction: column; align-items: center; gap: 14px; margin: 18px 0 6px; }
.ho-bigface__circle { width: 132px; height: 132px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid var(--wl-accent); color: var(--wl-accent); background: color-mix(in srgb, var(--wl-accent) 9%, transparent); transition: transform .2s var(--ease-spring); }
.wl--neon .ho-bigface__circle { box-shadow: 0 0 30px color-mix(in srgb, var(--wl-accent) 45%, transparent); }
.ho-bigface__circle svg { width: 72px; height: 72px; }
.ho-bigface__word { font-family: var(--wl-display); font-weight: 800; font-size: 20px; color: var(--wl-text); text-transform: uppercase; letter-spacing: .02em; }
.ho-slider { margin: 26px 6px 6px; }
.ho-slider__track { position: relative; height: 12px; border-radius: 99px; background: color-mix(in srgb, var(--wl-text) 12%, transparent); }
.ho-slider__fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 99px; background: var(--wl-accent); }
.wl--neon .ho-slider__fill { box-shadow: 0 0 14px var(--wl-accent); }
.ho-slider__pegs { position: absolute; inset: 0; display: flex; justify-content: space-between; align-items: center; padding: 0 4px; }
.ho-slider__peg { width: 4px; height: 4px; border-radius: 50%; background: color-mix(in srgb, var(--wl-bg) 60%, transparent); }
.ho-slider__knob { position: absolute; top: 50%; width: 30px; height: 30px; border-radius: 50%; background: var(--wl-accent); transform: translate(-50%, -50%); box-shadow: 0 4px 12px rgba(0, 0, 0, .4); border: 3px solid var(--wl-bg); cursor: grab; }
.ho-slider__nums { display: flex; justify-content: space-between; margin-top: 12px; padding: 0 2px; }
.ho-slider__nums button { background: none; border: none; font-family: var(--wl-display); font-weight: 700; font-size: 14px; color: var(--wl-muted); cursor: pointer; padding: 6px 10px; }
.ho-slider__nums button.on { color: var(--wl-accent); }

/* weight step */
.ho-wt { display: flex; flex-direction: column; align-items: center; gap: 4px; margin-top: 10px; }
.ho-wt__dial { display: flex; align-items: center; gap: 18px; }
.ho-wt__step { width: 52px; height: 52px; border-radius: 50%; font-size: 28px; font-weight: 700; display: flex; align-items: center; justify-content: center; cursor: pointer; background: color-mix(in srgb, var(--wl-accent) 8%, transparent); border: 1.5px solid color-mix(in srgb, var(--wl-accent) 40%, transparent); color: var(--wl-accent); -webkit-tap-highlight-color: transparent; transition: transform .1s; }
.ho-wt__step:active { transform: scale(.9); }
.ho-wt__val { font-family: var(--wl-display); font-weight: 800; font-size: 54px; color: var(--wl-text); font-variant-numeric: tabular-nums; line-height: 1; }
.ho-wt__unit { font-family: var(--ho-mono); font-size: 13px; color: var(--wl-muted); }
.ho-wt__skip { margin-top: 8px; background: none; border: none; font-family: var(--ho-mono); font-size: 11px; color: var(--wl-muted); text-decoration: underline; cursor: pointer; }

.ho-ci__foot { flex: 0 0 auto; padding: 14px 22px calc(20px + env(safe-area-inset-bottom, 0px)); max-width: 460px; margin: 0 auto; width: 100%; }

/* check-in done */
.ho-cidone { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; padding: 24px; text-align: center; }
.ho-cidone__ring { width: 96px; height: 96px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: color-mix(in srgb, var(--ho-ok, #1bc98a) 16%, transparent); color: var(--ho-ok, #1bc98a); animation: hoPop .4s var(--ease-spring); }
@keyframes hoPop { from { transform: scale(.5); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.ho-cidone__h { font-family: var(--wl-display); font-weight: 800; font-size: 24px; color: var(--wl-text); text-transform: uppercase; }
.ho-cidone__b { font-family: var(--ho-mono); font-size: 11px; color: var(--wl-muted); line-height: 1.6; max-width: 250px; }

/* account */
.ho-acct__group { margin-top: 18px; }
.ho-acct__label { font-family: var(--wl-display); font-size: 10px; letter-spacing: .16em; text-transform: uppercase; color: var(--wl-muted); margin: 0 4px 8px; }
.ho-acct__list { background: var(--wl-surface); border: 1px solid color-mix(in srgb, var(--wl-text) 8%, transparent); border-radius: var(--wl-radius); overflow: hidden; }
.wl--neon .ho-acct__list { background: rgba(255, 255, 255, .02); }
.wl--chalk .ho-acct__list { border: 3px solid var(--wl-ink); box-shadow: 5px 5px 0 var(--wl-ink); border-radius: 0; }
.ho-acct__row { display: flex; align-items: center; gap: 12px; padding: 14px 15px; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.ho-acct__row + .ho-acct__row { border-top: 1px solid color-mix(in srgb, var(--wl-text) 8%, transparent); }
.ho-acct__rowt { flex: 1; font-family: var(--wl-body); font-weight: 600; font-size: 14px; color: var(--wl-text); }
.ho-acct__rowsub { font-family: var(--ho-mono); font-size: 9px; color: var(--wl-muted); margin-top: 3px; }
.ho-acct__rowend { font-family: var(--ho-mono); font-size: 11px; color: var(--wl-muted); }

/* segmented (variante check-in) */
.ho-seg { display: flex; gap: 6px; }
.ho-seg button { flex: 1; font-family: var(--ho-mono); font-size: 9.5px; padding: 9px 5px; border-radius: 8px; border: 1px solid color-mix(in srgb, var(--wl-text) 16%, transparent); background: transparent; color: var(--wl-text); cursor: pointer; transition: background .15s, color .15s; }
.wl--chalk .ho-seg button { border-radius: 0; }
.ho-seg button.on { background: var(--wl-accent); color: var(--wl-bg); border-color: var(--wl-accent); font-weight: 700; }
.ho-hint { font-family: var(--ho-mono); font-size: 9px; color: var(--wl-muted); margin-top: 9px; line-height: 1.5; }

/* skin swatches */
.ho-skins { display: grid; grid-template-columns: repeat(auto-fill, minmax(64px, 1fr)); gap: 9px; }
.ho-skin { cursor: pointer; border-radius: 11px; overflow: hidden; border: 2px solid transparent; padding: 0; background: none; }
.ho-skin.on { border-color: var(--wl-accent); }
.ho-skin__sw { height: 42px; display: flex; }
.ho-skin__sw i { flex: 1; }
.ho-skin__nm { font-family: var(--ho-mono); font-size: 8.5px; color: var(--wl-text); padding: 6px 4px; text-align: center; background: color-mix(in srgb, var(--wl-text) 6%, transparent); }
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/screens/atleta/atleta.css
git commit -m "feat(web): atleta.css — port de las clases ho-* (sin chrome de mockup)"
```

### Task D2: `prefs.ts` (skin + check-in variant persistence)

**Files:**
- Create: `apps/web/src/screens/atleta/prefs.ts`

- [ ] **Step 1: Create `prefs.ts`**

```typescript
/** Athlete-local UI preferences (skin + check-in interaction), persisted in localStorage. */
export type CheckinVariant = "tap" | "dial";

const SKIN_KEY = "holy-oly:atleta-skin";
const VARIANT_KEY = "holy-oly:atleta-checkin-variant";
const SKINS = ["neon", "neonlight", "plates", "premium", "chalk"] as const;

export function getSkin(): string {
  const s = localStorage.getItem(SKIN_KEY);
  return s && (SKINS as readonly string[]).includes(s) ? s : "neon";
}
export function setSkin(skin: string): void {
  localStorage.setItem(SKIN_KEY, skin);
}
export function getVariant(): CheckinVariant {
  return localStorage.getItem(VARIANT_KEY) === "dial" ? "dial" : "tap";
}
export function setVariant(v: CheckinVariant): void {
  localStorage.setItem(VARIANT_KEY, v);
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/screens/atleta/prefs.ts
git commit -m "feat(web): prefs del atleta (skin + variante de check-in en localStorage)"
```

### Task D3: `primitives.tsx` (Face, NavIcon, Check)

**Files:**
- Create: `apps/web/src/screens/atleta/primitives.tsx`

> Ported verbatim from the design's `ui.jsx` (`goodness` lives in `core/wellness`, not here). The `Face` is monochrome (`currentColor`) — never a state palette (HR-1).

- [ ] **Step 1: Create `primitives.tsx`**

```tsx
import type { ReactNode } from "react";

const MOUTHS: Record<number, string> = {
  1: "M12.5 26 Q20 20.5 27.5 26",
  2: "M12.5 26 Q20 23 27.5 26",
  3: "M12.5 25.5 L27.5 25.5",
  4: "M12.5 25 Q20 29 27.5 25",
  5: "M12 24.5 Q20 31.5 28 24.5",
};

/** Monochrome 1-5 face (5 = happiest). Uses currentColor only — never a state color. */
export function Face({ level }: { level: number }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" style={{ display: "block" }}>
      <g fill="currentColor">
        <circle cx="15" cy="17" r="2.1" />
        <circle cx="25" cy="17" r="2.1" />
      </g>
      <path d={MOUTHS[level] ?? MOUTHS[3]} stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export const NavIcon: Record<"hoy" | "prog" | "cuenta", ReactNode> = {
  hoy: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" />
    </svg>
  ),
  prog: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19V5M4 19h16" />
      <path d="M7 15l3.5-4 3 2.5L20 7" />
    </svg>
  ),
  cuenta: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5.5 19a6.5 6.5 0 0 1 13 0" />
    </svg>
  ),
};

export function Check({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}
```

- [ ] **Step 2: Type-check + commit**

Run: `pnpm --filter @holy-oly/web exec tsc --noEmit`
Expected: PASS.

```bash
git add apps/web/src/screens/atleta/primitives.tsx
git commit -m "feat(web): primitivas del atleta (Face monocroma, NavIcon, Check)"
```

### Task D4: `AthleteShell` (brand bar + nav + Outlet context)

**Files:**
- Create: `apps/web/src/screens/atleta/AthleteShell.tsx`
- Create: `apps/web/src/screens/atleta/__tests__/shell.test.tsx`

> Mirrors `CoachShell` (`<Outlet/>` + bottom nav). Owns the skin + check-in variant (from `prefs`), exposes them to child routes via Outlet context (`AtletaOutletCtx`). The wrapper applies `wl wl--{skin}` so all atleta screens read the chosen skin's tokens.

- [ ] **Step 1: Write the failing test**

`apps/web/src/screens/atleta/__tests__/shell.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AthleteShell } from "../AthleteShell";

function renderShell(initial = "/atleta") {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route path="/atleta" element={<AthleteShell />}>
          <Route index element={<div>HOY-STUB</div>} />
          <Route path="cuenta" element={<div>CUENTA-STUB</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

test("renderiza la marca, las 3 pestañas y el contenido de la ruta", () => {
  renderShell();
  expect(screen.getByText("Holy Oly")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Hoy" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Mi progreso" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Cuenta" })).toBeInTheDocument();
  expect(screen.getByText("HOY-STUB")).toBeInTheDocument();
});

test("aplica la skin guardada en localStorage", () => {
  localStorage.setItem("holy-oly:atleta-skin", "plates");
  const { container } = renderShell();
  expect(container.querySelector(".ho-shell")?.classList.contains("wl--plates")).toBe(true);
  localStorage.clear();
});
```

- [ ] **Step 2: Run it — verify it fails**

Run: `pnpm --filter @holy-oly/web test shell`
Expected: FAIL — `Cannot find module '../AthleteShell'`.

- [ ] **Step 3: Implement `AthleteShell.tsx`**

```tsx
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useOutletContext } from "react-router-dom";
import { getSkin, setSkin as persistSkin, getVariant, setVariant as persistVariant, type CheckinVariant } from "./prefs";
import { NavIcon } from "./primitives";
import "./atleta.css";

export interface AtletaOutletCtx {
  skin: string;
  setSkin: (s: string) => void;
  variant: CheckinVariant;
  setVariant: (v: CheckinVariant) => void;
}

/** Typed accessor for the athlete shell's Outlet context (skin + check-in variant). */
export function useAtletaCtx(): AtletaOutletCtx {
  return useOutletContext<AtletaOutletCtx>();
}

const NAV: Array<{ to: string; label: string; icon: ReactNode; end?: boolean }> = [
  { to: "/atleta", label: "Hoy", icon: NavIcon.hoy, end: true },
  { to: "/atleta/progreso", label: "Mi progreso", icon: NavIcon.prog },
  { to: "/atleta/cuenta", label: "Cuenta", icon: NavIcon.cuenta },
];

export function AthleteShell() {
  const [skin, setSkinState] = useState<string>(() => getSkin());
  const [variant, setVariantState] = useState<CheckinVariant>(() => getVariant());

  const setSkin = useCallback((s: string) => { persistSkin(s); setSkinState(s); }, []);
  const setVariant = useCallback((v: CheckinVariant) => { persistVariant(v); setVariantState(v); }, []);

  const ctx = useMemo<AtletaOutletCtx>(() => ({ skin, setSkin, variant, setVariant }), [skin, setSkin, variant, setVariant]);

  return (
    <div className={`ho-shell wl wl--${skin}`}>
      <header className="ho-hobar">
        <img className="ho-hobar__logo" src="/icon.svg" alt="" />
        <div className="ho-hobar__brand">
          <span className="ho-hobar__name">Holy Oly</span>
          <span className="ho-hobar__motto">smart training · zero burnout</span>
        </div>
        <span className="ho-hobar__spacer" />
        <Link to="/atleta/cuenta" className="ho-hobar__avatar" aria-label="Mi cuenta">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="3.4" /><path d="M5.5 19a6.5 6.5 0 0 1 13 0" />
          </svg>
        </Link>
      </header>

      <main className="ho-scroll">
        <Outlet context={ctx} />
      </main>

      <nav className="ho-nav">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => "ho-nav__btn" + (isActive ? " is-on" : "")}>
            {n.icon}<span>{n.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
```

- [ ] **Step 4: Run tests — verify they pass**

Run: `pnpm --filter @holy-oly/web test shell`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/screens/atleta/AthleteShell.tsx apps/web/src/screens/atleta/__tests__/shell.test.tsx
git commit -m "feat(web): AthleteShell (brand bar + bottom-nav + skin/variant por Outlet context)"
```

### Task D5: Hoy sub-components (Titular, Constancia, Camino)

**Files:**
- Create: `apps/web/src/screens/atleta/hoy/Titular.tsx`
- Create: `apps/web/src/screens/atleta/hoy/ConstanciaCard.tsx`
- Create: `apps/web/src/screens/atleta/hoy/CaminoCard.tsx`

> Pure presentational, props-driven. Covered by the `HomeScreen` test (D6). `color=estado` lives ONLY in `Titular` (the dot); the heatmap/ribbon use `--wl-accent` (identity, not state). Each card has an honest empty variant.

- [ ] **Step 1: Create `hoy/Titular.tsx`**

```tsx
import type { ReactNode } from "react";
import type { CellState } from "@holy-oly/core";

// The 4 state colors (the ONLY place color = estado on Hoy). Mirrors the prototype ST palette.
const ST: Record<"ok" | "warn" | "alert", string> = { ok: "#1bc98a", warn: "#ffab2e", alert: "#ff3b46" };
const COPY: Record<"ok" | "warn" | "alert", { st: string; msg: ReactNode }> = {
  ok: { st: "Vas bien", msg: <>Tu recuperación está <b>en tu rango normal</b>. Seguí el plan como viene.</> },
  warn: { st: "Cuidate hoy", msg: <>Tu recuperación está algo por debajo de tu normal. Hoy bajá un escalón la intensidad y <b>priorizá dormir</b>.</> },
  alert: { st: "Pará la oreja", msg: <>Tu recuperación está bastante por debajo de tu normal. Hoy conviene <b>aflojar</b> — hablalo con tu coach.</> },
};

/** Estado de hoy. `none` → honest empty variant (new athlete); never a false-green. */
export function Titular({ state }: { state: CellState }) {
  if (state === "none") {
    return (
      <div className="ho-titular" style={{ background: "color-mix(in srgb, var(--wl-text) 5%, transparent)", borderColor: "color-mix(in srgb, var(--wl-text) 14%, transparent)" }}>
        <div className="ho-titular__row">
          <span className="ho-titular__dot" style={{ background: "color-mix(in srgb, var(--wl-text) 20%, transparent)" }} />
          <div>
            <div className="ho-titular__lbl">Mi estado de hoy</div>
            <div className="ho-titular__st" style={{ color: "var(--wl-muted)" }}>Sin datos aún</div>
          </div>
        </div>
        <p className="ho-titular__msg">Todavía no hay registros para leer tu estado. Tu primer <b>check-in</b> empieza a construir tu normal — sin historial, no inventamos un estado.</p>
      </div>
    );
  }
  const col = ST[state];
  const c = COPY[state];
  return (
    <div className="ho-titular" style={{ background: `color-mix(in srgb, ${col} 14%, transparent)`, borderColor: `color-mix(in srgb, ${col} 45%, transparent)` }}>
      <div className="ho-titular__row">
        <span className="ho-titular__dot" style={{ background: col, boxShadow: `0 0 18px ${col}99` }} />
        <div>
          <div className="ho-titular__lbl">Mi estado de hoy</div>
          <div className="ho-titular__st" style={{ color: col }}>{c.st}</div>
        </div>
      </div>
      <p className="ho-titular__msg">{c.msg}</p>
    </div>
  );
}
```

- [ ] **Step 2: Create `hoy/ConstanciaCard.tsx`**

```tsx
import { calendarWeeks } from "@holy-oly/core";

function CalendarHeatmap({ days, today }: { days: string[]; today: string }) {
  const set = new Set(days);
  const grid = calendarWeeks(today, 8);
  const labels = ["L", "M", "M", "J", "V", "S", "D"];
  return (
    <div>
      <div className="ho-calhd">{labels.map((d, i) => <span key={i}>{d}</span>)}</div>
      <div className="ho-cal">
        {grid.flatMap((week) =>
          week.map((date) => {
            const cls = date > today ? "fut" : set.has(date) ? "on" : "miss";
            return <div key={date} className={`ho-cal__c ${cls}`} title={date} />;
          }),
        )}
      </div>
    </div>
  );
}

/** Racha + heatmap. Empty (no logged days) → honest "tu racha empieza hoy". */
export function ConstanciaCard({ streak, days, today }: { streak: number; days: string[]; today: string }) {
  if (days.length === 0) {
    return (
      <div className="ho-card">
        <div className="ho-card__head"><span className="ho-card__t">Constancia de registro</span></div>
        <div className="ho-nodata">
          <div className="ho-nodata__icon">·</div>
          <div className="ho-nodata__t">Tu racha empieza hoy</div>
          <div className="ho-nodata__b">Registrá un día y arranca a contar. El descanso planificado no la rompe.</div>
        </div>
      </div>
    );
  }
  return (
    <div className="ho-card">
      <div className="ho-card__head"><span className="ho-card__t">Constancia de registro</span></div>
      <div className="ho-card__sub">filas = semanas · 7 columnas = días</div>
      <div className="ho-streak">
        <b>{streak}</b>
        <span>días de racha<br />el descanso no la rompe</span>
      </div>
      <CalendarHeatmap days={days} today={today} />
    </div>
  );
}
```

- [ ] **Step 3: Create `hoy/CaminoCard.tsx`**

```tsx
import type { MePlanView } from "@holy-oly/core";

type PlanView = NonNullable<MePlanView["plan"]>;

function MacroRibbon({ plan }: { plan: PlanView }) {
  return (
    <div style={{ display: "flex", gap: 3, marginTop: 4 }}>
      {plan.phases.map((p) => {
        const wks = p.to - p.from + 1;
        const fill = Math.round(((p.imr - 60) / 45) * 78 + 16);
        const now = plan.currentWeek >= p.from && plan.currentWeek <= p.to;
        const hasComp = plan.comps.some((c) => c.week >= p.from && c.week <= p.to);
        return (
          <div key={p.name} className={"ho-ribbon__seg" + (now ? " now" : "")} style={{ flex: wks, "--fill": `${fill}%` } as React.CSSProperties}>
            <div className="ho-ribbon__nm">{p.name}{hasComp ? " 🚩" : ""}{now ? " • hoy" : ""}</div>
            <div className="ho-ribbon__wk">sem {p.from}–{p.to}</div>
          </div>
        );
      })}
    </div>
  );
}

/** Countdown a la próxima comp + cinta de fases. Empty (no plan) → honest empty variant. */
export function CaminoCard({ plan }: { plan: MePlanView["plan"] }) {
  if (!plan) {
    return (
      <div className="ho-card">
        <div className="ho-card__head"><span className="ho-card__t">Camino a la competencia</span><span className="ho-card__end" style={{ color: "var(--wl-muted)" }}>lo fija tu coach</span></div>
        <div className="ho-nodata">
          <div className="ho-nodata__icon">·</div>
          <div className="ho-nodata__t">Todavía no tenés un plan asignado</div>
          <div className="ho-nodata__b">Cuando tu coach te asigne un macrociclo, vas a ver acá tu camino a la próxima competencia.</div>
        </div>
      </div>
    );
  }
  const next = [...plan.comps].sort((a, b) => a.week - b.week).find((c) => c.week >= plan.currentWeek) ?? plan.comps[plan.comps.length - 1];
  const faltan = next ? next.week - plan.currentWeek : null;
  return (
    <div className="ho-card">
      <div className="ho-card__head"><span className="ho-card__t">Camino a la competencia</span><span className="ho-card__end" style={{ color: "var(--wl-muted)" }}>lo fija tu coach</span></div>
      <div className="ho-card__sub" style={{ marginTop: 4 }}>cinta de fases del macro · 🚩 = competencia</div>
      {next && faltan != null ? (
        <div className="ho-count">
          <b>{faltan <= 0 ? "0" : faltan}</b>
          <span>{faltan <= 0 ? <>{next.name} es <b>esta semana</b></> : <>semanas para <b>{next.name}</b><br />semana {next.week} de {plan.totalWeeks}</>}</span>
        </div>
      ) : null}
      <MacroRibbon plan={plan} />
    </div>
  );
}
```

- [ ] **Step 4: Type-check + commit**

Run: `pnpm --filter @holy-oly/web exec tsc --noEmit`
Expected: PASS. (If `"--fill"` flags a CSSProperties error, the cast `as React.CSSProperties` resolves it; modern `@types/react` allows `--*` custom props.)

```bash
git add apps/web/src/screens/atleta/hoy/
git commit -m "feat(web): cards de Hoy (Titular estado + Constancia/heatmap + Camino/ribbon)"
```

### Task D6: `HomeScreen` (loads `meClient`, composes Hoy, owns Check-in overlay)

**Files:**
- Create: `apps/web/src/screens/atleta/HomeScreen.tsx`
- Create: `apps/web/src/screens/atleta/__tests__/home.test.tsx`

- [ ] **Step 1: Write the failing test**

`apps/web/src/screens/atleta/__tests__/home.test.tsx`:
```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { vi, beforeEach } from "vitest";
import type { MonitorSeries } from "@holy-oly/core";
import { AthleteShell } from "../AthleteShell";
import { HomeScreen } from "../HomeScreen";

vi.mock("../../../data/meClient", () => ({
  getMePlan: vi.fn(),
  getMeSeries: vi.fn(),
  getDayLog: vi.fn(),
  putDayLog: vi.fn(),
}));
import * as me from "../../../data/meClient";

function renderHome() {
  return render(
    <MemoryRouter initialEntries={["/atleta"]}>
      <Routes>
        <Route path="/atleta" element={<AthleteShell />}>
          <Route index element={<HomeScreen />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

const FLAT_SERIES: MonitorSeries = {
  weeks: 5, acute: [300, 300, 300, 300, 300], hrv: [70, 70, 70, 70, 70], hrvBase: 70,
  rhr: [50, 50, 50, 50, 50], rhrBase: 50, imr: [70, 70, 70, 70, 70],
  wellness: [80, 80, 80, 80, 80], recovery: [85, 85, 85, 85, 85],
};

beforeEach(() => vi.clearAllMocks());

test("atleta nuevo: saludo sin plan, Titular sin datos, racha empieza hoy, CTA primario", async () => {
  vi.mocked(me.getMePlan).mockResolvedValue({ athlete: { nombre: "Demo Atleta", iniciales: "DA" }, plan: null });
  vi.mocked(me.getMeSeries).mockResolvedValue(undefined);
  vi.mocked(me.getDayLog).mockResolvedValue({ entry: null, streak: 0, days: [], today: "2026-06-03" });

  renderHome();
  expect(await screen.findByText("Hola, Demo")).toBeInTheDocument();
  expect(screen.getByText(/tu coach todavía no te asignó un plan/)).toBeInTheDocument();
  expect(screen.getByText("Sin datos aún")).toBeInTheDocument();
  expect(screen.getByText("Tu racha empieza hoy")).toBeInTheDocument();
  expect(screen.getByText(/Todavía no tenés un plan asignado/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Hacer check-in de hoy" })).toBeInTheDocument();
});

test("atleta con plan + serie + check-in hecho: saludo con semana, estado, racha, CTA listo", async () => {
  vi.mocked(me.getMePlan).mockResolvedValue({
    athlete: { nombre: "Mara V.", iniciales: "MV" },
    plan: { macroName: "Ruso 5D", totalWeeks: 12, currentWeek: 5, currentPhase: "Fuerza", phases: [{ name: "Fuerza", from: 1, to: 12, imr: 88 }], comps: [{ name: "Nacional", week: 12 }] },
  });
  vi.mocked(me.getMeSeries).mockResolvedValue(FLAT_SERIES);
  vi.mocked(me.getDayLog).mockResolvedValue({ entry: { date: "2026-06-03", fatiga: 2, dolor: 1, estres: 2, humor: 4, motivacion: 5, sueno: 4 }, streak: 5, days: ["2026-06-03"], today: "2026-06-03" });

  renderHome();
  expect(await screen.findByText("Hola, Mara")).toBeInTheDocument();
  expect(screen.getByText(/Ruso 5D · semana 5 de 12 · Fuerza/)).toBeInTheDocument();
  expect(screen.getByText(/Vas bien|Cuidate hoy|Pará la oreja/)).toBeInTheDocument(); // a real state, not "Sin datos aún"
  expect(screen.queryByText("Sin datos aún")).not.toBeInTheDocument();
  expect(screen.getByText("Check-in de hoy, listo")).toBeInTheDocument();
  expect(screen.getByText("5")).toBeInTheDocument(); // streak
});

test("error de carga → mensaje honesto", async () => {
  vi.mocked(me.getMePlan).mockRejectedValue(new Error("boom"));
  vi.mocked(me.getMeSeries).mockResolvedValue(undefined);
  vi.mocked(me.getDayLog).mockResolvedValue({ entry: null, streak: 0, days: [], today: "2026-06-03" });
  renderHome();
  await waitFor(() => expect(screen.getByText(/No se pudo cargar/)).toBeInTheDocument());
});
```

- [ ] **Step 2: Run it — verify it fails**

Run: `pnpm --filter @holy-oly/web test home`
Expected: FAIL — `Cannot find module '../HomeScreen'`.

- [ ] **Step 3: Implement `HomeScreen.tsx`**

```tsx
import { useCallback, useEffect, useState } from "react";
import { seriesState, type CellState, type DayLogInput, type DayLogView, type MePlanView, type MonitorSeries } from "@holy-oly/core";
import * as me from "../../data/meClient";
import { Titular } from "./hoy/Titular";
import { ConstanciaCard } from "./hoy/ConstanciaCard";
import { CaminoCard } from "./hoy/CaminoCard";
import { CheckIn } from "./CheckIn";
import { Check } from "./primitives";
import { useAtletaCtx } from "./AthleteShell";

type Load = "loading" | "ready" | "error";

export function HomeScreen() {
  const { variant } = useAtletaCtx();
  const [plan, setPlan] = useState<MePlanView | null>(null);
  const [series, setSeries] = useState<MonitorSeries | undefined>(undefined);
  const [daylog, setDaylog] = useState<DayLogView | null>(null);
  const [load, setLoad] = useState<Load>("loading");
  const [checkinOpen, setCheckinOpen] = useState(false);

  useEffect(() => {
    let on = true;
    setLoad("loading");
    Promise.all([me.getMePlan(), me.getMeSeries(), me.getDayLog()])
      .then(([p, s, d]) => { if (on) { setPlan(p); setSeries(s); setDaylog(d); setLoad("ready"); } })
      .catch(() => { if (on) setLoad("error"); });
    return () => { on = false; };
  }, []);

  const onCheckinDone = useCallback(async (input: DayLogInput) => {
    await me.putDayLog(input);
    const fresh = await me.getDayLog();
    setDaylog(fresh);
  }, []);

  if (load === "loading") {
    return <div aria-busy="true" style={{ padding: 24, color: "var(--wl-muted)", fontFamily: "var(--ho-mono)" }}>Cargando…</div>;
  }
  if (load === "error" || !plan || !daylog) {
    return <div role="alert" style={{ padding: 24, color: "var(--wl-muted)", fontFamily: "var(--ho-mono)" }}>No se pudo cargar tu inicio. Probá de nuevo más tarde.</div>;
  }

  const currentWeek = plan.plan?.currentWeek ?? (series ? series.weeks : 1);
  const titularState: CellState = series ? seriesState(series, currentWeek) : "none";
  const checkedIn = daylog.entry !== null;
  const firstName = plan.athlete.nombre.split(" ")[0] || plan.athlete.nombre;

  return (
    <>
      <div className="ho-greet">
        <div className="ho-greet__h">Hola, {firstName}</div>
        <div className="ho-greet__s">
          {plan.plan
            ? `${plan.plan.macroName} · semana ${plan.plan.currentWeek} de ${plan.plan.totalWeeks} · ${plan.plan.currentPhase}`
            : "tu coach todavía no te asignó un plan"}
        </div>
      </div>

      <Titular state={titularState} />

      {checkedIn ? (
        <button className="ho-cta__done" onClick={() => setCheckinOpen(true)}>
          <span className="ho-cta__check"><Check size={16} /></span>
          <span style={{ flex: 1 }}>
            <b>Check-in de hoy, listo</b>
            <span>Gracias por registrarte · podés editarlo cuando quieras</span>
          </span>
        </button>
      ) : (
        <button className="wl-btn wl-btn--primary ho-cta" onClick={() => setCheckinOpen(true)}>Hacer check-in de hoy</button>
      )}

      <ConstanciaCard streak={daylog.streak} days={daylog.days} today={daylog.today} />
      <CaminoCard plan={plan.plan} />

      {checkinOpen && (
        <CheckIn variant={variant} initial={daylog.entry} onClose={() => setCheckinOpen(false)} onDone={onCheckinDone} />
      )}
    </>
  );
}
```

- [ ] **Step 4: Run tests — verify they pass**

Run: `pnpm --filter @holy-oly/web test home`
Expected: PASS (3 cases). (Depends on `CheckIn` from D7 only for the overlay import — the import must resolve; implement D7 in the same session before running the full web suite, or stub the import. If running D6 alone first, create a minimal `CheckIn.tsx` placeholder, then flesh it out in D7.)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/screens/atleta/HomeScreen.tsx apps/web/src/screens/atleta/__tests__/home.test.tsx
git commit -m "feat(web): HomeScreen (carga meClient, compone Hoy, overlay de check-in)"
```

### Task D7: `CheckIn` overlay (tap + dial + weight + done)

**Files:**
- Create: `apps/web/src/screens/atleta/CheckIn.tsx`
- Create: `apps/web/src/screens/atleta/__tests__/checkin.test.tsx`

> Ported from the design's `checkin.jsx`. `window.HO.checkinItems` → `WELLNESS_ITEMS` (core), answers keyed by `field`. Caritas are monochrome (`Face` uses `currentColor`). Adds submit busy/error handling (the design assumed a never-failing local store). `onDone` persists via `meClient` (HomeScreen wires it).

- [ ] **Step 1: Write the failing test**

`apps/web/src/screens/atleta/__tests__/checkin.test.tsx`:
```tsx
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { vi } from "vitest";
import { CheckIn } from "../CheckIn";

test("variante dial: avanza por los 6 ítems + peso y guarda (defaults 3)", async () => {
  const onDone = vi.fn().mockResolvedValue(undefined);
  render(<CheckIn variant="dial" onClose={() => {}} onDone={onDone} />);
  for (let i = 0; i < 6; i++) {
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
  }
  expect(screen.getByText("¿Cuánto pesás hoy?")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Guardar check-in" }));
  await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
  expect(onDone.mock.calls[0][0]).toMatchObject({ fatiga: 3, dolor: 3, estres: 3, humor: 3, motivacion: 3, sueno: 3, weight: 80 });
  expect(await screen.findByText("¡Listo!")).toBeInTheDocument();
});

test("variante tap: tocar una carita auto-avanza al ítem siguiente", () => {
  vi.useFakeTimers();
  try {
    render(<CheckIn variant="tap" onClose={() => {}} onDone={vi.fn()} />);
    expect(screen.getByText(/¿Qué tan cansada/)).toBeInTheDocument(); // Fatiga
    fireEvent.click(screen.getByRole("button", { name: "Fatiga 2" }));
    act(() => { vi.advanceTimersByTime(320); });
    expect(screen.getByText(/molestias o dolor/)).toBeInTheDocument(); // Dolor
  } finally {
    vi.useRealTimers();
  }
});

test("muestra el error del submit y no cierra (onDone rechaza)", async () => {
  const onDone = vi.fn().mockRejectedValue(new Error("API caída"));
  render(<CheckIn variant="dial" initial={{ date: "2026-06-03", fatiga: 3, dolor: 3, estres: 3, humor: 3, motivacion: 3, sueno: 3 }} onClose={() => {}} onDone={onDone} />);
  for (let i = 0; i < 6; i++) fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
  fireEvent.click(screen.getByRole("button", { name: "Guardar check-in" }));
  expect(await screen.findByText(/API caída/)).toBeInTheDocument();
  expect(screen.queryByText("¡Listo!")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run it — verify it fails**

Run: `pnpm --filter @holy-oly/web test checkin`
Expected: FAIL — `Cannot find module '../CheckIn'`.

- [ ] **Step 3: Implement `CheckIn.tsx`**

```tsx
import { useEffect, useRef, useState } from "react";
import { WELLNESS_ITEMS, goodness, type DayLog, type DayLogInput, type WellnessAnswers } from "@holy-oly/core";
import type { CheckinVariant } from "./prefs";
import { Face, Check } from "./primitives";

const GOOD_WORD: Record<number, string> = { 5: "Genial", 4: "Bien", 3: "Ahí va", 2: "Flojo", 1: "Difícil" };
type Item = (typeof WELLNESS_ITEMS)[number];

function FaceRow({ item, value, onPick }: { item: Item; value: number | undefined; onPick: (p: number) => void }) {
  return (
    <div>
      <div className="ho-faces">
        {[1, 2, 3, 4, 5].map((p) => (
          <button key={p} className={"ho-face" + (value === p ? " sel" : "")} onClick={() => onPick(p)} aria-label={`${item.label} ${p}`}>
            <Face level={goodness(p, item.highBad)} />
          </button>
        ))}
      </div>
      <div className="ho-facescale"><span>{item.lo}</span><span>{item.hi}</span></div>
    </div>
  );
}

function FaceDial({ item, value, onPick }: { item: Item; value: number; onPick: (p: number) => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const setFromX = (clientX: number): void => {
    const el = trackRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const f = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    onPick(Math.round(1 + f * 4));
  };
  const onDown = (e: React.PointerEvent): void => {
    setFromX(e.clientX);
    const move = (ev: PointerEvent): void => setFromX(ev.clientX);
    const up = (): void => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const g = goodness(value, item.highBad);
  const pct = ((value - 1) / 4) * 100;
  return (
    <div>
      <div className="ho-bigface">
        <div className="ho-bigface__circle" style={{ transform: `scale(${0.92 + g * 0.03})` }}><Face level={g} /></div>
        <div className="ho-bigface__word">{GOOD_WORD[g]}</div>
      </div>
      <div className="ho-slider">
        <div className="ho-slider__track" ref={trackRef} onPointerDown={onDown}>
          <div className="ho-slider__fill" style={{ width: `${pct}%` }} />
          <div className="ho-slider__pegs">{[1, 2, 3, 4, 5].map((p) => <span key={p} className="ho-slider__peg" />)}</div>
          <div className="ho-slider__knob" style={{ left: `${pct}%` }} />
        </div>
        <div className="ho-slider__nums">
          {[1, 2, 3, 4, 5].map((p) => (
            <button key={p} className={value === p ? "on" : ""} onClick={() => onPick(p)}>{p}</button>
          ))}
        </div>
        <div className="ho-facescale" style={{ marginTop: 2 }}><span>{item.lo}</span><span>{item.hi}</span></div>
      </div>
    </div>
  );
}

function WeightStep({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const step = (d: number): void => onChange(Math.round((value + d) * 10) / 10);
  return (
    <div className="ho-wt">
      <div className="ho-wt__dial">
        <button className="ho-wt__step" onClick={() => step(-0.1)} aria-label="menos">−</button>
        <div style={{ textAlign: "center" }}>
          <div className="ho-wt__val">{value.toFixed(1)}</div>
          <div className="ho-wt__unit">kg</div>
        </div>
        <button className="ho-wt__step" onClick={() => step(0.1)} aria-label="más">+</button>
      </div>
    </div>
  );
}

export function CheckIn({ variant, initial, onClose, onDone }: {
  variant: CheckinVariant;
  initial?: DayLog | null;
  onClose: () => void;
  onDone: (input: DayLogInput) => void | Promise<void>;
}) {
  const items = WELLNESS_ITEMS;
  const total = items.length + 1; // + peso
  const [step, setStep] = useState(0);
  const [maxReached, setMax] = useState(0);
  const [answers, setAnswers] = useState<Partial<WellnessAnswers>>(() =>
    initial
      ? { fatiga: initial.fatiga, dolor: initial.dolor, estres: initial.estres, humor: initial.humor, motivacion: initial.motivacion, sueno: initial.sueno }
      : {},
  );
  const [weight, setWeight] = useState<number>(initial?.weight ?? 80);
  const [finished, setFinished] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const advTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const go = (n: number): void => { setStep(n); setMax((m) => Math.max(m, n)); };
  useEffect(() => () => clearTimeout(advTimer.current), []);

  const pickTap = (item: Item, p: number): void => {
    setAnswers((a) => ({ ...a, [item.field]: p }));
    clearTimeout(advTimer.current);
    advTimer.current = setTimeout(() => go(step + 1), 300);
  };
  const pickDial = (item: Item, p: number): void => setAnswers((a) => ({ ...a, [item.field]: p }));

  const finish = async (includeWeight: boolean): Promise<void> => {
    const input: DayLogInput = {
      fatiga: answers.fatiga ?? 3, dolor: answers.dolor ?? 3, estres: answers.estres ?? 3,
      humor: answers.humor ?? 3, motivacion: answers.motivacion ?? 3, sueno: answers.sueno ?? 3,
      ...(includeWeight ? { weight } : {}),
    };
    setBusy(true);
    setError(null);
    try {
      await onDone(input);
      setFinished(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  };

  if (finished) {
    return (
      <div className="ho-checkin">
        <div className="ho-cidone">
          <div className="ho-cidone__ring"><Check size={42} /></div>
          <div className="ho-cidone__h">¡Listo!</div>
          <div className="ho-cidone__b">Registramos tu día. Esto alimenta tu tendencia — no un puntaje para competir. Volvé mañana, sin presión.</div>
          <button className="wl-btn wl-btn--ghost" style={{ marginTop: 6 }} onClick={onClose}>Volver al inicio</button>
        </div>
      </div>
    );
  }

  const onWeight = step === items.length;
  const item = onWeight ? null : items[step]!;

  return (
    <div className="ho-checkin" role="dialog" aria-label="Check-in de hoy">
      <div className="ho-ci__top">
        <button className="ho-ci__close" onClick={step === 0 ? onClose : () => go(step - 1)} aria-label="atrás">{step === 0 ? "✕" : "‹"}</button>
        <div className="ho-ci__seg">
          {Array.from({ length: total }).map((_, i) => (
            <i key={i} className={i < step ? "done" : i === step ? "cur" : ""} onClick={() => i <= maxReached && go(i)} style={{ cursor: i <= maxReached ? "pointer" : "default" }} />
          ))}
        </div>
        <span className="ho-ci__count">{step + 1}/{total}</span>
      </div>

      <div className="ho-ci__body">
        <div className="ho-ci__card" key={step}>
          {onWeight ? (
            <>
              <div className="ho-ci__item">Peso corporal</div>
              <div className="ho-ci__q">¿Cuánto pesás hoy?</div>
              <WeightStep value={weight} onChange={setWeight} />
              <button className="ho-wt__skip" onClick={() => void finish(false)} disabled={busy}>Hoy no me pesé — saltar</button>
            </>
          ) : (
            <>
              <div className="ho-ci__item">{step + 1} · {item!.label}</div>
              <div className="ho-ci__q">{item!.q}</div>
              {variant === "dial"
                ? <FaceDial item={item!} value={answers[item!.field] ?? 3} onPick={(p) => pickDial(item!, p)} />
                : <FaceRow item={item!} value={answers[item!.field]} onPick={(p) => pickTap(item!, p)} />}
            </>
          )}
        </div>
      </div>

      <div className="ho-ci__foot">
        {error && <div role="alert" style={{ textAlign: "center", color: "#ff3b46", fontFamily: "var(--ho-mono)", fontSize: 11, marginBottom: 8 }}>{error}</div>}
        {onWeight ? (
          <button className="wl-btn wl-btn--primary" style={{ width: "100%" }} onClick={() => void finish(true)} disabled={busy}>{busy ? "Guardando…" : "Guardar check-in"}</button>
        ) : variant === "dial" ? (
          <button className="wl-btn" style={{ width: "100%" }} onClick={() => { if (!answers[item!.field]) pickDial(item!, 3); go(step + 1); }}>Siguiente</button>
        ) : (
          <div style={{ textAlign: "center", fontFamily: "var(--ho-mono)", fontSize: 10, color: "var(--wl-muted)" }}>Tocá una carita</div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests — verify they pass**

Run: `pnpm --filter @holy-oly/web test checkin`
Expected: PASS (3 cases).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/screens/atleta/CheckIn.tsx apps/web/src/screens/atleta/__tests__/checkin.test.tsx
git commit -m "feat(web): CheckIn (variantes Toque/Dial + peso + listo; manejo de error en submit)"
```

### Task D8: `CuentaMin` (vincular + skin + variante + logout)

**Files:**
- Create: `apps/web/src/screens/atleta/CuentaMin.tsx`
- Create: `apps/web/src/screens/atleta/__tests__/cuenta.test.tsx`

> Vincular flow ported from `AtletaScreen` (calls `vinculoClient.acceptCode`); skin picker + check-in variant toggle (via `useAtletaCtx`); logout (via `useAuth`). Rich profile/export/ciclo are A3 — omitted.

- [ ] **Step 1: Write the failing test**

`apps/web/src/screens/atleta/__tests__/cuenta.test.tsx`:
```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "../../../auth/AuthContext";
import { AthleteShell } from "../AthleteShell";
import { CuentaMin } from "../CuentaMin";

function renderCuenta() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={["/atleta/cuenta"]}>
        <Routes>
          <Route path="/atleta" element={<AthleteShell />}>
            <Route path="cuenta" element={<CuentaMin />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

test("muestra la sección de vínculo, el toggle de variante y los skins", () => {
  renderCuenta();
  expect(screen.getByText("Cuenta")).toBeInTheDocument();
  expect(screen.getByLabelText("Código de invitación")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Skin Plates" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeInTheDocument();
});

test("elegir una skin la aplica al shell y la persiste", () => {
  const { container } = renderCuenta();
  fireEvent.click(screen.getByRole("button", { name: "Skin Plates" }));
  expect(container.querySelector(".ho-shell")?.classList.contains("wl--plates")).toBe(true);
  expect(localStorage.getItem("holy-oly:atleta-skin")).toBe("plates");
  localStorage.clear();
});
```

- [ ] **Step 2: Run it — verify it fails**

Run: `pnpm --filter @holy-oly/web test cuenta`
Expected: FAIL — `Cannot find module '../CuentaMin'`.

- [ ] **Step 3: Implement `CuentaMin.tsx`**

```tsx
import { useState, type FormEvent } from "react";
import type { VinculoEstado } from "@holy-oly/core";
import { useAuth } from "../../auth/AuthContext";
import * as vc from "../../data/vinculoClient";
import { useAtletaCtx } from "./AthleteShell";

const HO_SKINS: Array<{ id: string; nm: string; sw: [string, string, string] }> = [
  { id: "neon", nm: "Neon PR", sw: ["#07070f", "#c8ff2d", "#1fe7ff"] },
  { id: "neonlight", nm: "Neon Bloom", sw: ["#fdeef6", "#ff2e9a", "#8a5cff"] },
  { id: "plates", nm: "Plates", sw: ["#15171a", "#e23b2e", "#2274d4"] },
  { id: "premium", nm: "Premium", sw: ["#0d1016", "#e9b365", "#37d6b8"] },
  { id: "chalk", nm: "Chalk", sw: ["#e7e3d8", "#ff5400", "#2b59ff"] },
];

function VincularSection() {
  const [code, setCode] = useState("");
  const [estado, setEstado] = useState<VinculoEstado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await vc.acceptCode(code.trim().toUpperCase());
      setEstado(r.estado);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ho-acct__group">
      <div className="ho-acct__label">Mi coach</div>
      {estado === "pendiente" ? (
        <div className="ho-card">
          <b style={{ fontFamily: "var(--wl-display)" }}>Solicitud enviada ✓</b>
          <div className="ho-acct__rowsub" style={{ marginTop: 4 }}>Esperando que tu coach confirme el vínculo.</div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="ho-card">
          <div className="ho-acct__rowsub" style={{ marginBottom: 10 }}>Ingresá el código que te pasó tu coach. Cuando lo confirme, quedás vinculada.</div>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="CÓDIGO"
            aria-label="Código de invitación"
            style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 10, border: "1px solid color-mix(in srgb,var(--wl-text) 16%,transparent)", background: "var(--wl-bg)", color: "var(--wl-text)", fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 18, letterSpacing: ".18em", textAlign: "center" }}
          />
          {error && <div role="alert" style={{ color: "#ff3b46", fontFamily: "var(--ho-mono)", fontSize: 11, marginTop: 10 }}>{error}</div>}
          <button type="submit" className="wl-btn wl-btn--primary" style={{ width: "100%", marginTop: 12 }} disabled={busy || !code.trim()}>
            {busy ? "..." : "Enviar solicitud"}
          </button>
        </form>
      )}
    </div>
  );
}

export function CuentaMin() {
  const { logout } = useAuth();
  const { skin, setSkin, variant, setVariant } = useAtletaCtx();
  return (
    <>
      <div className="ho-greet"><div className="ho-greet__h">Cuenta</div><div className="ho-greet__s">vos sos dueña de tus datos</div></div>

      <VincularSection />

      <div className="ho-acct__group">
        <div className="ho-acct__label">Check-in · interacción</div>
        <div className="ho-seg">
          {([["tap", "Toque"], ["dial", "Dial"]] as const).map(([v, l]) => (
            <button key={v} className={variant === v ? "on" : ""} onClick={() => setVariant(v)}>{l}</button>
          ))}
        </div>
      </div>

      <div className="ho-acct__group">
        <div className="ho-acct__label">Apariencia · skin</div>
        <div className="ho-skins">
          {HO_SKINS.map((s) => (
            <button key={s.id} className={"ho-skin" + (skin === s.id ? " on" : "")} onClick={() => setSkin(s.id)} aria-label={`Skin ${s.nm}`}>
              <div className="ho-skin__sw">{s.sw.map((c, i) => <i key={i} style={{ background: c }} />)}</div>
              <div className="ho-skin__nm">{s.nm}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="ho-acct__group">
        <button type="button" onClick={() => void logout()} className="wl-btn wl-btn--ghost" style={{ width: "100%", color: "#ff5e5e" }}>Cerrar sesión</button>
      </div>

      <div style={{ textAlign: "center", fontFamily: "var(--ho-mono)", fontSize: 9, color: "var(--wl-muted)", margin: "22px 0 4px", letterSpacing: ".04em" }}>
        HOLY OLY · smart training · zero burnout
      </div>
    </>
  );
}
```

- [ ] **Step 4: Run tests — verify they pass**

Run: `pnpm --filter @holy-oly/web test cuenta`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/screens/atleta/CuentaMin.tsx apps/web/src/screens/atleta/__tests__/cuenta.test.tsx
git commit -m "feat(web): CuentaMin (vincular + skin picker + variante + logout)"
```

### Task D9: `ProgresoPlaceholder` + routing + retire `AtletaScreen`

**Files:**
- Create: `apps/web/src/screens/atleta/ProgresoPlaceholder.tsx`
- Modify: `apps/web/src/app/router.tsx`
- Delete: `apps/web/src/screens/atleta/AtletaScreen.tsx` (+ its test if one exists)

- [ ] **Step 1: Create `ProgresoPlaceholder.tsx` (A2 stub)**

```tsx
/** A2 lands the real "Mi progreso" (charts vs su normal + HR-2 sheets). A1 ships an honest stub. */
export function ProgresoPlaceholder() {
  return (
    <>
      <div className="ho-greet"><div className="ho-greet__h">Mi progreso</div><div className="ho-greet__s">tus tendencias vs tu propia normal</div></div>
      <div className="ho-card">
        <div className="ho-nodata">
          <div className="ho-nodata__icon">·</div>
          <div className="ho-nodata__t">Llega pronto</div>
          <div className="ho-nodata__b">Acá vas a ver tu carga, tu recuperación vs tu normal y cómo venís — con el contexto de cómo leer cada gráfico.</div>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Check for any `AtletaScreen` references before deleting**

Run (Grep tool or): `git grep -n "AtletaScreen"`
Expected: only `router.tsx` (the import + route) and the file itself (+ possibly `AtletaScreen.test.tsx`). Note each so none dangles.

- [ ] **Step 3: Rewire `router.tsx`**

In `apps/web/src/app/router.tsx`, replace the import line:
```tsx
import { AtletaScreen } from "../screens/atleta/AtletaScreen";
```
with:
```tsx
import { AthleteShell } from "../screens/atleta/AthleteShell";
import { HomeScreen } from "../screens/atleta/HomeScreen";
import { ProgresoPlaceholder } from "../screens/atleta/ProgresoPlaceholder";
import { CuentaMin } from "../screens/atleta/CuentaMin";
```

And replace the atleta route:
```tsx
      { path: "atleta", element: <RequireAuth role="atleta"><AtletaScreen /></RequireAuth> },
```
with:
```tsx
      {
        path: "atleta",
        element: <RequireAuth role="atleta"><AthleteShell /></RequireAuth>,
        children: [
          { index: true, element: <HomeScreen /> },
          { path: "progreso", element: <ProgresoPlaceholder /> },
          { path: "cuenta", element: <CuentaMin /> },
        ],
      },
```

- [ ] **Step 4: Delete `AtletaScreen.tsx` (+ its test if found in Step 2)**

```bash
git rm apps/web/src/screens/atleta/AtletaScreen.tsx
# plus: git rm apps/web/src/screens/atleta/AtletaScreen.test.tsx  (only if Step 2 found one)
```

- [ ] **Step 5: Full web verification**

Run: `pnpm --filter @holy-oly/web test`
Expected: PASS (existing 127 + new meClient/shell/home/checkin/cuenta cases).

Run: `pnpm --filter @holy-oly/web exec tsc --noEmit`
Expected: PASS (no dangling `AtletaScreen` import; `--fill` CSS var OK).

Run: `pnpm --filter @holy-oly/web exec eslint src`
Expected: clean.

Run: `pnpm --filter @holy-oly/web build`
Expected: builds (the `/atleta` tree compiles; `AtletaScreen` gone).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/screens/atleta/ProgresoPlaceholder.tsx apps/web/src/app/router.tsx
git rm apps/web/src/screens/atleta/AtletaScreen.tsx
git commit -m "feat(web): rutas /atleta (shell + hoy/progreso/cuenta); retira AtletaScreen (vincular → Cuenta)"
```

---

## Phase E — Verification, domain review, deploy

> Local browser preview is unavailable in this environment — verify via tests + El Carnicero + the live deploy smoke test (per the project workflow). NOT a manual local preview.

### Task E1: Full local verification

- [ ] **Step 1: Core**

Run: `pnpm --filter @holy-oly/core test && pnpm --filter @holy-oly/core exec tsc --noEmit`
Expected: green (existing 45 + wellness/schedule/mePlan/schemas).

- [ ] **Step 2: API — unit + integration (embedded PG) + e2e regression**

Run: `pnpm --filter @holy-oly/api test && pnpm --filter @holy-oly/api exec tsc --noEmit`
Run: `pnpm --filter @holy-oly/api verify` (boots embedded PG with `initdbFlags: ["--encoding=UTF8","--locale=C"]`, migrates incl. `4_day_log`, seeds, runs integration — incl. `me.int.test.ts`)
Run: `pnpm --filter @holy-oly/api e2e` (HttpRepository↔API↔PG regression — unaffected by `/me/*` but confirms no break)
Expected: all green.

- [ ] **Step 3: API production bundle compiles**

Run: `pnpm --filter @holy-oly/api build`
Expected: `tsup` bundles (incl. `@holy-oly/core` via `noExternal`). (The bundle boot itself is exercised by the deploy smoke test in E3 — the gotcha is that tsx tests don't catch a bundling regression, so the live `/health` check is the real proof.)

- [ ] **Step 4: Web**

Run: `pnpm --filter @holy-oly/web test`
Run: `pnpm --filter @holy-oly/web exec tsc --noEmit`
Run: `pnpm --filter @holy-oly/web exec eslint src`
Run: `pnpm --filter @holy-oly/web build`
Expected: all green.

### Task E2: El Carnicero domain review

> `subagent_type: el-carnicero` does NOT resolve by name on this machine → dispatch a `general-purpose` agent with the El Carnicero persona + rulebook as its prompt. Advisory, not infallible — verify each finding against the code.

- [ ] **Step 1: Dispatch the review**

Read `.claude/agents/el-carnicero.md` (persona) and `docs/domain/HOLY-OLY-DOMAIN.md` (rulebook). Dispatch a `general-purpose` agent whose prompt = the persona + rulebook + this instruction:

> Review the **athlete app A1 surface** (read-only). Files: `apps/web/src/screens/atleta/**`, `packages/core/src/logic/wellness.ts`, `packages/core/src/logic/mePlan.ts`, `apps/api/src/me/routes.ts`, `apps/api/src/repo.ts` (the `/me/*` additions). Check against the domain rulebook, especially: **HR-1** (the athlete must NEVER see an ACWR ratio or any gameable figure; the Titular shows a *state*, not a number; the caritas are monochrome, not a state palette); **color = estado** (the only state colors on Hoy are the Titular dot — the heatmap/ribbon use `--wl-accent` as identity, not state); **sin-dato honesto** (Titular/Constancia/Camino each have an explicit empty variant for the new athlete — no false-green); **ciclo** (must NOT render in A1); **authz** (`/me/*` is scoped to `req.athleteId` from the session, never body/path); **verdad anclada a fecha** (current week/streak derive from the server's date). Report CRITICAL/HIGH/MEDIUM/LOW with file:line + a concrete fix.

- [ ] **Step 2: Address findings**

Fix every CRITICAL/HIGH. Evaluate MEDIUM/LOW; fix where cheap, otherwise note as deferred (A2/A3) with a one-line rationale. Re-run the affected tests. Commit any fixes:
```bash
git add -A && git commit -m "fix(web,api,core): hallazgos de El Carnicero en A1 (dominio)"
```

### Task E3: Commit docs, push, deploy, smoke

- [ ] **Step 1: Commit the spec + this plan**

```bash
git add docs/superpowers/specs/2026-06-02-athlete-app-a1-design.md docs/superpowers/plans/2026-06-03-athlete-app-a1.md
git commit -m "docs: spec + plan de A1 (app del atleta — bienestar)"
```

- [ ] **Step 2: Push to main (FF) — triggers Render auto-deploy**

```bash
git push origin HEAD:main
```
The migration `4_day_log` applies automatically on deploy via `start:prod` (`prisma migrate deploy && node dist/main.js`). No manual DB step.

- [ ] **Step 3: Poll the deploy (background) until `live`**

Read the Render key from `C:\Users\Gamer\Videos\.render-key.txt` WITHOUT printing it. Poll (service `srv-d8etrvvavr4c73954o4g`):
```
GET https://api.render.com/v1/services/srv-d8etrvvavr4c73954o4g/deploys?limit=1
Authorization: Bearer <key>
```
Run this as a background loop (`curl` every ~20s) until the latest deploy `status` is `live` (or surface `build_failed`/`update_failed`).

- [ ] **Step 4: Smoke the live site**

```bash
curl -fsS https://holy-oly.onrender.com/health           # → {"ok":true}
curl -fsS https://holy-oly.onrender.com/ | grep -i "holy oly"   # SPA shell title
```
Manual check (note for the user): log in as the demo athlete (`atleta@holyoly.dev` / `holyoly-demo`) → `/atleta` shows the Hoy screen (empty states, honest) → check-in saves → racha shows 1.
Expected: `/health` 200, SPA served. A1 is live.

---

## Phase F — (OPTIONAL) Seed enrichment for a richer live demo

> Not required for A1 (the demo athlete's honest empty states are the correct new-athlete experience). This makes the **populated** Hoy demoable live. ⚠ `db:seed` is a **destructive reset** — only run against a DB with no real users (fine for the beta). Decide with the user before re-seeding prod.

### Task F1: Give Mara a login + plan + sample daylogs

**Files:**
- Modify: `apps/api/prisma/seed.ts`

- [ ] **Step 1: Give Mara (`mv`) a user account + a Plan with a date-anchored startDate**

In `seed.ts`, after Mara's series/medals/competencia are created, add (uses `defaultStartDate` from core to anchor today ≈ week 12, and seeds ~12 consecutive daylogs ending today so the racha + heatmap populate):
```typescript
import { defaultStartDate } from "@holy-oly/core";

// … inside main(), after the Mara competencia create:
const maraUser = await prisma.user.create({
  data: { email: (process.env.SEED_MARA_EMAIL ?? "mara@holyoly.dev").trim().toLowerCase(), passwordHash: await hash(process.env.SEED_MARA_PASSWORD ?? "holyoly-demo"), role: "atleta" },
});
await prisma.athlete.update({ where: { id: "mv" }, data: { userId: maraUser.id } });

const today = new Date().toISOString().slice(0, 10);
await prisma.plan.create({
  data: {
    athleteId: "mv", macroId: "ruso-5d", startWeek: 1, startDate: defaultStartDate(today, 12),
    rms: { arranque: 80, envion: 100, sentadilla: 140, frente: 110 },
  },
});
// 12 consecutive daylogs ending today → a visible racha + heatmap
const DAY = 86_400_000;
const t0 = new Date(`${today}T00:00:00Z`).getTime();
for (let i = 11; i >= 0; i--) {
  const d = new Date(t0 - i * DAY).toISOString().slice(0, 10);
  await prisma.dayLog.create({ data: { athleteId: "mv", date: d, fatiga: 2, dolor: 1, estres: 2, humor: 4, motivacion: 5, sueno: 4, weight: 80.8 } });
}
```
> Mara's `Competencia` already exists at week 16, so the Camino countdown reads "4 semanas para Nacional".

- [ ] **Step 2: Verify the seed still runs (embedded PG)**

Run: `pnpm --filter @holy-oly/api verify`
Expected: green (the seed runs as part of `verify`; the new rows don't break the existing integration tests — those use `demo-atleta`, not `mv`).

- [ ] **Step 3: Commit**

```bash
git add apps/api/prisma/seed.ts
git commit -m "chore(api): seed — Mara con login + plan + 12 daylogs (demo poblada del atleta)"
```

- [ ] **Step 4: (Manual, with user consent) re-seed prod**

⚠ Destructive. Only if the user agrees (beta DB, no real data). Run `db:seed` against the prod `DATABASE_URL` once. New demo login: `mara@holyoly.dev` / `holyoly-demo`. (Document the new account for the user.)

---

## Self-Review — spec coverage map

| Spec (§) | Requirement | Task(s) |
|---|---|---|
| §1 | Shell + bottom-nav | D4 |
| §1 | Hoy (saludo, Titular, CTA, Constancia, Camino) | D5, D6 |
| §1 | Check-in (2 variantes + peso + listo) | D7 |
| §1 | Cuenta mínima (logout + vincular + skin) | D8 |
| §1, §4 | Backend `DayLog` + `wellnessScore` + `/me/*` + `meClient` | A2, A5, B1–B3, C1 |
| §3 | Saludo ← `/me/plan`; Titular ← `seriesState`; Constancia ← `/me/daylog`; Camino ← `/me/plan` | A4, B3, D5, D6 |
| §5 | coach-ve-bienestar **DIFERIDO** | Honored — not in A1 (demo athlete: `/me/series` 404, empty states) |
| §6 | HR-1 (no ratio/cifra gameable; caritas monocromas) | D3 (`Face` currentColor), D6 (Titular = state, not number) |
| §6 | color = estado (solo Titular) | D5 (Titular ST map; heatmap/ribbon use `--wl-accent`) |
| §6 | sin-dato honesto | D5 (empty variants in Titular/Constancia/Camino) |
| §6 | ciclo oculto en A1 | Honored — no cycle card rendered |
| §6, §4 | authz scope-self (`req.athleteId`, no IDOR); Repository (screens via `meClient`) | B3 (`requireAthlete`), C1 |
| §7 | `/atleta` → `AthleteShell`; vincular → Cuenta | D9 |
| §8 | TDD: core/api/web + integration (login→check-in→persist+streak) | A2/A3/A4, B2/B3, C1, D4/D6/D7/D8; E2 (El Carnicero) |

**Notes:** Full browser-e2e (Playwright) is **Fase 6**, not A1 — the API integration test (`me.int.test.ts`) covers the login→check-in→persist+streak flow at the service layer. Per-athlete timezone is a later refinement (A1 anchors to the server's UTC date). The `--fill` CSS custom property in `MacroRibbon` is cast `as React.CSSProperties`.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-03-athlete-app-a1.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Best for this plan's size (it spans 3 packages); each task is self-contained with full code + a verification command. Note the one ordering dependency: `HomeScreen` (D6) imports `CheckIn` (D7) — have the D6 subagent drop a minimal `CheckIn.tsx` stub first, or run D7 before D6's full web suite.

**2. Inline Execution** — execute tasks in this session using `superpowers:executing-plans`, batched with checkpoints for review.

**Which approach?**
