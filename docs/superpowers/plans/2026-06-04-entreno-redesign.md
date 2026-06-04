# Entreno Rediseño — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Rediseñar el Entreno del atleta — discos en cada ejercicio (componente real, nunca redibujado), RPE fuera de todo, accesorios prescritos por %×RM de un lift de referencia, series/reps explícitas, y registro por adherencia-por-defecto ("se hace lo prescrito"; sólo se "modifica").

**Architecture:** core puro (tipos/lógica/catálogo/schemas) → api (Prisma/Fastify, migración) → web (React). El kg sale de `% × Plan.rms[rmRef]`; los discos se renderizan con el componente existente `Disc.tsx`/`DiscRow` + `perSide`/`DISC_COLORS`. El Entreno reusa `SessionActual`/`mergeActuals` (SP3/SP4) y el `SubstituteSheet` (SP4).

**Tech Stack:** TS strict (sin `any`, inmutable), Zod, Fastify 5 + Prisma 6 + Postgres (PG embebido en tests), React 18 + Vitest/RTL.

**Spec:** [`docs/superpowers/specs/2026-06-04-entreno-redesign-design.md`](../specs/2026-06-04-entreno-redesign-design.md)

---

## File Structure
- **core:** `types/index.ts` (quitar `rpe`; agregar `Atleta.sexo` + `MePlanView.athlete.sexo`); `logic/discs.ts` (`barKgForSexo`); `data/movements.ts` (`rmRef` de 6 bases); `data/recipes.ts` (`rpe→pct`); `logic/prescription.ts` (sin `rpe` en la vista); `logic/mePlan.ts` (sexo en la vista); `logic/actuals.ts` (sin `rpe`); `schemas.ts`.
- **api:** `prisma/schema.prisma` + migración `8_rpe_out_sexo`; `src/repo.ts`; `prisma/seed.ts`; int tests.
- **web:** `screens/atleta/EntrenoScreen.tsx` (rediseño); `screens/coach/sessions/SessionEditor.tsx` + `SessionsSection.tsx` (sin RPE); `data/meClient.ts` (sexo); tests.

Comandos: `pnpm --filter @holy-oly/{core,web} test [filtro]`, `… exec tsc --noEmit`, `pnpm --filter @holy-oly/api {test,verify,e2e}`, `… exec tsx scripts/make-migration.ts`, `… exec prisma generate`, `pnpm --filter @holy-oly/web exec eslint src`, `pnpm --filter @holy-oly/web build`.

---

## Phase A — core

### Task A1: `sexo` del atleta + barra por sexo

**Files:** Modify `packages/core/src/types/index.ts`, `packages/core/src/logic/discs.ts`, `packages/core/src/logic/mePlan.ts`, `packages/core/src/schemas.ts`; Test `packages/core/src/logic/discs.test.ts` (existe) + `packages/core/src/schemas.*.test.ts`.

- [ ] **Step 1: Test** — agregar a `discs.test.ts`:
```typescript
import { barKgForSexo } from "./discs";
it("barra 20 para hombre, 15 para mujer", () => {
  expect(barKgForSexo("M")).toBe(20);
  expect(barKgForSexo("F")).toBe(15);
});
```
- [ ] **Step 2:** `pnpm --filter @holy-oly/core test discs` → FAIL (`barKgForSexo` no existe).
- [ ] **Step 3: Implementar.**
  - `discs.ts`: agregar `export function barKgForSexo(sexo: "M" | "F"): number { return sexo === "F" ? 15 : 20; }` (se re-exporta desde el index público de core, igual que `perSide`).
  - `types/index.ts`: en `interface Atleta` agregar `sexo: "M" | "F";` (tras `nivel`); en `MePlanView.athlete` → `athlete: { nombre: string; iniciales: string; sexo: "M" | "F" };`.
  - `logic/mePlan.ts`: en `buildMePlanView`, al armar `athlete`, agregar `sexo: athlete.sexo` (el input ya es un `Atleta`, que ahora tiene `sexo`).
  - `schemas.ts`: `AtletaSchema` += `sexo: z.enum(["M", "F"]),`; el objeto `athlete` de `MePlanViewSchema` += `sexo: z.enum(["M", "F"]),`.
