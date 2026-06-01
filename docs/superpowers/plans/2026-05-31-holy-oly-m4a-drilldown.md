# Holy Oly — M4a · Athlete Drill-down (coach view) · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. Continues M1–M3; task numbering picks up at **Task 30**.

**Goal:** Make tapping an athlete on `/coach` open a REAL detail screen (`/coach/a/:id`) — replacing the placeholder — that shows, from the athlete's existing `MonitorSeries`, four monitor charts (ACWR-vs-band, Carga aguda/crónica, Recuperación HRV/FC, IMR-vs-fase) plus the **Palmarés** (medals), all as a thin consumer of `@holy-oly/core` + `useRepository()`.

**Architecture:** Presentational SVG charts in `apps/web/src/ui/charts/` (the `MacroTimeline`/`RiskQuadrant` idiom: viewBox + `--wl-*` chrome + `STATUS` for estado color), wrapped by a shared `ChartCard` + a tiny `linePath` helper (ports the mockup's `ccard`/`lpath`). The `Drilldown` screen builds one async projection from `getAthlete`/`getSeries`/`getMedals` and feeds the charts; the athlete's macro (for IMR phase bands) is looked up in `MACROCYCLES` by `Atleta.macroId` (only seeded for Mara — charts degrade gracefully when absent). M4a is the tangible first slice; **M4b** (Cumplimiento/Peso/Wellness-items charts — need new `MonitorSeries` fields —, the `MacroTimeline` phaseProfile rewrite + Plan seeding, and Asignar-competencia) is a follow-up plan.

**Tech Stack:** (unchanged) pnpm 10, Node 24, TS 5, Vitest + @testing-library/react, Vite 5, React 18, React Router 6.

Reference UI: `_mockup/coach.html` (the `chartACWR`/`chartLoad`/`chartRec`/`chartIMR`/`palmares` functions + `ccard`/`lpath`/`xlabels` helpers). Charts spec: memory `charts-spec`. Design doc §7.

---

## File Structure

**`apps/web/src/ui/charts/` (new charts + a kit):**
- `chartkit.tsx` — `ChartCard` (title/sub/chip(value+state)/svg-children wrapper, ports `.ccard`) + `linePath(pts: [number,number][]): string` (ports `lpath`) + `weekLabels(weeks, yBaseline)` (ports `xlabels`). Pure/presentational.
- `AcwrChart.tsx` (+ test) — ACWR line + 0.8–1.3 safe corridor + 1.3/1.5 dashed thresholds + state dots. Consumes `core.acwr`/`acwrState`.
- `LoadChart.tsx` (+ test) — acute bars + chronic line. Consumes `core.chronic`.
- `RecoveryChart.tsx` (+ test) — HRV + FC-reposo mini-lines vs base ±band.
- `ImrFaseChart.tsx` (+ test) — IMR line + per-phase expected bands (from the macro's `phaseProfile`) using `core.imrStateForWeek`.

**`apps/web/src/screens/coach/` (the screen):**
- `Drilldown.tsx` (+ `__tests__/drilldown.test.tsx`) — the athlete detail screen at `/coach/a/:id`. Replaces `DrilldownPlaceholder` usage.

**`apps/web/src/data/seeds.ts` (modify):** add a few seeded `Medal`s (so Palmarés renders) under a new `SEED_MEDALS`, applied in `LocalRepository.init()`.

**`apps/web/src/data/LocalRepository.ts` (modify):** seed medals in `init()`.

**`apps/web/src/app/router.tsx` (modify):** `/coach/a/:id` → `<Drilldown />` (was `<DrilldownPlaceholder />`). Keep the TS2742 annotation.

---

## Milestone 4a — Athlete Drill-down

### Task 30: Chart kit (`ChartCard` + `linePath` + `weekLabels`)

**Files:** Create `apps/web/src/ui/charts/chartkit.tsx`, `apps/web/src/ui/__tests__/chartkit.test.tsx`

Ports the mockup helpers `ccard`, `lpath`, `xlabels` (coach.html). `ChartCard` wraps `Card` (M2) with a title row + optional estado chip; children are the `<svg>`. `linePath` builds an SVG `d` from points. `weekLabels` returns `<text>` ticks (S1/S6/S12-style) at a baseline.

- [ ] **Step 1: Write the failing test `chartkit.test.tsx`**
```tsx
import { render, screen } from "@testing-library/react";
import { ChartCard, linePath } from "../charts/chartkit";

test("linePath builds an SVG path from points", () => {
  expect(linePath([[0, 10], [10, 20], [20, 5]])).toBe("M0 10 L10 20 L20 5");
});

test("ChartCard renders its title, chip, and svg children", () => {
  const { container } = render(
    <ChartCard title="ACWR" sub="banda 0,8–1,3" chip="1.42" chipState="warn">
      <svg data-testid="kid" />
    </ChartCard>,
  );
  expect(screen.getByText("ACWR")).toBeInTheDocument();
  expect(screen.getByText("1.42")).toBeInTheDocument();
  expect(container.querySelector('[data-testid="kid"]')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify it fails** — `pnpm --filter @holy-oly/web test chartkit` → FAIL (no module).

- [ ] **Step 3: Implement `chartkit.tsx`**
```tsx
import type { ReactNode } from "react";
import { Card } from "../Card";
import { Badge } from "../Badge";
import type { CellState } from "@holy-oly/core";
import { STATUS } from "../status";

/** SVG polyline path "M x y L x y …" from [x,y] points (ports the mockup's lpath). */
export function linePath(pts: [number, number][]): string {
  return pts.map((p, i) => `${i ? "L" : "M"}${p[0]} ${p[1]}`).join(" ");
}

/** Week-axis ticks at a y baseline (S1 / Smid / Slast), ports xlabels. */
export function weekLabels(weeks: number, yB: number, xAt: (w: number) => number): ReactNode {
  const marks = weeks <= 1 ? [1] : [1, Math.ceil(weeks / 2), weeks];
  return marks.map((w) => (
    <text key={w} x={xAt(w)} y={yB} textAnchor="middle" fontSize={8} fontFamily="JetBrains Mono" style={{ fill: "var(--wl-muted)" }}>S{w}</text>
  ));
}

/** Chart card: title + subtitle + optional estado chip, with the chart svg as children. */
export function ChartCard({ title, sub, chip, chipState, children }: {
  title: string; sub?: string; chip?: string; chipState?: CellState; children: ReactNode;
}) {
  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <div style={{ fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 13.5, color: "var(--wl-text)" }}>{title}</div>
        {chip != null && (
          chipState && chipState !== "none"
            ? <Badge tone={chipState}>{chip}</Badge>
            : <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: chipState === "none" ? STATUS.none : "var(--wl-muted)" }}>{chip}</span>
        )}
      </div>
      {sub && <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--wl-muted)", margin: "3px 0 9px" }}>{sub}</div>}
      {children}
    </Card>
  );
}
```

- [ ] **Step 4: Run to verify it passes** — `pnpm --filter @holy-oly/web test chartkit` → PASS.

- [ ] **Step 5: Commit**
```bash
git add apps/web/src/ui/charts/chartkit.tsx apps/web/src/ui/__tests__/chartkit.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): chart kit (ChartCard + linePath + weekLabels)

