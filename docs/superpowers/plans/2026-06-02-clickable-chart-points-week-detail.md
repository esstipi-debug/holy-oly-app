# Puntos clickeables → panel de semana editable · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clickear un punto (= una semana) en cualquiera de las 7 charts de señal del drill-down abre un `BottomSheet` con el cross-section de esa semana (valor-vs-banda + carga↔recuperación + adherencia editable + fecha + taper).

**Architecture:** Las charts ganan zonas de tap por semana (`WeekTapZones`) que emiten `onPointClick(week)`. El `Drilldown` (container) abre un `WeekDetailSheet` compartido, deriva el cross-section con un util puro `weekSignals`, y **reusa la ruta de escritura ya existente** (`onToggleSession`/`applyToggle`/`setSessionLog` con optimistic+rollback) para la adherencia editable.

**Tech Stack:** React 18 + Vite + TS; vitest + @testing-library/react; `@holy-oly/core` (estados de dominio).

> **Commits:** `[GATED]` — sólo con OK del usuario (default: commit final + push a main = deploy).

> **Ajustes al spec (notados durante grounding):** (a) son **7** charts de señal en el drill-down (Acwr/Load/Recovery/Imr/Wellness/Comp/Weight), no 6 — `CompChart` también; (b) `weekSignals` va en **web** (`apps/web/src/ui/charts/weekSignals.ts`), no en core: lleva labels en español (UI); los estados de dominio ya viven en core y se importan. (c) La adherencia editable **ya existe** en `Drilldown` (`onToggleSession`, líneas 79-89) → se reusa, no se reimplementa.

---

## File Structure

| Archivo | Crea/Modifica | Responsabilidad |
|---------|---------------|-----------------|
| `apps/web/src/ui/charts/weekSignals.ts` | Crear | Util puro: cross-section de la semana `w` → filas `{label, value, state?, hasData}` (sin-dato → hasData:false). |
| `apps/web/src/ui/charts/weekSignals.test.ts` | Crear | Tests del util. |
| `apps/web/src/ui/charts/chartkit.tsx` | Modifica | + `WeekTapZones` (rects transparentes por semana). |
| `apps/web/src/ui/__tests__/chartkit.test.tsx` | Modifica | + test de `WeekTapZones`. |
| `apps/web/src/ui/charts/{AcwrChart,LoadChart,ImrFaseChart,RecoveryChart,WeightChart,CompChart,WellnessChart}.tsx` | Modifica | + prop `onPointClick?` + render `WeekTapZones`. |
| `apps/web/src/ui/charts/WeekDetailSheet.tsx` | Crear | Panel de semana (cross-section + adherencia 1-semana + fecha + taper) en `BottomSheet`. |
| `apps/web/src/ui/charts/__tests__/WeekDetailSheet.test.tsx` | Crear | Tests del sheet. |
| `apps/web/src/screens/coach/Drilldown.tsx` | Modifica | `selectedWeek` + pasar `onPointClick` a las 7 charts + render del sheet (reusa `onToggleSession`). |

Reusados sin tocar: `apps/web/src/screens/coach/sessions/sessionLog.ts` (`markFor`, `weekDone`), `BottomSheet`, core (`acwr`, `acwrStateSafe`, `recoverySeries`, `recoveryState`, `imrStateForWeekSafe`, `weightBandState`, `dateOfWeek`, `isTaperWeek`, `sessionsPerWeek`).

---

## Task 1: `weekSignals` util (cross-section) — TDD

**Files:**
- Create: `apps/web/src/ui/charts/weekSignals.ts`
- Test: `apps/web/src/ui/charts/weekSignals.test.ts`

- [ ] **Step 1: Test que falla**

```ts
import { weekSignals } from "./weekSignals";
import { MACROCYCLES } from "@holy-oly/core";
import type { MonitorSeries } from "@holy-oly/core";

const s: MonitorSeries = {
  weeks: 3,
  acute: [300, 700, 340],
  hrv: [70, 62, 69], hrvBase: 70,
  rhr: [50, 56, 50], rhrBase: 50,
  imr: [70, 93, 88],
  wellness: [80, 58, 70],
  recovery: [82, 40, 71],
  compliance: [90, 60, 100], rpe: [7, 9, 7],
  bodyweight: [80.5, 81.4, 80.2], weightBand: [80, 81],
};

test("weekSignals: arma el cross-section de la semana con estado vs banda", () => {
  const rows = weekSignals(s, MACROCYCLES[0], 2);
  const acwr = rows.find((r) => r.label === "ACWR")!;
  expect(acwr.hasData).toBe(true);
  expect(acwr.state).toBe("alert"); // semana 2 = pico
  const peso = rows.find((r) => r.label === "Peso")!;
  expect(peso.state).toBe("alert"); // 81.4 fuera de [80,81]
});

test("weekSignals: dato faltante → hasData:false, sin estado (nunca falso-verde)", () => {
  const empty: MonitorSeries = { ...s, bodyweight: undefined, weightBand: undefined };
  const peso = weekSignals(empty, MACROCYCLES[0], 2).find((r) => r.label === "Peso")!;
  expect(peso.hasData).toBe(false);
  expect(peso.state).toBeUndefined();
  expect(peso.value).toBe("—");
});
```