- [ ] **Step 4:** `pnpm --filter @holy-oly/core test && pnpm --filter @holy-oly/core exec tsc --noEmit` → verde. Si algún fixture de test construye un `Atleta`/`MePlanView` sin `sexo`, agregale `sexo: "M"` (o `"F"`). (core es su propio paquete; el seed de api se arregla en B2.)
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(core): sexo del atleta + barKgForSexo (barra 20 H / 15 M)"`

### Task A2: `rmRef` de los accesorios (mapeo aprobado)

**Files:** Modify `packages/core/src/data/movements.ts`; Test `packages/core/src/logic/movements.test.ts` (existe).

- [ ] **Step 1: Test** — agregar:
```typescript
it("accesorios referencian su RM (no quedan 'none')", () => {
  expect(getMovement("sentadilla-overhead")?.rmRef).toBe("arranque");
  expect(getMovement("press-empuje")?.rmRef).toBe("envion");
  expect(getMovement("press-hombros")?.rmRef).toBe("envion");
  expect(getMovement("peso-muerto-rumano")?.rmRef).toBe("sentadilla");
  expect(getMovement("buenos-dias")?.rmRef).toBe("sentadilla");
  expect(getMovement("remo")?.rmRef).toBe("envion");
});
```
- [ ] **Step 2:** `pnpm --filter @holy-oly/core test movements` → FAIL.
- [ ] **Step 3: Implementar** — en `MOVEMENT_BASES` cambiar `rmRef: "none"` → su referencia: `sentadilla-overhead`→`"arranque"`; `press-empuje`→`"envion"`; `press-hombros`→`"envion"`; `peso-muerto-rumano`→`"sentadilla"`; `buenos-dias`→`"sentadilla"`; `remo`→`"envion"`. (Actualizar/borrar los `notes` que digan "rmRef 'none'".)
- [ ] **Step 4:** `pnpm --filter @holy-oly/core test movements && pnpm --filter @holy-oly/core exec tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(core): accesorios referencian su RM (OHS→arranque, presses/remo→envión, RDL/buenos días→sentadilla)"`

### Task A3: RPE fuera de la prescripción + accesorios por % en la receta

**Files:** Modify `packages/core/src/types/index.ts`, `packages/core/src/data/recipes.ts`, `packages/core/src/logic/prescription.ts`, `packages/core/src/schemas.ts`; Test `packages/core/src/logic/prescription.test.ts` (existe) + `packages/core/src/data/recipes.test.ts` (existe).

- [ ] **Step 1: Test** — en `prescription.test.ts` agregar:
```typescript
it("un accesorio resuelve kg por %×RM de su referencia (sin RPE)", () => {
  const rms = { arranque: 92, envion: 116, sentadilla: 150, frente: 122 };
  expect(resolveTargetKg({ movementId: "peso-muerto-rumano", sets: 3, reps: 6, pct: 68 }, rms)).toBe(102);
  expect(resolveTargetKg({ movementId: "press-empuje", sets: 4, reps: 4, pct: 62 }, rms)).toBe(72);
});
```
y en `recipes.test.ts`:
```typescript
it("la receta Ruso 5D no usa RPE — los accesorios traen pct", () => {
  const fb = MACRO_RECIPES[0]!.phases.find((p) => p.phaseKey === "fuerza-basica")!;
  const rdl = fb.sessions[1]!.exercises[2]!;
  expect(rdl.movementId).toBe("peso-muerto-rumano");
  expect(rdl.pct).toBe(68);
  expect((rdl as { rpe?: number }).rpe).toBeUndefined();
});
```
- [ ] **Step 2:** `pnpm --filter @holy-oly/core test prescription recipes` → FAIL (los accesorios tienen `rpe`, no `pct`).
- [ ] **Step 3: Implementar.**
  - `types/index.ts`: quitar `rpe?: number;` de `interface PrescribedExercise` (línea ~201). (`PrescribedExerciseView`/`PrescriptionRow` lo heredan → se va solo.)
  - `data/recipes.ts`: reemplazar cada `rpe: N` por `pct: M` según §3 del spec, por fase:
    - `peso-muerto-rumano`: hiper `pct:60`, fuerza-básica `pct:68`, fuerza-potencia `pct:72`.
    - `press-empuje`: hiper `pct:55`, fuerza-básica `pct:62`, fuerza-potencia `pct:68`.
    - `sentadilla-overhead`: hiper `pct:65`, fuerza-básica `pct:72`, fuerza-potencia `pct:78`.
    - `buenos-dias`: hiper `pct:40`, fuerza-básica `pct:48`.
  - `logic/prescription.ts`: en `buildSessionViews` (map de ejercicios) **quitar** `rpe: r.rpe,`. Ajustar el comentario de `resolveTargetKg` (sacar la mención a `rpe`); la lógica queda igual (kgOverride > pct×RM; `none`/sin-pct → undefined).
  - `schemas.ts`: quitar `rpe: z.number().min(1).max(10).optional(),` de `PrescribedExerciseSchema`.