Shared chart-card wrapper (ports .ccard) + linePath (ports lpath) + weekLabels
(ports xlabels) for the drill-down charts. Presentational; reuses Card/Badge/STATUS.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 31: `AcwrChart` (ACWR vs safe band)

**Files:** Create `apps/web/src/ui/charts/AcwrChart.tsx`, `apps/web/src/ui/__tests__/acwr-chart.test.tsx`

Port `chartACWR` (coach.html): a line of weekly ACWR with a green safe corridor 0.8–1.3, dashed thresholds at 1.3 (warn) and 1.5 (alert), and a colored dot per point via `acwrState`. Compute ACWR with `core.acwr(series.acute)`. Geometry: `viewBox 0 0 300 128`, `top=10, bot=112, lo=0.5, hi=1.7`, `y(v)=top+(1-(v-lo)/(hi-lo))*(bot-top)`, `x(w)=12+(w-1)/(weeks-1)*(300-24)`. Props: `{ series: MonitorSeries }`. Chip = last ACWR `toFixed(2)` with `acwrStateSafe` state. Use `ChartCard` + `linePath`. Title "ACWR", sub "banda segura 0,8–1,3 · el atleta no ve este número".

- [ ] **Step 1: Write the failing test `acwr-chart.test.tsx`**
```tsx
import { render } from "@testing-library/react";
import { AcwrChart } from "../charts/AcwrChart";
import type { MonitorSeries } from "@holy-oly/core";

const s: MonitorSeries = {
  weeks: 12,
  acute: [300, 320, 340, 300, 360, 380, 400, 320, 420, 700, 380, 340],
  hrv: [], hrvBase: 70, rhr: [], rhrBase: 50, imr: [], wellness: [], recovery: [],
};

test("renders an svg with a line path and one dot per week", () => {
  const { container } = render(<AcwrChart series={s} />);
  expect(container.querySelector("svg")).toBeTruthy();
  expect(container.querySelector("path")).toBeTruthy();
  // 12 weeks → 12 dots (circles)
  expect(container.querySelectorAll("circle").length).toBe(12);
});
```

