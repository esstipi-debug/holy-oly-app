# SP3 — Ejecución del atleta + registro real · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** The athlete sees their prescribed session (read-only) and records **what they actually lifted** per exercise; the coach sees **prescribed-vs-real** in the drill-down.

**Architecture:** **core** — `SessionActual` + `ExerciseActual` types, `mergeActuals`/`kgDeviation` logic, optional `actual?` on the session view, Zod wire schemas. **api** — Prisma `SessionActual` + migration `6_session_actual`; `getPrescriptionWeek` merges actuals (serves both coach + athlete); athlete-self `GET /me/sessions` + `PUT /me/session/:week/:idx`. **web** — `meClient` methods + the `EntrenoScreen` + a "Tu semana" card on *Hoy* (athlete); the coach `SessionsSection` shows real next to target.

**Tech Stack:** TS strict, Zod, Fastify 5 + Prisma 6 + Postgres (embedded for tests), React 18 + Vitest/RTL. Builds on SP2 (`PrescribedExercise`, `buildSessionViews`, `SessionView`, `getPrescriptionWeek`, the coach `SessionsSection`) + A1 (`/me/*`, `requireAthlete`, `meClient`, the athlete shell).

**Spec:** [`docs/superpowers/specs/2026-06-03-sp3-execution-actuals-design.md`](../specs/2026-06-03-sp3-execution-actuals-design.md)

---

## File Structure
- **core:** modify `types/index.ts` (+`SessionActual`, `ExerciseActual`, `PrescribedExerciseView.actual?`); create `logic/actuals.ts` (+test); modify `schemas.ts` (+ `ExerciseActualInputSchema`/`SessionActualsInputSchema` + `actual` on `PrescribedExerciseViewSchema`); modify `index.ts`.
- **api:** modify `prisma/schema.prisma` (+`SessionActual`); create migration `6_session_actual`; modify `src/repo.ts` (`getPrescriptionWeek` merge + `setSessionActuals`); modify `src/me/routes.ts` (2 routes); create `src/actuals.int.test.ts`.
- **web:** modify `src/data/meClient.ts` (+2 methods); create `src/screens/atleta/EntrenoScreen.tsx` + `src/screens/atleta/hoy/SemanaCard.tsx`; modify `src/screens/atleta/HomeScreen.tsx` + `src/app/router.tsx`; modify `src/screens/coach/sessions/SessionsSection.tsx`; tests.

Commands: `pnpm --filter @holy-oly/{core,web} test [filter]`, `… exec tsc --noEmit`, `pnpm --filter @holy-oly/api {test,verify,e2e}`, `… exec prisma generate`.

---

## Phase A — Core

### Task A1: Types

**Files:** Modify `packages/core/src/types/index.ts` (append)

- [ ] **Step 1: Append**
```typescript
// ── SP3 actuals: what the athlete actually lifted, per prescribed exercise. ──
export interface SessionActual {
  week: number; sessionIdx: number; order: number; movementId: string;
  done: boolean; actualKg?: number; actualReps?: number; actualRpe?: number; note?: string; doneAt?: string;
}
/** The flattened actual attached to a prescribed-exercise view (no location — it rides the exercise). */
export interface ExerciseActual { done: boolean; kg?: number; reps?: number; rpe?: number; note?: string }
```
Then add `actual?: ExerciseActual;` to the existing `PrescribedExerciseView` interface (it currently has `movementName: string; targetKg?: number`).

- [ ] **Step 2:** `pnpm --filter @holy-oly/core exec tsc --noEmit` → PASS.
- [ ] **Step 3: Commit** — `git commit -am "feat(core): tipos SessionActual + ExerciseActual (SP3)"`

---

### Task A2: `mergeActuals` + `kgDeviation`

**Files:** Create `packages/core/src/logic/actuals.ts` + `.test.ts`; modify `src/index.ts`

- [ ] **Step 1: Failing test** (`packages/core/src/logic/actuals.test.ts`)
```typescript
import { describe, it, expect } from "vitest";
import type { SessionView, SessionActual } from "../types";
import { mergeActuals, kgDeviation } from "./actuals";

const views: SessionView[] = [{
  week: 1, sessionIdx: 0, exercises: [
    { movementId: "arranque", sets: 5, reps: 3, pct: 70, movementName: "Arranque", targetKg: 56 },
    { movementId: "sentadilla", sets: 5, reps: 5, pct: 80, movementName: "Sentadilla", targetKg: 112 },
  ],
}];
const rows: SessionActual[] = [
  { week: 1, sessionIdx: 0, order: 0, movementId: "arranque", done: true, actualKg: 58, actualReps: 3, actualRpe: 8 },
];

describe("mergeActuals", () => {
  it("attaches the actual to the matching exercise by (week, sessionIdx, order=index)", () => {
    const merged = mergeActuals(views, rows);
    expect(merged[0]!.exercises[0]!.actual).toEqual({ done: true, kg: 58, reps: 3, rpe: 8, note: undefined });
    expect(merged[0]!.exercises[1]!.actual).toBeUndefined();
  });
  it("is a no-op when there are no rows", () => {
    expect(mergeActuals(views, [])[0]!.exercises[0]!.actual).toBeUndefined();
  });
});

describe("kgDeviation", () => {
  it("classifies real vs target", () => {
    expect(kgDeviation(56, 58)).toBe("mas");
    expect(kgDeviation(56, 54)).toBe("menos");
    expect(kgDeviation(56, 56)).toBe("igual");
    expect(kgDeviation(undefined, 56)).toBe("none");
    expect(kgDeviation(56, undefined)).toBe("none");
  });
});
```