- [ ] **Step 4:** `pnpm --filter @holy-oly/core test && pnpm --filter @holy-oly/core exec tsc --noEmit` → verde (si algún test de prescripción construía un ex con `rpe`, quitarlo).
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(core): RPE fuera de la prescripción — accesorios por %×RM (receta Ruso 5D)"`

### Task A4: RPE fuera de los actuals

**Files:** Modify `packages/core/src/types/index.ts`, `packages/core/src/logic/actuals.ts`, `packages/core/src/schemas.ts`; Test `packages/core/src/logic/actuals.test.ts` + `packages/core/src/schemas.actuals.test.ts`.

- [ ] **Step 1: Editar tests** — en `actuals.test.ts` y `schemas.actuals.test.ts`, **quitar** toda referencia a `rpe`/`actualRpe` de los fixtures (los `SessionActual`/`ExerciseActualInput`/asserts que lo usen). Agregar una aserción de que la vista ya no expone rpe:
```typescript
it("el actual mergeado no expone rpe", () => {
  const v: SessionView[] = [{ week: 1, sessionIdx: 0, exercises: [
    { movementId: "arranque", sets: 5, reps: 2, pct: 80, movementName: "Arranque", targetKg: 64 } ]}];
  const rows: SessionActual[] = [{ week: 1, sessionIdx: 0, order: 0, movementId: "arranque", done: true, actualKg: 60 }];
  const a = mergeActuals(v, rows)[0]!.exercises[0]!.actual!;
  expect((a as { rpe?: number }).rpe).toBeUndefined();
});
```
- [ ] **Step 2:** `pnpm --filter @holy-oly/core test actuals schemas.actuals` → FAIL (tipos aún tienen rpe / fixtures rotos).
- [ ] **Step 3: Implementar.**
  - `types/index.ts`: quitar `actualRpe?: number;` de `interface SessionActual`; quitar `rpe?: number;` de `interface ExerciseActual`.
  - `logic/actuals.ts`: en `mergeActuals` quitar `rpe: a.actualRpe,` del objeto `actual`.
  - `schemas.ts`: quitar `rpe` de `ExerciseActualInputSchema` y de `ExerciseActualSchema`.
- [ ] **Step 4:** `pnpm --filter @holy-oly/core test && pnpm --filter @holy-oly/core exec tsc --noEmit` → verde (108→ los tests siguen; cuenta puede bajar por fixtures editados).
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(core): RPE fuera de los actuals (atleta no reporta RPE)"`

---

## Phase B — api

### Task B1: migración `8_rpe_out_sexo`

**Files:** Modify `apps/api/prisma/schema.prisma`; create migration.

- [ ] **Step 1:** En `schema.prisma`: en `model PrescribedExercise` borrar la línea `rpe`; en `model SessionActual` borrar la línea `actualRpe`; en `model Athlete` agregar `sexo String @default("M")`.
- [ ] **Step 2:** `pnpm --filter @holy-oly/api exec tsx scripts/make-migration.ts 8 rpe_out_sexo`. Abrir el SQL generado y confirmar que es: `ALTER TABLE "PrescribedExercise" DROP COLUMN "rpe";`, `ALTER TABLE "SessionActual" DROP COLUMN "actualRpe";`, `ALTER TABLE "Athlete" ADD COLUMN "sexo" TEXT NOT NULL DEFAULT 'M';` (el default cubre el backfill de filas existentes).
- [ ] **Step 3:** `pnpm --filter @holy-oly/api exec prisma generate`.
- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat(api): migración 8 — drop rpe/actualRpe + Athlete.sexo"`

