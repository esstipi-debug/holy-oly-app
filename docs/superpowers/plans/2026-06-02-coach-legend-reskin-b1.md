# Coach re-skin "Legend/FUT" — B1 (skin + Atletas) · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una skin nueva `legend` (oro/metal + fonts Saira/Space Mono) aplicada al shell del coach, y la pantalla **Atletas** reescrita con el layout **FUT hero** (carta dorada del mejor readiness + grilla de mini-cards), cableada a datos reales.

**Architecture:** El skin se activa con `.wl--legend` en el wrapper del `CoachShell` → todas las pantallas del coach (que leen `var(--wl-*)`) re-skinean por token-swap. `readiness`/`readinessTrend` son helpers puros nuevos en `core` (heurística recuperación+carga). `Equipo` arma hero=mejor-readiness + grilla desde `getRosterRows` (extendido). Color=estado vía el `STATUS` existente (consistencia app-wide); el oro es decorativo, no estado.

**Tech Stack:** React 18 + Vite + TS; vitest + @testing-library/react; `@holy-oly/core`.

> **Commits:** `[GATED]` — sólo con OK del usuario (default: commit final + push a main = deploy).
> **Prerequisito:** si el worktree no tiene `node_modules`, correr `pnpm install`.
> **Spec:** `docs/superpowers/specs/2026-06-02-coach-legend-reskin-b1-design.md`.

---

## File Structure

| Archivo | Crea/Modifica | Responsabilidad |
|---------|---------------|-----------------|
| `apps/web/src/styles/theme.css` | Modifica | + fonts Saira/Space Mono al `@import`; + bloque `.wl--legend{…}`. |
| `packages/core/src/logic/readiness.ts` | Crea | `readiness(rec,acwr)` + `readinessTrend(series)` (heurística pura). |
| `packages/core/src/logic/readiness.test.ts` | Crea | Tests de la heurística. |
| `packages/core/src/index.ts` | Modifica | Re-export de `readiness`/`readinessTrend`. |
| `apps/web/src/screens/coach/roster.ts` | Modifica | + `readiness`, `trend`, `cat` en `RosterRow`. |
| `apps/web/src/screens/coach/roster.test.ts` | Modifica | + asserts de readiness/trend/cat. |
| `apps/web/src/screens/coach/atletas/legendNoise.ts` | Crea | Constante del data-URI de ruido (textura legend). |
| `apps/web/src/screens/coach/atletas/AtletaMiniCard.tsx` | Crea | Mini-card de atleta (FUT) + heat-strip. |
| `apps/web/src/screens/coach/atletas/AtletaMiniCard.test.tsx` | Crea | Tests del mini-card. |
| `apps/web/src/screens/coach/atletas/AtletasHero.tsx` | Crea | Carta dorada del mejor readiness. |
| `apps/web/src/screens/coach/atletas/AtletasHero.test.tsx` | Crea | Tests del hero. |
| `apps/web/src/screens/coach/Equipo.tsx` | Reescribe | Layout FUT (header + hero + grilla); saca Heatmap/RiskQuadrant. |
| `apps/web/src/screens/coach/__tests__/equipo.test.tsx` | Reescribe | Tests del layout FUT. |
| `apps/web/src/screens/coach/macros/CoachShell.tsx` | Modifica | Wrapper `className="wl wl--legend"`. |

Reusa: `STATUS` ([ui/status.ts](apps/web/src/ui/status.ts)), `getRosterRows`, `acwr` (core), `BottomNav` (hereda tokens legend).

---

## Task 1: Skin `legend` (fonts + tokens) en theme.css

**Files:** Modify `apps/web/src/styles/theme.css`

- [ ] **Step 1: Sumar fonts al `@import`.** Reemplazá la línea del `@import url('https://fonts.googleapis.com/css2?...&display=swap');` agregando Saira y Space Mono antes de `&display=swap`:

```css
@import url('https://fonts.googleapis.com/css2?family=Saira+Condensed:wght@500;600;700;800&family=Saira:wght@600;700;800;900&family=Space+Mono:wght@400;700&family=Barlow+Semi+Condensed:wght@500;600;700&family=Chakra+Petch:wght@500;600;700&family=Anton&family=Archivo:wght@500;600;700;800&family=Sora:wght@500;600;700;800&family=Manrope:wght@500;600;700;800&display=swap');
```