- [ ] **Step 2:** Run `pnpm --filter @holy-oly/core test actuals` → FAIL (no module).

- [ ] **Step 3: Implement `packages/core/src/logic/actuals.ts`**
```typescript
import type { ExerciseActual, SessionActual, SessionView } from "../types";

/** Attach each athlete actual to its prescribed exercise. Exercises in a SessionView are ordered by
 *  `order` (0-based, contiguous from instantiation/edit), so the view index == the row's `order`. */
export function mergeActuals(views: SessionView[], rows: SessionActual[]): SessionView[] {
  return views.map((v) => ({
    ...v,
    exercises: v.exercises.map((e, i) => {
      const a = rows.find((r) => r.week === v.week && r.sessionIdx === v.sessionIdx && r.order === i);
      if (!a) return e;
      const actual: ExerciseActual = { done: a.done, kg: a.actualKg, reps: a.actualReps, rpe: a.actualRpe, note: a.note };
      return { ...e, actual };
    }),
  }));
}

/** Real-vs-target classification for the coach's deviation marker. `none` when either side is missing. */
export function kgDeviation(targetKg: number | undefined, actualKg: number | undefined): "none" | "igual" | "mas" | "menos" {
  if (targetKg == null || actualKg == null) return "none";
  if (actualKg > targetKg) return "mas";
  if (actualKg < targetKg) return "menos";
  return "igual";
}
```

- [ ] **Step 4:** In `packages/core/src/index.ts` append `export * from "./logic/actuals";`. Run `pnpm --filter @holy-oly/core test actuals` → PASS.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(core): mergeActuals + kgDeviation (SP3, puro)"`

---

### Task A3: Zod wire schemas

**Files:** Modify `packages/core/src/schemas.ts` (append); create `schemas.actuals.test.ts`

- [ ] **Step 1: Failing test** (`packages/core/src/schemas.actuals.test.ts`)
```typescript
import { describe, it, expect } from "vitest";
import { SessionActualsInputSchema } from "./schemas";

describe("SessionActualsInputSchema", () => {
  it("accepts a valid per-exercise actuals body", () => {
    expect(SessionActualsInputSchema.safeParse([
      { order: 0, movementId: "arranque", done: true, kg: 58, reps: 3, rpe: 8 },
      { order: 1, movementId: "sentadilla", done: false, note: "molestia rodilla" },
    ]).success).toBe(true);
  });
  it("rejects bad order / kg / rpe / reps", () => {
    expect(SessionActualsInputSchema.safeParse([{ order: -1, movementId: "x", done: true }]).success).toBe(false);
    expect(SessionActualsInputSchema.safeParse([{ order: 0, movementId: "x", done: true, kg: 999 }]).success).toBe(false);
    expect(SessionActualsInputSchema.safeParse([{ order: 0, movementId: "x", done: true, rpe: 11 }]).success).toBe(false);
    expect(SessionActualsInputSchema.safeParse([{ order: 0, movementId: "x", done: true, reps: 200 }]).success).toBe(false);
  });
});
```

- [ ] **Step 2:** Run `pnpm --filter @holy-oly/core test schemas.actuals` → FAIL.

- [ ] **Step 3: Append to `packages/core/src/schemas.ts`** (`KgSchema` already exists in this file)
```typescript
// ── SP3 actuals wire shapes (untrusted athlete input → bounded). ──
export const ExerciseActualInputSchema = z.object({
  order: z.number().int().min(0).max(20),
  movementId: z.string().min(1).max(60),
  done: z.boolean(),
  kg: KgSchema.optional(),
  reps: z.number().int().min(0).max(100).optional(),
  rpe: z.number().min(1).max(10).optional(),
  note: z.string().max(200).optional(),
});
export const SessionActualsInputSchema = z.array(ExerciseActualInputSchema).max(15);

// The actual rides the prescribed-exercise view (no `order` — positional). Extend the view schema.
export const ExerciseActualSchema = z.object({
  done: z.boolean(),
  kg: z.number().optional(),
  reps: z.number().optional(),
  rpe: z.number().optional(),
  note: z.string().optional(),
});
```
Then add `actual: ExerciseActualSchema.optional(),` to the existing `PrescribedExerciseViewSchema` (the `.extend({ movementName, targetKg })` object).

- [ ] **Step 4:** Run `pnpm --filter @holy-oly/core test schemas.actuals && pnpm --filter @holy-oly/core test && pnpm --filter @holy-oly/core exec tsc --noEmit` → all green.
- [ ] **Step 5: Commit** — `git commit -am "feat(core): schemas wire de actuals (SP3) + actual? en SessionView"`

---

## Phase B — API

### Task B1: `SessionActual` model + migration

**Files:** Modify `apps/api/prisma/schema.prisma`; create `prisma/migrations/6_session_actual/migration.sql`

