# Calendario del plan (lista de semanas plegable) · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una sección **plegable** en el drill-down del atleta que lista las semanas del macro ancladas a fechas reales (Sem N + rango + chip de fase + adherencia + 🚩 comp + HOY); tocar una semana abre el `WeekDetailSheet` que ya existe.

**Architecture:** Builder puro (`planWeeks`) arma las filas-semana desde el plan (`dateOfWeek`/`phaseForWeek`/`isTaperWeek`/`weekDone`); el componente `PlanCalendar` (presentacional, colapsable) las rendea y emite `onWeekClick(week)`; el `Drilldown` (container) lo cablea a su `setSelectedWeek` ya existente → reusa el `WeekDetailSheet` sin wiring nuevo. La paleta neutra de fases se extrae a `phasePalette` y se comparte con `MacroTimeline`.

**Tech Stack:** React 18 + Vite + TS; vitest + @testing-library/react; `@holy-oly/core` (date logic + dominio).

> **Commits:** `[GATED]` — sólo con OK del usuario (default: commit final + push a main = deploy).

> **Prerequisito:** si el worktree no tiene `node_modules`, correr `pnpm install` (~6s) antes de los tests.

> **Ajustes al spec (notados durante grounding):** (a) "cero wiring" CONFIRMADO — `Drilldown.tsx:37` ya tiene `selectedWeek` y rendea el sheet (183-195); (b) la paleta neutra (`RAMP`) vive local en `MacroTimeline:14` → se extrae a `phasePalette` (DRY) y `MacroTimeline` la importa; (c) `core.phaseForWeek` ya existe → se reusa (no se reimplementa `phaseAt`); (d) `weekSignals` hoy exige `series` → se hace opcional para abrir el sheet en atletas con plan pero sin monitoreo (§4 del spec).

---

## File Structure

| Archivo | Crea/Modifica | Responsabilidad |
|---------|---------------|-----------------|
| `apps/web/src/ui/charts/phasePalette.ts` | Crear | Paleta NEUTRA de fases: `PHASE_RAMP` + `phaseColor(i)`. Compartida `MacroTimeline` + `PlanCalendar`. |
| `apps/web/src/ui/charts/__tests__/phasePalette.test.ts` | Crear | Test del helper de paleta. |
| `apps/web/src/ui/charts/MacroTimeline.tsx` | Modifica | Importa `phaseColor` (reemplaza `RAMP` local). |
| `apps/web/src/screens/coach/calendar/planRows.ts` | Crear | Puro: `PlanWeekRow`, `planWeeks(...)`, `weekRangeLabel(...)`. |
| `apps/web/src/screens/coach/calendar/planRows.test.ts` | Crear | Tests del builder puro. |
| `apps/web/src/screens/coach/calendar/PlanCalendar.tsx` | Crear | Componente plegable: filas-semana tappables. |
| `apps/web/src/screens/coach/calendar/PlanCalendar.test.tsx` | Crear | Render tests del componente. |
| `apps/web/src/ui/charts/weekSignals.ts` | Modifica | `series` opcional → 7 "sin dato" cuando no hay serie. |
| `apps/web/src/ui/charts/weekSignals.test.ts` | Modifica | + caso `series` undefined. |
| `apps/web/src/screens/coach/Drilldown.tsx` | Modifica | `hoyWeek` + sección `PlanCalendar` + abrir sheet sin serie. |

Reusados sin tocar: core (`dateOfWeek`, `weekOfDate`, `phaseForWeek`, `isTaperWeek`, `sessionsPerWeek`), `sessionLog.ts` (`weekDone`), `WeekDetailSheet`, `SessionAdherence`, `comps`/`sessionLog`/`startDate`/`perWeek`/`macro` (ya en scope del `Drilldown`).

---

## Task 1: `phasePalette` (DRY de la paleta de fases) — TDD

