# A4 «Sesión completada» — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar al atleta una pantalla de victoria al terminar y guardar un entreno, con datos reales del día (tonelaje, serie más pesada con discos oficiales, cumplimiento, posición en el macro), sobria y honesta.

**Architecture:** Agregación en `packages/core` (puro, testeado) → la pantalla web (`VictoriaScreen`, container) la consume tras re-leer la sesión guardada. Discos vía el componente oficial `Disc.tsx`; macro reutiliza el `CaminoCard` existente. Trigger: `EntrenoScreen.save()` navega a una ruta `/victoria` nueva.

**Tech Stack:** TypeScript, React 18 + react-router-dom, Vite, vitest + @testing-library/react (convención del repo: `fireEvent`, no `userEvent`). Monorepo pnpm (`@holy-oly/core`, `@holy-oly/web`).

**Spec:** `docs/superpowers/specs/2026-06-05-a4-sesion-completada-victoria-design.md`

**Worktree:** `C:\Holy Oly 0017\.claude\worktrees\distracted-maxwell-f8b846` (tiene `node_modules`; el checkout principal NO — nunca correr pnpm ahí).

---

## 🔴 Reglas no-negociables (verificar en cada task)

1. **Discos:** SIEMPRE `DiscRow` de `apps/web/src/ui/Disc.tsx` (sólo 10/15/20/25, barra por sexo). Nunca redibujar ni usar el `DiscoSet`/`--iwf*` del mockup.
2. **kg = verdad**, discos aproximan.
3. **Sin RPE, sin ACWR, sin rachas** en la pantalla.
4. **El calentamiento nunca cuenta** como carga.
5. **Honestidad de dato:** sin-dato → ocultar la tarjeta o «—», nunca un número inventado.

## Decisiones cerradas

- Ruta propia `/atleta/entreno/:week/:idx/victoria`; «Listo» → `/atleta`.
- Badge «Descenso honrado» **diferido** (no se renderiza).
- Titular **adaptativo**: ≥1 ejercicio hecho → «Sesión completada» + todas las tarjetas; 0 hechos → «Sesión registrada», sin carga total ni serie más pesada.
- **Reuso `CaminoCard`** para la tarjeta «posición en el macro» (no se porta el `MacroStrip` del mockup). Trade-off aceptado: el ribbon usa fill `--wl-accent`, no la rampa de fases coloreada del mockup.
- Tokens STATUS (`--ok/--warn/--alert/--gold`) se agregan a `apps/web/src/screens/atleta/atleta.css` `:root` (stylesheet global del atleta; junto a `--ho-mono`), no a `theme.css` (que es por-skin). Fases vienen de `phasePalette.ts` (no se usan en A4 al reusar CaminoCard, pero los tokens STATUS sí: segmentos de cumplimiento en verde-ok).
- La pantalla usa **estilos inline + clases reusables** (`.ho-card`, `.wl-btn`, `.ho-nodata`) como el resto de `screens/atleta/entreno/` (SessionPlayer/ResumenDia). No se crea `victoria.css`.

## File Structure

- **Create** `packages/core/src/logic/sessionStats.ts` — agregaciones puras (`setTonnage`, `sessionTonnage`, `heaviestSet`, `completion`).
- **Create** `packages/core/src/logic/sessionStats.test.ts` — unit tests.
- **Modify** `packages/core/src/index.ts` — exportar `./logic/sessionStats`.
- **Modify** `apps/web/src/screens/atleta/atleta.css` — `:root` gana `--ok/--warn/--alert/--gold`.
- **Create** `apps/web/src/screens/atleta/entreno/VictoriaScreen.tsx` — container + tarjetas A4.
- **Create** `apps/web/src/screens/atleta/__tests__/victoria.test.tsx` — tests de la pantalla.
- **Modify** `apps/web/src/screens/atleta/EntrenoScreen.tsx` — `save()` navega a `/victoria`.
- **Modify** `apps/web/src/app/router.tsx` — ruta nueva + import.