- [ ] **Step 1:** In `model Athlete` add `actuals SessionActual[]`. Add the model (after `model PrescribedExercise`):
```prisma
/// What the athlete actually lifted, per prescribed exercise (SP3). Self-written (requireAthlete).
model SessionActual {
  id          String   @id @default(uuid())
  athleteId   String
  athlete     Athlete  @relation(fields: [athleteId], references: [id], onDelete: Cascade)
  week        Int
  sessionIdx  Int
  order       Int
  movementId  String
  done        Boolean  @default(true)
  actualKg    Float?
  actualReps  Int?
  actualRpe   Float?
  note        String?
  doneAt      String?

  @@unique([athleteId, week, sessionIdx, order])
  @@index([athleteId, week])
}
```
- [ ] **Step 2:** `pnpm --filter @holy-oly/api exec tsx scripts/make-migration.ts 6 session_actual` (mirror migrations `4_day_log`/`5_prescription`). Inspect: CREATE TABLE "SessionActual" with the columns, the `@@unique` + `@@index`, cascade FK to Athlete.
- [ ] **Step 3:** `pnpm --filter @holy-oly/api exec prisma generate` (gives `prisma.sessionActual`).
- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat(api): modelo SessionActual + migración 6_session_actual"`

---

### Task B2: Failing integration test

**Files:** Create `apps/api/src/actuals.int.test.ts`

> The seeded demo coach has an active Vínculo to Mara (`mv`); the demo athlete `atleta@holyoly.dev` resolves to `demo-atleta` (no plan). For SP3 we test on `mv` by assigning a plan as the coach, then recording actuals **as the coach is not allowed** — actuals are athlete-self. Since `mv`'s athlete login (`mara@holyoly.dev`) exists in the seed, log in as the athlete to record, and as the coach to read prescribed-vs-real.

- [ ] **Step 1: Write the test**
```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "./server";
import { prisma } from "./db/client";

type InjectRes = { cookies: Array<{ name: string; value: string }>; statusCode: number };
function sess(res: InjectRes): { cookie: string } {
  const c = res.cookies.find((x) => x.name === "session");
  if (!c) throw new Error("no session cookie");
  return { cookie: `session=${c.value}` };
}
const RMS = { arranque: 80, envion: 100, sentadilla: 140, frente: 110 };

describe("API integration — actuals (SP3)", () => {
  let app: FastifyInstance;
  beforeAll(async () => { app = buildServer(); await app.ready(); });
  afterAll(async () => { await app.close(); await prisma.$disconnect(); });

  const login = (email: string) => app.inject({ method: "POST", url: "/auth/login", payload: { email, password: "holyoly-demo" } });

  it("athlete records actuals; GET /me/sessions echoes them; coach sees prescribed-vs-real", async () => {
    const coach = sess(await login("coach@holyoly.dev"));
    // ensure mv has the Ruso 5D plan (instantiates the prescription)
    expect((await app.inject({ method: "PUT", url: "/athletes/mv/plan", headers: coach,
      payload: { atletaId: "mv", macroId: "ruso-5d", startWeek: 1, startDate: "2026-04-01", rms: RMS, comps: [] } })).statusCode).toBe(200);

    const athlete = sess(await login("mara@holyoly.dev")); // seeded login → athleteId mv
    const put = await app.inject({ method: "PUT", url: "/me/session/1/0", headers: athlete,
      payload: [{ order: 0, movementId: "arranque", done: true, kg: 58, reps: 3, rpe: 8 }] });
    expect(put.statusCode).toBe(200);

    const mine = await app.inject({ method: "GET", url: "/me/sessions?week=1", headers: athlete });
    expect(mine.statusCode).toBe(200);
    const s0 = (mine.json() as Array<{ sessionIdx: number; exercises: Array<{ actual?: { kg?: number } }> }>).find((s) => s.sessionIdx === 0)!;
    expect(s0.exercises[0]!.actual?.kg).toBe(58);

    const coachView = await app.inject({ method: "GET", url: "/athletes/mv/prescription?week=1", headers: coach });
    const cs0 = (coachView.json() as Array<{ sessionIdx: number; exercises: Array<{ targetKg?: number; actual?: { kg?: number } }> }>).find((s) => s.sessionIdx === 0)!;
    expect(cs0.exercises[0]!.actual?.kg).toBe(58); // coach sees the real next to target
  });

  it("requires week on GET, validates the body, and is athlete-self (coach → 401 on /me)", async () => {
    const athlete = sess(await login("mara@holyoly.dev"));
    expect((await app.inject({ method: "GET", url: "/me/sessions", headers: athlete })).statusCode).toBe(400);
    expect((await app.inject({ method: "PUT", url: "/me/session/1/0", headers: athlete, payload: [{ order: 0, movementId: "x", done: true, kg: 999 }] })).statusCode).toBe(400);
    const coach = sess(await login("coach@holyoly.dev"));
    expect((await app.inject({ method: "GET", url: "/me/sessions?week=1", headers: coach })).statusCode).toBe(401);
  });
});
```

- [ ] **Step 2:** `pnpm --filter @holy-oly/api verify` → FAIL (`/me/sessions` 404, actuals not merged).