- [ ] **Step 2: Run to verify it fails** — `pnpm --filter @holy-oly/web test acwr-chart` → FAIL.

- [ ] **Step 3: Implement `AcwrChart.tsx`** — port `chartACWR` to JSX. Compute `const a = acwr(series.acute);` (core). For each week `w` (1..weeks), dot at `[x(w), y(a[w-1])]` with `fill: STATUS[acwrStateSafe(a[w-1] ?? NaN)]`. Safe band: a `<rect>` from `y(1.3)` to `y(0.8)` filled `STATUS.ok` opacity .13. Dashed `<line>`s at `y(1.3)` and `y(1.5)`. Line via `linePath(a.map((v,i)=>[x(i+1), y(v)]))`. Wrap in `<ChartCard title="ACWR" sub="banda segura 0,8–1,3 · el atleta no ve este número" chip={a.at(-1)?.toFixed(2)} chipState={acwrStateSafe(a.at(-1) ?? NaN)}>`. Import `acwr, acwrStateSafe, type MonitorSeries` from `@holy-oly/core`; `STATUS` from `../status`; `ChartCard, linePath` from `./chartkit`.

- [ ] **Step 4: Run to verify it passes** — `pnpm --filter @holy-oly/web test acwr-chart` → PASS.

- [ ] **Step 5: Commit**
```bash
git add apps/web/src/ui/charts/AcwrChart.tsx apps/web/src/ui/__tests__/acwr-chart.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): AcwrChart (ACWR vs 0.8–1.3 safe band)

Port of coach.html chartACWR: ACWR line (core.acwr) + green safe corridor +
1.3/1.5 dashed thresholds + per-week state dots (acwrStateSafe). Chip = last ACWR.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 32: `LoadChart` (carga aguda vs crónica)

**Files:** Create `apps/web/src/ui/charts/LoadChart.tsx`, `apps/web/src/ui/__tests__/load-chart.test.tsx`

Port `chartLoad`: weekly `acute` as accent bars + `core.chronic(acute)` as a text-color line overlay. Geometry: `viewBox 0 0 300 120`, `top=10, bot=104, mx=max(acute)*1.1`, `y(v)=top+(1-v/mx)*(bot-top)`, `x(w)` as Task 31, bar width `(300-24)/weeks*0.6`. Props `{ series: MonitorSeries }`. Title "Carga aguda vs crónica", sub "barras = semanal · línea = crónica (4 sem)". Chip = `acute.at(-1)` (no state; plain).

- [ ] **Step 1: Write the failing test `load-chart.test.tsx`**
```tsx
import { render } from "@testing-library/react";
import { LoadChart } from "../charts/LoadChart";
import type { MonitorSeries } from "@holy-oly/core";

const s: MonitorSeries = {
  weeks: 12, acute: [300, 320, 340, 300, 360, 380, 400, 320, 420, 700, 380, 340],
  hrv: [], hrvBase: 70, rhr: [], rhrBase: 50, imr: [], wellness: [], recovery: [],
};

