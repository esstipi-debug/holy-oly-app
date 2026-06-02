# Remediación de charts — Fase 1 · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar contexto HR-2 (cómo se forma / para qué sirve / contra qué se lee) a los 11 charts vía un `explain` requerido en `ChartCard` que se abre al tap en un `BottomSheet`, y matar 2 bugs de falso-verde (`WeightChart`, `ImrFaseChart`).

**Architecture:** Un cambio sistémico en `chartkit.ChartCard` (prop `explain` requerido + estado local + `BottomSheet`) fuerza, vía el tipo requerido, a que los 11 charts pasen su contexto. Dos helpers puros en `packages/core/src/logic/monitor.ts` (`weightBandState`, `imrStateForWeekSafe`) corrigen el falso-verde con la disciplina de sin-dato ya existente.

**Tech Stack:** React 18 + Vite + TS; vitest + @testing-library/react; `@holy-oly/core` (lógica pura).

> **Commits:** marcados `[GATED]` — sólo con OK del usuario (default: commit final + push a main = deploy, como en el ciclo de El Carnicero).

---

## File Structure

| Archivo | Crea/Modifica | Responsabilidad |
|---------|---------------|-----------------|
| `packages/core/src/logic/monitor.ts` | Modifica | + `weightBandState`, `imrStateForWeekSafe` |
| `packages/core/src/logic/monitor.test.ts` | Modifica | + tests de los 2 helpers |
| `apps/web/src/ui/charts/chartkit.tsx` | Modifica | `ChartCard` gana `explain` requerido + tap→`BottomSheet`; nuevo `ChartExplainSheet` + `type Explain` |
| `apps/web/src/ui/__tests__/chartkit.test.tsx` | Modifica | actualizar el render existente (ahora `explain` requerido) + test del tap |
| `apps/web/src/ui/charts/*.tsx` (los 11) | Modifica | cada uno pasa su `explain`; `WeightChart` + `ImrFaseChart` además aplican el fix |

---

## Task 1: Helpers de core (falso-verde) — TDD

**Files:**
- Modify: `packages/core/src/logic/monitor.ts`
- Test: `packages/core/src/logic/monitor.test.ts`

- [ ] **Step 1: Tests que fallan** — agregá a `monitor.test.ts` (dentro del `describe("monitor", …)` o al final del archivo, importando los nuevos símbolos en el `import { … } from "./monitor"`):

```ts
it("weightBandState: dentro→ok, fuera→alert, sin banda/dato→none", () => {
  expect(weightBandState(80.5, [80, 81])).toBe("ok");
  expect(weightBandState(80, [80, 81])).toBe("ok");      // borde inclusivo
  expect(weightBandState(81.4, [80, 81])).toBe("alert"); // por encima
  expect(weightBandState(79.6, [80, 81])).toBe("alert"); // por debajo
  expect(weightBandState(80.5, undefined)).toBe("none"); // sin categoría
  expect(weightBandState(undefined, [80, 81])).toBe("none");
  expect(weightBandState(NaN, [80, 81])).toBe("none");
});

it("imrStateForWeekSafe: NaN→none (nunca falso-verde)", () => {
  const macro = MACROCYCLES[0]!;
  expect(imrStateForWeekSafe(NaN, macro, 1)).toBe("none");
  // un IMR finito delega en imrStateForWeek (Estado real)
  expect(imrStateForWeekSafe(70, macro, 1)).not.toBe("none");
});
```

Y sumá `weightBandState, imrStateForWeekSafe` al `import { … } from "./monitor"` del tope del test.

- [ ] **Step 2: Verificar que fallan** — Run: `pnpm --filter @holy-oly/core test`
Expected: FAIL (`weightBandState`/`imrStateForWeekSafe` no existen).

- [ ] **Step 3: Implementar** — agregá al final de `packages/core/src/logic/monitor.ts`:

```ts
/** Estado del peso vs la banda de categoría [lo,hi]. Sin banda o sin dato → "none" (nunca falso-verde).
 *  Disciplina: binario ok/alert — un "cerca del borde→warn" exigiría un margen que el rulebook no define. */
export function weightBandState(weight: number | undefined, band: [number, number] | undefined): CellState {
  if (band === undefined || weight === undefined || !Number.isFinite(weight)) return "none";
  return weight >= band[0] && weight <= band[1] ? "ok" : "alert";
}

/** Guarded imrStateForWeek: un IMR no-finito (sin dato) es "none", nunca un falso "ok".
 *  Gemelo de acwrStateSafe para el chart IMR-vs-fase. */
export function imrStateForWeekSafe(imr: number, macro: Macrocycle, week: number): CellState {
  return Number.isFinite(imr) ? imrStateForWeek(imr, macro, week) : "none";
}
```

- [ ] **Step 4: Verificar que pasan** — Run: `pnpm --filter @holy-oly/core test`
Expected: PASS (todos los suites core verdes; era 35, ahora 37).

- [ ] **Step 5: `[GATED]` Commit**

```bash
git add packages/core/src/logic/monitor.ts packages/core/src/logic/monitor.test.ts
git commit -m "feat(core): weightBandState + imrStateForWeekSafe (disciplina de sin-dato para charts)"
```

---

## Task 2: `ChartCard` gana `explain` + tap→`BottomSheet` — TDD

**Files:**
- Modify: `apps/web/src/ui/charts/chartkit.tsx`
- Test: `apps/web/src/ui/__tests__/chartkit.test.tsx`

- [ ] **Step 1: Confirmar el blast radius** — Run: `pnpm --filter @holy-oly/web exec grep -rl "ChartCard" src` (o Grep "ChartCard" en `apps/web/src`).
Expected: sólo los 11 charts en `src/ui/charts/` + `chartkit.tsx` (definición) + el test. Si aparece otro consumidor, sumarlo al retrofit (Task 3).

- [ ] **Step 2: Actualizar + agregar tests** — reemplazá el test de `ChartCard` en `apps/web/src/ui/__tests__/chartkit.test.tsx` por (el `linePath` test queda igual):

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { ChartCard, linePath } from "../charts/chartkit";

const EXPLAIN = { forma: "A ÷ B", sirve: "decidir X", lectura: "banda 0,8–1,3" };

test("linePath builds an SVG path from points", () => {
  expect(linePath([[0, 10], [10, 20], [20, 5]])).toBe("M0 10 L10 20 L20 5");
});

test("ChartCard renders its title, chip, and svg children", () => {
  const { container } = render(
    <ChartCard title="ACWR" sub="banda 0,8–1,3" chip="1.42" chipState="warn" explain={EXPLAIN}>
      <svg data-testid="kid" />
    </ChartCard>,
  );
  expect(screen.getByText("ACWR")).toBeInTheDocument();
  expect(screen.getByText("1.42")).toBeInTheDocument();
  expect(container.querySelector('[data-testid="kid"]')).toBeInTheDocument();
});

test("ChartCard: el tap en ⓘ abre el sheet con las 3 secciones de HR-2", () => {
  render(<ChartCard title="ACWR" explain={EXPLAIN}><svg /></ChartCard>);
  expect(screen.queryByText("A ÷ B")).not.toBeInTheDocument();          // cerrado: no está
  fireEvent.click(screen.getByRole("button", { name: /cómo se lee/i })); // tap
  expect(screen.getByText("A ÷ B")).toBeInTheDocument();                 // forma
  expect(screen.getByText("decidir X")).toBeInTheDocument();             // sirve
  expect(screen.getByText("banda 0,8–1,3")).toBeInTheDocument();         // lectura
});
```

- [ ] **Step 3: Verificar que falla** — Run: `pnpm --filter @holy-oly/web test src/ui/__tests__/chartkit.test.tsx`
Expected: FAIL (no existe `explain` ni el botón).

- [ ] **Step 4: Implementar** — reemplazá `apps/web/src/ui/charts/chartkit.tsx` por:

```tsx
import { useState, type ReactNode } from "react";
import { Card } from "../Card";
import { Badge } from "../Badge";
import { BottomSheet } from "../BottomSheet";
import type { CellState } from "@holy-oly/core";
import { STATUS } from "../status";

/** Las 3 respuestas que HR-2 exige de todo gráfico. Requerido en ChartCard → ningún chart compila sin contexto. */
export type Explain = { forma: string; sirve: string; lectura: string };

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