---

### Task B3: repo + routes

**Files:** Modify `apps/api/src/repo.ts`, `apps/api/src/me/routes.ts`

- [ ] **Step 1: `repo.ts`** — extend the core import with `mergeActuals` + types `SessionActual`, `ExerciseActualInput` (the input type = `z.infer` of the schema; or accept the parsed array). Make `getPrescriptionWeek` merge actuals, and add `setSessionActuals`:
```typescript
// in getPrescriptionWeek, after building `views` from buildSessionViews(rows, plan.rms):
  const actualRows = await prisma.sessionActual.findMany({ where: { athleteId, week } });
  const actuals: SessionActual[] = actualRows.map((a) => ({
    week: a.week, sessionIdx: a.sessionIdx, order: a.order, movementId: a.movementId, done: a.done,
    actualKg: a.actualKg ?? undefined, actualReps: a.actualReps ?? undefined, actualRpe: a.actualRpe ?? undefined,
    note: a.note ?? undefined, doneAt: a.doneAt ?? undefined,
  }));
  return mergeActuals(buildSessionViews(rows, plan.rms), actuals);
```
(Replace the existing `return buildSessionViews(rows, plan.rms);` with the merge.)
```typescript
/** Replace one session's athlete actuals (self-written). Transactional. `today` stamps doneAt. */
export async function setSessionActuals(
  prisma: PrismaClient, athleteId: string, week: number, sessionIdx: number,
  actuals: Array<{ order: number; movementId: string; done: boolean; kg?: number; reps?: number; rpe?: number; note?: string }>,
  today: string,
): Promise<void> {
  await prisma.$transaction([
    prisma.sessionActual.deleteMany({ where: { athleteId, week, sessionIdx } }),
    prisma.sessionActual.createMany({
      data: actuals.map((a) => ({
        athleteId, week, sessionIdx, order: a.order, movementId: a.movementId, done: a.done,
        actualKg: a.kg ?? null, actualReps: a.reps ?? null, actualRpe: a.rpe ?? null, note: a.note ?? null, doneAt: today,
      })),
    }),
  ]);
}
```

- [ ] **Step 2: `me/routes.ts`** — extend the core import (`SessionActualsInputSchema`) and add the two routes inside `meRoutes`:
```typescript
  app.get<{ Querystring: { week?: string } }>("/me/sessions", async (req, reply) => {
    const athleteId = requireAthlete(req, reply);
    if (!athleteId) return;
    const week = Number(req.query.week);
    if (!Number.isInteger(week) || week < 1 || week > 104) return reply.code(400).send({ error: "week required (1..104)" });
    return repo.getPrescriptionWeek(prisma, athleteId, week);
  });

  app.put<{ Params: { week: string; idx: string } }>("/me/session/:week/:idx", async (req, reply) => {
    const athleteId = requireAthlete(req, reply);
    if (!athleteId) return;
    const week = Number(req.params.week);
    const idx = Number(req.params.idx);
    if (!Number.isInteger(week) || week < 1 || week > 104 || !Number.isInteger(idx) || idx < 0 || idx > 13) {
      return reply.code(400).send({ error: "bad week/idx" });
    }
    const parsed = SessionActualsInputSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid actuals" });
    await repo.setSessionActuals(prisma, athleteId, week, idx, parsed.data, todayISO());
    return reply.code(200).send({ ok: true });
  });
```

- [ ] **Step 3:** `pnpm --filter @holy-oly/api verify` → PASS (new actuals.int + existing). The SP2 `prescription.int` still passes (exercises gain an absent `actual` only when no rows). `pnpm --filter @holy-oly/api test && pnpm --filter @holy-oly/api exec tsc --noEmit`.
- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat(api): /me/sessions + /me/session/:week/:idx (actuals) + merge prescrito-vs-real"`

---

## Phase C — Web (athlete: Entreno screen + Hoy)

### Task C1: `meClient` methods

**Files:** Modify `apps/web/src/data/meClient.ts`; create `apps/web/src/data/meSessions.test.ts`