- [ ] **Step 2: Verificar que falla** — Run: `pnpm --filter @holy-oly/web test weekSignals`
Expected: FAIL (módulo no existe).

- [ ] **Step 3: Implementar** — `apps/web/src/ui/charts/weekSignals.ts`:

```ts
import {
  acwr, acwrStateSafe, recoverySeries, recoveryState,
  imrStateForWeekSafe, weightBandState,
  type CellState, type Macrocycle, type MonitorSeries,
} from "@holy-oly/core";

export interface WeekSignal {
  label: string;
  value: string;          // valor formateado, o "—" sin dato
  hasData: boolean;
  state?: CellState;       // sólo señales con banda (ACWR/recuperación/IMR/peso)
}

const fin = (v: number | undefined): number | undefined =>
  v != null && Number.isFinite(v) ? v : undefined;

function row(label: string, v: number | undefined, fmt: (n: number) => string, state?: CellState): WeekSignal {
  return v != null
    ? { label, value: fmt(v), hasData: true, state }
    : { label, value: "—", hasData: false };
}

/** Cross-section de todas las señales semanales para la semana `week` (1-based).
 *  Faltante/NaN → hasData:false ("sin dato"), sin estado — jamás un valor inventado ni falso-verde. */
export function weekSignals(series: MonitorSeries, macro: Macrocycle | undefined, week: number): WeekSignal[] {
  const i = week - 1;
  const acwrV = fin(acwr(series.acute)[i]);
  const recV = fin(recoverySeries(series)[i]);
  const imrV = fin(series.imr[i]);
  const wtV = fin(series.bodyweight?.[i]);
  return [
    row("ACWR", acwrV, (n) => n.toFixed(2), acwrV != null ? acwrStateSafe(acwrV) : undefined),
    row("Carga aguda", fin(series.acute[i]), (n) => String(Math.round(n))),
    row("Recuperación", recV, (n) => String(Math.round(n)), recV != null ? recoveryState(recV) : undefined),
    row("IMR", imrV, (n) => String(Math.round(n)), imrV != null && macro ? imrStateForWeekSafe(imrV, macro, week) : undefined),
    row("Bienestar", fin(series.wellness[i]), (n) => String(Math.round(n))),
    row("Cumplimiento", fin(series.compliance?.[i]), (n) => `${Math.round(n)}%`),
    row("Peso", wtV, (n) => `${n} kg`, wtV != null ? weightBandState(wtV, series.weightBand) : undefined),
  ];
}
```

- [ ] **Step 4: Verificar que pasa** — Run: `pnpm --filter @holy-oly/web test weekSignals`
Expected: PASS.

---

## Task 2: `WeekTapZones` + `onPointClick` en las 7 charts

**Files:**
- Modify: `apps/web/src/ui/charts/chartkit.tsx`, `apps/web/src/ui/__tests__/chartkit.test.tsx`
- Modify: las 7 charts.

- [ ] **Step 1: Test del tap-zone** — agregá a `chartkit.test.tsx`:

```tsx
import { WeekTapZones } from "../charts/chartkit";
// ...
test("WeekTapZones: un tap en una zona llama onPick con la semana", () => {
  const picks: number[] = [];
  const x = (w: number) => 12 + (w - 1) * 50;
  const { container } = render(
    <svg viewBox="0 0 300 100"><WeekTapZones weeks={3} x={x} top={0} bot={100} onPick={(w) => picks.push(w)} /></svg>,
  );
  const rects = container.querySelectorAll('rect[data-week]');
  expect(rects.length).toBe(3);
  fireEvent.click(rects[1]!); // semana 2
  expect(picks).toEqual([2]);
});
```

- [ ] **Step 2: Verificar que falla** — Run: `pnpm --filter @holy-oly/web test chartkit`
Expected: FAIL (`WeekTapZones` no existe).