**Files:**
- Create: `apps/web/src/ui/charts/phasePalette.ts`
- Test: `apps/web/src/ui/charts/__tests__/phasePalette.test.ts`
- Modify: `apps/web/src/ui/charts/MacroTimeline.tsx`

- [ ] **Step 1: Test que falla** — `apps/web/src/ui/charts/__tests__/phasePalette.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { PHASE_RAMP, phaseColor } from "../phasePalette";

describe("phasePalette", () => {
  it("phaseColor: color por orden de fase (0-based)", () => {
    expect(phaseColor(0)).toBe(PHASE_RAMP[0]);
    expect(phaseColor(1)).toBe(PHASE_RAMP[1]);
  });
  it("phaseColor: envuelve con modulo si hay más fases que colores", () => {
    expect(phaseColor(PHASE_RAMP.length)).toBe(PHASE_RAMP[0]);
  });
  it("phaseColor: índice inválido (-1, sin fase) → primer color, sin crashear", () => {
    expect(phaseColor(-1)).toBe(PHASE_RAMP[0]);
  });
});
```

- [ ] **Step 2: Verificar que falla** — Run: `pnpm --filter @holy-oly/web test phasePalette`
Expected: FAIL (módulo no existe).

- [ ] **Step 3: Implementar** — `apps/web/src/ui/charts/phasePalette.ts`:

```ts
/** Paleta NEUTRA de fases (categórica, NO semáforo — no colisiona con STATUS verde/amarillo/rojo).
 *  El color de una fase es decisión de render (`phaseProfile` no trae color); se asigna por ORDEN
 *  de la fase en el perfil. Compartida por MacroTimeline (cinta) y PlanCalendar (chips). */
export const PHASE_RAMP = ["#6f86ff", "#22b8cf", "#a78bfa", "#94a3b8"];

/** Color neutro de la fase número `i` (0-based, índice en `macro.phaseProfile`). `i<0` → primer color. */
export function phaseColor(i: number): string {
  return PHASE_RAMP[Math.max(0, i) % PHASE_RAMP.length]!;
}
```

- [ ] **Step 4: Verificar que pasa** — Run: `pnpm --filter @holy-oly/web test phasePalette`
Expected: PASS (3 tests).

- [ ] **Step 5: Refactor `MacroTimeline` para reusar `phaseColor`.** En `apps/web/src/ui/charts/MacroTimeline.tsx`:
  - En el bloque de imports (después de la línea 2 `import { ChartCard } from "./chartkit";`) agregá:
```tsx
import { phaseColor } from "./phasePalette";
```
  - Borrá el comentario + const local (líneas 12-14):
```tsx
// Paleta neutra de fases (categórica, NO semáforo — no colisiona con STATUS verde/amarillo/rojo).
// phaseProfile no trae color — es decisión de render, no dato.
const RAMP = ["#6f86ff", "#22b8cf", "#a78bfa", "#94a3b8"];
```
  - En la creación del ribbon (≈línea 61) reemplazá `RAMP[i % RAMP.length]` por `phaseColor(i)`:
```tsx
        <rect x={x0} y={10} width={Math.max(0, x1 - x0 - 2)} height={20} rx={4}
          style={{ fill: phaseColor(i), opacity: 0.85 }} />
```

- [ ] **Step 6: Verificar** — Run: `pnpm --filter @holy-oly/web test macro-timeline && pnpm --filter @holy-oly/web exec tsc --noEmit`
Expected: PASS (los tests de `MacroTimeline` siguen verdes — chequean nombres de fase y render, no el nombre del const), tsc limpio.

---

## Task 2: `planRows.ts` (builder puro + rango de fechas) — TDD

**Files:**
- Create: `apps/web/src/screens/coach/calendar/planRows.ts`
- Test: `apps/web/src/screens/coach/calendar/planRows.test.ts`