- [ ] **Step 1: Failing test** (`apps/web/src/data/meSessions.test.ts`)
```typescript
import { describe, it, expect, vi, afterEach } from "vitest";
import * as me from "./meClient";

describe("meClient sessions", () => {
  afterEach(() => vi.restoreAllMocks());
  it("getMeSessions GETs ?week and parses; putMeSession PUTs the actuals", async () => {
    let seen = "";
    global.fetch = vi.fn(async (url: string, init?: { method?: string }) => {
      seen = `${init?.method ?? "GET"} ${url}`;
      if ((init?.method ?? "GET") === "GET") return { ok: true, status: 200, json: async () => [{ week: 1, sessionIdx: 0, exercises: [{ movementId: "arranque", sets: 5, reps: 3, pct: 70, movementName: "Arranque", targetKg: 56, actual: { done: true, kg: 58 } }] }] } as Response;
      return { ok: true, status: 200, json: async () => ({ ok: true }) } as Response;
    }) as unknown as typeof fetch;
    const wk = await me.getMeSessions(1);
    expect(wk[0]!.exercises[0]!.actual?.kg).toBe(58);
    expect(seen).toContain("/me/sessions?week=1");
    await me.putMeSession(1, 0, [{ order: 0, movementId: "arranque", done: true, kg: 58, reps: 3, rpe: 8 }]);
    expect(seen).toBe("PUT /me/session/1/0");
  });
});
```
- [ ] **Step 2:** `pnpm --filter @holy-oly/web test meSessions` → FAIL.
- [ ] **Step 3: Implement** — in `meClient.ts`, mirror the existing fetch+Zod helpers (look at `getDayLog`/`putDayLog`). Add (import `SessionViewsSchema` + the `SessionView`/`ExerciseActualInput` types from core; for the input type use `z.infer<typeof ExerciseActualInputSchema>` or an inline type):
```typescript
export async function getMeSessions(week: number): Promise<SessionView[]> {
  return apiGet(`/me/sessions?week=${week}`, SessionViewsSchema); // use this file's existing GET helper + base
}
export interface ActualInput { order: number; movementId: string; done: boolean; kg?: number; reps?: number; rpe?: number; note?: string }
export async function putMeSession(week: number, idx: number, actuals: ActualInput[]): Promise<void> {
  await apiSend(`/me/session/${week}/${idx}`, "PUT", actuals); // use this file's existing mutate helper
}
```
(Match the EXACT helper names/signatures already in `meClient.ts` — `getDayLog` shows the GET+parse pattern, `putDayLog` the PUT pattern. Reuse them; don't invent new fetch plumbing.)
- [ ] **Step 4:** `pnpm --filter @holy-oly/web test meSessions && pnpm --filter @holy-oly/web exec tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(web): meClient.getMeSessions + putMeSession (SP3)"`

---

### Task C2: `EntrenoScreen` + route

**Files:** Create `apps/web/src/screens/atleta/EntrenoScreen.tsx`; modify `apps/web/src/app/router.tsx`; create `apps/web/src/screens/atleta/__tests__/entreno.test.tsx`

- [ ] **Step 1: Failing test** (`apps/web/src/screens/atleta/__tests__/entreno.test.tsx`)
```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { vi } from "vitest";
import * as me from "../../../data/meClient";
import { EntrenoScreen } from "../EntrenoScreen";

vi.spyOn(me, "getMeSessions").mockResolvedValue([
  { week: 1, sessionIdx: 0, exercises: [{ movementId: "arranque", sets: 5, reps: 3, pct: 70, movementName: "Arranque", targetKg: 56 }] },
] as never);
const put = vi.spyOn(me, "putMeSession").mockResolvedValue(undefined);

test("carga la sesión, registra lo real y guarda", async () => {
  render(
    <MemoryRouter initialEntries={["/atleta/entreno/1/0"]}>
      <Routes>
        <Route path="/atleta/entreno/:week/:idx" element={<EntrenoScreen />} />
        <Route path="/atleta" element={<div>HOY</div>} />
      </Routes>
    </MemoryRouter>,
  );
  expect(await screen.findByText("Arranque")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("kg real de Arranque"), { target: { value: "58" } });
  fireEvent.click(screen.getByRole("button", { name: /guardar entreno/i }));
  await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
  expect(put.mock.calls[0][2][0]).toMatchObject({ order: 0, movementId: "arranque", kg: 58 });
});
```
- [ ] **Step 2:** `pnpm --filter @holy-oly/web test entreno` → FAIL.
- [ ] **Step 3: Implement `EntrenoScreen.tsx`** (athlete records actuals; read-only on the prescription)
```tsx
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { SessionView } from "@holy-oly/core";
import * as me from "../../data/meClient";
import type { ActualInput } from "../../data/meClient";

interface Row { movementId: string; movementName: string; sets: number; reps: number; targetKg?: number; rpe?: number; done: boolean; kg?: number; repsActual?: number; rpeActual?: number; note?: string }

const num: CSSProperties = { width: 60, boxSizing: "border-box", padding: "7px 8px", borderRadius: 9, textAlign: "center", border: "1px solid color-mix(in srgb,var(--wl-text) 16%,transparent)", background: "var(--wl-bg)", color: "var(--wl-text)", fontFamily: "var(--wl-display)", fontSize: 15 };

export function EntrenoScreen() {
  const { week: weekP, idx: idxP } = useParams();
  const navigate = useNavigate();
  const week = Number(weekP);
  const idx = Number(idxP);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let on = true;
    me.getMeSessions(week)
      .then((views: SessionView[]) => {
        if (!on) return;
        const s = views.find((v) => v.sessionIdx === idx);
        setRows((s?.exercises ?? []).map((e) => ({
          movementId: e.movementId, movementName: e.movementName, sets: e.sets, reps: e.reps, targetKg: e.targetKg, rpe: e.rpe,
          done: e.actual?.done ?? false, kg: e.actual?.kg ?? e.targetKg, repsActual: e.actual?.reps ?? e.reps,
          rpeActual: e.actual?.rpe ?? e.rpe, note: e.actual?.note ?? "",
        })));
      })
      .catch(() => { if (on) setRows([]); });
    return () => { on = false; };
  }, [week, idx]);

  const patch = (i: number, p: Partial<Row>): void => setRows((rs) => (rs ? rs.map((r, j) => (j === i ? { ...r, ...p } : r)) : rs));

  const save = useCallback(async () => {
    if (!rows) return;
    setBusy(true); setError(null);
    try {
      const actuals: ActualInput[] = rows.map((r, order) => ({
        order, movementId: r.movementId, done: r.done, kg: r.kg, reps: r.repsActual, rpe: r.rpeActual,
        note: r.note?.trim() ? r.note.trim() : undefined,
      }));
      await me.putMeSession(week, idx, actuals);
      navigate("/atleta");
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar"); }
    finally { setBusy(false); }
  }, [rows, week, idx, navigate]);

  if (rows === null) return <div style={{ padding: 20, color: "var(--wl-muted)", fontFamily: "var(--mono)" }}>Cargando…</div>;

  // NOTE: rendered inside AthleteShell's `<main className="ho-scroll">` (child route) — do NOT add
  // another `ho-scroll` wrapper here (the shell already provides scroll padding incl. nav clearance).
  return (
    <div>
      <button type="button" aria-label="volver" onClick={() => navigate("/atleta")} style={{ border: 0, background: "transparent", color: "var(--wl-text)", fontSize: 22, cursor: "pointer", padding: 0, marginBottom: 6 }}>‹</button>
      <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 20, color: "var(--wl-text)" }}>Entreno · sem {week} · día {idx + 1}</div>
      <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)", marginTop: 2 }}>Anotá lo que levantaste. No cambia tu plan.</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
        {rows.map((r, i) => (
          <div key={i} style={{ background: "var(--wl-surface)", borderRadius: 12, padding: "11px 13px", opacity: r.done ? 1 : 0.92 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <input type="checkbox" aria-label={`hecho ${r.movementName}`} checked={r.done} onChange={(e) => patch(i, { done: e.target.checked })} style={{ width: 18, height: 18 }} />
              <span style={{ flex: 1, fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 15, color: "var(--wl-text)" }}>{r.movementName}</span>
              <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)" }}>obj {r.sets}×{r.reps}{r.targetKg != null ? ` · ${r.targetKg}kg` : r.rpe != null ? ` · RPE ${r.rpe}` : ""}</span>
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 9, fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)" }}>
              <input style={num} type="number" inputMode="decimal" aria-label={`kg real de ${r.movementName}`} placeholder="kg" value={r.kg ?? ""} onChange={(e) => patch(i, { kg: e.target.value ? Number(e.target.value) : undefined })} />kg
              <input style={num} type="number" aria-label={`reps reales de ${r.movementName}`} placeholder="reps" value={r.repsActual ?? ""} onChange={(e) => patch(i, { repsActual: e.target.value ? Number(e.target.value) : undefined })} />reps
              <input style={num} type="number" aria-label={`RPE real de ${r.movementName}`} placeholder="RPE" value={r.rpeActual ?? ""} onChange={(e) => patch(i, { rpeActual: e.target.value ? Number(e.target.value) : undefined })} />RPE
            </div>
          </div>
        ))}
        {rows.length === 0 && <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)" }}>No hay sesión para este día.</div>}
      </div>
      {error && <div role="alert" style={{ marginTop: 10, color: "#ff3b46", fontFamily: "var(--mono)", fontSize: 11 }}>{error}</div>}
      {rows.length > 0 && (
        <button type="button" className="wl-btn wl-btn--primary" disabled={busy} onClick={() => void save()} style={{ width: "100%", marginTop: 16, opacity: busy ? 0.6 : 1 }}>
          {busy ? "Guardando…" : "Guardar entreno"}
        </button>
      )}
    </div>
  );
}
```
- [ ] **Step 4: Route** — in `apps/web/src/app/router.tsx`, import `EntrenoScreen` and add a child under the atleta `AthleteShell` route children array: `{ path: "entreno/:week/:idx", element: <EntrenoScreen /> }`.
- [ ] **Step 5:** `pnpm --filter @holy-oly/web test entreno && pnpm --filter @holy-oly/web exec tsc --noEmit` → PASS.
- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat(web): EntrenoScreen — el atleta registra lo real (SP3)"`

---

### Task C3: "Tu semana" card on Hoy

**Files:** Create `apps/web/src/screens/atleta/hoy/SemanaCard.tsx`; modify `apps/web/src/screens/atleta/HomeScreen.tsx`; create `apps/web/src/screens/atleta/__tests__/semana.test.tsx`

- [ ] **Step 1: Failing test** (`semana.test.tsx`)
```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { vi } from "vitest";
import * as me from "../../../data/meClient";
import { SemanaCard } from "../hoy/SemanaCard";

vi.spyOn(me, "getMeSessions").mockResolvedValue([
  { week: 8, sessionIdx: 0, exercises: [{ movementId: "arranque", sets: 5, reps: 2, pct: 80, movementName: "Arranque", targetKg: 64, actual: { done: true } }] },
  { week: 8, sessionIdx: 1, exercises: [{ movementId: "cargada", sets: 5, reps: 2, pct: 80, movementName: "Cargada", targetKg: 80 }] },
] as never);

test("lista los días de la semana y navega al tocar uno", async () => {
  render(
    <MemoryRouter initialEntries={["/atleta"]}>
      <Routes>
        <Route path="/atleta" element={<SemanaCard week={8} />} />
        <Route path="/atleta/entreno/:week/:idx" element={<div>ENTRENO</div>} />
      </Routes>
    </MemoryRouter>,
  );
  expect(await screen.findByText(/Día 1/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Día 2/ }));
  await waitFor(() => expect(screen.getByText("ENTRENO")).toBeInTheDocument());
});
```
- [ ] **Step 2:** `pnpm --filter @holy-oly/web test semana` → FAIL.
- [ ] **Step 3: Implement `SemanaCard.tsx`**
```tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { SessionView } from "@holy-oly/core";
import { getMeSessions } from "../../../data/meClient";

export function SemanaCard({ week }: { week: number }) {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionView[] | null>(null);
  useEffect(() => {
    let on = true;
    getMeSessions(week).then((s) => { if (on) setSessions(s); }).catch(() => { if (on) setSessions([]); });
    return () => { on = false; };
  }, [week]);

  if (!sessions || sessions.length === 0) return null;
  return (
    <section className="ho-card">
      <div className="ho-card__h">Tu semana</div>
      <div className="ho-card__sub">tocá un día para registrar tu entreno</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 10 }}>
        {sessions.map((s) => {
          const total = s.exercises.length;
          const done = s.exercises.filter((e) => e.actual?.done).length;
          const state = done === 0 ? "pendiente" : done === total ? "hecho" : "en curso";
          const dot = state === "hecho" ? "var(--wl-accent)" : state === "en curso" ? "var(--wl-muted)" : "color-mix(in srgb,var(--wl-text) 22%,transparent)";
          return (
            <button key={s.sessionIdx} type="button" onClick={() => navigate(`/atleta/entreno/${week}/${s.sessionIdx}`)}
              style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: 11, border: "1px solid color-mix(in srgb,var(--wl-text) 10%,transparent)", background: "var(--wl-bg)", cursor: "pointer" }}>
              <span style={{ width: 9, height: 9, borderRadius: 99, background: dot, flex: "0 0 auto" }} />
              <span style={{ flex: 1, fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 14, color: "var(--wl-text)" }}>Día {s.sessionIdx + 1}</span>
              <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--wl-muted)" }}>{done}/{total} · {state}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
```
(If `.ho-card`/`.ho-card__h`/`.ho-card__sub` classes don't exist in `atleta.css`, mirror the closest existing card class used by `ConstanciaCard`/`CaminoCard` — match their wrapper styling rather than inventing new CSS.)
- [ ] **Step 4: Wire into `HomeScreen.tsx`** — import `SemanaCard`; render it after `<CaminoCard … />` only when there's a plan: `{plan.plan && <SemanaCard week={plan.plan.currentWeek} />}`.
- [ ] **Step 5:** `pnpm --filter @holy-oly/web test semana && pnpm --filter @holy-oly/web test && pnpm --filter @holy-oly/web exec tsc --noEmit` → green.
- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat(web): tarjeta 'Tu semana' en Hoy → entra a Entreno (SP3)"`

---

## Phase D — Web (coach: prescribed-vs-real)

### Task D1: deviation display in `SessionsSection`

**Files:** Modify `apps/web/src/screens/coach/sessions/SessionsSection.tsx`; modify its test `apps/web/src/screens/coach/__tests__/sessionsSection.test.tsx`

- [ ] **Step 1: Extend the test** — add a case: a `LocalRepository`-backed render where the prescription view exercise carries an `actual`, and assert the real + marker render. Since `SessionsSection` calls `repo.getPrescriptionWeek`, and `LocalRepository` doesn't store actuals, the simplest is a focused render with a stub repo whose `getPrescriptionWeek` returns a `SessionView` with `actual`. Add:
```tsx
test("muestra real vs objetivo cuando hay registro", async () => {
  const repo = new LocalRepository(new MemStorage());
  vi.spyOn(repo, "getPrescriptionWeek").mockResolvedValue([
    { week: 10, sessionIdx: 0, exercises: [{ movementId: "arranque", sets: 6, reps: 1, pct: 88, movementName: "Arranque", targetKg: 70, actual: { done: true, kg: 72 } }] },
  ] as never);
  render(<RepositoryProvider repo={repo}><SessionsSection athleteId="mv" hoyWeek={10} totalWeeks={16} /></RepositoryProvider>);
  expect(await screen.findByText(/real 72/)).toBeInTheDocument();
});
```
(Import `vi` in that test file if not present.)
- [ ] **Step 2:** `pnpm --filter @holy-oly/web test sessionsSection` → FAIL (real not rendered).
- [ ] **Step 3: Implement** — in `SessionsSection.tsx`, import `kgDeviation` from `@holy-oly/core`. In the per-exercise row, after the prescribed `{e.sets}×{e.reps} · {load(...)}`, when `e.actual` exists append the real + marker:
```tsx
{e.actual && (
  <span style={{ color: "var(--wl-accent)" }}>
    {" · real "}{e.actual.kg != null ? `${e.actual.kg} kg` : e.actual.done ? "hecho" : "—"}
    {(() => { const d = kgDeviation(e.targetKg, e.actual.kg); return d === "mas" ? " ↑" : d === "menos" ? " ↓" : d === "igual" ? " =" : ""; })()}
  </span>
)}
```
(Place it inside the existing exercise line so it reads "Movimiento … 6×1 · 70 kg · real 72 kg ↑".)
- [ ] **Step 4:** `pnpm --filter @holy-oly/web test sessionsSection && pnpm --filter @holy-oly/web test && pnpm --filter @holy-oly/web exec tsc --noEmit && pnpm --filter @holy-oly/web exec eslint src && pnpm --filter @holy-oly/web build` → green.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(web): el coach ve prescrito-vs-real en Sesiones (SP3)"`

---

## Phase E — Verify · El Carnicero · Deploy

### Task E1: Full local verification
- [ ] **Step 1:** Run all green:
```bash
pnpm --filter @holy-oly/core test && pnpm --filter @holy-oly/web test && pnpm --filter @holy-oly/api test
pnpm --filter @holy-oly/api verify && pnpm --filter @holy-oly/api e2e
pnpm --filter @holy-oly/core exec tsc --noEmit && pnpm --filter @holy-oly/api exec tsc --noEmit && pnpm --filter @holy-oly/web exec tsc --noEmit
pnpm --filter @holy-oly/web exec eslint src && pnpm --filter @holy-oly/web build
```
- [ ] **Step 2: Prod-bundle sanity** — `pnpm --filter @holy-oly/api build`, then confirm the bundle still inlines core (Grep `apps/api/dist/main.js` for `mergeActuals` present + `@holy-oly/core` import ABSENT). Migration `6_session_actual` applied by `verify`.

### Task E2: El Carnicero domain review (advisory)
- [ ] **Step 1:** Dispatch a `general-purpose` agent carrying the persona (`.claude/agents/el-carnicero.md`) + rulebook (`docs/domain/HOLY-OLY-DOMAIN.md`). Review the SP3 diff. Check: **HR-1** (the athlete sees their OWN plan + actuals — their data — never coach-only gameable figures; no semáforo on the Entreno screen); **kg=truth** (real recorded in kg, discs downstream); **prescrito-vs-real honesty** (no fabricated real; "pendiente" when unrecorded); **read-only prescription** (the athlete cannot mutate the prescription — only writes `SessionActual`); the **autoregulation framing** (real ≠ target is legitimate, not an "error"). Returns CRITICAL/HIGH/coach-decision.
- [ ] **Step 2:** Triage + fix CRITICAL/HIGH (verify each against the rulebook). Re-run affected tests. Commit `fix(sp3): correcciones de dominio El Carnicero`.

### Task E3: Deploy + demo actuals
- [ ] **Step 1: FF + push** — FF `main` to the verified branch HEAD; `git push origin HEAD:main` → Render auto-deploy (migration `6_session_actual` runs via `start:prod`). Poll the Render API (`srv-d8etrvvavr4c73954o4g`, key at `C:\Users\Gamer\Videos\.render-key.txt`, read WITHOUT printing) until `status: live`.
- [ ] **Step 2: Demo actuals (optional but recommended)** — enrich `apps/api/prisma/seed.ts` to add a few `SessionActual` rows for Mara (`mv`) in her current week (some `done` with `actualKg` ≈ target ± a couple kg) so the coach drill-down shows prescribed-vs-real and her Entreno shows recorded days. Re-run the seed against prod using the **documented allow-list dance**: `PATCH /v1/postgres/dpg-d8etnvurnols73amaju0-a` to add the egress IP, `DATABASE_URL=<externalConnectionString>?sslmode=require pnpm --filter @holy-oly/api db:seed` (with `dangerouslyDisableSandbox`), then **restore `ipAllowList:[]`**. Verify the seed locally via `pnpm --filter @holy-oly/api verify` first.
- [ ] **Step 3: Live smoke (Playwright MCP)** — login `mara@holyoly.dev`/`holyoly-demo` → *Hoy* shows "Tu semana" → open a día → Entreno records (kg/reps/RPE) → save → re-open shows it persisted; login `coach@holyoly.dev` → Mara's drill-down → "Sesiones" shows real next to target. Screenshot.
- [ ] **Step 4: Update memory** — append SP3-shipped status to `athlete-app-and-execution-pillar.md` + the `MEMORY.md` pointer (SessionActual; `/me/sessions`+`/me/session`; EntrenoScreen + "Tu semana"; coach prescrito-vs-real; SP4 next = sustitución/ajuste en vivo).

---

## Notes / decisions
- **Per-exercise** actuals (one `SessionActual` per prescribed slot, keyed `athleteId+week+sessionIdx+order`); the view matches by position (order == index).
- `getPrescriptionWeek` serves **both** coach (via `guardAthlete`) and athlete (`/me/sessions` via `requireAthlete`) — same merged view; the athlete reads only their own (scope = `req.athleteId`).
- Athlete is **read-only on the prescription**; only writes `SessionActual`. kg real may differ from target (autoregulation) — surfaced as `↑/↓/=`, not an error.
- Out of scope (documented): per-series, warm-up modeling, in-session substitution (**SP4**), RM update (**SP5**), other macro recipes, "Mi progreso" charts (A2).