- [ ] **Step 2: Agregar el bloque `.wl--legend`** al final de `theme.css` (después de la skin `neonlight`):

```css
/* ============================================================
   6 · LEGEND / FUT — coach: metal/oro/holo, deportivo "modo leyenda"
   Saira + Saira Condensed (nombres) + Space Mono (datos) + Archivo (body).
   El oro (--wl-accent) es IDENTIDAD decorativa, NO color de estado.
   ============================================================ */
.wl--legend{
  --wl-bg:#0A0B0E; --wl-surface:#11151A; --wl-surface-2:#20262E;
  --wl-text:#EEF2F6; --wl-muted:#6B7480;
  --wl-accent:#E9C46A;      /* oro — identidad legend */
  --wl-accent-2:#2EE6A0;    /* verde-ok como secundario */
  --wl-display:'Saira', sans-serif;
  --wl-cond:'Saira Condensed', sans-serif;
  --wl-body:'Archivo', sans-serif;
  --mono:'Space Mono', ui-monospace, monospace;
  --wl-radius:16px;
}
```

- [ ] **Step 3: Verificar** — Run: `pnpm --filter @holy-oly/web build`
Expected: build verde (CSS válido; no hay test unitario de CSS — se valida en el deploy/visual).

---

## Task 2: `readiness` + `readinessTrend` (core) — TDD

**Files:**
- Create: `packages/core/src/logic/readiness.ts`
- Test: `packages/core/src/logic/readiness.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Test que falla** — `packages/core/src/logic/readiness.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readiness, readinessTrend } from "./readiness";
import type { MonitorSeries } from "../types";

describe("readiness (heurística recuperación + carga)", () => {
  it("recuperación buena + carga en banda → ~recuperación", () => {
    expect(readiness(84, 1.05)).toBe(84); // acwr en [0.8,1.3] → sin penalidad
  });
  it("penaliza carga fuera de banda (alta)", () => {
    expect(readiness(41, 1.62)).toBe(28); // over=0.32 → penalty=min(20,round(12.8))=13 → 41-13=28
  });
  it("penaliza carga fuera de banda (baja), con tope 20", () => {
    expect(readiness(80, 0.2)).toBe(60); // over=0.6 → round(24)=24 → cap 20 → 80-20=60
  });
  it("sin recuperación → undefined (sin-dato, nunca un número inventado)", () => {
    expect(readiness(undefined, 1.0)).toBeUndefined();
    expect(readiness(NaN, 1.0)).toBeUndefined();
  });
  it("recuperación sin carga → la recuperación sin penalizar", () => {
    expect(readiness(70, undefined)).toBe(70);
  });
  it("clamp 0..100", () => {
    expect(readiness(10, 2.5)).toBe(0); // 10 - 20 = -10 → 0
  });
});