### Task B2: repo + seed + integración

**Files:** Modify `apps/api/src/repo.ts`, `apps/api/prisma/seed.ts`, `apps/api/src/*.int.test.ts` (donde corresponda).

- [ ] **Step 1: Test** — en el int test de prescripción (donde se asigna plan y se lee `/athletes/:id/prescription`) agregar/ajustar:
```typescript
it("un accesorio del plan trae kg por %×RM y NO trae rpe", async () => {
  const coach = sess(await login("coach@holyoly.dev"));
  await app.inject({ method: "PUT", url: "/athletes/mv/plan", headers: coach, payload: { atletaId: "mv", macroId: "ruso-5d", startWeek: 1, startDate: "2026-04-01", rms: RMS, comps: [] } });
  const r = await app.inject({ method: "GET", url: "/athletes/mv/prescription?week=8", headers: coach });
  const sessions = r.json() as Array<{ exercises: Array<{ movementId: string; targetKg?: number; rpe?: number }> }>;
  const rdl = sessions.flatMap((s) => s.exercises).find((e) => e.movementId === "peso-muerto-rumano")!;
  expect(rdl.targetKg).toBeGreaterThan(0);
  expect(rdl.rpe).toBeUndefined();
});
```
(`RMS` = el helper existente con sentadilla 150; week 8 cae en fuerza-básica.)
- [ ] **Step 2:** `pnpm --filter @holy-oly/api verify` → FAIL (o tsc rojo) hasta sacar rpe del repo.
- [ ] **Step 3: Implementar.**
  - `repo.ts`: quitar `rpe` del mapeo de `PrescribedExercise` (lectura y escritura/instanciación) y `actualRpe` del mapeo de `SessionActual` (`setSessionActuals` createMany y `getPrescriptionWeek` rows→core). Mapear `sexo` del `Athlete` en el roster (`Atleta`) y en `buildMePlanView`/`/me/plan` (pasar `athlete.sexo`).
  - `seed.ts`: agregar `sexo` a cada atleta creado (Mara = `"F"`; el resto el que corresponda, default `"M"`).
- [ ] **Step 4:** `pnpm --filter @holy-oly/api verify && pnpm --filter @holy-oly/api exec tsc --noEmit` → verde (la nueva aserción pasa; SP3/SP4 int siguen verdes sin rpe).
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(api): repo+seed sin rpe + sexo del atleta (roster/me-plan)"`

---

## Phase C — web (atleta · EntrenoScreen)

### Task C1: meClient sin rpe + sexo

**Files:** Modify `apps/web/src/data/meClient.ts` (+ schemas web si los hay); Test `apps/web/src/data/meClient.test.ts` (existe) o `meSessions.test.ts`.

- [ ] **Step 1: Test** — ajustar el mock de `/me/plan` para incluir `athlete.sexo: "F"` y assert que `getMePlan()` lo devuelve; quitar `rpe` de cualquier fixture de `/me/sessions`.
- [ ] **Step 2:** `pnpm --filter @holy-oly/web test meClient meSessions` → FAIL.
- [ ] **Step 3: Implementar** — `meClient`/schemas web ya validan contra schemas de core (que ahora tienen `sexo` y no `rpe`); ajustar cualquier tipo/fixture local. `getMePlan()` ya devuelve `athlete.sexo` por el schema de core.
- [ ] **Step 4:** `pnpm --filter @holy-oly/web test meClient meSessions && pnpm --filter @holy-oly/web exec tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(web): meClient sin rpe + sexo del atleta"`

### Task C2: EntrenoScreen — discos + adherencia-por-defecto + modificar inline

**Files:** Modify `apps/web/src/screens/atleta/EntrenoScreen.tsx` + `apps/web/src/screens/atleta/__tests__/entreno.test.tsx`.

