# Charts Fase 2 — polish visual · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar los ítems "Fase 2" del backlog de auditoría: `MacroTimeline` a `ChartCard` + tokens; bandas/colores faltantes (Bienestar vs su normal, IMR ±2, Recovery línea por estado, CompChart zonas 85/70); sacar números planos de Bienestar.

**Architecture:** Cambios de SVG por chart (mecánicos, anclados al rulebook). `MacroTimeline` gana `ChartCard` (contexto HR-2). Colores hardcodeados/decorativos → `STATUS` tokens (estados) + paleta neutra (fases). Lo que el rulebook no define (referencia de Bienestar) = "vs su propia normal" (media±desvío de la serie, derivado).

**Tech Stack:** React 18 + Vite + TS; vitest + @testing-library/react.

> **Commits:** `[GATED]` — sólo con OK del usuario (default: commit final + push a main = deploy).
> **Naturaleza:** cambios **mayormente visuales (SVG)** → verificación primaria = **El Carnicero** (color=estado, sin hex decorativo, no número plano) + **deploy en vivo**. Tests unitarios sólo donde dan señal real (Bienestar-sin-número-plano, MacroTimeline-en-ChartCard); el resto sería aserción frágil de SVG → se omite a propósito.

---

## File Structure

| Archivo | Modifica | Cambio |
|---------|----------|--------|
| `apps/web/src/ui/charts/WellnessChart.tsx` | sí | sacar número plano de ítems; banda "vs su normal" (media±desvío) en el score |
| `apps/web/src/ui/charts/ImrFaseChart.tsx` | sí | banda de fase con margen ±2 visible |
| `apps/web/src/ui/charts/CompChart.tsx` | sí | líneas de referencia visibles 85/70 |
| `apps/web/src/ui/charts/RecoveryChart.tsx` | sí | línea neutra + último punto por estado; quitar cian/verde fijos |
| `apps/web/src/ui/charts/MacroTimeline.tsx` | sí | envolver en `ChartCard`; `RAMP`→paleta neutra; `#ff3b46`→`STATUS.alert` |
| `apps/web/src/ui/__tests__/wellness-chart.test.tsx` | sí | test: no número plano |
| `apps/web/src/ui/__tests__/macro-timeline.test.tsx` | sí | test: título + ⓘ; ajustar si rompe |

---

## Task 1: WellnessChart — sacar números planos + banda "vs su normal"

**Files:** Modify `apps/web/src/ui/charts/WellnessChart.tsx`, Test `apps/web/src/ui/__tests__/wellness-chart.test.tsx`

- [ ] **Step 1: Test que falla (no número plano)** — agregá a `wellness-chart.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { WellnessChart } from "../charts/WellnessChart";
import type { MonitorSeries } from "@holy-oly/core";

test("WellnessChart: no muestra el número plano del ítem (HR-1)", () => {
  const s = {
    weeks: 1, acute: [], hrv: [], hrvBase: 70, rhr: [], rhrBase: 50, imr: [],
    wellness: [80], recovery: [], wellnessItems: { Fatiga: [3] },
  } as unknown as MonitorSeries;
  render(<WellnessChart series={s} />);
  expect(screen.getByText("Fatiga")).toBeInTheDocument();   // label queda
  expect(screen.queryByText("3")).not.toBeInTheDocument();  // el "3" plano se fue
});
```

- [ ] **Step 2: Verificar que falla** — Run: `pnpm --filter @holy-oly/web test wellness-chart`
Expected: FAIL (hoy renderiza `{arr.at(-1)}` = "3").

- [ ] **Step 3: Sacar el número plano** — en `WellnessChart.tsx`, borrá el `<span>` del valor del ítem (el que envuelve `{arr.at(-1)}`):

```tsx
            <span
              style={{
                fontFamily: "var(--mono)",
                fontSize: 10,
                color: "var(--wl-text)",
              } as React.CSSProperties}
            >
              {arr.at(-1)}
            </span>
```
(borrar ese bloque completo — queda el `<span>{key}</span>` + el `<svg>` del sparkline).