- [ ] **Step 1: Test que falla** — `apps/web/src/screens/coach/calendar/planRows.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { planWeeks, weekRangeLabel } from "./planRows";
import { MACROCYCLES } from "@holy-oly/core";
import type { Competencia, SessionLog } from "@holy-oly/core";

const macro = MACROCYCLES.find((m) => m.id === "coreano-5d")!; // 12 sem · 3 fases
const start = "2026-03-02"; // lunes

describe("weekRangeLabel", () => {
  it("rango dentro del mismo mes", () => {
    expect(weekRangeLabel(start, 1)).toBe("2–8 mar");
  });
  it("rango que cruza de mes", () => {
    expect(weekRangeLabel(start, 5)).toBe("30 mar–5 abr");
  });
});

describe("planWeeks", () => {
  it("una fila por semana, con HOY, comp, fase y adherencia", () => {
    const comps: Competencia[] = [{ name: "Nacional", week: 9, date: "2026-04-27" }];
    const marks: SessionLog = [
      { week: 2, idx: 0, status: "done" },
      { week: 2, idx: 1, status: "done" },
      { week: 2, idx: 2, status: "missed" },
    ];
    const rows = planWeeks(macro, 12, start, 4, comps, marks, 5);
    expect(rows.length).toBe(12);
    expect(rows[0]!.week).toBe(1);
    expect(rows[3]!.isToday).toBe(true);      // hoyWeek = 4
    expect(rows[0]!.isToday).toBe(false);
    expect(rows[8]!.comp).toBe("Nacional");    // semana 9
    expect(rows[0]!.comp).toBeUndefined();
    expect(rows[1]!.done).toBe(2);             // semana 2: 2 ✓
    expect(rows[0]!.phaseName).toBe("Cimentación");
    expect(rows[0]!.phaseIndex).toBe(0);
    expect(rows[4]!.phaseName).toBe("Transformación"); // semana 5
    expect(rows[4]!.phaseIndex).toBe(1);
    expect(rows[8]!.phaseName).toBe("Realización");    // semana 9
    expect(rows[8]!.phaseIndex).toBe(2);
  });
  it("taper marca la comp + las 2 semanas previas", () => {
    const comps: Competencia[] = [{ name: "X", week: 9 }];
    const rows = planWeeks(macro, 12, start, 1, comps, [], 5);
    expect(rows[8]!.isTaper).toBe(true);  // 9 (comp)
    expect(rows[7]!.isTaper).toBe(true);  // 8
    expect(rows[6]!.isTaper).toBe(true);  // 7
    expect(rows[5]!.isTaper).toBe(false); // 6
  });
});
```

- [ ] **Step 2: Verificar que falla** — Run: `pnpm --filter @holy-oly/web test planRows`
Expected: FAIL (módulo no existe).

- [ ] **Step 3: Implementar** — `apps/web/src/screens/coach/calendar/planRows.ts`:

```ts
import {
  dateOfWeek, isTaperWeek, phaseForWeek,
  type Competencia, type Macrocycle, type SessionLog,
} from "@holy-oly/core";
import { weekDone } from "../sessions/sessionLog";

export interface PlanWeekRow {
  week: number;
  range: string;       // "2–8 jun"
  phaseName: string;
  phaseIndex: number;  // índice en macro.phaseProfile → color (phaseColor)
  done: number;        // sesiones marcadas ✓ esa semana
  perWeek: number;
  isToday: boolean;
  isTaper: boolean;
  comp?: string;       // nombre de la comp si cae en esta semana
}

const DAY = 86_400_000;
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const ms = (iso: string): number => new Date(`${iso}T00:00:00Z`).getTime();

/** Rango de fechas de una semana del macro: "2–8 jun" (mismo mes) o "29 may–4 jun" (cruza mes). */
export function weekRangeLabel(startDate: string, week: number): string {
  const a = new Date(ms(dateOfWeek(startDate, week)));
  const b = new Date(ms(dateOfWeek(startDate, week)) + 6 * DAY);
  const da = a.getUTCDate(), ma = a.getUTCMonth();
  const db = b.getUTCDate(), mb = b.getUTCMonth();
  return ma === mb ? `${da}–${db} ${MES[mb]!}` : `${da} ${MES[ma]!}–${db} ${MES[mb]!}`;
}

/** Filas del calendario del plan, una por semana (1..weeks). Pura y determinista. */
export function planWeeks(
  macro: Macrocycle,
  weeks: number,
  startDate: string,
  hoyWeek: number,
  comps: Competencia[],
  marks: SessionLog,
  perWeek: number,
): PlanWeekRow[] {
  return Array.from({ length: weeks }, (_, i) => {
    const week = i + 1;
    const phase = phaseForWeek(macro, week);
    return {
      week,
      range: weekRangeLabel(startDate, week),
      phaseName: phase?.name ?? "—",
      phaseIndex: phase ? macro.phaseProfile.indexOf(phase) : -1,
      done: weekDone(marks, week),
      perWeek,
      isToday: week === hoyWeek,
      isTaper: isTaperWeek(week, comps),
      comp: comps.find((c) => c.week === week)?.name,
    };
  });
}
```