- [ ] **Step 1: Test** — reescribir `entreno.test.tsx` para el nuevo modelo. Casos (usar el mock de `getMePlan` con `athlete.sexo:"F"` + `getMeSessions` con 1 ejercicio `arranque` 5×2 targetKg 64):
  1. **render normal:** muestra "5 series × 2 repeticiones", el kg (64), discos (hay ≥1 `svg` de disco), y NO hay input siempre-visible ni checkbox "hecho".
  2. **guardar sin modificar:** click "Guardar/Listo" → el actual enviado para ese ejercicio tiene `done:true`, `kg:64` (=targetKg), `reps:2`, `movementId:"arranque"`, `prescribedMovementId:"arranque"`.
  3. **modificar peso:** click "✎ modificar" → cambiar kg a 60 → guardar → actual `done:true, kg:60`.
  4. **no la hice:** abrir modificar → "no la hice" → guardar → actual `done:false` (sin kg).
  5. **sustituir:** abrir modificar → ⇄ → elegir variante real (`arranque.colgado.bajo`) → kg se limpia → ingresar 50 → guardar → actual `movementId:"arranque.colgado.bajo"`, `prescribedMovementId:"arranque"`, `kg:50`.
```tsx
// estructura del test (mockear me.getMePlan + me.getMeSessions + me.putMeSession con vi.fn)
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import * as me from "../../../data/meClient";
import { EntrenoScreen } from "../EntrenoScreen";
// ... wrap en MemoryRouter con ruta /atleta/entreno/8/0; mock useParams week=8 idx=0
// me.getMePlan → { athlete:{nombre:"Mara",iniciales:"MV",sexo:"F"}, plan:{...} }
// me.getMeSessions → [{week:8,sessionIdx:0,exercises:[{movementId:"arranque",sets:5,reps:2,pct:80,movementName:"Arranque",targetKg:64}]}]
// me.putMeSession = vi.fn().mockResolvedValue(undefined)
```
(Ajustar a los helpers reales del test existente — wrapper de router, mock de `useNavigate`. El comportamiento bajo prueba es el de arriba; usá ids de variante reales de `simplerVariants("arranque")`.)
- [ ] **Step 2:** `pnpm --filter @holy-oly/web test entreno` → FAIL.
- [ ] **Step 3: Implementar `EntrenoScreen.tsx`** (reemplaza el componente; reusa `DiscRow` y `SubstituteSheet`, sin RPE, sin checkbox):
```tsx
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { SessionView, ExerciseActualInput } from "@holy-oly/core";
import { getMovement, barKgForSexo } from "@holy-oly/core";
import * as me from "../../data/meClient";
import { DiscRow } from "../../ui/Disc";
import { SubstituteSheet } from "../../ui/SubstituteSheet";

interface Row {
  movementId: string; movementName: string; prescribedMovementId: string;
  sets: number; reps: number; targetKg?: number;
  open: boolean; notDone: boolean;
  kg?: number; repsActual?: number; note?: string;
}

const num: CSSProperties = { width: 70, boxSizing: "border-box", padding: "7px 8px", borderRadius: 9, textAlign: "center", border: "1px solid color-mix(in srgb,var(--wl-text) 16%,transparent)", background: "var(--wl-bg)", color: "var(--wl-text)", fontFamily: "var(--wl-display)", fontSize: 15 };
const chip: CSSProperties = { border: "1px solid color-mix(in srgb,var(--wl-text) 16%,transparent)", borderRadius: 999, background: "var(--wl-bg)", color: "var(--wl-text)", fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 12.5, padding: "6px 11px", cursor: "pointer" };

export function EntrenoScreen() {
  const { week: weekP, idx: idxP } = useParams();
  const navigate = useNavigate();
  const week = Number(weekP);
  const idx = Number(idxP);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [barKg, setBarKg] = useState(20);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subFor, setSubFor] = useState<number | null>(null);

  useEffect(() => {
    if (!Number.isInteger(week) || !Number.isInteger(idx)) { navigate("/atleta", { replace: true }); return; }
    let on = true;
    Promise.all([me.getMePlan().catch(() => null), me.getMeSessions(week)])
      .then(([plan, views]: [{ athlete: { sexo: "M" | "F" } } | null, SessionView[]]) => {
        if (!on) return;
        setBarKg(barKgForSexo(plan?.athlete.sexo ?? "M"));
        const s = views.find((v) => v.sessionIdx === idx);
        setRows((s?.exercises ?? []).map((e) => ({
          movementId: e.actual?.movementId ?? e.movementId,
          movementName: e.actual?.movementName ?? e.movementName,
          prescribedMovementId: e.movementId,
          sets: e.sets, reps: e.reps, targetKg: e.targetKg,
          open: false, notDone: e.actual ? !e.actual.done : false,
          kg: e.actual?.kg ?? e.targetKg, repsActual: e.actual?.reps ?? e.reps, note: e.actual?.note ?? "",
        })));
      })
      .catch(() => { if (on) setRows([]); });
    return () => { on = false; };
  }, [week, idx, navigate]);

  const patch = (i: number, p: Partial<Row>): void => setRows((rs) => (rs ? rs.map((r, j) => (j === i ? { ...r, ...p } : r)) : rs));

  const save = useCallback(async () => {
    if (!rows) return;
    setBusy(true); setError(null);
    try {
      const actuals: ExerciseActualInput[] = rows.map((r, order) =>
        r.notDone
          ? { order, movementId: r.movementId, prescribedMovementId: r.prescribedMovementId, done: false }
          : { order, movementId: r.movementId, prescribedMovementId: r.prescribedMovementId, done: true,
              kg: r.kg, reps: r.repsActual, note: r.note?.trim() ? r.note.trim() : undefined });
      await me.putMeSession(week, idx, actuals);
      navigate("/atleta");
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar"); }
    finally { setBusy(false); }
  }, [rows, week, idx, navigate]);

  if (rows === null) return <div style={{ padding: 20, color: "var(--wl-muted)", fontFamily: "var(--ho-mono)" }}>Cargando…</div>;

  return (
    <div>
      <button type="button" aria-label="volver" onClick={() => navigate("/atleta")} style={{ border: 0, background: "transparent", color: "var(--wl-text)", fontSize: 22, cursor: "pointer", padding: 0, marginBottom: 6 }}>‹</button>
      <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 20, color: "var(--wl-text)" }}>Entreno · sem {week} · día {idx + 1}</div>
      <div style={{ fontFamily: "var(--ho-mono)", fontSize: 11, color: "var(--wl-muted)", marginTop: 2 }}>Hacé lo prescrito. Tocá "modificar" sólo si cambió algo.</div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
        {rows.map((r, i) => (
          <div key={i} style={{ background: "var(--wl-surface)", borderRadius: 12, padding: "11px 13px", opacity: r.notDone ? 0.6 : 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 16, color: "var(--wl-text)" }}>{r.movementName}</span>
              <span style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 22, color: "var(--wl-text)" }}>{r.kg != null ? `${r.kg}` : "—"}<span style={{ fontSize: 12, color: "var(--wl-muted)", fontWeight: 600 }}> kg</span></span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 8 }}>
              {r.kg != null ? <DiscRow kg={r.kg} barKg={barKg} /> : <span />}
              <span style={{ fontFamily: "var(--wl-display)", fontSize: 13, color: "var(--wl-muted)" }}>{r.sets} series × {r.reps} repeticiones</span>
            </div>
            {r.movementId !== r.prescribedMovementId && (
              <div style={{ fontFamily: "var(--wl-display)", fontSize: 11, color: "var(--wl-muted)", marginTop: 4 }}>prescripto: {getMovement(r.prescribedMovementId)?.name ?? r.prescribedMovementId}</div>
            )}
            {r.notDone && <div style={{ fontFamily: "var(--wl-display)", fontSize: 12, color: "var(--wl-muted)", marginTop: 4 }}>no la hice</div>}
            {!r.open ? (
              <button type="button" onClick={() => patch(i, { open: true })} style={{ marginTop: 9, border: 0, background: "transparent", color: "var(--wl-accent)", fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 13, cursor: "pointer", padding: 0 }} aria-label={`modificar ${r.movementName}`}>✎ modificar</button>
            ) : (
              <div style={{ marginTop: 10 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <input style={num} type="number" inputMode="decimal" aria-label={`kg real de ${r.movementName}`} value={r.kg ?? ""} onChange={(e) => patch(i, { kg: e.target.value ? Number(e.target.value) : undefined })} /><span style={{ color: "var(--wl-muted)", fontSize: 12 }}>kg</span>
                  <input style={num} type="number" inputMode="numeric" aria-label={`reps reales de ${r.movementName}`} value={r.repsActual ?? ""} onChange={(e) => patch(i, { repsActual: e.target.value === "" ? undefined : Number(e.target.value) })} /><span style={{ color: "var(--wl-muted)", fontSize: 12 }}>reps</span>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 9, flexWrap: "wrap" }}>
                  <button type="button" style={chip} onClick={() => setSubFor(i)} aria-label={`cambiar movimiento de ${r.movementName}`}>⇄ cambiar</button>
                  <button type="button" style={chip} onClick={() => patch(i, { notDone: !r.notDone })}>{r.notDone ? "sí la hice" : "no la hice"}</button>
                  <button type="button" style={chip} onClick={() => patch(i, { open: false })}>✓ listo</button>
                </div>
              </div>
            )}
            <input style={{ ...num, width: "100%", textAlign: "left", marginTop: 8 }} type="text" maxLength={200} aria-label={`nota de ${r.movementName}`} placeholder="nota (opcional)" value={r.note ?? ""} onChange={(e) => patch(i, { note: e.target.value })} />
          </div>
        ))}
        {rows.length === 0 && <div style={{ fontFamily: "var(--ho-mono)", fontSize: 11, color: "var(--wl-muted)" }}>No hay sesión para este día.</div>}
      </div>

      {error && <div role="alert" style={{ marginTop: 10, color: "#ff3b46", fontFamily: "var(--ho-mono)", fontSize: 11 }}>{error}</div>}
      {rows.length > 0 && (
        <button type="button" className="wl-btn wl-btn--primary" disabled={busy} onClick={() => void save()} style={{ width: "100%", marginTop: 16, opacity: busy ? 0.6 : 1 }}>{busy ? "Guardando…" : "Listo · Guardar entreno"}</button>
      )}
      {subFor !== null && rows[subFor] && (
        <SubstituteSheet open movementId={rows[subFor]!.movementId} onClose={() => setSubFor(null)}
          onPick={(id) => patch(subFor, { movementId: id, movementName: getMovement(id)?.name ?? id, kg: undefined })} />
      )}
    </div>
  );
}
```
(Notas: `DiscRow` se importa de `../../ui/Disc` — **reusar, jamás redibujar**. `barKg` del sexo del atleta. La nota queda siempre visible/opcional; si querés, moverla dentro de "modificar" — no afecta el modelo. Confirmá que `me.getMePlan` existe en `meClient`; si el nombre difiere, usar el real.)
- [ ] **Step 4:** `pnpm --filter @holy-oly/web test entreno && pnpm --filter @holy-oly/web test && pnpm --filter @holy-oly/web exec tsc --noEmit` → verde.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(web): Entreno — discos + adherencia por defecto + modificar inline + series/reps explícitas (sin RPE)"`