- [ ] **Step 4: Banda "vs su normal" en el score** — en `WellnessChart.tsx`, antes de `const lastWsc = wsc.at(-1);` agregá el cálculo:

```tsx
  const valid = wsc.filter((v) => Number.isFinite(v));
  const mean = valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
  const std = valid.length ? Math.sqrt(valid.reduce((a, b) => a + (b - mean) ** 2, 0) / valid.length) : 0;
```
Y dentro del `<svg>` del score, **antes** del `{wsc.length > 0 && (<path…/>)}`, agregá la banda + línea de normal (paleta neutra, NO status — es referencia, no semáforo):

```tsx
        {valid.length > 0 && (
          <rect x={12} y={y(Math.min(hi, mean + std))} width={300 - 24}
            height={y(Math.max(lo, mean - std)) - y(Math.min(hi, mean + std))}
            style={{ fill: "var(--wl-muted)", opacity: 0.12 } as React.CSSProperties} />
        )}
        {valid.length > 0 && (
          <line x1={12} x2={300 - 12} y1={y(mean)} y2={y(mean)}
            style={{ stroke: "var(--wl-muted)", opacity: 0.5 } as React.CSSProperties} strokeDasharray="3 2" />
        )}
```
Y actualizá el `sub` a `"puntaje 0–100 vs tu normal · ítems"` y el `lectura` del `explain` a `"El score se lee contra tu propia normal (banda media±desvío); cada ítem vs su tendencia."`.

- [ ] **Step 5: Verificar** — Run: `pnpm --filter @holy-oly/web test wellness-chart`
Expected: PASS.

---

## Task 2: ImrFaseChart — banda con margen ±2 visible

**Files:** Modify `apps/web/src/ui/charts/ImrFaseChart.tsx`

- [ ] **Step 1: Expandir la banda al ±2** — en el `<rect>` de la banda de fase, cambiá los `y`/`height` para usar `imrPct[1]+2` / `imrPct[0]-2`, clampeados al dominio [lo,hi]=[60,104]:

```tsx
            <rect
              x={x(phase.weeks[0])}
              y={y(Math.min(hi, phase.imrPct[1] + 2))}
              width={x(phase.weeks[1]) - x(phase.weeks[0])}
              height={y(Math.max(lo, phase.imrPct[0] - 2)) - y(Math.min(hi, phase.imrPct[1] + 2))}
              style={{ fill: STATUS.ok, opacity: 0.16 } as React.CSSProperties}
            />
```
> `lo`/`hi` (60/104) ya están en scope. Ahora la banda visible matchea el ±2 con el que `imrStateForWeekSafe` evalúa el dot.

- [ ] **Step 2: Verificar** — Run: `pnpm --filter @holy-oly/web test imr-fase && pnpm --filter @holy-oly/web exec tsc --noEmit`
Expected: tests existentes verdes (el cambio es de coords, no rompe estructura), tsc limpio. (Verificación visual: deploy + El Carnicero.)

---

## Task 3: CompChart — zonas 85/70 visibles

**Files:** Modify `apps/web/src/ui/charts/CompChart.tsx`

- [ ] **Step 1: Líneas de referencia 85/70** — dentro del `<svg>`, **antes** del `{comp.map(...)}` (para que las barras queden encima), agregá:

```tsx
        {[85, 70].map((thr) => (
          <line key={thr} x1={0} x2={300} y1={y(thr)} y2={y(thr)}
            style={{ stroke: thr === 85 ? STATUS.ok : STATUS.warn, opacity: 0.35 } as React.CSSProperties}
            strokeDasharray="2 3" />
        ))}
```
> `y(v) = top + (1 - v/100)*(bot-top)` ya está en scope. Hace visible el umbral que hoy sólo vive en el color de la barra (≥85 ok, ≥70 warn).