test("renders one bar (rect) per week plus a chronic line", () => {
  const { container } = render(<LoadChart series={s} />);
  // 12 acute bars (rects); the chronic overlay is a <path>
  expect(container.querySelectorAll("rect").length).toBeGreaterThanOrEqual(12);
  expect(container.querySelector("path")).toBeTruthy();
});
```

- [ ] **Step 2: Run to verify it fails** — `pnpm --filter @holy-oly/web test load-chart` → FAIL.

- [ ] **Step 3: Implement `LoadChart.tsx`** — one `<rect>` per week (`fill: var(--wl-accent)`, opacity .45, or .95 for the max week), `<path>` for `chronic(acute)` via `linePath` (`stroke: var(--wl-text)`), `weekLabels`. Wrap in `ChartCard`. Import `chronic, type MonitorSeries` from core; `ChartCard, linePath, weekLabels` from `./chartkit`.

- [ ] **Step 4: Run to verify it passes** — `pnpm --filter @holy-oly/web test load-chart` → PASS.

- [ ] **Step 5: Commit**
```bash
git add apps/web/src/ui/charts/LoadChart.tsx apps/web/src/ui/__tests__/load-chart.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): LoadChart (acute bars + chronic line)

Port of coach.html chartLoad: weekly acute as accent bars + core.chronic
4-week line overlay. Presentational; reuses the chart kit.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 33: `RecoveryChart` (HRV + FC reposo vs base)

**Files:** Create `apps/web/src/ui/charts/RecoveryChart.tsx`, `apps/web/src/ui/__tests__/recovery-chart.test.tsx`

Port `chartRec`: two stacked mini-line charts — HRV (above, green) and RHR (below, cyan `#2dd4e6`) — each with a dashed baseline (`hrvBase`/`rhrBase`) and a green ±band (HRV base±5, RHR base±3). Each mini `viewBox`-shares the 300-wide SVG; mini height ~52, `y(v)` scaled to `[min(arr,base)-pad, max(arr,base)+pad]`. Props `{ series: MonitorSeries }`. Title "Recuperación", sub "HRV ↓ y FC reposo ↑ sostenidos = alerta". (Cycle/luteal overlay is M4b — NOT here; this view is cycle-blind.) Chip = `recoveryState(recoverySeries(series).at(-1))` state with the value.

- [ ] **Step 1: Write the failing test `recovery-chart.test.tsx`**
```tsx
import { render } from "@testing-library/react";
import { RecoveryChart } from "../charts/RecoveryChart";
import type { MonitorSeries } from "@holy-oly/core";

const s: MonitorSeries = {
  weeks: 12, acute: [],
  hrv: [72, 71, 70, 73, 69, 70, 68, 72, 67, 62, 64, 69], hrvBase: 70,
  rhr: [49, 50, 50, 48, 51, 50, 52, 49, 53, 56, 54, 50], rhrBase: 50,
  imr: [], wellness: [], recovery: [],
};

test("renders two mini line charts (hrv + rhr)", () => {
  const { container } = render(<RecoveryChart series={s} />);
  // two line paths (one per mini); baselines may add more
  expect(container.querySelectorAll("path").length).toBeGreaterThanOrEqual(2);
  expect(container.querySelector("svg")).toBeTruthy();
});
```

- [ ] **Step 2: Run to verify it fails** — `pnpm --filter @holy-oly/web test recovery-chart` → FAIL.

- [ ] **Step 3: Implement `RecoveryChart.tsx`** — a small internal `Mini({ arr, base, color, label, pad })` helper rendering a baseline + ±band + the line via `linePath`. Render two minis (HRV green `STATUS.ok`, RHR cyan `#2dd4e6`) in one SVG (stacked) or two small SVGs inside one `ChartCard`. Import `recoverySeries, recoveryState, type MonitorSeries` from core; `ChartCard, linePath` from `./chartkit`; `STATUS` from `../status`.

- [ ] **Step 4: Run to verify it passes** — `pnpm --filter @holy-oly/web test recovery-chart` → PASS.