describe("readinessTrend", () => {
  const base: MonitorSeries = {
    weeks: 5, acute: [60, 65, 70, 80, 95], hrv: [70, 70, 70, 70, 70], hrvBase: 70,
    rhr: [50, 50, 50, 50, 50], rhrBase: 50, imr: [70, 72, 74, 76, 78],
    wellness: [80, 80, 80, 80, 80], recovery: [85, 82, 80, 70, 60],
  };
  it("Δ readiness entre la última semana y ~3 atrás", () => {
    const t = readinessTrend(base);
    expect(typeof t).toBe("number");
    expect(t).toBeLessThan(0); // recuperación cae + carga sube → trend negativo
  });
  it("undefined con menos de 2 semanas", () => {
    expect(readinessTrend({ ...base, weeks: 1, acute: [60], recovery: [85], hrv: [70], rhr: [50], imr: [70], wellness: [80] })).toBeUndefined();
    expect(readinessTrend(undefined)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Verificar que falla** — Run: `pnpm --filter @holy-oly/core test readiness`
Expected: FAIL (módulo no existe).

- [ ] **Step 3: Implementar** — `packages/core/src/logic/readiness.ts`:

```ts
import type { MonitorSeries } from "../types";
import { acwr } from "./monitor";

/**
 * Readiness 0-100 (heurística — criterio del coach, ajustable): base = recuperación,
 * penalizada cuando el ACWR sale de la banda segura [0.8, 1.3] (proporcional a la
 * distancia, tope 20). Sin recuperación → undefined (sin-dato, nunca un número inventado).
 */
export function readiness(rec: number | undefined, acwrV: number | undefined): number | undefined {
  if (rec == null || !Number.isFinite(rec)) return undefined;
  let penalty = 0;
  if (acwrV != null && Number.isFinite(acwrV)) {
    const over = acwrV > 1.3 ? acwrV - 1.3 : acwrV < 0.8 ? 0.8 - acwrV : 0;
    penalty = Math.min(20, Math.round(over * 40));
  }
  return Math.max(0, Math.min(100, Math.round(rec - penalty)));
}

/** Δ del readiness entre la última semana y ~3 atrás (window disponible). undefined si <2 semanas. */
export function readinessTrend(s: MonitorSeries | undefined): number | undefined {
  if (!s || s.weeks < 2) return undefined;
  const a = acwr(s.acute);
  const at = (i: number): number | undefined => readiness(s.recovery[i], a[i]);
  const last = at(s.weeks - 1);
  const back = at(Math.max(0, s.weeks - 1 - 3));
  if (last == null || back == null) return undefined;
  return last - back;
}
```

- [ ] **Step 4: Re-export** — en `packages/core/src/index.ts`, junto a los otros export de `./logic/monitor`, agregá:
```ts
export { readiness, readinessTrend } from "./logic/readiness";
```

- [ ] **Step 5: Verificar que pasa** — Run: `pnpm --filter @holy-oly/core test readiness`
Expected: PASS.

---

## Task 3: Extender `roster.ts` (readiness/trend/cat) — TDD

**Files:**
- Modify: `apps/web/src/screens/coach/roster.ts`, `apps/web/src/screens/coach/roster.test.ts`

- [ ] **Step 1: Test que falla** — agregá a `apps/web/src/screens/coach/roster.test.ts` (mock repo autocontenido):

```ts
import { getRosterRows } from "./roster";
import type { Repository, MonitorSeries, Atleta } from "@holy-oly/core";

test("getRosterRows: computa readiness, trend y cat (weightBand) por atleta", async () => {
  const s: MonitorSeries = {
    weeks: 5, acute: [60, 65, 70, 80, 95], hrv: [70, 70, 70, 70, 70], hrvBase: 70,
    rhr: [50, 50, 50, 50, 50], rhrBase: 50, imr: [70, 72, 74, 76, 78],
    wellness: [80, 80, 80, 80, 80], recovery: [85, 82, 80, 70, 60],
    bodyweight: [64, 64, 64, 64, 64], weightBand: [60, 64],
  };
  const atleta: Atleta = { id: "a1", nombre: "Mara V.", iniciales: "MV", nivel: "advanced", macroId: "ruso-5d", compite: true };
  const repo = {
    getRoster: async () => [atleta],
    getSeries: async () => s,
  } as unknown as Repository;

  const rows = await getRosterRows(repo);
  expect(rows[0]!.readiness).toBeGreaterThanOrEqual(0);
  expect(rows[0]!.readiness).toBeLessThanOrEqual(100);
  expect(typeof rows[0]!.trend).toBe("number");
  expect(rows[0]!.cat).toBe("64 kg"); // weightBand[1]
});

test("getRosterRows: atleta sin serie → readiness/trend/cat sin dato (undefined)", async () => {
  const atleta: Atleta = { id: "a2", nombre: "Caro F.", iniciales: "CF", nivel: "beginner", compite: false };
  const repo = {
    getRoster: async () => [atleta],
    getSeries: async () => undefined,
  } as unknown as Repository;
  const rows = await getRosterRows(repo);
  expect(rows[0]!.readiness).toBeUndefined();
  expect(rows[0]!.trend).toBeUndefined();
  expect(rows[0]!.cat).toBeUndefined();
});
```

- [ ] **Step 2: Verificar que falla** — Run: `pnpm --filter @holy-oly/web test roster`
Expected: FAIL (`readiness`/`trend`/`cat` no existen en `RosterRow`).

- [ ] **Step 3: Implementar** — en `apps/web/src/screens/coach/roster.ts`:
  - Import: cambiá la primera línea para sumar `readiness`, `readinessTrend`:
```ts
import { acwr, rosterStatus, seriesState, readiness, readinessTrend, type CellState, type Repository } from "@holy-oly/core";
```
  - Sumá a la interfaz `RosterRow` (después de `cell: CellState;`):
```ts
  readiness: number | undefined;
  trend: number | undefined;
  cat: string | undefined;
  history: CellState[];
```
  - En el `return` del `.map`, después de `cell: rosterStatus(s),` agregá:
```ts
      readiness: readiness(s ? s.recovery.at(-1) : undefined, lastAcwr != null && Number.isFinite(lastAcwr) ? lastAcwr : undefined),
      trend: readinessTrend(s),
      cat: s?.weightBand ? `${s.weightBand[1]} kg` : undefined,
```
  > `rec`/`acwr` ya se calculan arriba; `readiness` reusa esos mismos valores. `history` ya estaba.

- [ ] **Step 4: Verificar que pasa** — Run: `pnpm --filter @holy-oly/web test roster`
Expected: PASS.

---

## Task 4: `legendNoise` + `AtletaMiniCard` — TDD

**Files:**
- Create: `apps/web/src/screens/coach/atletas/legendNoise.ts`
- Create: `apps/web/src/screens/coach/atletas/AtletaMiniCard.tsx`
- Test: `apps/web/src/screens/coach/atletas/AtletaMiniCard.test.tsx`

- [ ] **Step 1: Crear `legendNoise.ts`**:
```ts
/** Ruido fractal (SVG data-URI) como textura de overlay en las cards legend (del diseño FUT). */
export const LEGEND_NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)'/%3E%3C/svg%3E\")";
```

- [ ] **Step 2: Test que falla** — `apps/web/src/screens/coach/atletas/AtletaMiniCard.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AtletaMiniCard } from "./AtletaMiniCard";
import type { RosterRow } from "../roster";

const row: RosterRow = {
  id: "mara", nombre: "Mara V.", iniciales: "MV", metodo: "Ruso 5D", compite: true,
  acwr: 1.62, rec: 41, cell: "alert", readiness: 28, trend: -9, cat: "64 kg",
  history: ["ok", "ok", "warn", "alert", "warn", "alert", "alert"],
};

describe("AtletaMiniCard", () => {
  it("muestra nombre, iniciales y readiness; tap → onPick(id)", () => {
    const picks: string[] = [];
    render(<AtletaMiniCard row={row} onPick={(id) => picks.push(id)} />);
    expect(screen.getByText("Mara V.")).toBeInTheDocument();
    expect(screen.getByText("MV")).toBeInTheDocument();
    expect(screen.getByText("28")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button"));
    expect(picks).toEqual(["mara"]);
  });
  it("sin dato → readiness '—' (nunca un número inventado)", () => {
    const nd: RosterRow = { ...row, cell: "none", readiness: undefined, acwr: undefined, rec: undefined, trend: undefined, cat: undefined, history: ["none", "none"] };
    render(<AtletaMiniCard row={nd} onPick={() => {}} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Verificar que falla** — Run: `pnpm --filter @holy-oly/web test AtletaMiniCard`
Expected: FAIL (no existe).

- [ ] **Step 4: Implementar** — `apps/web/src/screens/coach/atletas/AtletaMiniCard.tsx`:
```tsx
import type { CellState } from "@holy-oly/core";
import type { RosterRow } from "../roster";
import { STATUS } from "../../../ui/status";
import { LEGEND_NOISE } from "./legendNoise";

function HeatStrip({ history }: { history: CellState[] }) {
  const last7 = history.slice(-7);
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {last7.map((k, i) => (
        <div key={i} style={{
          width: 11, height: 11, borderRadius: 3,
          background: k === "none" ? "transparent" : STATUS[k],
          border: k === "none" ? `1px dashed ${STATUS.none}` : "none",
        }} />
      ))}
    </div>
  );
}

/** Mini-card de atleta (estilo FUT): initials + readiness + nombre + heat-strip. Tap → drill-down. */
export function AtletaMiniCard({ row, onPick }: { row: RosterRow; onPick: (id: string) => void }) {
  const nd = row.cell === "none";
  const st = STATUS[row.cell];
  return (
    <button type="button" onClick={() => onPick(row.id)}
      aria-label={`${row.nombre} · readiness ${nd ? "sin dato" : row.readiness}`}
      style={{
        position: "relative", textAlign: "left", borderRadius: 16, overflow: "hidden", padding: "12px 13px",
        cursor: "pointer", color: "var(--wl-text)",
        background: "linear-gradient(158deg,#20262E 0%,#11151A 55%,#0B0E12 100%)", border: "1px solid rgba(255,255,255,.08)",
      }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: LEGEND_NOISE, backgroundSize: "90px", opacity: .05, mixBlendMode: "overlay", pointerEvents: "none" }} />
      <span style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${st}, transparent)` }} />
      <div style={{ position: "relative", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: `color-mix(in srgb, ${st} 16%, transparent)`, border: `1px solid color-mix(in srgb, ${st} 45%, transparent)`, fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 13, color: nd ? "var(--wl-muted)" : st }}>{row.iniciales}</div>
        <span style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 28, lineHeight: .9, color: nd ? "var(--wl-muted)" : "#fff" }}>{nd ? "—" : row.readiness}</span>
      </div>
      <div style={{ position: "relative", marginTop: 10 }}>
        <div style={{ fontFamily: "var(--wl-cond, var(--wl-display))", fontWeight: 700, fontSize: 17, letterSpacing: .2, textTransform: "uppercase", lineHeight: 1, color: "#fff" }}>{row.nombre}</div>
        <div style={{ fontFamily: "var(--mono)", fontSize: 8.5, color: "var(--wl-muted)", textTransform: "uppercase", marginTop: 3 }}>{row.metodo}{row.cat ? ` · ${row.cat}` : ""}</div>
      </div>
      <div style={{ position: "relative", marginTop: 9 }}><HeatStrip history={row.history} /></div>
    </button>
  );
}
```

- [ ] **Step 5: Verificar que pasa** — Run: `pnpm --filter @holy-oly/web test AtletaMiniCard`
Expected: PASS (2 tests).

---

## Task 5: `AtletasHero` (carta dorada) — TDD

**Files:**
- Create: `apps/web/src/screens/coach/atletas/AtletasHero.tsx`
- Test: `apps/web/src/screens/coach/atletas/AtletasHero.test.tsx`

- [ ] **Step 1: Test que falla** — `apps/web/src/screens/coach/atletas/AtletasHero.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AtletasHero } from "./AtletasHero";
import type { RosterRow } from "../roster";

const hero: RosterRow = {
  id: "tomas", nombre: "Tomás L.", iniciales: "TL", metodo: "Polaco 5D", compite: true,
  acwr: 0.98, rec: 88, cell: "ok", readiness: 91, trend: 4, cat: "102 kg", history: ["ok", "ok", "ok"],
};

describe("AtletasHero", () => {
  it("muestra readiness grande, nombre, categoría y los 3 stats; tap → onPick", () => {
    const picks: string[] = [];
    render(<AtletasHero row={hero} onPick={(id) => picks.push(id)} />);
    expect(screen.getByText("91")).toBeInTheDocument();
    expect(screen.getByText("Tomás L.")).toBeInTheDocument();
    expect(screen.getByText("102 kg")).toBeInTheDocument();
    expect(screen.getByText("0.98")).toBeInTheDocument();   // ACWR
    expect(screen.getByText("88%")).toBeInTheDocument();    // RECUP
    expect(screen.getByText("+4")).toBeInTheDocument();     // RACHA
    expect(screen.getByText(/MEJOR READINESS/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button"));
    expect(picks).toEqual(["tomas"]);
  });
});
```

- [ ] **Step 2: Verificar que falla** — Run: `pnpm --filter @holy-oly/web test AtletasHero`
Expected: FAIL (no existe).

- [ ] **Step 3: Implementar** — `apps/web/src/screens/coach/atletas/AtletasHero.tsx`:
```tsx
import type { RosterRow } from "../roster";
import { LEGEND_NOISE } from "./legendNoise";

/** Carta "modo leyenda" del mejor readiness del plantel (oro/holo/noise). El oro es
 *  identidad decorativa, NO color de estado. Tap → drill-down del atleta. */
export function AtletasHero({ row, onPick }: { row: RosterRow; onPick: (id: string) => void }) {
  const stats: [string, string][] = [
    ["ACWR", row.acwr != null ? row.acwr.toFixed(2) : "—"],
    ["RECUP", row.rec != null ? `${row.rec}%` : "—"],
    ["RACHA", row.trend != null ? `${row.trend >= 0 ? "+" : ""}${row.trend}` : "—"],
  ];
  return (
    <button type="button" onClick={() => onPick(row.id)} aria-label={`${row.nombre} · mejor readiness ${row.readiness}`}
      style={{ position: "relative", width: "100%", height: 196, borderRadius: 22, overflow: "hidden", cursor: "pointer", textAlign: "left", border: 0, padding: 0, boxShadow: "0 18px 40px -12px rgba(233,196,106,.4), inset 0 0 0 1px rgba(255,240,200,.5)", background: "#C7A14C" }}>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg,#6E561F 0%,#C7A14C 24%,#F8E7AE 47%,#C49A41 66%,#8A6E2C 100%)" }} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(115deg, transparent 30%, rgba(255,120,180,.28) 44%, rgba(120,200,255,.28) 52%, rgba(180,255,170,.24) 60%, transparent 72%)", mixBlendMode: "overlay" }} />
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(120% 80% at 80% -10%, rgba(255,255,255,.55), transparent 50%)" }} />
      <div style={{ position: "absolute", inset: 0, backgroundImage: LEGEND_NOISE, backgroundSize: "120px", opacity: .12, mixBlendMode: "overlay" }} />
      <div style={{ position: "relative", height: "100%", padding: "14px 18px", display: "flex", flexDirection: "column", color: "#241A04" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, fontWeight: 700, letterSpacing: 1, padding: "4px 9px", borderRadius: 999, background: "rgba(36,26,4,.16)" }}>★ MEJOR READINESS</span>
          <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>{row.metodo}</span>
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 16, marginTop: 4 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "var(--wl-display)", fontWeight: 900, fontSize: 62, lineHeight: .85, letterSpacing: -2 }}>{row.readiness}</div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 9, fontWeight: 700, letterSpacing: 2, marginTop: 2 }}>READINESS</div>
            {row.cat && <div style={{ fontFamily: "var(--wl-cond, var(--wl-display))", fontWeight: 700, fontSize: 15, marginTop: 6, letterSpacing: .5 }}>{row.cat}</div>}
          </div>
          <div style={{ width: 1, alignSelf: "stretch", background: "rgba(36,26,4,.25)", margin: "6px 0" }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "var(--wl-cond, var(--wl-display))", fontWeight: 800, fontSize: 30, lineHeight: .95, textTransform: "uppercase", letterSpacing: .3 }}>{row.nombre}</div>
            <div style={{ display: "flex", gap: 14, marginTop: 14 }}>
              {stats.map(([l, v]) => (
                <div key={l}>
                  <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 19, lineHeight: 1 }}>{v}</div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 8, fontWeight: 700, letterSpacing: 1, opacity: .7 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}
```

- [ ] **Step 4: Verificar que pasa** — Run: `pnpm --filter @holy-oly/web test AtletasHero`
Expected: PASS.

---

## Task 6: Reescribir `Equipo` (layout FUT) + wrapper `CoachShell`

**Files:**
- Rewrite: `apps/web/src/screens/coach/Equipo.tsx`
- Rewrite: `apps/web/src/screens/coach/__tests__/equipo.test.tsx`
- Modify: `apps/web/src/screens/coach/macros/CoachShell.tsx`

- [ ] **Step 1: Reescribir el test** — `apps/web/src/screens/coach/__tests__/equipo.test.tsx`. Reemplazá su contenido por (mock repo + router):
```tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { Equipo } from "../Equipo";
import { RepositoryProvider } from "../../../data/RepositoryProvider";
import type { Repository, MonitorSeries, Atleta } from "@holy-oly/core";

function mkSeries(rec: number[]): MonitorSeries {
  const n = rec.length;
  return { weeks: n, acute: Array(n).fill(70), hrv: Array(n).fill(70), hrvBase: 70, rhr: Array(n).fill(50), rhrBase: 50, imr: Array(n).fill(75), wellness: Array(n).fill(80), recovery: rec };
}
const ATLETAS: Atleta[] = [
  { id: "alta", nombre: "Tomás L.", iniciales: "TL", nivel: "advanced", macroId: "polaco-5d", compite: true },
  { id: "baja", nombre: "Mara V.", iniciales: "MV", nivel: "advanced", macroId: "ruso-5d", compite: true },
];
const SERIES: Record<string, MonitorSeries> = { alta: mkSeries([85, 86, 88]), baja: mkSeries([60, 55, 45]) };
const repo = { getRoster: async () => ATLETAS, getSeries: async (id: string) => SERIES[id] } as unknown as Repository;

function renderEquipo() {
  return render(
    <MemoryRouter initialEntries={["/coach"]}>
      <RepositoryProvider repository={repo}>
        <Routes><Route path="/coach" element={<Equipo />} /><Route path="/coach/a/:id" element={<div>DRILL</div>} /></Routes>
      </RepositoryProvider>
    </MemoryRouter>,
  );
}

describe("Equipo (FUT)", () => {
  it("muestra la carta hero del mejor readiness + la grilla del resto; tap navega al drill-down", async () => {
    renderEquipo();
    expect(await screen.findByText(/MEJOR READINESS/)).toBeInTheDocument();
    // El mejor readiness (Tomás, recuperación alta) es el hero
    const hero = screen.getByRole("button", { name: /Tom[aá]s L\. · mejor readiness/i });
    expect(hero).toBeInTheDocument();
    // El otro aparece como mini-card
    expect(screen.getByRole("button", { name: /Mara V\. · readiness/i })).toBeInTheDocument();
    fireEvent.click(hero);
    expect(await screen.findByText("DRILL")).toBeInTheDocument();
  });
});
```
> **Nota:** verificá la firma real de `RepositoryProvider` (prop `repository` vs otra) leyendo `apps/web/src/data/RepositoryProvider.tsx`; ajustá el wrapper del test a como lo hacen los tests existentes (p.ej. `drilldown.test.tsx`).

- [ ] **Step 2: Verificar que falla** — Run: `pnpm --filter @holy-oly/web test equipo`
Expected: FAIL (el `Equipo` actual no tiene hero/“MEJOR READINESS”).

- [ ] **Step 3: Reescribir `Equipo.tsx`**:
```tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRepository } from "../../data/RepositoryProvider";
import { getRosterRows, type RosterRow } from "./roster";
import { AtletasHero } from "./atletas/AtletasHero";
import { AtletaMiniCard } from "./atletas/AtletaMiniCard";

export function Equipo() {
  const repo = useRepository();
  const navigate = useNavigate();
  const [rows, setRows] = useState<RosterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let on = true;
    setLoading(true); setError(false);
    getRosterRows(repo)
      .then((r) => { if (on) { setRows(r); setLoading(false); } })
      .catch(() => { if (on) { setError(true); setLoading(false); } });
    return () => { on = false; };
  }, [repo]);

  const onPick = (id: string) => navigate(`/coach/a/${id}`);
  const withData = rows.filter((r) => r.cell !== "none" && r.readiness != null);
  const hero = withData.length
    ? withData.reduce((b, r) => (r.readiness! > b.readiness! ? r : b), withData[0]!)
    : undefined;
  const rest = rows.filter((r) => r.id !== hero?.id);

  return (
    <div style={{ padding: "14px 18px 26px", color: "var(--wl-text)", minHeight: "100vh", maxWidth: 420, margin: "0 auto", background: "radial-gradient(130% 50% at 50% -5%, #1A1813 0%, #0A0B0E 55%)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <h1 style={{ margin: 0, fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 24, letterSpacing: -.4 }}>Plantel</h1>
        <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)" }}>{rows.length} ATLETAS</span>
      </div>

      {error ? (
        <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)", padding: "16px 0" }}>No se pudo cargar el plantel. Reintentá.</div>
      ) : loading ? (
        <div aria-busy="true" style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)", padding: "16px 0" }}>Cargando plantel…</div>
      ) : (
        <>
          {hero && <AtletasHero row={hero} onPick={onPick} />}
          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "16px 0 11px" }}>
            <span style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 13, letterSpacing: 1, color: "var(--wl-muted)", textTransform: "uppercase" }}>El plantel</span>
            <span style={{ flex: 1, height: 1, background: "rgba(255,255,255,.1)" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
            {rest.map((r) => <AtletaMiniCard key={r.id} row={r} onPick={onPick} />)}
          </div>
        </>
      )}
    </div>
  );
}
```
> Saca `Heatmap`/`RiskQuadrant`/buckets/`picked` (la decisión aprobada: la vista primaria es FUT; las mini-cards traen el heat-strip). Los componentes `Heatmap`/`RiskQuadrant` quedan en el repo para B2.

- [ ] **Step 4: Wrapper legend en `CoachShell.tsx`**:
```tsx
import { Outlet } from "react-router-dom";
import { BottomNav } from "./BottomNav";

/** Coach layout: skin "legend" + la pantalla activa + el bottom nav persistente. */
export function CoachShell() {
  return (
    <div className="wl wl--legend" style={{ minHeight: "100vh", background: "var(--wl-bg)" }}>
      <Outlet />
      <BottomNav />
    </div>
  );
}
```

- [ ] **Step 5: Verificar** — Run: `pnpm --filter @holy-oly/web test equipo`
Expected: PASS. Si el `RepositoryProvider` no acepta la prop `repository`, ajustá el test al patrón real (Step 1 nota) y re-corré.

---

## Task 7: Verificación completa

- [ ] **Step 1** — Run:
```bash
pnpm --filter @holy-oly/core test && pnpm --filter @holy-oly/web test && pnpm --filter @holy-oly/web exec tsc --noEmit && pnpm --filter @holy-oly/web exec eslint src && pnpm --filter @holy-oly/web build
```
Expected: todo verde (core readiness + web nuevos/actualizados; tsc/eslint/build limpios). Revisá que `BottomNav` tome los tokens legend (accent oro); si hardcodea color neon, cambiá esos literales por `var(--wl-accent)`.

---

## Task 8: Review de El Carnicero

- [ ] **Step 1: Dispatch** (rol-adoptado: `general-purpose` con la persona de `.claude/agents/el-carnicero.md` + rulebook, ya que el `subagent_type: el-carnicero` no resuelve en esta sesión). Prompt foco: *(1) **color = estado** intacto — los estados salen de `STATUS`/`CellState`; el ORO/holo es identidad decorativa, no estado; (2) **sin-dato honesto** — atleta sin serie → readiness/acwr/recup '—', mini-card sin falso-verde, y el hero NUNCA toma un `sindatos`; (3) `readiness` es **heurística documentada** (recuperación penalizada por carga), superficie de COACH (no gameable del atleta, HR-1 ok); (4) Repository/authz sin cambios.*
Expected: sin CRITICAL/HIGH. Si marca algo real, arreglar + re-verificar (Task 7). El Carnicero es asesor, no infalible.

---

## Task 9: `[GATED]` Cierre (deploy)

- [ ] Con OK del usuario: limpiar `.design-tmp/` (no commitear el bundle de diseño), `git add -A`, commit (sin trailer): `feat(web): coach skin "legend" + pantalla Atletas (FUT hero)`, `git push origin claude/magical-allen-dd70fe:main` → Render auto-deploy + poll en background → live.

---

## Self-Review

**1. Spec coverage:**
- §2 skin `legend` (tokens+fonts) + activación en CoachShell → Task 1 + Task 6 Step 4. ✓
- §3 pantalla FUT (header+hero+grilla; sin chrome iOS; bottom-nav real) → Tasks 5,4,6. ✓
- §4 reconciliación (mapping RosterRow) → Task 3. ✓
- §4a readiness/trend heurística (core) → Task 2. ✓ cat (weightBand) → Task 3. ✓
- §5 color=estado (STATUS), oro decorativo, sin-dato, coach-surface → Tasks 4/5 (STATUS) + review Task 8. ✓
- §6 archivos → todos cubiertos. RiskQuadrant/Heatmap fuera (decisión aprobada) → Task 6 Step 3. ✓
- §7 verificación (TDD + El Carnicero + deploy) → Tasks 2-9. ✓

**2. Placeholder scan:** Código completo (readiness entero, roster diff exacto, legendNoise, AtletaMiniCard + AtletasHero enteros, Equipo + CoachShell enteros, tests con casos reales). Sin "TBD". (Única instrucción de verificación-en-vivo: la firma de `RepositoryProvider` en el test de Equipo — marcada como nota a verificar contra `drilldown.test.tsx`.)

**3. Type consistency:** `RosterRow` extendido con `readiness/trend/cat: …|undefined` (Task 3) ↔ consumido en `AtletaMiniCard`/`AtletasHero` (Tasks 4/5) ↔ `Equipo` (Task 6). `readiness(rec?, acwrV?)` + `readinessTrend(series?)` firmas (Task 2) ↔ uso en roster.ts (Task 3). `STATUS[CellState]` (existente) ↔ uso en mini-card/heat-strip. `onPick:(id:string)=>void` consistente. `--wl-cond`/`--mono` definidos en `.wl--legend` (Task 1) ↔ usados con fallback en los componentes. ✓

---

## Execution Handoff (ver pasos al final del skill)