---

## Task 1: Core — `sessionStats.ts` (agregaciones puras, TDD)

**Files:**
- Create: `packages/core/src/logic/sessionStats.ts`
- Test: `packages/core/src/logic/sessionStats.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/logic/sessionStats.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { PrescribedExerciseView, SetActual } from "../types";
import { setTonnage, sessionTonnage, heaviestSet, completion } from "./sessionStats";

const ex = (over: Partial<PrescribedExerciseView>): PrescribedExerciseView => ({
  movementId: "arranque", movementName: "Arranque", sets: 3, reps: 2, ...over,
});
const set = (kg: number | undefined, reps: number | undefined, done: boolean): SetActual => ({ kg, reps, done });

describe("setTonnage", () => {
  it("kg×reps cuando está hecha y tiene ambos datos", () => {
    expect(setTonnage(set(100, 2, true))).toBe(200);
  });
  it("0 si no está hecha, o falta kg o reps", () => {
    expect(setTonnage(set(100, 2, false))).toBe(0);
    expect(setTonnage(set(undefined, 2, true))).toBe(0);
    expect(setTonnage(set(100, undefined, true))).toBe(0);
  });
});

describe("sessionTonnage", () => {
  it("suma sólo series hechas con kg&reps de todos los ejercicios", () => {
    const exercises: PrescribedExerciseView[] = [
      ex({ actual: { done: true, movementId: "arranque", movementName: "Arranque", substituted: false, desfasado: false,
        sets: [set(60, 2, true), set(60, 2, true), set(60, 2, false)] } }),
      ex({ movementId: "sentadilla", movementName: "Sentadilla", actual: { done: true, movementId: "sentadilla", movementName: "Sentadilla", substituted: false, desfasado: false,
        sets: [set(100, 5, true)] } }),
    ];
    expect(sessionTonnage(exercises)).toBe(60 * 2 + 60 * 2 + 100 * 5); // 740
  });
  it("el calentamiento (warmup) no entra: vive fuera de actual.sets", () => {
    const exercises: PrescribedExerciseView[] = [
      ex({ warmup: [{ pct: 0, kg: 20, reps: 5, label: "barra" }],
        actual: { done: true, movementId: "arranque", movementName: "Arranque", substituted: false, desfasado: false,
          sets: [set(80, 2, true)] } }),
    ];
    expect(sessionTonnage(exercises)).toBe(160);
  });
  it("sin actual → 0", () => {
    expect(sessionTonnage([ex({})])).toBe(0);
  });
});

describe("heaviestSet", () => {
  it("elige el mayor kg hecho y devuelve el movimiento real (actual)", () => {
    const exercises: PrescribedExerciseView[] = [
      ex({ actual: { done: true, movementId: "arranque", movementName: "Arranque", substituted: false, desfasado: false, sets: [set(60, 2, true)] } }),
      ex({ movementId: "envion", movementName: "Envión", actual: { done: true, movementId: "envion", movementName: "Envión", substituted: false, desfasado: false, sets: [set(140, 1, true), set(142, 1, true)] } }),
    ];
    expect(heaviestSet(exercises)).toEqual({ movementName: "Envión", kg: 142 });
  });
  it("empate → la primera", () => {
    const exercises: PrescribedExerciseView[] = [
      ex({ movementName: "A", actual: { done: true, movementId: "a", movementName: "A", substituted: false, desfasado: false, sets: [set(100, 2, true)] } }),
      ex({ movementName: "B", actual: { done: true, movementId: "b", movementName: "B", substituted: false, desfasado: false, sets: [set(100, 2, true)] } }),
    ];
    expect(heaviestSet(exercises)).toEqual({ movementName: "A", kg: 100 });
  });
  it("null cuando ninguna serie hecha tiene kg (sustituido/limpio o no-hecho)", () => {
    const exercises: PrescribedExerciseView[] = [
      ex({ actual: { done: true, movementId: "arranque", movementName: "Arranque", substituted: true, desfasado: false, sets: [set(undefined, 2, true)] } }),
      ex({ actual: { done: false, movementId: "envion", movementName: "Envión", substituted: false, desfasado: false, sets: [set(140, 1, false)] } }),
    ];
    expect(heaviestSet(exercises)).toBeNull();
  });
});

describe("completion", () => {
  it("cuenta ejercicios con ≥1 serie hecha / total", () => {
    const exercises: PrescribedExerciseView[] = [
      ex({ actual: { done: true, movementId: "a", movementName: "A", substituted: false, desfasado: false, sets: [set(60, 2, true), set(60, 2, false)] } }),
      ex({ actual: { done: false, movementId: "b", movementName: "B", substituted: false, desfasado: false, sets: [set(60, 2, false)] } }),
    ];
    expect(completion(exercises)).toEqual({ done: 1, total: 2 });
  });
  it("ejercicio sin actual cuenta como no hecho", () => {
    expect(completion([ex({}), ex({})])).toEqual({ done: 0, total: 2 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @holy-oly/core exec vitest run src/logic/sessionStats.test.ts`