- [ ] **Step 3: Implementar `WeekTapZones`** — agregá a `chartkit.tsx` (después de `weekLabels`):

```tsx
/** Zonas de tap transparentes, una por semana, sobre el plot. Hit-target grande (mobile);
 *  funciona para charts de puntos y de líneas. Emite onPick(week). */
export function WeekTapZones({ weeks, x, top, bot, onPick }: {
  weeks: number; x: (w: number) => number; top: number; bot: number; onPick: (week: number) => void;
}) {
  if (weeks < 1) return null;
  const half = weeks > 1 ? (x(2) - x(1)) / 2 : 150;
  return (
    <>
      {Array.from({ length: weeks }, (_, i) => {
        const w = i + 1;
        return (
          <rect
            key={w}
            data-week={w}
            x={x(w) - half}
            y={top}
            width={half * 2}
            height={bot - top}
            fill="transparent"
            style={{ cursor: "pointer" } as React.CSSProperties}
            onClick={() => onPick(w)}
          />
        );
      })}
    </>
  );
}
```

- [ ] **Step 4: Verificar que pasa** — Run: `pnpm --filter @holy-oly/web test chartkit`
Expected: PASS.

- [ ] **Step 5: Threadear `onPointClick` en las 7 charts.** En cada una: (1) sumá `onPointClick?: (week: number) => void` a las props; (2) al **final del `<svg>` principal** (último hijo, para que quede encima), agregá `{onPointClick && <WeekTapZones weeks={weeks} x={x} top={TOP} bot={BOT} onPick={onPointClick} />}` con los dims de cada chart; (3) importá `WeekTapZones` de `./chartkit`.

Dims por chart (TOP/BOT = los del plot ya definidos en cada archivo):

| Chart | TOP | BOT | Nota |
|---|---|---|---|
| `AcwrChart` | 10 | 112 | `bot = H-16` |
| `LoadChart` | 10 | 104 | |
| `ImrFaseChart` | 10 | 116 | |
| `WeightChart` | 10 | 94 | |
| `CompChart` | 10 | 104 | |
| `WellnessChart` | 10 | 80 | en el `<svg>` del score (no en los sparklines) |
| `RecoveryChart` | 8 | 46 | thread `onPointClick` al sub-componente `Mini`; renderá `WeekTapZones` en el `<svg>` del mini con `weeks={arr.length}` y el `x` del mini. Sólo hace falta en uno (basta el mini de HRV). |

> Cada chart ya define su `x(w)` y `weeks` localmente — reusarlos. Para `WellnessChart`/`RecoveryChart` el `x`/`weeks` es el del sub-plot correspondiente.

- [ ] **Step 6: Verificar** — Run: `pnpm --filter @holy-oly/web exec tsc --noEmit && pnpm --filter @holy-oly/web test`
Expected: tsc verde, tests verdes (las charts compilan con la prop opcional; nada se rompe porque `onPointClick` es opcional).

---

## Task 3: `WeekDetailSheet` — TDD

**Files:**
- Create: `apps/web/src/ui/charts/WeekDetailSheet.tsx`
- Test: `apps/web/src/ui/charts/__tests__/WeekDetailSheet.test.tsx`

- [ ] **Step 1: Test que falla**

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { WeekDetailSheet } from "../WeekDetailSheet";
import type { WeekSignal } from "../weekSignals";

const signals: WeekSignal[] = [
  { label: "ACWR", value: "1.42", hasData: true, state: "alert" },
  { label: "Peso", value: "—", hasData: false },
];

test("WeekDetailSheet: muestra semana, fecha, señales y 'sin dato'", () => {
  render(<WeekDetailSheet open week={2} dateISO="2026-03-09" isTaper={false} signals={signals}
    perWeek={0} marks={[]} onToggle={() => {}} onClose={() => {}} />);
  expect(screen.getByText(/Semana 2/)).toBeInTheDocument();
  expect(screen.getByText("2026-03-09")).toBeInTheDocument();
  expect(screen.getByText("1.42")).toBeInTheDocument();
  expect(screen.getByText("Peso")).toBeInTheDocument();
  expect(screen.getByText("sin dato")).toBeInTheDocument();
});