- [ ] **Step 5: Commit**
```bash
git add apps/web/src/ui/charts/RecoveryChart.tsx apps/web/src/ui/__tests__/recovery-chart.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): RecoveryChart (HRV + FC reposo vs baseline)

Port of coach.html chartRec (cycle-blind for M4a): two mini lines vs dashed
baseline + ±band. Chip = last recovery state. Reuses the chart kit.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 34: `ImrFaseChart` (IMR vs expected phase band)

**Files:** Create `apps/web/src/ui/charts/ImrFaseChart.tsx`, `apps/web/src/ui/__tests__/imr-fase-chart.test.tsx`

Port `chartIMR`: an IMR line with per-phase expected bands derived from the athlete's macro `phaseProfile` (each phase's `weeks:[s,e]` + `imrPct:[lo,hi]`), dashed separators between phases, and a dot per week colored by `core.imrStateForWeek(imr, macro, week)`. Geometry: `viewBox 0 0 300 132`, `top=10, bot=116, lo=60, hi=104`, `y`/`x` as before. Props `{ series: MonitorSeries; macro: Macrocycle }`. Title "IMR vs fase", sub "banda = lo que el programa espera (se mueve por fase)". Chip = `imrStateForWeek(imr.at(-1), macro, weeks)`.

- [ ] **Step 1: Write the failing test `imr-fase-chart.test.tsx`**
```tsx
import { render } from "@testing-library/react";
import { ImrFaseChart } from "../charts/ImrFaseChart";
import { MACROCYCLES, type MonitorSeries } from "@holy-oly/core";

const ruso = MACROCYCLES.find((m) => m.id === "ruso-5d")!;
const s: MonitorSeries = {
  weeks: 12, acute: [], hrv: [], hrvBase: 70, rhr: [], rhrBase: 50,
  imr: [66, 68, 70, 69, 76, 78, 80, 79, 86, 93, 88, 89], wellness: [], recovery: [],
};

test("renders the imr line, one phase band per macro phase, and per-week dots", () => {
  const { container } = render(<ImrFaseChart series={s} macro={ruso} />);
  expect(container.querySelector("path")).toBeTruthy();
  // one expected-band <rect> per phaseProfile entry (ruso-5d has 4)
  expect(container.querySelectorAll("rect").length).toBeGreaterThanOrEqual(ruso.phaseProfile.length);
  expect(container.querySelectorAll("circle").length).toBe(12);
});
```

- [ ] **Step 2: Run to verify it fails** — `pnpm --filter @holy-oly/web test imr-fase-chart` → FAIL.

- [ ] **Step 3: Implement `ImrFaseChart.tsx`** — for each `phase` in `macro.phaseProfile`: a `<rect>` spanning `x(phase.weeks[0])..x(phase.weeks[1])` at `y(phase.imrPct[1])..y(phase.imrPct[0])` (`STATUS.ok` opacity .16) + a dashed separator. IMR line via `linePath(imr.map((v,i)=>[x(i+1), y(v)]))`. Dot per week: `fill: STATUS[imrStateForWeek(imr[w-1], macro, w)]`. Wrap in `ChartCard`. Import `imrStateForWeek, type Macrocycle, type MonitorSeries` from core; kit + STATUS.

- [ ] **Step 4: Run to verify it passes** — `pnpm --filter @holy-oly/web test imr-fase-chart` → PASS.

- [ ] **Step 5: Commit**
```bash
git add apps/web/src/ui/charts/ImrFaseChart.tsx apps/web/src/ui/__tests__/imr-fase-chart.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): ImrFaseChart (IMR vs program phase band)

Port of coach.html chartIMR: IMR line + per-phase expected bands from the
macro's phaseProfile + per-week dots via core.imrStateForWeek. Reuses kit.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 35: Seed medals + `Drilldown` screen (charts + palmarés)

**Files:**
- Modify: `apps/web/src/data/seeds.ts` (add `SEED_MEDALS`), `apps/web/src/data/LocalRepository.ts` (seed them in `init()`)
- Create: `apps/web/src/screens/coach/Drilldown.tsx`, `apps/web/src/screens/coach/__tests__/drilldown.test.tsx`

> The screen is a thin consumer: an effect loads `getAthlete(id)`, `getSeries(id)`, `getMedals(id)` (and `MACROCYCLES.find(m=>m.id===athlete.macroId)` for the macro). Header shows nombre/método/macro+week/estado (`rosterStatus(series)`). Then the 4 charts (skip `ImrFaseChart` when the athlete has no macro). Then **Palmarés**: the medal counts (reuse `Medal`) + a row per medal (comp/date/cat + Arr/Env/Total), or "Sin medallas registradas." when empty. No "add medal"/"asignar competencia" sheets yet (M4b).