- [ ] **Step 4: Verificar que pasa** — Run: `pnpm --filter @holy-oly/web test planRows`
Expected: PASS (4 tests).

---

## Task 3: `PlanCalendar` (componente plegable) — TDD

**Files:**
- Create: `apps/web/src/screens/coach/calendar/PlanCalendar.tsx`
- Test: `apps/web/src/screens/coach/calendar/PlanCalendar.test.tsx`

- [ ] **Step 1: Test que falla** — `apps/web/src/screens/coach/calendar/PlanCalendar.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PlanCalendar } from "./PlanCalendar";
import { MACROCYCLES } from "@holy-oly/core";
import type { Competencia, SessionLog } from "@holy-oly/core";

const macro = MACROCYCLES.find((m) => m.id === "coreano-5d")!;
const base = {
  macro, weeks: 12, startDate: "2026-03-02", hoyWeek: 4,
  comps: [{ name: "Nacional", week: 9 }] as Competencia[],
  marks: [] as SessionLog, perWeek: 5,
};

describe("PlanCalendar", () => {
  it("colapsado por default: muestra el header, NO las filas", () => {
    render(<PlanCalendar {...base} onWeekClick={() => {}} />);
    expect(screen.getByRole("button", { name: /calendario/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Semana 1\b/ })).not.toBeInTheDocument();
  });
  it("abrir lista una fila por semana; tap fila → onWeekClick(week)", () => {
    const picks: number[] = [];
    render(<PlanCalendar {...base} onWeekClick={(w) => picks.push(w)} />);
    fireEvent.click(screen.getByRole("button", { name: /calendario/i }));
    const semana9 = screen.getByRole("button", { name: /Semana 9\b/ });
    expect(semana9).toBeInTheDocument();
    fireEvent.click(semana9);
    expect(picks).toEqual([9]);
  });
  it("abierto: HOY y la 🚩 de la comp son visibles", () => {
    render(<PlanCalendar {...base} onWeekClick={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /calendario/i }));
    expect(screen.getByText("HOY")).toBeInTheDocument();
    expect(screen.getByText(/Nacional/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Verificar que falla** — Run: `pnpm --filter @holy-oly/web test PlanCalendar`
Expected: FAIL (no existe).

- [ ] **Step 3: Implementar** — `apps/web/src/screens/coach/calendar/PlanCalendar.tsx`:

```tsx
import { useState } from "react";
import type { Competencia, Macrocycle, SessionLog } from "@holy-oly/core";
import { planWeeks } from "./planRows";
import { phaseColor } from "../../../ui/charts/phasePalette";

/** Calendario del plan: lista plegable de semanas ancladas a fechas. Tocar una semana
 *  abre el WeekDetailSheet del Drilldown (vía onWeekClick → setSelectedWeek). Default cerrada. */