test("WeekDetailSheet: el toggle de adherencia llama onToggle(week, idx)", () => {
  const calls: [number, number][] = [];
  render(<WeekDetailSheet open week={2} dateISO="2026-03-09" isTaper={false} signals={signals}
    perWeek={3} marks={[]} onToggle={(w, i) => calls.push([w, i])} onClose={() => {}} />);
  fireEvent.click(screen.getByLabelText(/sesión 1/i));
  expect(calls).toEqual([[2, 0]]);
});
```

- [ ] **Step 2: Verificar que falla** — Run: `pnpm --filter @holy-oly/web test WeekDetailSheet`
Expected: FAIL (no existe).

- [ ] **Step 3: Implementar** — `apps/web/src/ui/charts/WeekDetailSheet.tsx`:

```tsx
import type { CSSProperties } from "react";
import type { SessionLog, SessionStatus } from "@holy-oly/core";
import { BottomSheet } from "../BottomSheet";
import { Badge } from "../Badge";
import { STATUS } from "../status";
import { markFor, weekDone } from "../../screens/coach/sessions/sessionLog";
import type { WeekSignal } from "./weekSignals";

const GLYPH: Record<SessionStatus, string> = { done: "✓", missed: "✗" };
const TINT: Record<SessionStatus, string> = { done: "#34d058", missed: "#ff5e5e" };
function cell(status: SessionStatus | undefined): CSSProperties {
  return {
    width: 26, height: 26, flex: "0 0 auto", borderRadius: 6, cursor: "pointer", padding: 0,
    fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 13, lineHeight: 1,
    color: status ? TINT[status] : "var(--wl-muted)",
    background: status ? `color-mix(in srgb,${TINT[status]} 18%,transparent)` : "transparent",
    border: `1px solid ${status ? `color-mix(in srgb,${TINT[status]} 55%,transparent)` : "color-mix(in srgb,var(--wl-text) 16%,transparent)"}`,
  };
}