---

## Phase D — web (coach)

### Task D1: SessionEditor — sin RPE, accesorios por %

**Files:** Modify `apps/web/src/screens/coach/sessions/SessionEditor.tsx` + su test.

- [ ] **Step 1: Test** — ajustar `sessionEditor.test.tsx`: el editor ya no ofrece input/modo "RPE"; un accesorio (p.ej. `peso-muerto-rumano`) se edita por **%** (campo `%`), y al guardar `onSave` recibe el ejercicio con `pct` (sin `rpe`). Quitar asserts de RPE.
- [ ] **Step 2:** `pnpm --filter @holy-oly/web test sessionEditor` → FAIL.
- [ ] **Step 3: Implementar** — en `SessionEditor.tsx`: el `Draft` ya no tiene `rpe`; quitar el input de RPE y la rama "modo RPE" del selector de carga. Como ningún movimiento queda `rmRef:"none"`, el modo es **siempre %** (con `kgOverride` opcional para pinear). El `swapMovement` (SP4) ya re-derivaba el modo del `rmRef`; simplificar: siempre `pct` (más `kgOverride`), sin la rama `rpe`. (Adaptar al shape real del `Draft`/controles.)
- [ ] **Step 4:** `pnpm --filter @holy-oly/web test sessionEditor && pnpm --filter @holy-oly/web exec tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(web): SessionEditor sin RPE — accesorios por % (SP2 actualizado)"`