- [ ] **Step 1: Add `SEED_MEDALS` to `seeds.ts`** (so Palmarés isn't empty) — Mara gets 2 medals:
```ts
import type { Medal } from "@holy-oly/core"; // extend the existing core import
export const SEED_MEDALS: Record<string, Medal[]> = {
  mv: [
    { comp: "Nacional Absoluto", date: "2026-03", cat: "−81", medal: "oro", sn: 92, cj: 116, place: "1º" },
    { comp: "Apertura Regional", date: "2025-11", cat: "−81", medal: "plata", sn: 88, cj: 110, place: "2º" },
  ],
};
```

- [ ] **Step 2: Seed medals in `LocalRepository.init()`** — inside the `for (const a of SEED_ROSTER)` loop, after seeding series, add:
```ts
const medals = SEED_MEDALS[a.id];
if (medals) this.s.set(KEYS.medals(a.id), medals);
```
(import `SEED_MEDALS` from `./seeds`). Idempotency unchanged (still guarded by `ho:seeded`).

- [ ] **Step 3: Write the failing test `drilldown.test.tsx`**
```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { RepositoryProvider } from "../../../data/RepositoryProvider";
import { LocalRepository } from "../../../data/LocalRepository";
import { Drilldown } from "../Drilldown";

class MemStorage implements Storage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.get(k) ?? null; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  removeItem(k: string) { this.m.delete(k); }
  setItem(k: string, v: string) { this.m.set(k, v); }
}

function renderAt(id: string) {
  const repo = new LocalRepository(new MemStorage());
  return render(
    <RepositoryProvider repo={repo}>
      <MemoryRouter initialEntries={[`/coach/a/${id}`]}>
        <Routes><Route path="/coach/a/:id" element={<Drilldown />} /></Routes>
      </MemoryRouter>
    </RepositoryProvider>,
  );
}

test("shows the athlete header, the monitor charts, and the palmarés medals (Mara)", async () => {
  const { container } = renderAt("mv");
  await waitFor(() => expect(screen.getByText("Mara V.")).toBeInTheDocument());
  expect(screen.getByText("ACWR")).toBeInTheDocument();
  expect(screen.getByText(/Recuperación/)).toBeInTheDocument();
  expect(screen.getByText("IMR vs fase")).toBeInTheDocument(); // Mara has a macro
  expect(screen.getByText(/Palmar/)).toBeInTheDocument();
  expect(screen.getByText("Nacional Absoluto")).toBeInTheDocument();
  // svgs rendered (charts + medals)
  expect(container.querySelectorAll("svg").length).toBeGreaterThan(3);
});

test("no-data athlete (Tomás) shows an empty state, not charts", async () => {
  renderAt("tl");
  await waitFor(() => expect(screen.getByText("Tomás L.")).toBeInTheDocument());
  expect(screen.getByText(/sin datos de monitoreo/i)).toBeInTheDocument();
});
```

- [ ] **Step 4: Run to verify it fails** — `pnpm --filter @holy-oly/web test drilldown` → FAIL (no `Drilldown`).

- [ ] **Step 5: Implement `Drilldown.tsx`**
```tsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useRepository } from "../../data/RepositoryProvider";
import { MACROCYCLES, rosterStatus, type Atleta, type Macrocycle, type Medal, type MonitorSeries } from "@holy-oly/core";
import { ROSTER_META } from "../../data/seeds";
import { AcwrChart } from "../../ui/charts/AcwrChart";
import { LoadChart } from "../../ui/charts/LoadChart";
import { RecoveryChart } from "../../ui/charts/RecoveryChart";
import { ImrFaseChart } from "../../ui/charts/ImrFaseChart";
import { Medal as MedalIcon } from "../../ui/Medal";
import { Badge } from "../../ui/Badge";

export function Drilldown() {
  const { id = "" } = useParams();
  const repo = useRepository();
  const [athlete, setAthlete] = useState<Atleta | undefined>();
  const [series, setSeries] = useState<MonitorSeries | undefined>();
  const [medals, setMedals] = useState<Medal[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let on = true;
    Promise.all([repo.getAthlete(id), repo.getSeries(id), repo.getMedals(id)]).then(([a, s, m]) => {
      if (!on) return;
      setAthlete(a); setSeries(s); setMedals(m); setLoaded(true);
    });
    return () => { on = false; };
  }, [repo, id]);

  if (!loaded) return <div style={{ padding: 24, color: "var(--wl-muted)" }} />;
  if (!athlete) return <div style={{ padding: 24, color: "var(--wl-text)" }}>Atleta no encontrado.</div>;

  const macro: Macrocycle | undefined = athlete.macroId ? MACROCYCLES.find((m) => m.id === athlete.macroId) : undefined;
  const metodo = ROSTER_META[athlete.id]?.metodo ?? "";
  const cell = rosterStatus(series);
  const estadoLabel = cell === "alert" ? "Alerta" : cell === "warn" ? "Vigilar" : cell === "ok" ? "OK" : "Sin datos";
  const counts = { oro: 0, plata: 0, bronce: 0 } as Record<Medal["medal"], number>;
  for (const m of medals) counts[m.medal]++;

  return (
    <div style={{ padding: "14px 13px 26px", color: "var(--wl-text)", background: "var(--wl-bg)", minHeight: "100vh", maxWidth: 390, margin: "0 auto" }}>
      {/* header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div>
          <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 22, lineHeight: 1 }}>{athlete.nombre}</div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--wl-muted)", marginTop: 6 }}>
            {metodo}{macro ? ` · ${macro.duration}` : ""}
          </div>
        </div>
        {cell === "none"
          ? <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-muted)", border: "1px solid color-mix(in srgb,var(--wl-text) 16%,transparent)", padding: "3px 8px", borderRadius: 99 }}>{estadoLabel}</span>
          : <Badge tone={cell}>{estadoLabel}</Badge>}
      </div>

      {/* charts (only when there is a series) */}
      {series ? (
        <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
          <AcwrChart series={series} />
          <LoadChart series={series} />
          <RecoveryChart series={series} />
          {macro && <ImrFaseChart series={series} macro={macro} />}
        </div>
      ) : (
        <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)", margin: "16px 0" }}>
          Este atleta aún no tiene datos de monitoreo. Cuando registre HRV/FC/carga, aparecerán acá.
        </div>
      )}

      {/* palmarés */}
      <div style={{ marginTop: 16, fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 13.5 }}>Palmarés · competencias</div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", margin: "8px 0" }}>
        {(["oro", "plata", "bronce"] as const).map((k) => (
          <span key={k} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <MedalIcon metal={k} size={22} />
            <b style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{counts[k]}</b>
          </span>
        ))}
      </div>
      {medals.length === 0 ? (
        <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-muted)" }}>Sin medallas registradas.</div>
      ) : (
        medals.map((m, i) => (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", padding: "6px 0", borderTop: "1px solid color-mix(in srgb,var(--wl-text) 6%,transparent)" }}>
            <MedalIcon metal={m.medal} size={26} />
            <div>
              <div style={{ fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 12 }}>{m.comp}</div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--wl-muted)" }}>{m.date} · {m.cat} · Arr {m.sn} · Env {m.cj} · Total {m.sn + m.cj}</div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
```

- [ ] **Step 6: Run to verify it passes** — `pnpm --filter @holy-oly/web test drilldown` → PASS (both tests).

- [ ] **Step 7: Commit**
```bash
git add apps/web/src/data/seeds.ts apps/web/src/data/LocalRepository.ts apps/web/src/screens/coach/Drilldown.tsx "apps/web/src/screens/coach/__tests__/drilldown.test.tsx"
git commit -m "$(cat <<'EOF'
feat(web): athlete Drilldown screen (charts + palmarés) + seed medals

/coach/a/:id detail: header (nombre/método/estado via rosterStatus) + the four
monitor charts (ACWR/Load/Recovery + IMR-vs-fase when the athlete has a macro) +
Palmarés (Medal counts + rows). No-data athlete shows an empty state. Seed 2
medals for Mara so Palmarés renders. Thin consumer of useRepository + core.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 36: Route `/coach/a/:id` → `Drilldown` + verify + push M4a

**Files:** Modify `apps/web/src/app/router.tsx`

- [ ] **Step 1: Swap the placeholder for the real screen** — in `router.tsx`, change the `coach/a/:id` child from `<DrilldownPlaceholder />` to `<Drilldown />`, and update the import (`import { Drilldown } from "../screens/coach/Drilldown";` replacing the `DrilldownPlaceholder` import). Keep `/`→Equipo, `/coach`→Equipo, `/gallery`→Gallery, the RepositoryProvider wrap, and the `: ReturnType<typeof createBrowserRouter>` annotation. (You may delete `DrilldownPlaceholder.tsx` or leave it unused — prefer deleting it and its no-longer-needed import.)

- [ ] **Step 2: Typecheck + full test run** — `pnpm --filter @holy-oly/web typecheck && pnpm -r test` → typecheck clean; ALL suites green (core 27 + web: prior 22 + chartkit 2 + acwr 1 + load 1 + recovery 1 + imr-fase 1 + drilldown 2 = 30). Report totals.

- [ ] **Step 3: Visual verify (controller does this)** — `/coach` → tap an athlete (e.g. Mara) → `/coach/a/mv` shows the header + 4 charts + palmarés (2 medals); tap Tomás → empty-state. (The controller runs the dev server + DOM snapshot; do NOT block on a dev server in the implementer.)

- [ ] **Step 4: Commit + push milestone**
```bash
git add apps/web/src/app/router.tsx
git commit -m "$(cat <<'EOF'
feat(web): wire /coach/a/:id to the real Drilldown screen

Replace the M4 placeholder with the Drilldown detail screen. Clicking an athlete
on /coach now opens their charts + palmarés. TS2742 router annotation preserved.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
git push origin main
```
> (Controller note: push = FF merge branch→main, like prior milestones — the implementer commits; the controller does the visual verify + push.)

**M4a done when:** `pnpm -r test` is green; tapping an athlete on `/coach` opens a real `/coach/a/:id` screen with the four monitor charts + palmarés (Mara), and the no-data athlete (Tomás) shows an empty state instead of charts.

---

## Deferred to M4b (follow-up plan)
- Charts needing new `MonitorSeries` fields: **Cumplimiento** (`compliance[]`+`rpe[]`), **Peso vs categoría** (`bodyweight[]`+`weightBand`), **Bienestar ítems** (the 6 `witems` sparklines). → extend `MonitorSeries` + seeds first.
- **MacroTimeline reuse** for the macro chart in the drill-down: needs the phaseProfile-driven rewrite (it's hardcoded 16-week) + `Plan`/`macroId` seeding for the other 7 athletes (today only Mara has a macro).
- **Asignar competencia** sheet (`getComps`/`setComps` + `restructure`) + **Añadir medalla** sheet (`addMedal`).
- **Cycle/luteal overlay** on Recovery/IMR when `getCycleContext` is `full` (needs the real `inLutealNow`).
- Hardening from the M3 final review: enforce the `MonitorSeries` length-invariant + finiteness-guard `rec` in `roster.ts` (add a ragged-series test).

## Self-review notes
- **Spec coverage (M4a scope):** the 4 charts buildable from the current `MonitorSeries` (ACWR/Load/Recovery/IMR-fase) + Palmarés + the screen + routing are each a task (30–36). The other 4 charts + sheets are explicitly deferred to M4b (they need data/refactors not in scope) — consistent with delivering a tangible screen now.
- **Type consistency:** `MonitorSeries`/`Macrocycle`/`Medal`/`CellState`/`Atleta` names match core; `acwr`/`acwrStateSafe`/`chronic`/`recoverySeries`/`recoveryState`/`imrStateForWeek`/`rosterStatus`/`MACROCYCLES` are all existing core exports (verified in M3). `ChartCard`/`linePath`/`weekLabels` (Task 30) are consumed by Tasks 31–34. `Drilldown` (Task 35) is routed in Task 36.
- **Grounded:** charts port the named `_mockup/coach.html` functions with the geometry mapped from the source; tests are smoke + structural (svg/path/rect/circle counts + key text), with full visual verification at Task 36 (the screen).
- **No placeholders:** every task has a verbatim failing test + concrete implementation (the chart-port tasks give the exact geometry + which core fn + reuse the kit, mirroring the M3 Medal/MacroTimeline port tasks; the screen + router tasks are fully verbatim).