export function WeekDetailSheet({ open, onClose, week, dateISO, isTaper, signals, perWeek, marks, onToggle }: {
  open: boolean; onClose: () => void;
  week: number; dateISO: string; isTaper: boolean;
  signals: WeekSignal[];
  perWeek: number; marks: SessionLog; onToggle: (week: number, idx: number) => void;
}) {
  return (
    <BottomSheet open={open} onClose={onClose}>
      <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 16, color: "var(--wl-text)" }}>
        Semana {week} {isTaper && <span style={{ color: STATUS.alert }}>· 🚩 taper</span>}
      </div>
      <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)", marginBottom: 12 }}>{dateISO}</div>

      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {signals.map((s) => (
          <div key={s.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, borderTop: "1px solid color-mix(in srgb,var(--wl-text) 7%,transparent)", paddingTop: 7 }}>
            <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--wl-muted)" }}>{s.label}</span>
            {!s.hasData
              ? <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: STATUS.none }}>sin dato</span>
              : s.state && s.state !== "none"
                ? <Badge tone={s.state}>{s.value}</Badge>
                : <span style={{ fontFamily: "var(--mono)", fontSize: 12.5, color: "var(--wl-text)" }}>{s.value}</span>}
          </div>
        ))}
      </div>

      {perWeek > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 13 }}>Adherencia</span>
            <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-muted)" }}>{weekDone(marks, week)}/{perWeek} · tocá · → ✓ → ✗</span>
          </div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8 }}>
            {Array.from({ length: perWeek }, (_, idx) => {
              const st = markFor(marks, week, idx);
              return (
                <button key={idx} type="button" onClick={() => onToggle(week, idx)} style={cell(st)}
                  aria-label={`semana ${week} sesión ${idx + 1}: ${st === "done" ? "entrenó" : st === "missed" ? "no entrenó" : "pendiente"}`}>
                  {st ? GLYPH[st] : ""}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </BottomSheet>
  );
}
```

- [ ] **Step 4: Verificar que pasa** — Run: `pnpm --filter @holy-oly/web test WeekDetailSheet`
Expected: PASS (2 tests).

---

## Task 4: Wire en `Drilldown`

**Files:**
- Modify: `apps/web/src/screens/coach/Drilldown.tsx`

- [ ] **Step 1: Imports.** En el import de `@holy-oly/core` (línea 4) sumá `dateOfWeek, isTaperWeek`. Sumá los imports de `weekSignals` y `WeekDetailSheet`:
```tsx
import { weekSignals } from "../../ui/charts/weekSignals";
import { WeekDetailSheet } from "../../ui/charts/WeekDetailSheet";
```

- [ ] **Step 2: Estado.** Junto a los otros `useState` (≈línea 33) agregá:
```tsx
const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
```

- [ ] **Step 3: Pasar `onPointClick` a las 7 charts.** En el bloque `series ? (...)` (líneas 124-130), agregá `onPointClick={setSelectedWeek}` a cada una de: `AcwrChart`, `LoadChart`, `RecoveryChart`, `ImrFaseChart`, `WellnessChart`, `CompChart`, `WeightChart`. (No a `MacroTimeline`.) Ej:
```tsx
<AcwrChart series={series} onPointClick={setSelectedWeek} />
```

- [ ] **Step 4: Render del sheet.** Antes del cierre del `</div>` raíz (junto a `<MedalSheet…>`/`<CompSheet…>`, ≈línea 179), agregá:
```tsx
{series && selectedWeek != null && (
  <WeekDetailSheet
    open
    onClose={() => setSelectedWeek(null)}
    week={selectedWeek}
    dateISO={dateOfWeek(startDate, selectedWeek)}
    isTaper={isTaperWeek(selectedWeek, comps)}
    signals={weekSignals(series, macro, selectedWeek)}
    perWeek={perWeek}
    marks={sessionLog}
    onToggle={(w, i) => void onToggleSession(w, i)}
  />
)}
```
> Reusa `onToggleSession` (con su optimistic+rollback+error ya existentes), `startDate`, `comps`, `perWeek`, `sessionLog`, `macro` — todo ya está en scope.

- [ ] **Step 5: Verificación completa** — Run:
```bash
pnpm --filter @holy-oly/web test && pnpm --filter @holy-oly/web exec tsc --noEmit && pnpm --filter @holy-oly/web exec eslint src && pnpm --filter @holy-oly/web build
```
Expected: todo verde (tests previos + los nuevos de weekSignals/WeekTapZones/WeekDetailSheet; tsc/eslint/build limpios).

- [ ] **Step 6: `[GATED]` Commit**
```bash
git add apps/web docs/superpowers/specs/2026-06-02-clickable-chart-points-week-detail-design.md docs/superpowers/plans/2026-06-02-clickable-chart-points-week-detail.md
git commit -m "feat(web): puntos clickeables → panel de semana (cross-section + adherencia editable)"
```

---

## Task 5: Review de El Carnicero

- [ ] **Step 1: Dispatch** (rol-adoptado en esta sesión, o `subagent_type: el-carnicero` en sesión nueva). Prompt: *"Revisá el diff `git diff` contra el rulebook. Foco: (1) el panel de semana respeta valor-vs-banda (no número pelado) y la disciplina de sin-dato ('sin dato', nunca falso-verde); (2) escritura de adherencia por `Repository` con manejo de error; (3) privacidad — el panel NO trae dato de ciclo; (4) granularidad semanal correcta."*
Expected: sin CRITICAL/HIGH. Si marca algo real, arreglar + re-verificar (Task 4 Step 5).

---

## Task 6: `[GATED]` Cierre
- [ ] Con OK del usuario: `git push origin claude/loving-fermat-8c0b1d:main` (deploy) + confirmar deploy live (Render API).

---

## Self-Review

**1. Spec coverage:**
- §3 `weekSignals` → Task 1. ✓ (movido a web — ajuste notado)
- §3 `WeekTapZones` + onPointClick en charts → Task 2. ✓ (7 charts — ajuste notado)
- §3 `WeekDetailSheet` → Task 3. ✓
- §4 adherencia editable + setSessionLog + error handling → reusa `onToggleSession` existente (Task 4 Step 4). ✓
- §3 wiring en Drilldown (selectedWeek + sheet + date + taper) → Task 4. ✓
- §5 privacidad (sólo MonitorSeries + sessionLog) → `weekSignals` no toca ciclo; review Task 5. ✓
- §6 verificación (TDD + El Carnicero) → Tasks 1-5. ✓
- §7 fuera de scope (sesión real, charts no-señal) → sin tasks. ✓

**2. Placeholder scan:** Código completo en cada Task (weekSignals, WeekTapZones, WeekDetailSheet enteros; per-chart con dims exactos; Drilldown con los 4 puntos de edición). Sin "TBD".

**3. Type consistency:** `WeekSignal {label,value,hasData,state?}` definido en Task 1, usado idéntico en Task 3 + Task 4. `WeekTapZones({weeks,x,top,bot,onPick})` def Task 2 ↔ uso Task 2 Step 5. `onPointClick?:(week:number)=>void` consistente charts↔Drilldown. `onToggle(week,idx)`/`markFor`/`weekDone` = firmas reales de `sessionLog.ts`. `dateOfWeek`/`isTaperWeek`/`sessionsPerWeek` = exports reales de core. ✓

---

## Execution Handoff (ver pasos al final del skill)