### Task D2: SessionsSection — sin RPE

**Files:** Modify `apps/web/src/screens/coach/sessions/SessionsSection.tsx` + su test.

- [ ] **Step 1: Test** — ajustar `sessionsSection.test.tsx`: quitar fixtures/asserts de `rpe`/`actualRpe`. Confirmar que un accesorio muestra su kg objetivo (ya no "RPE N") y el real-vs-prescrito (SP4 sustituido/desfasado intacto).
- [ ] **Step 2:** `pnpm --filter @holy-oly/web test sessionsSection` → FAIL.
- [ ] **Step 3: Implementar** — en `SessionsSection.tsx` quitar cualquier render de RPE prescrito o real (`· RPE N`). Los accesorios ahora tienen `targetKg` → se muestran como el resto (`obj sets×reps · kg`). La lógica SP4 (sustituido/desfasado, precedencia) intacta.
- [ ] **Step 4:** `pnpm --filter @holy-oly/web test sessionsSection && pnpm --filter @holy-oly/web test && pnpm --filter @holy-oly/web exec tsc --noEmit && pnpm --filter @holy-oly/web exec eslint src && pnpm --filter @holy-oly/web build` → todo verde.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(web): coach Sesiones sin RPE — accesorios muestran kg"`

---

## Phase E — verify · El Carnicero · deploy (controlador)