export function PlanCalendar({ macro, weeks, startDate, hoyWeek, comps, marks, perWeek, onWeekClick }: {
  macro: Macrocycle; weeks: number; startDate: string; hoyWeek: number;
  comps: Competencia[]; marks: SessionLog; perWeek: number;
  onWeekClick: (week: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const rows = open ? planWeeks(macro, weeks, startDate, hoyWeek, comps, marks, perWeek) : [];
  return (
    <div style={{ marginTop: 16 }}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
          background: "var(--wl-surface)", border: "1px solid color-mix(in srgb,var(--wl-text) 8%,transparent)",
          borderRadius: 12, padding: "10px 12px", cursor: "pointer", color: "var(--wl-text)" }}>
        <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
          <span style={{ fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 13.5 }}>📅 Calendario del plan</span>
          <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--wl-muted)" }}>{weeks} semanas · HOY sem {hoyWeek}</span>
        </span>
        <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--wl-muted)" }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 8 }}>
          {rows.map((r) => (
            <button key={r.week} type="button" onClick={() => onWeekClick(r.week)}
              aria-label={`Semana ${r.week} · ${r.range}${r.comp ? ` · 🚩 ${r.comp}` : ""} · ${r.done} de ${r.perWeek} sesiones`}
              style={{
                display: "flex", alignItems: "center", gap: 8, textAlign: "left", cursor: "pointer",
                padding: "8px 10px", borderRadius: 10, color: "var(--wl-text)",
                background: r.isToday ? "color-mix(in srgb,var(--wl-accent) 12%,transparent)" : "var(--wl-surface)",
                border: r.isToday
                  ? "1px solid color-mix(in srgb,var(--wl-accent) 55%,transparent)"
                  : "1px solid color-mix(in srgb,var(--wl-text) 8%,transparent)",
              }}>
              <span style={{ width: 52, flexShrink: 0 }}>
                <span style={{ display: "block", fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 12.5 }}>Sem {r.week}</span>
                <span style={{ display: "block", fontFamily: "var(--mono)", fontSize: 9, color: "var(--wl-muted)" }}>{r.range}</span>
              </span>
              <span style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: 10, fontWeight: 700, color: "#0b0b11",
                  background: phaseColor(r.phaseIndex), borderRadius: 5, padding: "2px 7px",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 120 }}>{r.phaseName}</span>
                {r.isToday && <span style={{ fontFamily: "var(--mono)", fontSize: 9, fontWeight: 700, color: "var(--wl-accent)" }}>HOY</span>}
                {r.comp && <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>🚩 {r.comp}</span>}
                {!r.comp && r.isTaper && <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--wl-muted)" }}>taper</span>}
              </span>
              <span style={{ flexShrink: 0, fontFamily: "var(--mono)", fontSize: 10.5,
                color: r.perWeek > 0 && r.done >= r.perWeek ? "#34d058" : "var(--wl-muted)" }}>
                {r.perWeek > 0 ? `${r.done}/${r.perWeek}` : "—"}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verificar que pasa** — Run: `pnpm --filter @holy-oly/web test PlanCalendar`
Expected: PASS (3 tests).

---

## Task 4: `weekSignals` series-opcional — TDD

**Files:**
- Modify: `apps/web/src/ui/charts/weekSignals.ts`
- Modify: `apps/web/src/ui/charts/weekSignals.test.ts`

- [ ] **Step 1: Test que falla** — agregá a `apps/web/src/ui/charts/weekSignals.test.ts`:

```ts
test("weekSignals: sin serie → 7 filas 'sin dato' (nunca falso-verde)", () => {
  const rows = weekSignals(undefined, MACROCYCLES[0], 2);
  expect(rows.length).toBe(7);
  expect(rows.every((r) => !r.hasData && r.value === "—" && r.state === undefined)).toBe(true);
});
```
> Si `MACROCYCLES` no está importado en el archivo de test, ya lo está (los tests existentes lo usan). Mantené el resto del archivo intacto.

- [ ] **Step 2: Verificar que falla** — Run: `pnpm --filter @holy-oly/web test weekSignals`
Expected: FAIL (hoy `weekSignals` exige `series: MonitorSeries`; pasarle `undefined` es error de tipo / crashea al leer `series.acute`).

- [ ] **Step 3: Implementar** — en `apps/web/src/ui/charts/weekSignals.ts`, cambiá la firma a `series` opcional y agregá el guard al inicio del cuerpo (el resto del cuerpo queda IGUAL):

```ts
export function weekSignals(series: MonitorSeries | undefined, macro: Macrocycle | undefined, week: number): WeekSignal[] {
  if (!series) {
    return ["ACWR", "Carga aguda", "Recuperación", "IMR", "Bienestar", "Cumplimiento", "Peso"]
      .map((label) => ({ label, value: "—", hasData: false }));
  }
  const i = week - 1;
  const acwrV = fin(acwr(series.acute)[i]);
  const recV = fin(series.recovery[i]);
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
> Los 7 labels del guard son los MISMOS y en el mismo orden que el cuerpo normal — consistencia.

- [ ] **Step 4: Verificar que pasa** — Run: `pnpm --filter @holy-oly/web test weekSignals`
Expected: PASS (los tests previos siguen verdes + el nuevo caso undefined).

---

## Task 5: Wire en `Drilldown` (sección plegable + abrir sheet sin serie)

**Files:**
- Modify: `apps/web/src/screens/coach/Drilldown.tsx`

- [ ] **Step 1: Import.** Junto a los imports de pantallas/charts (≈línea 21, después de `import { WeekDetailSheet } from "../../ui/charts/WeekDetailSheet";`) agregá:
```tsx
import { PlanCalendar } from "./calendar/PlanCalendar";
```

- [ ] **Step 2: `hoyWeek`.** Justo después de la línea que define `startDate` (≈línea 67), agregá:
```tsx
const hoyWeek = weekOfDate(startDate, today, maxWeek);
```
> `weekOfDate`, `startDate`, `today`, `maxWeek` ya están en scope (imports/línea 62-67).

- [ ] **Step 3: Sección `PlanCalendar`.** Entre el cierre del bloque de charts `)}` (≈línea 139) y el bloque `{macro && (` de "Planificación · sesiones" (≈línea 141), insertá:
```tsx
      {macro && (
        <PlanCalendar
          macro={macro}
          weeks={maxWeek}
          startDate={startDate}
          hoyWeek={hoyWeek}
          comps={comps}
          marks={sessionLog}
          perWeek={perWeek}
          onWeekClick={setSelectedWeek}
        />
      )}
```

- [ ] **Step 4: Abrir el sheet aunque no haya serie.** En el render del `WeekDetailSheet` (≈línea 183), cambiá el guard y dejá que `weekSignals` reciba `series` opcional:
  - De:
```tsx
      {series && selectedWeek != null && (
```
  - A:
```tsx
      {selectedWeek != null && (
```
  El resto del bloque queda igual; `signals={weekSignals(series, macro, selectedWeek)}` ya compila (Task 4 hizo `series` opcional) y para un atleta sin serie muestra las 7 señales "sin dato" + la fecha + la adherencia.

- [ ] **Step 5: Verificación completa** — Run:
```bash
pnpm --filter @holy-oly/web test && pnpm --filter @holy-oly/web exec tsc --noEmit && pnpm --filter @holy-oly/web exec eslint src && pnpm --filter @holy-oly/web build
```
Expected: todo verde (tests previos + phasePalette/planRows/PlanCalendar/weekSignals nuevos; tsc/eslint/build limpios).

- [ ] **Step 6: `[GATED]` Commit** (sólo con OK del usuario)
```bash
git add apps/web docs/superpowers/specs/2026-06-02-plan-calendar-design.md docs/superpowers/plans/2026-06-02-plan-calendar.md
git commit -m "feat(web): calendario del plan — lista de semanas plegable → WeekDetailSheet"
```

---

## Task 6: Review de El Carnicero

- [ ] **Step 1: Dispatch** (`subagent_type: el-carnicero` en sesión nueva resuelve por nombre). Prompt: *"Revisá el diff `git diff` contra el rulebook `docs/domain/HOLY-OLY-DOMAIN.md`. Foco: (1) el chip de fase usa paleta NEUTRA (no semáforo); (2) HOY anclado a fecha (`weekOfDate`), fechas vía `dateOfWeek`; (3) disciplina sin-dato — atleta sin serie abre el sheet con 7 'sin dato', nunca falso-verde; (4) privacidad — el calendario NO trae dato de ciclo; (5) el detalle/escritura reusan el `WeekDetailSheet`/`onToggleSession` por Repository, no se duplica ruta; (6) granularidad SEMANAL correcta (no promete por-día)."*
Expected: sin CRITICAL/HIGH. Si marca algo real, arreglar + re-verificar (Task 5 Step 5). El Carnicero es asesor, no infalible — verificar su feedback.

---

## Task 7: `[GATED]` Cierre (deploy)

- [ ] Con OK del usuario: `git push origin claude/magical-allen-dd70fe:main` (Render auto-deploy) + poll del deploy (Render API, en background) → confirmar live en https://holy-oly.onrender.com.

---

## Self-Review

**1. Spec coverage:**
- §2 layout lista-de-semanas → `PlanCalendar` (Task 3) + builder `planWeeks` (Task 2). ✓
- §2 conviven + plegable → `PlanCalendar` default-cerrada (Task 3); `SessionAdherence` intacta; Drilldown rendea ambas (Task 5 Step 3). ✓
- §2 cero wiring de detalle → `onWeekClick={setSelectedWeek}` reusa el sheet (Task 5 Step 3). ✓
- §3 `phasePalette` + refactor MacroTimeline → Task 1. ✓
- §3 `planRows`/`weekRangeLabel` → Task 2. ✓
- §3 `PlanCalendar` plegable → Task 3. ✓
- §3/§4 `weekSignals` series-opcional → Task 4; abrir sheet sin serie → Task 5 Step 4. ✓
- §5 HOY por fecha (`weekOfDate`) → Task 5 Step 2. ✓
- §6 privacidad (sin ciclo) → `planWeeks` sólo toca plan/macro/comps/sessionLog; review Task 6. ✓
- §7 verificación (TDD + El Carnicero + deploy) → Tasks 1-7. ✓
- §8 fuera de scope (per-día/app atleta) → sin tasks. ✓

**2. Placeholder scan:** Código completo en cada Task (phasePalette, planRows + weekRangeLabel, PlanCalendar entero, weekSignals con cuerpo completo, los 4 puntos de edición del Drilldown con líneas exactas). Sin "TBD".

**3. Type consistency:** `PlanWeekRow {week,range,phaseName,phaseIndex,done,perWeek,isToday,isTaper,comp?}` def Task 2 ↔ consumido idéntico en `PlanCalendar` Task 3. `planWeeks(macro,weeks,startDate,hoyWeek,comps,marks,perWeek)` firma Task 2 ↔ llamada Task 3 (componente) ↔ props pasadas Task 5 Step 3. `phaseColor(i:number)` def Task 1 ↔ uso Task 1 Step 5 (MacroTimeline) + Task 3 (PlanCalendar). `weekSignals(series?:MonitorSeries|undefined, macro, week)` Task 4 ↔ llamada existente Drilldown (Task 5 Step 4). `weekDone`/`dateOfWeek`/`phaseForWeek`/`isTaperWeek`/`weekOfDate`/`sessionsPerWeek` = exports reales (verificados en grounding). `onWeekClick:(week:number)=>void` ↔ `setSelectedWeek` (`(number|null)` setter acepta `number`). ✓

---

## Execution Handoff (ver pasos al final del skill)