Expected: FAIL — `Failed to resolve import "./sessionStats"` / functions not defined.

- [ ] **Step 3: Write minimal implementation**

Create `packages/core/src/logic/sessionStats.ts`:

```ts
import type { PrescribedExerciseView, SetActual } from "../types";

/** Tonelaje de una serie: kg×reps sólo si está hecha y tiene ambos datos. 0 en otro caso. */
export function setTonnage(set: SetActual): number {
  return set.done && set.kg != null && set.reps != null ? set.kg * set.reps : 0;
}

/** Carga total de la sesión = suma del tonelaje de las series hechas de todos los ejercicios.
 *  El calentamiento NO entra (vive en exercise.warmup, nunca en actual.sets). */
export function sessionTonnage(exercises: PrescribedExerciseView[]): number {
  return exercises.reduce(
    (sum, e) => sum + (e.actual?.sets ?? []).reduce((s, set) => s + setTonnage(set), 0),
    0,
  );
}

/** La serie hecha de mayor kg, con el movimiento realmente ejecutado. null si ninguna tiene kg. */
export function heaviestSet(exercises: PrescribedExerciseView[]): { movementName: string; kg: number } | null {
  let best: { movementName: string; kg: number } | null = null;
  for (const e of exercises) {
    const name = e.actual?.movementName ?? e.movementName;
    for (const set of e.actual?.sets ?? []) {
      if (set.done && set.kg != null && (best === null || set.kg > best.kg)) {
        best = { movementName: name, kg: set.kg };
      }
    }
  }
  return best;
}

/** Cumplimiento: cantidad de ejercicios con ≥1 serie hecha, sobre el total de ejercicios. */
export function completion(exercises: PrescribedExerciseView[]): { done: number; total: number } {
  const done = exercises.filter((e) => {
    const sets = e.actual?.sets;
    if (sets && sets.length > 0) return sets.some((s) => s.done);
    return e.actual?.done === true;
  }).length;
  return { done, total: exercises.length };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @holy-oly/core exec vitest run src/logic/sessionStats.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Export from the core barrel**

In `packages/core/src/index.ts`, after the line `export * from "./logic/actuals";` add:

```ts
export * from "./logic/sessionStats";
```

- [ ] **Step 6: Typecheck core**

Run: `pnpm --filter @holy-oly/core exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/logic/sessionStats.ts packages/core/src/logic/sessionStats.test.ts packages/core/src/index.ts
git commit -m "feat(core): sessionStats (tonelaje, serie mas pesada, cumplimiento) para A4"
```

---

## Task 2: Tokens STATUS en `atleta.css`

**Files:**
- Modify: `apps/web/src/screens/atleta/atleta.css:4`

- [ ] **Step 1: Add the status tokens to `:root`**

En `apps/web/src/screens/atleta/atleta.css`, la línea 4 es:

```css
:root { --ho-mono: 'JetBrains Mono', ui-monospace, monospace; }
```

Reemplazarla por (tokens STATUS fijos, categóricos, skin-independientes — mismo criterio que la rampa de fases):

```css
:root {
  --ho-mono: 'JetBrains Mono', ui-monospace, monospace;
  /* STATUS — semáforo (verde/ámbar/rojo) + oro de hito; fijos, no por-skin */
  --ok: #3FB55B;
  --warn: #E0A23B;
  --alert: #E5484D;
  --gold: #E8B23A;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/screens/atleta/atleta.css
git commit -m "feat(web): tokens STATUS (--ok/--warn/--alert/--gold) para superficies del atleta"
```

---

## Task 3: `VictoriaScreen.tsx` (container + tarjetas A4)

**Files:**
- Create: `apps/web/src/screens/atleta/entreno/VictoriaScreen.tsx`

- [ ] **Step 1: Create the screen**

Create `apps/web/src/screens/atleta/entreno/VictoriaScreen.tsx`:

```tsx
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { MePlanView, SessionView } from "@holy-oly/core";
import { barKgForSexo, sessionTonnage, heaviestSet, completion } from "@holy-oly/core";
import * as me from "../../../data/meClient";
import { DiscRow } from "../../../ui/Disc";
import { CaminoCard } from "../hoy/CaminoCard";

const CL = (n: number): string => n.toLocaleString("es-CL");

type LoadState = "loading" | "ready" | "error";

/** A4 · pantalla de victoria tras guardar un entreno. Re-lee la sesión guardada y muestra
 *  tonelaje del día, serie más pesada (discos oficiales), cumplimiento y posición en el macro.
 *  Titular adaptativo: 0 ejercicios hechos → «Sesión registrada» sin tarjetas de carga. */
export function VictoriaScreen() {
  const { week: weekP, idx: idxP } = useParams();
  const navigate = useNavigate();
  const week = Number(weekP);
  const idx = Number(idxP);

  const [plan, setPlan] = useState<MePlanView | null>(null);
  const [session, setSession] = useState<SessionView | undefined>(undefined);
  const [sessionsCount, setSessionsCount] = useState(0);
  const [state, setState] = useState<LoadState>("loading");

  useEffect(() => {
    if (!Number.isInteger(week) || !Number.isInteger(idx)) { navigate("/atleta", { replace: true }); return; }
    let on = true;
    Promise.all([me.getMePlan(), me.getMeSessions(week)])
      .then(([p, views]: [MePlanView, SessionView[]]) => {
        if (!on) return;
        const s = views.find((v) => v.sessionIdx === idx);
        if (!s) { setState("error"); return; }
        setPlan(p); setSession(s); setSessionsCount(views.length); setState("ready");
      })
      .catch(() => { if (on) setState("error"); });
    return () => { on = false; };
  }, [week, idx, navigate]);

  if (state === "loading") {
    return <div style={{ padding: 20, color: "var(--wl-muted)", fontFamily: "var(--ho-mono)" }}>Cargando…</div>;
  }
  if (state === "error" || !session || !plan) {
    return (
      <div style={{ padding: 20 }}>
        <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 18, color: "var(--wl-text)" }}>No pudimos cargar el resumen</div>
        <button type="button" className="wl-btn wl-btn--primary" style={{ width: "100%", marginTop: 14 }} onClick={() => navigate("/atleta")}>Volver al inicio</button>
      </div>
    );
  }

  const exercises = session.exercises;
  const barKg = barKgForSexo(plan.athlete.sexo);
  const comp = completion(exercises);
  const didWork = comp.done > 0;
  const tonnage = sessionTonnage(exercises);
  const heaviest = heaviestSet(exercises);
  const title = didWork ? "Sesión completada" : "Sesión registrada";
  const dayMoves = exercises.slice(0, 2).map((e) => e.actual?.movementName ?? e.movementName).join(" + ");
  const fecha = new Date().toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" });

  const muteFill = "color-mix(in srgb, var(--wl-text) 12%, transparent)";

  return (
    <div>
      {/* header */}
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--ho-mono)", fontSize: 10.5, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--wl-muted)" }}>
        <span>Holy Oly · Sesión</span>
        {plan.plan?.currentPhase && <span style={{ color: "var(--wl-accent)" }}>{plan.plan.currentPhase}</span>}
      </div>
      <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 30, lineHeight: 1, textTransform: "uppercase", color: "var(--wl-text)", marginTop: 8 }}>{title}</div>
      <div style={{ fontFamily: "var(--ho-mono)", fontSize: 11, color: "var(--wl-muted)", marginTop: 8, lineHeight: 1.5 }}>Día {idx + 1} — {dayMoves}<br />{fecha}</div>

      {/* carga total del día */}
      {didWork && (
        <div className="ho-card">
          <div className="ho-card__head"><span className="ho-card__t">Carga total del día</span><span className="ho-card__end" style={{ color: "var(--wl-muted)" }}>kg</span></div>
          <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 48, lineHeight: 1, color: "var(--wl-text)", fontVariantNumeric: "tabular-nums", marginTop: 6 }}>
            {CL(tonnage)}<span style={{ fontSize: 18, color: "var(--wl-muted)", marginLeft: 6 }}>kg</span>
          </div>
          <div style={{ fontFamily: "var(--ho-mono)", fontSize: 10, color: "var(--wl-muted)", marginTop: 8 }}>Tonelaje movido en la sesión · el calentamiento no cuenta</div>
        </div>
      )}

      {/* serie más pesada + discos oficiales */}
      {didWork && heaviest && (
        <div className="ho-card">
          <div className="ho-card__head"><span className="ho-card__t">Tu serie más pesada hoy</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, marginTop: 4 }}>
            <span style={{ fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 18, color: "var(--wl-text)" }}>{heaviest.movementName}</span>
            <span style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 24, color: "var(--wl-text)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{heaviest.kg}<span style={{ fontSize: 13, color: "var(--wl-muted)" }}> kg</span></span>
          </div>
          <div style={{ marginTop: 12 }}><DiscRow kg={heaviest.kg} barKg={barKg} /></div>
          <div style={{ fontFamily: "var(--ho-mono)", fontSize: 9.5, color: "var(--wl-muted)", marginTop: 10 }}>Discos IWF por lado · aproximan al kg</div>
        </div>
      )}

      {/* cumplimiento */}
      <div className="ho-card">
        <div className="ho-card__head"><span className="ho-card__t">Cumplimiento</span></div>
        <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "var(--ho-mono)", fontWeight: 700, fontSize: 20, color: "var(--wl-text)" }}>{comp.done}/{comp.total}</div>
            <div style={{ fontFamily: "var(--ho-mono)", fontSize: 10, color: "var(--wl-muted)", marginTop: 3 }}>ejercicios completados</div>
            <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
              {Array.from({ length: comp.total }).map((_, i) => (
                <div key={i} style={{ height: 5, flex: 1, borderRadius: 2, background: i < comp.done ? "var(--ok)" : muteFill }} />
              ))}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "var(--ho-mono)", fontWeight: 700, fontSize: 20, color: "var(--wl-text)" }}>{idx + 1} / {sessionsCount}</div>
            <div style={{ fontFamily: "var(--ho-mono)", fontSize: 10, color: "var(--wl-muted)", marginTop: 3 }}>sesión de la semana</div>
          </div>
        </div>
      </div>

      {/* posición en el macro — reuso del componente existente */}
      <CaminoCard plan={plan.plan} />

      {/* CTAs */}
      <button type="button" className="wl-btn wl-btn--primary" style={{ width: "100%", marginTop: 16 }} onClick={() => navigate("/atleta")}>Listo</button>
      <button type="button" className="wl-btn" style={{ width: "100%", marginTop: 10 }} onClick={() => navigate("/atleta")}>Registrar bienestar</button>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck web**