### Task E1: verificación completa
- [ ] core/web/api tests; `pnpm --filter @holy-oly/api verify` (migración `8` aplicada); `… e2e`; tsc×3; eslint; web build.
- [ ] **Prod-bundle:** `pnpm --filter @holy-oly/api build` + Grep `apps/api/dist/main.js` confirma `@holy-oly/core` inlineado (ausente como import).

### Task E2: El Carnicero (dominio)
- [ ] Dispatch `general-purpose` (model opus) con persona `.claude/agents/el-carnicero.md` + rulebook `docs/domain/HOLY-OLY-DOMAIN.md`. Revisar: **discos = componente real, NO redibujados**; **kg=verdad** (accesorios %×RM dan kg realista, no inflan el corredor IMR de la fase; `remo` mapeo débil → kgOverride); **RPE ausente** del atleta y de la prescripción; **adherencia-por-defecto honesta** (el "Listo" a nivel sesión justifica registrar prescrito-como-real; "no la hice" explícito; sin-dato si faltara RM → targetKg ausente, nunca 0); **sustitución (SP4) intacta**. Triage + fix CRITICAL/HIGH; commit `fix: correcciones de dominio El Carnicero (Entreno rediseño)`.

### Task E3: deploy + smoke + memoria
- [ ] FF `main` → push → Render auto-deploy (migración `8` vía `start:prod`). Poll `srv-d8etrvvavr4c73954o4g` (key en `C:\Users\Gamer\Videos\.render-key.txt`, leer SIN imprimir) hasta `live`.
- [ ] Smoke (Playwright MCP): Mara → Entreno → ve **discos** + "N series × M repeticiones" (sin RPE) → "Listo" guarda; abrir "modificar" → cambiar kg/⇄/no la hice → guardar; coach ve real-vs-prescrito. Screenshots.
- [ ] Memoria: actualizar `athlete-app-and-execution-pillar.md` + `MEMORY.md` (Entreno rediseñado: discos reusando `Disc.tsx`, RPE eliminado, accesorios %×RM, adherencia-por-defecto, `sexo`+migración 8).

---

## Notas / decisiones
- **Discos INTOCABLES:** reusar `Disc`/`DiscRow` (nunca redibujar). Barra 20 H / 15 M (del `sexo`).
- **RPE eliminado** de core/api/web y de la prescripción (decisión del coach "rpe no va nunca").
- **Accesorios = %×RM** (mapeo §3 del spec); el coach pinea kg con `kgOverride`.
- **Adherencia por defecto:** lo no-modificado se guarda hecho=prescrito al "Listo"; único "no hecho" = explícito.
- Fuera de scope: warm-up, por-serie, selector de barra, auto-sugerir kg del sustituto, 5º RM.