function ChartExplainSheet({ title, explain }: { title: string; explain: Explain }) {
  const rows: [string, string][] = [
    ["Cómo se forma", explain.forma],
    ["Para qué sirve", explain.sirve],
    ["Contra qué se lee", explain.lectura],
  ];
  return (
    <div>
      <div style={{ fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 15, color: "var(--wl-text)", marginBottom: 12 }}>{title}</div>
      {rows.map(([label, value]) => (
        <div key={label} style={{ marginBottom: 12 }}>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: ".04em", color: "var(--wl-muted)", marginBottom: 3 }}>{label}</div>
          <div style={{ fontSize: 13, color: "var(--wl-text)", lineHeight: 1.45 }}>{value}</div>
        </div>
      ))}
    </div>
  );
}

/** Chart card: title + subtitle + optional estado chip + required HR-2 explain (tap "ⓘ" → BottomSheet). */
export function ChartCard({ title, sub, chip, chipState, explain, children }: {
  title: string; sub?: string; chip?: string; chipState?: CellState; explain: Explain; children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <div style={{ fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 13.5, color: "var(--wl-text)" }}>{title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {chip != null && (
            chipState && chipState !== "none"
              ? <Badge tone={chipState}>{chip}</Badge>
              : <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: chipState === "none" ? STATUS.none : "var(--wl-muted)" }}>{chip}</span>
          )}
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={`Cómo se lee: ${title}`}
            style={{
              width: 18, height: 18, borderRadius: 9, border: "1px solid var(--wl-muted)",
              background: "transparent", color: "var(--wl-muted)", fontSize: 11, lineHeight: "15px",
              padding: 0, cursor: "pointer", fontFamily: "var(--mono)", flex: "0 0 auto",
            }}
          >i</button>
        </div>
      </div>
      {sub && <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--wl-muted)", margin: "3px 0 9px" }}>{sub}</div>}
      {children}
      <BottomSheet open={open} onClose={() => setOpen(false)}>
        <ChartExplainSheet title={title} explain={explain} />
      </BottomSheet>
    </Card>
  );
}
```

- [ ] **Step 5: Verificar el test del chartkit** — Run: `pnpm --filter @holy-oly/web test src/ui/__tests__/chartkit.test.tsx`
Expected: PASS. (El typecheck global aún ROJO: los 11 charts no pasan `explain` todavía → se arregla en Task 3. No commitear aún.)

---

## Task 3: Retrofit de los charts que usan ChartCard + fix de los 2 bugs

> **CORRECCIÓN (grep de Task 2 Step 1):** sólo **7** charts usan `ChartCard` → AcwrChart, CompChart, ImrFaseChart, LoadChart, RecoveryChart, WeightChart, WellnessChart. Los otros 4 NO usan ChartCard: Heatmap / RiskQuadrant / MacroPeriodization ya tienen contexto propio (audit = buenos); MacroTimeline necesita ser envuelto en ChartCard → **eso es Fase 2**. Ejecutar sólo los 7 (saltear los steps de Heatmap/MacroPeriodization/MacroTimeline/RiskQuadrant).

Cada chart agrega `explain={{ forma, sirve, lectura }}` a su `<ChartCard …>`. `WeightChart` y `ImrFaseChart` además aplican su fix. **Copy a usar (revisable por el usuario):**

- [ ] **Step 1: `AcwrChart.tsx`** — en el `<ChartCard …>` agregá:
```tsx
explain={{
  forma: "Carga aguda ÷ media móvil de 4 semanas (incluye la actual).",
  sirve: "Detecta picos de carga que anticipan riesgo; fuera de banda → considerá descarga.",
  lectura: "Banda segura 0,8–1,3; >1,3 precaución, >1,5 alerta. El atleta no ve este número.",
}}
```

- [ ] **Step 2: `CompChart.tsx`**:
```tsx
explain={{
  forma: "Sesiones completadas sobre planificadas por semana (barras) + RPE medio reportado (línea).",
  sirve: "Ver si el plan se cumple y a qué costo percibido.",
  lectura: "Barras: verde ≥85%, amarillo ≥70%, rojo abajo. RPE en escala 5–10.",
}}
```

- [ ] **Step 3: `Heatmap.tsx`**:
```tsx
explain={{
  forma: "Por atleta y semana, el peor-de (carga ACWR, recuperación) de esa semana.",
  sirve: "Triage del plantel: ver de un vistazo quién está en rojo y hace cuánto.",
  lectura: "Color = estado (verde ok / amarillo precaución / rojo alerta); punteado = sin datos.",
}}
```

- [ ] **Step 4: `LoadChart.tsx`**:
```tsx
explain={{
  forma: "Carga semanal (barras) y carga crónica = media móvil de 4 semanas (línea).",
  sirve: "Ver la tendencia de carga; la crónica es la base contra la que se mide el ACWR.",
  lectura: "Unidades de carga del atleta; la barra más alta resalta el pico reciente.",
}}
```

- [ ] **Step 5: `MacroPeriodization.tsx`**:
```tsx
explain={{
  forma: "Del programa: corredor de intensidad esperada por fase (banda), intensidad media por fase (línea) y volumen relativo (barras).",
  sirve: "Entender la forma del macrociclo antes de asignarlo: dónde sube intensidad y baja volumen.",
  lectura: "Banda = IMR esperado por fase; barras = volumen relativo; ▲ = pico.",
}}
```

- [ ] **Step 6: `MacroTimeline.tsx`**:
```tsx
explain={{
  forma: "Volumen semanal (barras) + intensidad (línea) a lo largo del macro, con el taper antes de cada competencia.",
  sirve: "Ver el camino a la competencia y cómo se reestructura el volumen para picar.",
  lectura: "🚩 = competencia; HOY marca la semana actual; el tramo reestructurado se resalta.",
}}
```

- [ ] **Step 7: `RecoveryChart.tsx`**:
```tsx
explain={{
  forma: "HRV y FC en reposo (RHR) por semana, comparadas contra el baseline propio del atleta.",
  sirve: "Leer la recuperación: HRV cayendo o RHR subiendo sostenidos sugieren fatiga.",
  lectura: "Banda alrededor del baseline; fuera de banda (HRV↓ / RHR↑) = vigilar.",
}}
```

- [ ] **Step 8: `RiskQuadrant.tsx`**:
```tsx
explain={{
  forma: "Cada atleta ubicado por ACWR (eje X) y recuperación (eje Y) de su última semana.",
  sirve: "Triage: identificar quién está en la zona de riesgo (ACWR alto + recuperación baja).",
  lectura: "Esquina de riesgo resaltada; los atletas sin datos se listan aparte, no se grafican.",
}}
```

- [ ] **Step 9: `WellnessChart.tsx`**:
```tsx
explain={{
  forma: "Score de bienestar (0–100) + 6 ítems del cuestionario (fatiga, dolor, estrés, humor, motivación, sueño) como tendencias.",
  sirve: "Contexto subjetivo que complementa las señales fisiológicas.",
  lectura: "Tendencia de cada ítem vs su normal; el score resume el conjunto.",
}}
```

- [ ] **Step 10: `WeightChart.tsx` — explain + fix del falso-verde**. (a) importá el helper:
```tsx
import { weightBandState, type MonitorSeries } from "@holy-oly/core";
```
(b) cambiá el `fill` del punto (líneas ~47-52) de `STATUS.ok` a estado real:
```tsx
          <circle
            cx={x(weeks)}
            cy={y(lastWt)}
            r={3.4}
            style={{ fill: STATUS[weightBandState(lastWt, band)] } as React.CSSProperties}
          />