Run: `pnpm --filter @holy-oly/web exec tsc --noEmit`
Expected: no errors. (La pantalla aún no se enruta; se valida tipos.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/screens/atleta/entreno/VictoriaScreen.tsx
git commit -m "feat(web): VictoriaScreen A4 (carga, serie mas pesada con discos oficiales, cumplimiento, macro)"
```

---

## Task 4: Cablear trigger + ruta

**Files:**
- Modify: `apps/web/src/screens/atleta/EntrenoScreen.tsx:69`
- Modify: `apps/web/src/app/router.tsx`

- [ ] **Step 1: Redirigir a /victoria tras guardar**

En `apps/web/src/screens/atleta/EntrenoScreen.tsx`, dentro de `save()`, la línea:

```ts
      await me.putMeSession(week, idx, actuals);
      navigate("/atleta");
```

Reemplazar la navegación por:

```ts
      await me.putMeSession(week, idx, actuals);
      navigate(`/atleta/entreno/${week}/${idx}/victoria`);
```

- [ ] **Step 2: Registrar la ruta**

En `apps/web/src/app/router.tsx`:

a) Agregar el import después de la línea `import { EntrenoScreen } ...`:

```tsx
import { VictoriaScreen } from "../screens/atleta/entreno/VictoriaScreen";
```

b) En los `children` de la ruta `atleta`, después de
`{ path: "entreno/:week/:idx", element: <EntrenoScreen /> },` agregar:

```tsx
          { path: "entreno/:week/:idx/victoria", element: <VictoriaScreen /> },
```

- [ ] **Step 3: Typecheck web**

Run: `pnpm --filter @holy-oly/web exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Verify the existing entreno test still passes**

El test `guardar … → navega` espera la ruta `/atleta` (`<div>HOY</div>`). Tras el cambio, `save()` navega a `/atleta/entreno/8/0/victoria`. Revisar `apps/web/src/screens/atleta/__tests__/entreno.test.tsx`: ninguno de sus tests asierta el destino de navegación (sólo `put` toHaveBeenCalled y el contenido de `sent`). Confirmar corriendo:

Run: `pnpm --filter @holy-oly/web exec vitest run src/screens/atleta/__tests__/entreno.test.tsx`
Expected: PASS (5 tests). Si alguno fallara por la nueva ruta, agregar `<Route path="/atleta/entreno/:week/:idx/victoria" element={<div>VICTORIA</div>} />` al `renderEntreno()` de ese test (sólo si es necesario).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/screens/atleta/EntrenoScreen.tsx apps/web/src/app/router.tsx
git commit -m "feat(web): al guardar el entreno navega a la pantalla de victoria A4"
```

---

## Task 5: Tests de `VictoriaScreen` + verificación final

**Files:**
- Create: `apps/web/src/screens/atleta/__tests__/victoria.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/screens/atleta/__tests__/victoria.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { afterEach, beforeEach, test, expect, vi } from "vitest";
import type { MePlanView, SessionView, ExerciseActual } from "@holy-oly/core";
import * as me from "../../../data/meClient";
import { VictoriaScreen } from "../entreno/VictoriaScreen";

const PLAN: MePlanView = {
  athlete: { nombre: "Mara V.", iniciales: "MV", sexo: "F" },
  plan: { macroName: "Ruso 5D", totalWeeks: 12, currentWeek: 8, currentPhase: "Fuerza", phases: [], comps: [] },
};

const actual = (over: Partial<ExerciseActual> & Pick<ExerciseActual, "movementId" | "movementName">): ExerciseActual => ({
  done: true, substituted: false, desfasado: false, ...over,
});

function sessions(over?: Partial<SessionView["exercises"][number]>): SessionView[] {
  return [{
    week: 8, sessionIdx: 0,
    exercises: [
      { movementId: "arranque", movementName: "Arranque", sets: 2, reps: 2, pct: 80, targetKg: 64,
        actual: actual({ movementId: "arranque", movementName: "Arranque", sets: [{ kg: 64, reps: 2, done: true }, { kg: 66, reps: 2, done: true }] }) },
      { movementId: "envion", movementName: "Envión", sets: 1, reps: 1, pct: 90, targetKg: 120,
        actual: actual({ movementId: "envion", movementName: "Envión", sets: [{ kg: 120, reps: 1, done: true }] }), ...over },
    ],
  }];
}

beforeEach(() => {
  vi.spyOn(me, "getMePlan").mockResolvedValue(PLAN);
});
afterEach(() => vi.restoreAllMocks());

function renderVictoria() {
  return render(
    <MemoryRouter initialEntries={["/atleta/entreno/8/0/victoria"]}>
      <Routes>
        <Route path="/atleta/entreno/:week/:idx/victoria" element={<VictoriaScreen />} />
        <Route path="/atleta" element={<div>HOY</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

test("≥1 hecho → «Sesión completada», carga total y discos visibles", async () => {
  vi.spyOn(me, "getMeSessions").mockResolvedValue(sessions());
  renderVictoria();
  expect(await screen.findByText("Sesión completada")).toBeInTheDocument();
  // carga total = 64*2 + 66*2 + 120*1 = 380 → "380"
  expect(screen.getByText("380")).toBeInTheDocument();
  // serie más pesada: Envión 120 kg (mayor kg) + discos (svg con texto del disco)
  expect(screen.getByText("Tu serie más pesada hoy")).toBeInTheDocument();
  // cumplimiento 2/2
  expect(screen.getByText("2/2")).toBeInTheDocument();
});

test("0 hechos → «Sesión registrada», sin carga total ni serie más pesada", async () => {
  const all0: SessionView[] = [{
    week: 8, sessionIdx: 0,
    exercises: [
      { movementId: "arranque", movementName: "Arranque", sets: 1, reps: 2, pct: 80, targetKg: 64,
        actual: actual({ movementId: "arranque", movementName: "Arranque", done: false, sets: [{ kg: 64, reps: 2, done: false }] }) },
    ],
  }];
  vi.spyOn(me, "getMeSessions").mockResolvedValue(all0);
  renderVictoria();
  expect(await screen.findByText("Sesión registrada")).toBeInTheDocument();
  expect(screen.queryByText("Carga total del día")).not.toBeInTheDocument();
  expect(screen.queryByText("Tu serie más pesada hoy")).not.toBeInTheDocument();
  expect(screen.getByText("0/1")).toBeInTheDocument();
});

test("series hechas sin kg → sin tarjeta de serie más pesada (honesto)", async () => {
  const noKg: SessionView[] = [{
    week: 8, sessionIdx: 0,
    exercises: [
      { movementId: "arranque", movementName: "Arranque", sets: 1, reps: 2, pct: 80, targetKg: 64,
        actual: actual({ movementId: "arranque", movementName: "Arranque", substituted: true, sets: [{ kg: undefined, reps: 2, done: true }] }) },
    ],
  }];
  vi.spyOn(me, "getMeSessions").mockResolvedValue(noKg);
  renderVictoria();
  expect(await screen.findByText("Sesión completada")).toBeInTheDocument();
  expect(screen.queryByText("Tu serie más pesada hoy")).not.toBeInTheDocument();
});

test("«Listo» navega al inicio", async () => {
  vi.spyOn(me, "getMeSessions").mockResolvedValue(sessions());
  renderVictoria();
  fireEvent.click(await screen.findByRole("button", { name: /^listo$/i }));
  await waitFor(() => expect(screen.getByText("HOY")).toBeInTheDocument());
});

test("API falla → estado de error con volver al inicio", async () => {
  vi.spyOn(me, "getMeSessions").mockRejectedValue(new Error("boom"));
  renderVictoria();
  expect(await screen.findByText(/no pudimos cargar/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /volver al inicio/i }));
  await waitFor(() => expect(screen.getByText("HOY")).toBeInTheDocument());
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `pnpm --filter @holy-oly/web exec vitest run src/screens/atleta/__tests__/victoria.test.tsx`
Expected: PASS (5 tests). Si el query `getByText("380")` falla por separador de miles (es-CL no agrupa < 10.000, así que "380" es correcto; números ≥ 1.000 usarían "1.380"), ajustar el fixture o el query — pero con 380 no hay agrupación.

- [ ] **Step 3: Full verification**

Run cada uno y confirmar verde:

```
pnpm --filter @holy-oly/core test
pnpm --filter @holy-oly/web test
pnpm --filter @holy-oly/core exec tsc --noEmit
pnpm --filter @holy-oly/web  exec tsc --noEmit
pnpm --filter @holy-oly/web  exec eslint src
pnpm --filter @holy-oly/web  build
```

Expected: core tests verdes (incluye 10 nuevos), web tests verdes (incluye 5 nuevos), tsc limpio ×2, eslint sin errores, build OK.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/screens/atleta/__tests__/victoria.test.tsx
git commit -m "test(web): VictoriaScreen A4 (titular adaptativo, discos, estados vacíos, navegación)"
```

---

## Notas para el ejecutor

- **No hay cambios de API ni de Prisma** → no se necesita `verify`/`e2e` con Postgres embebido para esta tanda. El sanity del bundle de api tampoco aplica (no se tocó `apps/api`).
- **Discos:** sólo `DiscRow`. Si en algún momento aparece la tentación de dibujar un disco, parar — es regla intocable.
- **El Carnicero** (revisor de dominio) corre **después** del build, sobre el feature completo: validar que el tonelaje excluye el calentamiento, que la serie más pesada es info-neutra (no trofeo), que el titular es honesto y que los discos son los oficiales.
- Tras El Carnicero: deploy (push a `main` → Render) + smoke (Playwright: terminar un entreno de Mara y confirmar la pantalla + discos IWF) + actualizar memoria.

---

## Self-Review

- **Spec coverage:**
  - Core `sessionStats` (setTonnage/sessionTonnage/heaviestSet/completion) → Task 1. ✔
  - Tokens STATUS → Task 2 (en `atleta.css :root`, desviación documentada vs el «theme.css» del spec). ✔
  - VictoriaScreen + tarjetas (header adaptativo, carga, serie más pesada+discos, cumplimiento, macro vía CaminoCard, CTA) → Task 3. ✔
  - Trigger en `save()` + ruta → Task 4. ✔
  - Tests core + web + verificación → Tasks 1 y 5. ✔
  - Badge descenso honrado: **fuera de alcance** (no aparece en ninguna task). ✔
  - Estados vacíos honestos (0 hechos, sin kg, error de API) → Task 3 + tests Task 5. ✔
- **Desviaciones del spec (intencionales):** (a) tokens en `atleta.css :root` en vez de `theme.css` (theme.css es por-skin; atleta.css tiene el `:root` global del atleta); (b) reuso de `CaminoCard` en vez de portar `MacroStrip` (el spec lo permitía: "reusar el ribbon existente si calza"). Ambas reducen código y mantienen consistencia.
- **Placeholder scan:** sin TBD/TODO; todo el código está completo. ✔
- **Type consistency:** `sessionTonnage`/`heaviestSet`/`completion` reciben `PrescribedExerciseView[]` en core, en los tests y en `VictoriaScreen` (que pasa `session.exercises`). `heaviestSet` devuelve `{ movementName, kg } | null` y la pantalla lo guardea con `heaviest &&`. `barKgForSexo`, `DiscRow({kg,barKg})`, `CaminoCard({plan})` usados con sus firmas reales. ✔