- [ ] **Step 2: Verificar** — Run: `pnpm --filter @holy-oly/web test comp-chart && pnpm --filter @holy-oly/web exec tsc --noEmit`
Expected: verdes. (Visual: deploy + El Carnicero.)

---

## Task 4: RecoveryChart — línea neutra + último punto por estado

**Files:** Modify `apps/web/src/ui/charts/RecoveryChart.tsx`

- [ ] **Step 1: `Mini` — línea neutra + punto de estado.** (a) En `MiniProps`, reemplazá `color: string;` por `pointState?: CellState;`. (b) Importá `CellState`: cambiá la línea de import de core a `import { recoverySeries, recoveryState, type CellState, type MonitorSeries } from "@holy-oly/core";`. (c) En `Mini`, cambiá la firma `{ arr, base, color, label, pad, onPick }` → `{ arr, base, label, pad, pointState, onPick }`. (d) En la data line, el stroke pasa a neutro: `stroke: "var(--wl-text)"` (en vez de `color`). (e) Después de la `data line`, antes del `label`, agregá el último punto coloreado por estado:

```tsx
      {arr.length > 0 && pointState && (
        <circle cx={x(weeks)} cy={y(arr[weeks - 1]!)} r={3}
          style={{ fill: STATUS[pointState] } as React.CSSProperties} />
      )}
```

- [ ] **Step 2: `RecoveryChart` — pasar el estado, quitar colores fijos.** Calculá el estado actual y pasalo a ambos `Mini` (sacando `color`):

```tsx
  const st = recoveryState(lastRec);
```
(después de `const lastRec = ...`). Y los dos `<Mini>`:
```tsx
      <Mini arr={series.hrv} base={series.hrvBase} label="HRV (ms)" pad={5} pointState={st} onPick={onPointClick} />
      <Mini arr={series.rhr} base={series.rhrBase} label="FC reposo (lpm)" pad={3} pointState={st} onPick={onPointClick} />
```
> Mata el `#2dd4e6` decorativo y el verde-siempre de la línea; el estado se ve en el último punto. La banda verde de baseline (referencia) queda.

- [ ] **Step 2: Verificar** — Run: `pnpm --filter @holy-oly/web test recovery-chart && pnpm --filter @holy-oly/web exec tsc --noEmit`
Expected: verdes. (Visual: deploy + El Carnicero.)

---

## Task 5: MacroTimeline — a `ChartCard` + tokens

**Files:** Modify `apps/web/src/ui/charts/MacroTimeline.tsx`, Test `apps/web/src/ui/__tests__/macro-timeline.test.tsx`

- [ ] **Step 1: Imports + paleta neutra + tokens.** (a) Agregá imports: `import { ChartCard } from "./chartkit";` y `import { STATUS } from "../status";`. (b) Reemplazá `RAMP` por una paleta **neutra** (sin verde/amarillo/rojo de status):

```tsx
// Paleta neutra de fases (categórica, NO semáforo — no colisiona con STATUS verde/amarillo/rojo).
const RAMP = ["#6f86ff", "#22b8cf", "#a78bfa", "#94a3b8"];
```
(c) Reemplazá los 3 `#ff3b46` hardcodeados por `STATUS.alert`: en las barras de taper (`fill: t ? "#ff3b46" : ...` → `fill: t ? STATUS.alert : "var(--wl-text)"`), y en las flags (la `<line>` `stroke: "#ff3b46"` → `stroke: STATUS.alert`, y el `<text>` `fill: "#ff3b46"` → `fill: STATUS.alert`).

- [ ] **Step 2: Envolver en `ChartCard`.** Cambiá el `return (<svg…>…</svg>)` por:

```tsx
  return (
    <ChartCard
      title="Macrociclo · línea de tiempo"
      explain={{
        forma: "Volumen semanal (barras) + intensidad media por fase (línea) a lo largo del macro, con el taper antes de cada competencia.",
        sirve: "Ver el camino a la competencia y cómo se reestructura el volumen para picar.",
        lectura: "Cinta de fases arriba; 🚩 = competencia; HOY = semana actual; el taper baja las barras antes de cada 🚩.",
      }}
    >
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label={`Macrociclo ${macro.name} · ${NW} semanas`}>
        {ribbon}
        {bars}
        {intensityLine}
        {hoyEl}
        {flags}
      </svg>
    </ChartCard>
  );
```

- [ ] **Step 3: Test del título + ⓘ** — leé `macro-timeline.test.tsx`; si asume que el nodo raíz es el `<svg>`/`role="img"`, sigue OK (sigue existiendo dentro). Agregá:

```tsx
test("MacroTimeline: va en ChartCard (título + ⓘ de contexto)", () => {
  const macro = MACROCYCLES[0]!;
  render(<MacroTimeline macro={macro} hoy={3} comps={[]} />);
  expect(screen.getByText(/Macrociclo · línea de tiempo/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /cómo se lee/i })).toBeInTheDocument();
});
```
(asegurate de importar `render, screen` de `@testing-library/react` y `MACROCYCLES` de `@holy-oly/core` si no están).

- [ ] **Step 4: Verificar** — Run: `pnpm --filter @holy-oly/web test macro-timeline`
Expected: PASS (incluido el nuevo). Si el test viejo rompe por el wrapper, ajustarlo (el `<svg>` sigue presente dentro del `ChartCard`).

---

## Task 6: Verificación completa + review de El Carnicero

- [ ] **Step 1: Suite + build** — Run:
```bash
pnpm --filter @holy-oly/web test && pnpm --filter @holy-oly/web exec tsc --noEmit && pnpm --filter @holy-oly/web exec eslint src && pnpm --filter @holy-oly/web build
```
Expected: todo verde.

- [ ] **Step 2: El Carnicero** — dispatch (rol-adoptado / `subagent_type: el-carnicero` en sesión nueva). Prompt: *"Revisá `git diff` contra el rulebook. Foco: §4 color=estado (¿quedó algún hex decorativo o color que colisione con STATUS? ¿las fases del MacroTimeline usan paleta neutra?); HR-1 (¿se fueron los números planos de Bienestar?); las bandas de referencia (IMR ±2 visible, CompChart 85/70, Bienestar vs-normal) no inventan umbrales fuera del rulebook."*
Expected: sin CRITICAL/HIGH. Arreglar lo real + re-verificar.

---

## Task 7: `[GATED]` Cierre
- [ ] Con OK del usuario: commit `feat(web): charts Fase 2 — MacroTimeline a ChartCard + bandas/colores (tokens, ±2, vs-normal)` → `git push origin claude/loving-fermat-8c0b1d:main` → confirmar deploy live.

---

## Self-Review

**1. Spec coverage:**
- §3 MacroTimeline→ChartCard + tokens → Task 5. ✓
- §3 RecoveryChart línea por estado + token → Task 4. ✓
- §3 ImrFase ±2 → Task 2. ✓
- §3 WellnessChart sin números planos + score vs-normal → Task 1. ✓
- §3 CompChart zonas 85/70 → Task 3. ✓
- §2 Bienestar vs-su-normal (media±desvío) → Task 1 Step 4. ✓ · RPE como tendencia → sin cambio (correcto). ✓
- §4 verificación (El Carnicero + deploy + tests donde dan señal) → Tasks 1,5 (unit) + Task 6. ✓

**2. Placeholder scan:** Edits concretos por chart con el código exacto. Paleta neutra pineada. Sin "TBD".

**3. Type consistency:** `STATUS` (de `../status`, keys CellState) usado en Tasks 2-5. `CellState` importado en Task 4 para `pointState`. `ChartCard`/`explain {forma,sirve,lectura}` = el contrato real (Fase 1). `recoveryState`/`recoverySeries` = exports reales de core. ✓

---

## Execution Handoff (ver pasos al final del skill)