```
(c) agregá al `<ChartCard …>`:
```tsx
explain={{
  forma: "Peso corporal por semana vs la banda de la categoría objetivo.",
  sirve: "Seguir si el atleta da el peso de su categoría de cara a la competencia.",
  lectura: "Banda = límites de categoría; el punto se pinta rojo si está fuera, neutro si no hay categoría asignada.",
}}
```

- [ ] **Step 11: `ImrFaseChart.tsx` — explain + guarda de sin-dato**. (a) cambiá el import a la versión segura:
```tsx
import { imrStateForWeek, imrStateForWeekSafe, type Macrocycle, type MonitorSeries } from "@holy-oly/core";
```
(b) el chip (línea ~17-18) con guarda de finitud:
```tsx
      chip={Number.isFinite(imr.at(-1)) ? String(imr.at(-1)) : undefined}
      chipState={imr.at(-1) != null ? imrStateForWeekSafe(imr.at(-1)!, macro, weeks) : undefined}
```
(c) el dot (línea ~52) usa la versión segura:
```tsx
            style={{ fill: STATUS[imrStateForWeekSafe(v, macro, i + 1)] } as React.CSSProperties}
```
(d) agregá el `explain`:
```tsx
explain={{
  forma: "IMR (intensidad media relativa) reportado vs la banda que el programa espera en cada fase.",
  sirve: "Detectar desajuste entre el plan y la realidad; si el IMR se va de la banda de la fase, revisar cargas.",
  lectura: "Banda escalonada por fase (se mueve con el macro), con tolerancia ±2.",
}}
```
> Si tras esto `imrStateForWeek` queda sin usar, quitalo del import (eslint `no-unused-vars`).

- [ ] **Step 12: Verificación completa** — Run:
```bash
pnpm --filter @holy-oly/web test && pnpm --filter @holy-oly/web exec tsc --noEmit && pnpm --filter @holy-oly/web exec eslint src && pnpm --filter @holy-oly/web build
```
Expected: typecheck **verde** (los 11 charts ya pasan `explain`), eslint limpio, build OK, todos los tests web verdes (102 previos + 1 nuevo de tap).

- [ ] **Step 13: `[GATED]` Commit**
```bash
git add apps/web/src/ui/charts apps/web/src/ui/__tests__/chartkit.test.tsx
git commit -m "feat(web): contexto HR-2 en charts (ChartCard explain+tap) + fix falso-verde Weight/Imr"
```

---

## Task 4: Review de El Carnicero

- [ ] **Step 1: Dispatch** — corré el revisor de dominio (en sesión nueva: `subagent_type: el-carnicero`; en esta sesión: `general-purpose` que lee `.claude/agents/el-carnicero.md` + adopta el rol). Prompt: *"Revisá el diff de `git diff main...HEAD` contra el rulebook, foco en HR-2 (¿los 11 charts ahora explican cómo-se-forma/para-qué/contra-qué?) y disciplina de sin-dato (¿murió el falso-verde de WeightChart/ImrFaseChart?)."*
Expected: confirma HR-2 satisfecho + falso-verde muerto; sin CRITICAL/HIGH nuevos. Si marca algo real, arreglarlo y re-verificar (Task 3 Step 12).

---

## Task 5: `[GATED]` Cierre

- [ ] **Step 1:** Con OK del usuario, push a main (deploy): `git push origin claude/loving-fermat-8c0b1d:main`.
- [ ] **Step 2:** Reportar: HR-2 ahora es compile-time (ningún chart compila sin contexto), falso-verde muerto, Fase 2 (polish visual por chart) queda como próximo ciclo.

---

## Self-Review

**1. Spec coverage:**
- §3 ChartCard explain+tap+BottomSheet → Task 2. ✓
- §4 retrofit 11 charts → Task 3 steps 1-11. ✓
- §5 WeightChart falso-verde → Task 1 (`weightBandState`) + Task 3 step 10. ✓
- §5 ImrFaseChart guarda → Task 1 (`imrStateForWeekSafe`) + Task 3 step 11. ✓
- §7 verificación (TDD + El Carnicero + build) → Tasks 1-4. ✓
- §2 "explain requerido fuerza los 11" → Task 2 (tipo requerido) + Task 3 (typecheck verde sólo tras retrofit). ✓
- §6 Fase 2 fuera de scope → no hay tasks para bandas/colores profundos. ✓ (correcto)

**2. Placeholder scan:** Todo el código está completo (helpers, ChartCard entero, 11 explains literales, 2 fixes con líneas). Sin "TBD".

**3. Type consistency:** `Explain {forma,sirve,lectura}` definido en Task 2, usado idéntico en los 11 de Task 3. `weightBandState(weight?, band?)` / `imrStateForWeekSafe(imr,macro,week)` definidos en Task 1, usados igual en Task 3 steps 10-11. `CellState`/`STATUS` ya existentes. ✓

---

## Execution Handoff (ver pasos al final del skill)
