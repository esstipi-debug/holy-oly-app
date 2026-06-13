# Registro con fecha + regla 1×fecha + doble sesión AM/PM — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada registro de entreno lleva *fecha real* (default hoy, jamás futura), el server impone máx. 1 entreno por fecha (excepción: turnos AM/PM del mismo día del plan), y el Búlgaro emite la primera receta bi-diaria real visible en todas las superficies.

**Architecture:** Tabla nueva `SessionRegistro` (fuente de verdad de la fecha; `doneAt` se estampa = fecha en la misma transacción, jamás divergen). Regla 1×fecha como helper puro de core (`fechaConflict`) ejecutado dentro de la transacción del endpoint → 409. El layout de días (`day`/`turno`) NO se persiste: se deriva de la receta vía `dayLayoutFor` y viaja en `SessionView`. La suposición «sesión i = día i» muere en `sessionsByDay()` (core), que consumen SemanaCard, player, heat y coach.

**Tech Stack:** TypeScript monorepo pnpm (packages/core puro + apps/api Fastify/Prisma/PG + apps/web React/Vite). Tests: vitest en los 3 paquetes (`pnpm -C <dir> test`). Migraciones SQL a mano en `apps/api/prisma/migrations/<n>_<name>/migration.sql` (última committeada: `17_cycle_fields`; hueco en 15 es normal).

**Spec:** `docs/superpowers/specs/2026-06-12-registro-fecha-doble-sesion-design.md` (decisiones D1–D14 — no re-litigar).

**Convenciones de la casa que NO se negocian:** kg+discos en toda fila de ejercicio del atleta (no tocar `Disc.tsx`/`DiscRow`); RPE jamás en superficie de atleta; tap, jamás hover; copy es-CL voseo («Tocá», «podés»); sin-dato honesto (jamás inventar); commits `tipo(scope): descripción` sin atribución.

---

### Task 1: Tipos core + schemas zod (SessionRegistro, envelope del PUT, SessionView extendida)

**Files:**
- Modify: `packages/core/src/types/index.ts` (zona de actuals, ~línea 247 y ~263)
- Modify: `packages/core/src/schemas.ts` (después de `SessionActualsInputSchema`, línea 257, y dentro del schema de view de sesión)
- Test: `packages/core/src/schemas.actuals.test.ts` (append)

- [ ] **Step 1: Escribir tests que fallan** — append en `packages/core/src/schemas.actuals.test.ts`:

```ts
import { PutMeSessionInputSchema, SessionRegistroSchema } from "./schemas";

describe("PutMeSessionInputSchema (registro con fecha — spec 2026-06-12)", () => {
  it("acepta envelope { fecha?, actuals } y rechaza el array pelado legacy", () => {
    expect(PutMeSessionInputSchema.safeParse({ actuals: [] }).success).toBe(true);
    expect(PutMeSessionInputSchema.safeParse({ fecha: "2026-06-10", actuals: [{ order: 0, movementId: "arranque", done: true }] }).success).toBe(true);
    expect(PutMeSessionInputSchema.safeParse([{ order: 0, movementId: "arranque", done: true }]).success).toBe(false);
  });
  it("rechaza fecha no-calendario (lección NaN del Carnicero)", () => {
    expect(PutMeSessionInputSchema.safeParse({ fecha: "2026-99-99", actuals: [] }).success).toBe(false);
  });
});

describe("SessionRegistroSchema", () => {
  it("valida week/idx con los límites de la casa y fecha ISO", () => {
    expect(SessionRegistroSchema.safeParse({ week: 1, sessionIdx: 0, fecha: "2026-06-12" }).success).toBe(true);
    expect(SessionRegistroSchema.safeParse({ week: 0, sessionIdx: 0, fecha: "2026-06-12" }).success).toBe(false);
    expect(SessionRegistroSchema.safeParse({ week: 1, sessionIdx: 14, fecha: "2026-06-12" }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Correr y ver FAIL**

Run: `pnpm -C packages/core test -- schemas.actuals`
Expected: FAIL — `PutMeSessionInputSchema` no existe.

- [ ] **Step 3: Implementar tipos** — en `packages/core/src/types/index.ts`, junto a `SessionActual` (~línea 263) agregar:

```ts
/** Registro de fecha de una sesión (spec 2026-06-12 D1/D3): cuándo se HIZO el entreno.
 *  Fuente de verdad; doneAt por-ejercicio es copia estampada en la misma transacción. */
export interface SessionRegistro { week: number; sessionIdx: number; fecha: string }
```

y extender `SessionView` (línea 247) — los 3 campos nuevos son opcionales (D8: ausentes = legacy):

```ts
/** One instantiated session (a column in the week), kg already derived. `day`/`turno` vienen
 *  del layout de la receta (D8); `fecha` del SessionRegistro del atleta (D1). */
export interface SessionView {
  week: number; sessionIdx: number; exercises: PrescribedExerciseView[];
  day?: number; turno?: "AM" | "PM"; fecha?: string;
}
```

- [ ] **Step 4: Implementar schemas** — en `packages/core/src/schemas.ts` después de la línea 258 (`export type ExerciseActualInput…`):

```ts
/** Envelope del PUT /me/session (spec 2026-06-12 D4): fecha del entreno + actuals. Sin
 *  retrocompat con el array pelado (pre-launch, cliente y server se despliegan juntos). */
export const PutMeSessionInputSchema = z.object({
  fecha: IsoDateSchema.optional(),
  actuals: SessionActualsInputSchema,
});
export type PutMeSessionInput = z.infer<typeof PutMeSessionInputSchema>;

export const SessionRegistroSchema = z.object({
  week: z.number().int().min(1).max(104),
  sessionIdx: z.number().int().min(0).max(13),
  fecha: IsoDateSchema,
});
```

`IsoDateSchema` está definida arriba en el mismo archivo (línea 55) pero NO exportada — exportarla (`export const IsoDateSchema = …`) porque la ruta y LocalMeClient la van a usar.

Buscar el schema read-side de la sesión (el que usa `SessionViewsSchema` que parsea `httpMeClient.getMeSessions`) y agregarle los 3 campos opcionales — sin esto zod los DESCARTA silenciosamente en el cliente:

```ts
  day: z.number().int().optional(),
  turno: z.enum(["AM", "PM"]).optional(),
  fecha: z.string().optional(),  // read-side: el server ya validó al escribir (patrón de la casa)
```

- [ ] **Step 5: Correr y ver PASS** — `pnpm -C packages/core test -- schemas.actuals` → PASS. También `pnpm -C packages/core typecheck`.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/types/index.ts packages/core/src/schemas.ts packages/core/src/schemas.actuals.test.ts
git commit -m "feat(core): tipos+schemas de SessionRegistro, envelope PUT con fecha y SessionView day/turno/fecha"
```

---

### Task 2: Helpers puros de la regla — `registro.ts` (validateFechaEntreno, fechaConflict, weekRange/fueraDeSemana)

**Files:**
- Create: `packages/core/src/logic/registro.ts`
- Create: `packages/core/src/logic/registro.test.ts`
- Modify: `packages/core/src/index.ts` (barrel — exportar el módulo nuevo igual que los vecinos de `logic/`)

- [ ] **Step 1: Test que falla** — `packages/core/src/logic/registro.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { validateFechaEntreno, fechaConflict, weekRange, fueraDeSemana } from "./registro";

describe("validateFechaEntreno (D2: pasada libre, futuro jamás)", () => {
  it("hoy y cualquier pasada → ok; futura → futuro", () => {
    expect(validateFechaEntreno("2026-06-12", "2026-06-12")).toBe("ok");
    expect(validateFechaEntreno("2025-01-01", "2026-06-12")).toBe("ok");
    expect(validateFechaEntreno("2026-06-13", "2026-06-12")).toBe("futuro");
  });
});

describe("fechaConflict (D1: máx 1 entreno por fecha; excepción turnos del mismo día)", () => {
  const dayOf = (idx: number) => idx + 1; // layout legacy: sesión n = día n
  const regs = [{ week: 9, sessionIdx: 0, fecha: "2026-06-12" }];
  it("otra sesión con la misma fecha → conflicto identificado", () => {
    expect(fechaConflict(regs, 9, 1, "2026-06-12", dayOf)).toEqual(regs[0]);
  });
  it("editarse a sí misma jamás conflictúa (D12)", () => {
    expect(fechaConflict(regs, 9, 0, "2026-06-12", dayOf)).toBeNull();
  });
  it("fecha distinta → sin conflicto", () => {
    expect(fechaConflict(regs, 9, 1, "2026-06-11", dayOf)).toBeNull();
  });
  it("turnos AM/PM del mismo día de receta comparten fecha (D9)", () => {
    const dosTurnos = (idx: number) => (idx <= 1 ? 1 : idx); // sesiones 0 y 1 = día 1
    expect(fechaConflict(regs, 9, 1, "2026-06-12", dosTurnos)).toBeNull();
  });
  it("mismo día de receta pero OTRA semana → conflicto (la excepción es intra-semana)", () => {
    const dosTurnos = (idx: number) => (idx <= 1 ? 1 : idx);
    expect(fechaConflict(regs, 10, 1, "2026-06-12", dosTurnos)).toEqual(regs[0]);
  });
});

describe("weekRange/fueraDeSemana (D2: aviso suave, jamás bloqueo)", () => {
  it("semana w = [startDate+(w-1)*7, +6]", () => {
    expect(weekRange("2026-04-01", 1)).toEqual({ from: "2026-04-01", to: "2026-04-07" });
    expect(weekRange("2026-04-01", 9)).toEqual({ from: "2026-05-27", to: "2026-06-02" });
  });
  it("fecha degenerada → null/false, jamás NaN fabricando booleanos (lección Carnicero)", () => {
    expect(weekRange("garbage", 1)).toBeNull();
    expect(fueraDeSemana("2026-06-12", "garbage", 1)).toBe(false);
  });
  it("dentro/fuera del rango", () => {
    expect(fueraDeSemana("2026-04-03", "2026-04-01", 1)).toBe(false);
    expect(fueraDeSemana("2026-04-09", "2026-04-01", 1)).toBe(true);
  });
});
```

- [ ] **Step 2: Run FAIL** — `pnpm -C packages/core test -- logic/registro` → FAIL (módulo no existe).

- [ ] **Step 3: Implementación** — `packages/core/src/logic/registro.ts`:

```ts
import type { SessionRegistro } from "../types";

/** Día de receta (1-based) de un sessionIdx — viene de dayLayoutFor; ausente = idx+1 (D8). */
export type DayOf = (sessionIdx: number) => number;

/** D2: la fecha declarada del entreno acepta cualquier pasada o hoy; jamás futura.
 *  Comparación lexicográfica — válida para ISO YYYY-MM-DD (patrón de la casa). */
export function validateFechaEntreno(fecha: string, hoy: string): "ok" | "futuro" {
  return fecha > hoy ? "futuro" : "ok";
}

/** D1: máx 1 entreno por fecha. Devuelve el registro en conflicto o null. Excepciones:
 *  la sesión editándose a sí misma (D12) y los turnos del MISMO día de receta de la MISMA
 *  semana (D9 — partir el día doble en dos fechas también es legítimo, esto sólo PERMITE). */
export function fechaConflict(
  registros: readonly SessionRegistro[],
  week: number,
  sessionIdx: number,
  fecha: string,
  dayOf: DayOf,
): SessionRegistro | null {
  for (const r of registros) {
    if (r.fecha !== fecha) continue;
    if (r.week === week && r.sessionIdx === sessionIdx) continue;
    if (r.week === week && dayOf(r.sessionIdx) === dayOf(sessionIdx)) continue;
    return r;
  }
  return null;
}

const DAY_MS = 86_400_000;
const addDaysISO = (iso: string, days: number): string =>
  new Date(new Date(`${iso}T00:00:00Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10);

/** Rango calendario de la semana w de un plan anclado a startDate (semanas ancladas al weekday
 *  del startDate — misma regla del heat-map). startDate degenerado → null, jamás NaN. */
export function weekRange(startDate: string, week: number): { from: string; to: string } | null {
  if (!Number.isFinite(new Date(`${startDate}T00:00:00Z`).getTime())) return null;
  const from = addDaysISO(startDate, (week - 1) * 7);
  return { from, to: addDaysISO(from, 6) };
}

/** D2: ¿la fecha cae fuera del rango calendario de esa semana del plan? Alimenta el AVISO
 *  suave del selector — informativo, jamás bloquea. Sin rango computable → false (honesto). */
export function fueraDeSemana(fecha: string, startDate: string, week: number): boolean {
  const r = weekRange(startDate, week);
  return r != null && (fecha < r.from || fecha > r.to);
}
```

- [ ] **Step 4: Exportar en el barrel** — en `packages/core/src/index.ts`, junto a los exports de `logic/` existentes: `export * from "./logic/registro";`

- [ ] **Step 5: Run PASS** — `pnpm -C packages/core test -- logic/registro` → PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/logic/registro.ts packages/core/src/logic/registro.test.ts packages/core/src/index.ts
git commit -m "feat(core): regla 1xfecha pura - validateFechaEntreno, fechaConflict (excepcion AM/PM intra-semana), weekRange/fueraDeSemana"
```

---

### Task 3: `sessionsByDay()` + `dayLayoutFor()` (donde muere «sesión i = día i»)

**Files:**
- Create: `packages/core/src/logic/sessionsByDay.ts`
- Create: `packages/core/src/logic/sessionsByDay.test.ts`
- Modify: `packages/core/src/logic/prescription.ts` (agregar `dayLayoutFor` al final)
- Modify: `packages/core/src/logic/prescription.test.ts` (append tests de `dayLayoutFor`)
- Modify: `packages/core/src/index.ts` (barrel)

- [ ] **Step 1: Tests que fallan** — `packages/core/src/logic/sessionsByDay.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { sessionsByDay } from "./sessionsByDay";

const s = (sessionIdx: number, day?: number, turno?: "AM" | "PM") => ({ sessionIdx, day, turno });

describe("sessionsByDay (D8: agrupación única por día real)", () => {
  it("sin day → legacy: sesión n = día n, un grupo por sesión", () => {
    expect(sessionsByDay([s(0), s(1), s(2)])).toEqual([
      { day: 1, sesiones: [{ session: s(0) }] },
      { day: 2, sesiones: [{ session: s(1) }] },
      { day: 3, sesiones: [{ session: s(2) }] },
    ]);
  });
  it("día doble: AM y PM caen en el mismo grupo, orden estable, días ordenados", () => {
    const grouped = sessionsByDay([s(0, 1, "AM"), s(1, 1, "PM"), s(2, 2)]);
    expect(grouped).toHaveLength(2);
    expect(grouped[0]).toEqual({
      day: 1,
      sesiones: [{ session: s(0, 1, "AM"), turno: "AM" }, { session: s(1, 1, "PM"), turno: "PM" }],
    });
    expect(grouped[1]!.day).toBe(2);
  });
});
```

y append en `packages/core/src/logic/prescription.test.ts`:

```ts
import { dayLayoutFor } from "./prescription";
import { MACROCYCLES } from "../data/macrocycles";

describe("dayLayoutFor (layout día/turno derivado de la receta — D8, no se persiste)", () => {
  it("ruso-5d (mono-diario): day = idx+1, sin turno", () => {
    const ruso = MACROCYCLES.find((m) => m.id === "ruso-5d")!;
    const layout = dayLayoutFor(ruso, 1)!;
    expect(layout).toHaveLength(5);
    expect(layout[0]).toEqual({ day: 1 });
    expect(layout[4]).toEqual({ day: 5 });
  });
  it("macro sin receta para la semana → null (sin-dato honesto)", () => {
    const ruso = MACROCYCLES.find((m) => m.id === "ruso-5d")!;
    expect(dayLayoutFor(ruso, 999)).toBeNull();
  });
});
```

- [ ] **Step 2: Run FAIL** — `pnpm -C packages/core test -- sessionsByDay prescription` → FAIL.

- [ ] **Step 3: Implementar `sessionsByDay.ts`**:

```ts
/** Agrupación ÚNICA de sesiones por día real (spec 2026-06-12 D8). Acá muere la suposición
 *  «sesión i = día i»: day ausente = comportamiento histórico. Genérico: sirve SessionView
 *  (web/api) y SessionTemplate (generador) por igual. */
export interface DaySession<T> { session: T; turno?: "AM" | "PM" }
export interface DayGroup<T> { day: number; sesiones: DaySession<T>[] }

export function sessionsByDay<T extends { sessionIdx: number; day?: number; turno?: "AM" | "PM" }>(
  sessions: readonly T[],
): DayGroup<T>[] {
  const by = new Map<number, DaySession<T>[]>();
  for (const s of sessions) {
    const day = s.day ?? s.sessionIdx + 1;
    if (!by.has(day)) by.set(day, []);
    by.get(day)!.push(s.turno ? { session: s, turno: s.turno } : { session: s });
  }
  return [...by.entries()].sort((a, b) => a[0] - b[0]).map(([day, sesiones]) => ({ day, sesiones }));
}
```

- [ ] **Step 4: Implementar `dayLayoutFor`** — al final de `packages/core/src/logic/prescription.ts`:

```ts
import { recipeFor } from "../data/recipesAll"; // ← agregar al bloque de imports de arriba

/** Layout de días de una semana: (day, turno) por sessionIdx, derivado de la RECETA (D8 — no
 *  se persiste; los dobles son ADN de escuela, no edición por atleta). Receta mono-diaria →
 *  day = idx+1. Semana sin templates → null (caller decide el fallback legacy). */
export function dayLayoutFor(macro: Macrocycle, week: number): { day: number; turno?: "AM" | "PM" }[] | null {
  const sessions = sessionTemplateFor(recipeFor(macro.id), macro, week);
  if (sessions.length === 0) return null;
  return sessions.map((s, i) => ({ day: s.day ?? i + 1, ...(s.turno ? { turno: s.turno } : {}) }));
}
```

(Verificar que no hay ciclo de imports: `recipesAll` → `recipeGen` → `movements/schedule/complexes/data` — no vuelve a `prescription`. Si tsc acusa ciclo, mover `dayLayoutFor` a `sessionsByDay.ts` importando `sessionTemplateFor`.)

- [ ] **Step 5: Barrel** — `export * from "./logic/sessionsByDay";` en `packages/core/src/index.ts`.

- [ ] **Step 6: Run PASS** — `pnpm -C packages/core test -- sessionsByDay prescription` → PASS. `pnpm -C packages/core typecheck` limpio.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/logic/sessionsByDay.ts packages/core/src/logic/sessionsByDay.test.ts packages/core/src/logic/prescription.ts packages/core/src/logic/prescription.test.ts packages/core/src/index.ts
git commit -m "feat(core): sessionsByDay + dayLayoutFor - la suposicion sesion-i=dia-i muere en un solo lugar (D8)"
```

---

### Task 4: Generador bi-diario — Búlgaro AM/PM con guard de presupuesto SNC diario

**Files:**
- Modify: `packages/core/src/data/schools.ts:35` (Búlgaro `sessionsPerDay: 1 → 2`)
- Modify: `packages/core/src/logic/recipeGen.ts` (función `generateRecipe`, líneas 359-379, + helpers nuevos)
- Modify: `packages/core/src/logic/recipeGen.test.ts` (append describe bi-diario)
- Regenerate: `packages/core/src/data/__snapshots__/recipes-gen.snap`

- [ ] **Step 1: Tests que fallan** — append en `packages/core/src/logic/recipeGen.test.ts` (los imports de `generateRecipe`, `dnaForFamily`, `MACROCYCLES`-vía-`macro()` ya existen en el archivo):

```ts
describe("generateRecipe bi-diario (D6/D7 — Búlgaro AM/PM, spec 2026-06-12)", () => {
  const bulgaro = () => generateRecipe(dnaForFamily("Búlgaro")!, macro("bulgaro-6d"))!;

  it("emite day/turno: días impares dobles (AM arranque-céntrico / PM envión-céntrico)", () => {
    for (const phase of bulgaro().phases) {
      const dia1 = phase.sessions.filter((s) => s.day === 1);
      expect(dia1.map((s) => s.turno)).toEqual(["AM", "PM"]);
      // Abadjiev: AM = arquetipo focus arranque, PM = focus envión → el lift principal difiere
      const dia2 = phase.sessions.filter((s) => s.day === 2);
      expect(dia2).toHaveLength(1);
      expect(dia2[0]!.turno).toBeUndefined();
    }
  });

  it("TODA sesión emitida lleva day (bi-diario completo, sin huecos)", () => {
    for (const phase of bulgaro().phases) {
      for (const s of phase.sessions) expect(s.day).toBeGreaterThanOrEqual(1);
    }
  });

  it("guard D7: la suma SNC de los turnos de un día jamás excede el techo diario", () => {
    // el techo diario = sncBudget[role] * 1.5 (DAILY_SNC_FACTOR) — espejo del generador
    const dna = dnaForFamily("Búlgaro")!;
    for (const phase of bulgaro().phases) {
      const byDay = new Map<number, number>();
      for (const s of phase.sessions) {
        const snc = s.exercises.reduce((acc, ex) => acc + loadsOf(ex).snc, 0);
        byDay.set(s.day!, (byDay.get(s.day!) ?? 0) + snc);
      }
      for (const total of byDay.values()) {
        expect(total).toBeLessThanOrEqual(Math.round(Math.max(...Object.values(dna.sncBudget)) * 1.5));
      }
    }
  });

  it("las escuelas mono-diarias NO cambian: ninguna emite day/turno", () => {
    const ids = ["ruso-4d", "cubano-novicio-2d", "usa-school"]; // muestra de familias ≠ Búlgaro
    for (const id of ids) {
      const m = macro(id);
      const r = generateRecipe(dnaForFamily(m.family)!, m);
      if (!r) continue; // receta curada → null, ya cubierto por otros tests
      for (const p of r.phases) for (const s of p.sessions) {
        expect(s.day, `${id} no debe emitir day`).toBeUndefined();
      }
    }
  });
});
```

Nota: `loadsOf` ya existe en el archivo (línea ~70). Si algún id de la muestra mono-diaria no existe en el catálogo, reemplazarlo por otro id real de `MACROCYCLES` de familia ≠ Búlgaro — verificar con `grep "id: '" packages/core/src/data/macrocycles.ts`.

- [ ] **Step 2: Run FAIL** — `pnpm -C packages/core test -- recipeGen` → FAIL (Búlgaro aún mono-diario).

- [ ] **Step 3: Búlgaro a bi-diario** — `packages/core/src/data/schools.ts:35`:

```ts
    sessionsPerDay: 2, // bi-diario REAL (AM arranque / PM envión) — D14 saldado (spec 2026-06-12)
```

- [ ] **Step 4: Emisión en el generador** — en `packages/core/src/logic/recipeGen.ts`, agregar tras `applyPrilepinSessionClamp` (línea ~305) los helpers:

```ts
/** Techo SNC del DÍA (D7): los turnos de un día doble suman contra esto. Factor curaduría
 *  del coach (calibrable acá): 1.5× el presupuesto de sesión — dos sesiones cortas caben,
 *  dos sesiones llenas no. El Carnicero revisa el valor. */
const DAILY_SNC_FACTOR = 1.5;

const sessionSnc = (s: SessionTemplate): number =>
  s.exercises.reduce((acc, ex) => acc + effLoads(ex.movementId).snc, 0);

/** Arquetipo de un turno (Abadjiev): AM busca focus arranque, PM focus envión. Escuela sin
 *  ese focus declarado → rota por día (jamás inventa estructura). */
function archetypeForTurno(archetypes: SessionArchetype[], turno: "AM" | "PM", day: number): SessionArchetype {
  const want = turno === "AM" ? "arranque" : "envion";
  return archetypes.find((a) => a.focus === want)
    ?? archetypes[(day - 1 + (turno === "PM" ? 1 : 0)) % archetypes.length]!;
}
```

y reemplazar el cuerpo del loop de fases de `generateRecipe` (líneas 366-377) por:

```ts
  const phases: PhaseTemplate[] = [];
  for (const phase of macro.phaseProfile) {
    const role = phaseRole(phase);
    const archetypes = archetypesFor(dna, role);
    if (archetypes.length === 0) return null;
    const sessions: SessionTemplate[] = [];
    if (dna.sessionsPerDay === 2) {
      // Bi-diario (D6): días IMPARES dobles, pares simples — mezcla visible de layouts,
      // volumen sano para humanos (curaduría v1; El Carnicero revisa). sessionIdx = posición
      // del array (idx corrido), day/turno viajan en el template (D9).
      const dailyCap = Math.round(dna.sncBudget[role] * DAILY_SNC_FACTOR);
      let idx = 0;
      for (let day = 1; day <= n; day++) {
        if (day % 2 === 1) {
          const am = buildSession(dna, macro, phase, role, archetypeForTurno(archetypes, "AM", day), idx);
          const pm = buildSession(dna, macro, phase, role, archetypeForTurno(archetypes, "PM", day), idx + 1);
          if (sessionSnc(am) + sessionSnc(pm) <= dailyCap) {
            sessions.push({ ...am, day, turno: "AM" }, { ...pm, day, turno: "PM" });
            idx += 2;
          } else {
            // Guard D7: el día no aguanta dos turnos → degrada a día simple (honesto, jamás recortar a ciegas)
            sessions.push({ ...am, day });
            idx += 1;
          }
        } else {
          sessions.push({ ...buildSession(dna, macro, phase, role, archetypes[(day - 1) % archetypes.length]!, idx), day });
          idx += 1;
        }
      }
    } else {
      for (let i = 0; i < n; i++) {
        const archetype = archetypes[i % archetypes.length]!;
        sessions.push(buildSession(dna, macro, phase, role, archetype, i));
      }
    }
    phases.push({ phaseKey: phase.key, sessions });
  }
  return { macroId: macro.id, phases };
```

(la variable `n` ya existe: `const n = sessionsPerWeekFor(macro)` — son DÍAS; en bi-diario las sesiones totales son n + #días-dobles. La rama mono-diaria queda byte-idéntica → los snapshots de las otras 22 recetas generadas NO cambian.)

- [ ] **Step 5: Regenerar snapshot y auditar el diff**

Run: `pnpm -C packages/core test -- -u`
Expected: sólo `recipes-gen.snap` cambia y SOLO en los macros Búlgaro. Revisar el diff con `git diff packages/core/src/data/__snapshots__/` — los días 1,3,5 del bulgaro-6d deben mostrar pares AM (arranque) / PM (cargada-envion). Si cambia CUALQUIER receta no-Búlgara → bug en la rama mono-diaria, revertir y revisar.

- [ ] **Step 6: Suite core completa** — `pnpm -C packages/core test` → PASS total (distintividad pareada, auditoría Prilepin, regresión Ruso intactas).

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/data/schools.ts packages/core/src/logic/recipeGen.ts packages/core/src/logic/recipeGen.test.ts packages/core/src/data/__snapshots__/recipes-gen.snap
git commit -m "feat(core): Bulgaro bi-diario real - dias impares AM/PM (Abadjiev), guard SNC diario 1.5x con degradacion honesta (D6/D7)"
```

---

### Task 5: Prisma — modelo `SessionRegistro` + migración 18 con backfill

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (modelo nuevo después de `SessionMark`, ~línea 255, + back-relation en `Athlete`)
- Create: `apps/api/prisma/migrations/18_session_registro/migration.sql`

- [ ] **Step 1: Modelo en schema.prisma** — después del bloque `SessionMark`:

```prisma
/// Fecha REAL del entreno por sesión registrada (spec 2026-06-12 D1/D3). Fuente de verdad;
/// SessionActual.doneAt es copia estampada en la misma transacción (jamás divergen). La regla
/// 1×fecha NO es unique de DB (la excepción AM/PM la rompe): vive en setSessionActuals.
model SessionRegistro {
  id         String  @id @default(uuid())
  athleteId  String
  athlete    Athlete @relation(fields: [athleteId], references: [id], onDelete: Cascade)
  week       Int
  sessionIdx Int
  fecha      String

  @@unique([athleteId, week, sessionIdx])
  @@index([athleteId, fecha])
}
```

y en `model Athlete` agregar la back-relation junto a las existentes: `sessionRegistros SessionRegistro[]`.

- [ ] **Step 2: Migración a mano** — `apps/api/prisma/migrations/18_session_registro/migration.sql` (estilo de la casa: SQL a mano, carpetas numeradas; la 15 falta a propósito y el booking WIP renumera a 19):

```sql
-- 18_session_registro (spec 2026-06-12): fecha real del entreno por sesión registrada.
CREATE TABLE "SessionRegistro" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "sessionIdx" INTEGER NOT NULL,
    "fecha" TEXT NOT NULL,

    CONSTRAINT "SessionRegistro_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SessionRegistro" ADD CONSTRAINT "SessionRegistro_athleteId_fkey"
    FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "SessionRegistro_athleteId_week_sessionIdx_key"
    ON "SessionRegistro"("athleteId", "week", "sessionIdx");

CREATE INDEX "SessionRegistro_athleteId_fecha_idx"
    ON "SessionRegistro"("athleteId", "fecha");

-- Backfill (D10): fecha = MIN(doneAt) de las filas done de cada sesión ya registrada —
-- aproximación honesta a «primera vez registrada» (el doneAt histórico deriva con ediciones).
-- Los SessionActual históricos NO se tocan (verdad histórica).
INSERT INTO "SessionRegistro" ("id", "athleteId", "week", "sessionIdx", "fecha")
SELECT gen_random_uuid(), "athleteId", "week", "sessionIdx", MIN("doneAt")
FROM "SessionActual"
WHERE "done" = true AND "doneAt" IS NOT NULL
GROUP BY "athleteId", "week", "sessionIdx";
```

(Antes de escribirla, mirar `apps/api/prisma/migrations/17_cycle_fields/migration.sql` y copiar el estilo exacto de la casa. `gen_random_uuid()` es nativo de PG 13+ — el embedded-postgres del repo lo cumple; si la migración falla por la función, usar `md5(random()::text || clock_timestamp()::text)` como id.)

- [ ] **Step 3: Regenerar el cliente y verificar** — `pnpm -C apps/api exec prisma generate` y después correr cualquier test int existente para confirmar que las migraciones aplican limpio: `pnpm -C apps/api test -- actuals.int` (los int tests levantan el PG embebido y corren `migrate deploy`). Expected: los tests EXISTENTES de actuals siguen PASS (la tabla nueva no rompe nada todavía).

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/18_session_registro/migration.sql
git commit -m "feat(api): migracion 18_session_registro - tabla fecha-del-entreno + backfill min(doneAt) (D10)"
```

---

### Task 6: Repo + ruta — regla 1×fecha transaccional, 409, doneAt = fecha

**Files:**
- Modify: `apps/api/src/repo.ts:356-378` (`setSessionActuals`) + imports
- Modify: `apps/api/src/me/routes.ts:95-107` (PUT handler)
- Create: `apps/api/src/registro.int.test.ts`
- Modify: `apps/api/src/actuals.int.test.ts` y `apps/api/src/rm.int.test.ts` (payloads al envelope nuevo)

- [ ] **Step 1: Test int que falla** — `apps/api/src/registro.int.test.ts` (copiar el arnés de `actuals.int.test.ts`: mismo `beforeAll` con app+login+plan; el plan se asigna a `mv` en `ruso-5d` con `startDate: "2026-04-01"`):

```ts
// Arnés: espejo de actuals.int.test.ts (app, login coach/mara, PUT /athletes/mv/plan en ruso-5d).
const HOY = new Date().toISOString().slice(0, 10);
const AYER = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
const put = (week: number, idx: number, payload: unknown) =>
  app.inject({ method: "PUT", url: `/me/session/${week}/${idx}`, headers: athlete, payload });
const body = (fecha: string | undefined, done = true) =>
  ({ ...(fecha ? { fecha } : {}), actuals: [{ order: 0, movementId: "arranque", done, kg: 60, reps: 2 }] });

describe("PUT /me/session — envelope con fecha + regla 1×fecha (spec 2026-06-12)", () => {
  it("array pelado legacy → 400 (D4, sin retrocompat)", async () => {
    expect((await put(1, 0, [{ order: 0, movementId: "arranque", done: true }])).statusCode).toBe(400);
  });
  it("fecha futura → 400 (D2)", async () => {
    const futuro = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    expect((await put(1, 0, body(futuro))).statusCode).toBe(400);
  });
  it("sin fecha → hoy; segunda sesión el mismo día → 409 con conflicto identificado (D1/D5)", async () => {
    expect((await put(1, 0, body(undefined))).statusCode).toBe(200);
    const res = await put(1, 1, body(undefined));
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: "fecha_ocupada", conflicto: { week: 1, sessionIdx: 0, fecha: HOY } });
  });
  it("misma sesión re-guardada (edición) jamás conflictúa y CONSERVA su fecha (D12)", async () => {
    expect((await put(1, 0, body(undefined))).statusCode).toBe(200);
    const mine = await app.inject({ method: "GET", url: "/me/sessions?week=1", headers: athlete });
    const s0 = (mine.json() as Array<{ sessionIdx: number; fecha?: string }>).find((s) => s.sessionIdx === 0)!;
    expect(s0.fecha).toBe(HOY);
  });
  it("backdating libre: la otra sesión con fecha de ayer → 200, y doneAt = fecha (D3)", async () => {
    expect((await put(1, 1, body(AYER))).statusCode).toBe(200);
    const mine = await app.inject({ method: "GET", url: "/me/sessions?week=1", headers: athlete });
    const s1 = (mine.json() as Array<{ sessionIdx: number; fecha?: string; exercises: Array<{ actual?: { doneAt?: string } }> }>)
      .find((s) => s.sessionIdx === 1)!;
    expect(s1.fecha).toBe(AYER);
  });
  it("actuals: [] libera la fecha (D11): otra sesión puede tomarla", async () => {
    expect((await put(1, 1, { actuals: [] })).statusCode).toBe(200);
    expect((await put(1, 2, body(AYER))).statusCode).toBe(200);
  });
  it("GET /me/sessions trae day en cada sesión (layout ruso-5d: day = idx+1)", async () => {
    const mine = await app.inject({ method: "GET", url: "/me/sessions?week=1", headers: athlete });
    const views = mine.json() as Array<{ sessionIdx: number; day?: number }>;
    for (const v of views) expect(v.day).toBe(v.sessionIdx + 1);
  });
});
```

(El caso AM/PM-comparten-fecha se testea en core (Task 2) y de punta a punta requeriría asignar `bulgaro-6d`; agregar UN caso int con plan búlgaro: asignar a `kv` el macro `bulgaro-6d`, registrar sesiones 0 y 1 (día 1 AM/PM) con la MISMA fecha → ambas 200; sesión 2 (día 2) con esa fecha → 409.)

- [ ] **Step 2: Run FAIL** — `pnpm -C apps/api test -- registro.int` → FAIL.

- [ ] **Step 3: Repo** — reemplazar `setSessionActuals` (repo.ts:356-378) por:

```ts
/** El conflicto de la regla 1×fecha, identificado (la ruta lo traduce a 409). */
export class FechaOcupadaError extends Error {
  constructor(public readonly conflicto: { week: number; sessionIdx: number; fecha: string }) {
    super("fecha_ocupada");
  }
}

/** Replace one session's athlete actuals + su registro de fecha (spec 2026-06-12 D1/D3).
 *  Transaccional. `fecha` = fecha REAL del entreno (la ruta ya validó ≤ hoy): estampa doneAt
 *  en filas done (las ediciones ya no corren la procedencia) y aplica la regla 1×fecha con
 *  la excepción AM/PM intra-semana vía dayLayoutFor (core). 0 filas done → el registro se
 *  borra y la fecha se libera (D11). */
export async function setSessionActuals(
  prisma: PrismaClient, athleteId: string, week: number, sessionIdx: number,
  actuals: ExerciseActualInput[],
  fecha: string,
): Promise<void> {
  const plan = await getPlan(prisma, athleteId);
  const macro = plan ? MACROCYCLES.find((m) => m.id === plan.macroId) : undefined;
  const layout = macro ? dayLayoutFor(macro, week) : null;
  const dayOf: DayOf = (idx) => layout?.[idx]?.day ?? idx + 1;
  const summarized = actuals.map((a) => ({
    a, sum: a.sets && a.sets.length > 0 ? summarizeSets(a.sets) : { done: a.done, kg: a.kg, reps: a.reps },
  }));
  const anyDone = summarized.some(({ sum }) => sum.done);
  await prisma.$transaction(async (tx) => {
    if (anyDone) {
      const registros = await tx.sessionRegistro.findMany({
        where: { athleteId, fecha }, select: { week: true, sessionIdx: true, fecha: true },
      });
      const conflict = fechaConflict(registros, week, sessionIdx, fecha, dayOf);
      if (conflict) throw new FechaOcupadaError(conflict);
    }
    await tx.sessionActual.deleteMany({ where: { athleteId, week, sessionIdx } });
    if (summarized.length > 0) {
      await tx.sessionActual.createMany({
        data: summarized.map(({ a, sum }) => ({
          athleteId, week, sessionIdx, order: a.order, movementId: a.movementId,
          prescribedMovementId: a.prescribedMovementId ?? null,
          done: sum.done,
          actualKg: sum.kg ?? null, actualReps: sum.reps ?? null, note: a.note ?? null,
          sets: a.sets && a.sets.length > 0 ? (a.sets as Prisma.InputJsonValue) : Prisma.JsonNull,
          doneAt: sum.done ? fecha : null,
        })),
      });
    }
    if (anyDone) {
      await tx.sessionRegistro.upsert({
        where: { athleteId_week_sessionIdx: { athleteId, week, sessionIdx } },
        create: { athleteId, week, sessionIdx, fecha },
        update: { fecha },
      });
    } else {
      await tx.sessionRegistro.deleteMany({ where: { athleteId, week, sessionIdx } });
    }
  });
}
```

imports nuevos en repo.ts: `dayLayoutFor`, `fechaConflict`, `type DayOf` desde `@holy-oly/core`.

- [ ] **Step 4: `getPrescriptionWeek` adjunta fecha/day/turno** — reemplazar el `return` (repo.ts:296) por:

```ts
  const macro = MACROCYCLES.find((m) => m.id === plan.macroId);
  const layout = macro ? dayLayoutFor(macro, week) : null;
  const registros = await prisma.sessionRegistro.findMany({ where: { athleteId, week } });
  const fechaByIdx = new Map(registros.map((r) => [r.sessionIdx, r.fecha]));
  return mergeActuals(buildSessionViews(rows, plan.rms, barKg), actuals).map((v) => ({
    ...v,
    ...(layout?.[v.sessionIdx] ? layout[v.sessionIdx]! : {}),       // day (+turno si hay)
    ...(fechaByIdx.has(v.sessionIdx) ? { fecha: fechaByIdx.get(v.sessionIdx)! } : {}),
  }));
```

(esto sirve al atleta Y al coach — mismo builder, D13 gratis en la vista prescrito-vs-real.)

- [ ] **Step 5: Ruta** — reemplazar el handler (me/routes.ts:95-107):

```ts
  app.put<{ Params: { week: string; idx: string } }>("/me/session/:week/:idx", async (req, reply) => {
    const athleteId = requireAthlete(req, reply);
    if (!athleteId) return;
    const week = Number(req.params.week);
    const idx = Number(req.params.idx);
    if (!Number.isInteger(week) || week < 1 || week > 104 || !Number.isInteger(idx) || idx < 0 || idx > 13) {
      return reply.code(400).send({ error: "bad week/idx" });
    }
    const parsed = PutMeSessionInputSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid actuals" });
    const hoy = todayISO();
    const fecha = parsed.data.fecha ?? hoy;
    if (validateFechaEntreno(fecha, hoy) === "futuro") return reply.code(400).send({ error: "fecha futura" });
    try {
      await repo.setSessionActuals(prisma, athleteId, week, idx, parsed.data.actuals, fecha);
    } catch (e) {
      if (e instanceof repo.FechaOcupadaError) {
        return reply.code(409).send({ error: "fecha_ocupada", conflicto: e.conflicto });
      }
      throw e;
    }
    return reply.code(200).send({ ok: true });
  });
```

imports: `PutMeSessionInputSchema`, `validateFechaEntreno` desde `@holy-oly/core`.

- [ ] **Step 6: Export D3** — en `exportAthleteData` (repo.ts, buscar `rmUpdates`) agregar `sessionRegistros: await prisma.sessionRegistro.findMany({ where: { athleteId }, select: { week: true, sessionIdx: true, fecha: true } })` al objeto exportado.

- [ ] **Step 7: Migrar tests existentes al envelope** — en `actuals.int.test.ts`, `me.int.test.ts` y `rm.int.test.ts`: todo `payload: [...]` de PUT /me/session pasa a `payload: { actuals: [...] }`. En `rm.int.test.ts:91` el assert `expect(arr.doneAt).toBe(TODAY)` sigue válido (fecha default = hoy). ⚠ Si algún test registra DOS sesiones el mismo día (p.ej. `me.int.test.ts:139-142`), darles fechas distintas (`{ fecha: AYER, actuals: [...] }`) — ahora chocan por diseño.

- [ ] **Step 8: Run PASS** — `pnpm -C apps/api test` → PASS completo (los 50+ existentes + registro.int). `pnpm -C apps/api typecheck` limpio.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/repo.ts apps/api/src/me/routes.ts apps/api/src/registro.int.test.ts apps/api/src/actuals.int.test.ts apps/api/src/me.int.test.ts apps/api/src/rm.int.test.ts
git commit -m "feat(api): regla 1xfecha transaccional con 409 + envelope {fecha,actuals} + doneAt=fecha + day/turno/fecha en las views (D1-D5,D11-D13)"
```

---

### Task 7: Heat day-aware (core `planHeat` + repo)

**Files:**
- Modify: `packages/core/src/logic/planHeat.ts`
- Modify: `packages/core/src/logic/planHeat.test.ts` (append)
- Modify: `apps/api/src/repo.ts` (`getPlanHeat`, líneas 343-354)

- [ ] **Step 1: Test que falla** — append en `packages/core/src/logic/planHeat.test.ts`:

```ts
describe("planHeat day-aware (D8: dos turnos agregan en la celda del día)", () => {
  it("rows con day explícito caen en days[day-1]; AM+PM suman lifts y topPct = máx", () => {
    const rows = [
      { week: 1, sessionIdx: 0, sets: 5, reps: 2, pct: 90, day: 1 },  // AM
      { week: 1, sessionIdx: 1, sets: 4, reps: 1, pct: 95, day: 1 },  // PM, mismo día
      { week: 1, sessionIdx: 2, sets: 3, reps: 3, pct: 80, day: 2 },
    ];
    const heat = planHeat(rows, 1);
    expect(heat[0]!.days[0]).toEqual({ lifts: 14, topPct: 95 });
    expect(heat[0]!.days[1]).toEqual({ lifts: 9, topPct: 80 });
    expect(heat[0]!.days[2]).toBeNull();
  });
  it("sin day → legacy: days[sessionIdx] (cero regresión)", () => {
    const heat = planHeat([{ week: 1, sessionIdx: 3, sets: 2, reps: 2, pct: 70 }], 1);
    expect(heat[0]!.days[3]).toEqual({ lifts: 4, topPct: 70 });
  });
});
```

- [ ] **Step 2: Run FAIL** — `pnpm -C packages/core test -- planHeat` → FAIL (day no existe en HeatRow).

- [ ] **Step 3: Implementar** — en `planHeat.ts`: `HeatRow` gana `day?: number` y el loop usa el día:

```ts
export type HeatRow = Pick<PrescriptionRow, "week" | "sessionIdx" | "sets" | "reps" | "pct"> & { day?: number };
```

y dentro del `for` (línea 21), reemplazar los accesos `days[r.sessionIdx]` por:

```ts
    const dayIdx = (r.day ?? r.sessionIdx + 1) - 1;   // D8: sin day = legacy sesión i → día i
    if (r.week < 1 || r.week > totalWeeks || dayIdx < 0 || dayIdx >= DAYS) continue;
    const days = weeks[r.week - 1]!.days;
    const cur = days[dayIdx];
    const lifts = (cur?.lifts ?? 0) + r.sets * r.reps;
    const prevTop = cur?.topPct;
    const topPct = r.pct == null ? prevTop : prevTop == null ? r.pct : Math.max(prevTop, r.pct);
    days[dayIdx] = topPct == null ? { lifts } : { lifts, topPct };
```

(actualizar también el docstring: «Day i = session i» pasa a «day del layout de la receta; sin day = session i (legacy)».)

- [ ] **Step 4: Repo pasa el day** — en `getPlanHeat` (repo.ts:343-354), reemplazar el `return` por:

```ts
  const layoutCache = new Map<number, ReturnType<typeof dayLayoutFor>>();
  const layoutOf = (week: number) => {
    if (!layoutCache.has(week)) layoutCache.set(week, macro ? dayLayoutFor(macro, week) : null);
    return layoutCache.get(week)!;
  };
  return planHeat(rows.map((r) => ({
    ...r, pct: r.pct ?? undefined,
    day: layoutOf(r.week)?.[r.sessionIdx]?.day,
  })), totalWeeks);
```

(`macro` ya está resuelto arriba en la función, línea 346.)

- [ ] **Step 5: Run PASS** — `pnpm -C packages/core test -- planHeat` y `pnpm -C apps/api test -- heat` → PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/logic/planHeat.ts packages/core/src/logic/planHeat.test.ts apps/api/src/repo.ts
git commit -m "feat(core+api): heat day-aware - los turnos AM/PM agregan en la celda del dia (lifts suma, topPct max)"
```

---

### Task 8: Cliente web — interfaz nueva de `putMeSession` + regla en `LocalMeClient`

**Files:**
- Modify: `apps/web/src/data/meClient.ts` (interfaz + wrapper, líneas 36-38 y 61-77)
- Modify: `apps/web/src/data/httpMeClient.ts:75-83`
- Modify: `apps/web/src/data/LocalMeClient.ts` (putMeSession 143-158, getMeSessions 99-106, getMeHeat)
- Test: `apps/web/src/data/__tests__/localMeClient.test.ts` (o el archivo de tests existente del LocalMeClient — ubicarlo con `pnpm -C apps/web exec vitest list 2>/dev/null | grep -i local` o Glob `apps/web/src/**/*ocal*e*lient*test*`)

- [ ] **Step 1: Tipo compartido del error** — en `apps/web/src/data/meClient.ts`:

```ts
/** 409 de la regla 1×fecha (D1): el caller (player) abre el selector de fecha con el conflicto. */
export class FechaOcupadaError extends Error {
  constructor(public readonly conflicto: { week: number; sessionIdx: number; fecha: string }) {
    super("fecha_ocupada");
  }
}
export interface PutMeSessionInput { fecha?: string; actuals: ExerciseActualInput[] }
```

y la firma en la interfaz `MeClient` + wrapper:

```ts
  putMeSession(week: number, idx: number, input: PutMeSessionInput): Promise<void>;
```

- [ ] **Step 2: httpMeClient** — reemplazar `putMeSession` (líneas 75-83):

```ts
export async function putMeSession(week: number, idx: number, input: PutMeSessionInput): Promise<void> {
  const res = await fetch(`${BASE}/me/session/${week}/${idx}`, {
    method: "PUT",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (res.status === 409) {
    const body = (await res.json()) as { conflicto: { week: number; sessionIdx: number; fecha: string } };
    throw new FechaOcupadaError(body.conflicto);
  }
  if (!res.ok) await fail(res);
}
```

- [ ] **Step 3: Test del LocalMeClient que falla** — en el archivo de tests del LocalMeClient (append; si no existe, crearlo con el arnés mínimo `new LocalMeClient(id, storageMock, () => "2026-06-12")` — el constructor ya acepta `today` inyectable, línea 30-38):

```ts
it("regla 1×fecha en local (D1): segunda sesión el mismo día → FechaOcupadaError; otra fecha → ok", async () => {
  const c = client(); // arnés del archivo: LocalMeClient con plan demo seedeado y today fijo
  await c.putMeSession(1, 0, { actuals: [{ order: 0, movementId: "arranque", done: true, kg: 60 }] });
  await expect(c.putMeSession(1, 1, { actuals: [{ order: 0, movementId: "cargada", done: true, kg: 70 }] }))
    .rejects.toBeInstanceOf(FechaOcupadaError);
  await c.putMeSession(1, 1, { fecha: "2026-06-11", actuals: [{ order: 0, movementId: "cargada", done: true, kg: 70 }] });
  const views = await c.getMeSessions(1);
  expect(views.find((v) => v.sessionIdx === 0)?.fecha).toBe("2026-06-12");
  expect(views.find((v) => v.sessionIdx === 1)?.fecha).toBe("2026-06-11");
});
```

- [ ] **Step 4: Run FAIL**, después implementar en `LocalMeClient.ts` — espejo del server:

```ts
async putMeSession(week: number, sessionIdx: number, input: PutMeSessionInput): Promise<void> {
  const parsed = PutMeSessionInputSchema.parse(input);
  const hoy = this.today();
  const fecha = parsed.fecha ?? hoy;
  if (validateFechaEntreno(fecha, hoy) === "futuro") throw new Error("fecha futura");
  const macro = this.macro(); // helper: MACROCYCLES.find((m) => m.id === this.plan()?.macroId)
  const layout = macro ? dayLayoutFor(macro, week) : null;
  const dayOf = (idx: number) => layout?.[idx]?.day ?? idx + 1;
  const registros = this.registros(); // JsonStore key nuevo: KEYS.sessionRegistros(this.id), default []
  const summarized = parsed.actuals.map((a) => ({
    a, sum: a.sets && a.sets.length > 0 ? summarizeSets(a.sets) : { done: a.done, kg: a.kg, reps: a.reps },
  }));
  const anyDone = summarized.some(({ sum }) => sum.done);
  if (anyDone) {
    const conflict = fechaConflict(registros.filter((r) => r.fecha === fecha), week, sessionIdx, fecha, dayOf);
    if (conflict) throw new FechaOcupadaError(conflict);
  }
  const kept = this.actuals().filter((a) => !(a.week === week && a.sessionIdx === sessionIdx));
  const added: SessionActual[] = summarized.map(({ a, sum }) => ({
    week, sessionIdx, order: a.order, movementId: a.movementId,
    prescribedMovementId: a.prescribedMovementId,
    done: sum.done, actualKg: sum.kg, actualReps: sum.reps, note: a.note,
    sets: a.sets && a.sets.length > 0 ? a.sets : undefined,
    doneAt: sum.done ? fecha : undefined,
  }));
  this.s.set(KEYS.sessionActuals(this.id), [...kept, ...added]);
  const keptRegs = registros.filter((r) => !(r.week === week && r.sessionIdx === sessionIdx));
  this.s.set(KEYS.sessionRegistros(this.id), anyDone ? [...keptRegs, { week, sessionIdx, fecha }] : keptRegs);
}
```

y `getMeSessions` adjunta el layout + fecha (espejo del repo, Task 6 Step 4); `getMeHeat` pasa `day` a `planHeat` (espejo de Task 7 Step 4). Agregar `KEYS.sessionRegistros` donde están las otras keys y el getter `registros()` validando con `z.array(SessionRegistroSchema)` (patrón read-side de la casa).

- [ ] **Step 5: Actualizar TODOS los call sites de `putMeSession`** — `Grep putMeSession apps/web/src` y envolver los payloads: `me.putMeSession(week, idx, actuals)` → `me.putMeSession(week, idx, { actuals })` (la fecha real la cablea Task 10). Incluye mocks de tests (`vi.mocked`).

- [ ] **Step 6: Run PASS** — `pnpm -C apps/web test -- localMeClient` y `pnpm -C apps/web typecheck` → PASS/limpio.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/data/
git commit -m "feat(web): cliente con envelope {fecha,actuals}, FechaOcupadaError tipada y regla 1xfecha espejada en LocalMeClient"
```

---

### Task 9: `FechaSheet` — el selector de fecha (BottomSheet, tap, jamás futuro)

**Files:**
- Create: `apps/web/src/screens/atleta/entreno/FechaSheet.tsx`
- Create: `apps/web/src/screens/atleta/__tests__/fechaSheet.test.tsx`

- [ ] **Step 1: Test que falla**:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { FechaSheet } from "../entreno/FechaSheet";

const noop = () => {};
const base = { open: true, hoy: "2026-06-12", ocupadas: [], onClose: noop };

test("ofrece Hoy/Ayer y dispara onPick con la fecha elegida", () => {
  const onPick = vi.fn();
  render(<FechaSheet {...base} motivo="conflicto" onPick={onPick} />);
  expect(screen.getByText(/ya registraste un entreno/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /ayer/i }));
  expect(onPick).toHaveBeenCalledWith("2026-06-11");
});

test("fecha ocupada elegida a mano → lo dice y NO deja confirmar", () => {
  const onPick = vi.fn();
  render(<FechaSheet {...base} motivo="editar" ocupadas={["2026-06-10"]} onPick={onPick} />);
  fireEvent.change(screen.getByLabelText(/elegir fecha/i), { target: { value: "2026-06-10" } });
  expect(screen.getByText(/esa fecha ya tiene un entreno/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /usar esta fecha/i }));
  expect(onPick).not.toHaveBeenCalled();
});

test("aviso suave fuera de la semana del plan — informa, no bloquea (D2)", () => {
  const onPick = vi.fn();
  render(<FechaSheet {...base} motivo="editar" fueraDeSemana={(f) => f === "2026-05-01"} onPick={onPick} />);
  fireEvent.change(screen.getByLabelText(/elegir fecha/i), { target: { value: "2026-05-01" } });
  expect(screen.getByText(/fuera de la semana del plan/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /usar esta fecha/i }));
  expect(onPick).toHaveBeenCalledWith("2026-05-01");
});
```

- [ ] **Step 2: Run FAIL** — `pnpm -C apps/web test -- fechaSheet` → FAIL.

- [ ] **Step 3: Implementar** — `FechaSheet.tsx`:

```tsx
import { useState } from "react";
import { BottomSheet } from "../../../ui/BottomSheet";

const addDays = (iso: string, d: number): string =>
  new Date(new Date(`${iso}T00:00:00Z`).getTime() + d * 86_400_000).toISOString().slice(0, 10);

/** Selector de la fecha del entreno (spec 2026-06-12 D2/D5). Aparece SOLO al entrar con hoy
 *  ocupada (motivo "conflicto") o al tocar «Entreno del … ▾» (motivo "editar"). Tap, jamás
 *  hover; jamás futuro (input max=hoy); ocupada elegida a mano → bloquea confirmar con copy
 *  honesto; fuera de la semana del plan → AVISO suave, deja pasar (D2). */
export function FechaSheet({ open, hoy, ocupadas, motivo, fueraDeSemana, onPick, onClose }: {
  open: boolean;
  hoy: string;
  ocupadas: string[];
  motivo: "conflicto" | "editar";
  fueraDeSemana?: (fecha: string) => boolean;
  onPick: (fecha: string) => void;
  onClose: () => void;
}) {
  const [manual, setManual] = useState<string>("");
  const ayer = addDays(hoy, -1);
  const ocupada = manual !== "" && ocupadas.includes(manual);
  const fuera = manual !== "" && !ocupada && (fueraDeSemana?.(manual) ?? false);
  const mono: React.CSSProperties = { fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)" };
  return (
    <BottomSheet open={open} onClose={onClose} ariaLabel="Fecha del entreno">
      <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 18, color: "var(--wl-text)" }}>
        {motivo === "conflicto" ? "Ya registraste un entreno hoy" : "¿Cuándo hiciste este entreno?"}
      </div>
      <div style={{ ...mono, marginTop: 6 }}>
        {motivo === "conflicto"
          ? "Este registro necesita su propia fecha — ¿cuándo lo hiciste?"
          : "El registro queda con la fecha real del entreno."}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        {!ocupadas.includes(hoy) && (
          <button type="button" className="wl-btn wl-btn--primary" style={{ flex: 1 }} onClick={() => onPick(hoy)}>Hoy</button>
        )}
        {!ocupadas.includes(ayer) && (
          <button type="button" className="wl-btn" style={{ flex: 1 }} onClick={() => onPick(ayer)}>Ayer</button>
        )}
      </div>
      <label style={{ ...mono, display: "block", marginTop: 14 }}>
        Elegir fecha
        <input
          type="date" max={hoy} value={manual}
          onChange={(e) => setManual(e.target.value)}
          style={{ display: "block", width: "100%", marginTop: 6, padding: "10px 12px", borderRadius: "var(--wl-radius)", border: "1px solid color-mix(in srgb,var(--wl-text) 14%,transparent)", background: "var(--wl-bg)", color: "var(--wl-text)", fontFamily: "var(--mono)", fontSize: 13, boxSizing: "border-box" }}
        />
      </label>
      {ocupada && <div role="alert" style={{ ...mono, color: "var(--wl-danger)", marginTop: 8 }}>Esa fecha ya tiene un entreno registrado.</div>}
      {fuera && <div role="status" style={{ ...mono, marginTop: 8 }}>Ojo: queda fuera de la semana del plan — se permite igual.</div>}
      <button
        type="button" className="wl-btn wl-btn--primary" disabled={manual === "" || ocupada}
        style={{ width: "100%", marginTop: 12, opacity: manual === "" || ocupada ? 0.5 : 1 }}
        onClick={() => { if (manual !== "" && !ocupada) onPick(manual); }}
      >
        Usar esta fecha
      </button>
    </BottomSheet>
  );
}
```

(`--wl-danger` existe en los 6 skins — sesión homogeneización 06-11. El `input type="date"` con `max` es la guarda de futuro en UI; el server re-valida.)

- [ ] **Step 4: Run PASS** — `pnpm -C apps/web test -- fechaSheet` → PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/screens/atleta/entreno/FechaSheet.tsx apps/web/src/screens/atleta/__tests__/fechaSheet.test.tsx
git commit -m "feat(web): FechaSheet - selector de fecha del entreno (conflicto upfront / editar), jamas futuro, aviso suave fuera-de-semana"
```

---

### Task 10: EntrenoScreen — fecha en el flujo (upfront en conflicto, retry en 409, «Entreno del … ▾»)

**Files:**
- Modify: `apps/web/src/screens/atleta/EntrenoScreen.tsx`
- Modify: `apps/web/src/screens/atleta/entreno/ResumenDia.tsx` (línea del trigger de fecha)
- Test: `apps/web/src/screens/atleta/__tests__/entreno.fecha.test.tsx` (nuevo; mockear `meClient` como hacen los tests vecinos)

- [ ] **Step 1: Tests que fallan** (arnés: mock de `meClient` con `getMeSessions` resolviendo la semana; render con MemoryRouter en `/atleta/entreno/9/3` — copiar el patrón del test existente del EntrenoScreen si lo hay, si no del de SemanaCard):

```tsx
test("hoy ocupada por OTRA sesión → FechaSheet aparece al entrar (D5)", async () => {
  // semana con sesión 0 fecha=HOY; entramos a la sesión 3
  mockSessions([viewConFecha(0, HOY), view(1), view(2), view(3), view(4)]);
  renderEntreno(9, 3);
  expect(await screen.findByText(/ya registraste un entreno hoy/i)).toBeInTheDocument();
});

test("hoy libre → sin sheet; guarda con {fecha: hoy}", async () => {
  mockSessions([view(0), view(1), view(2), view(3), view(4)]);
  renderEntreno(9, 3);
  expect(screen.queryByText(/ya registraste un entreno/i)).not.toBeInTheDocument();
  // ... flujo de guardar (patrón del test existente) ...
  expect(me.putMeSession).toHaveBeenCalledWith(9, 3, expect.objectContaining({ fecha: HOY }));
});

test("409 del server (carrera) → abre FechaSheet y reintenta con la fecha elegida", async () => {
  mockSessions([view(0), view(1), view(2), view(3), view(4)]);
  vi.mocked(me.putMeSession)
    .mockRejectedValueOnce(new FechaOcupadaError({ week: 9, sessionIdx: 0, fecha: HOY }))
    .mockResolvedValueOnce(undefined);
  renderEntreno(9, 3);
  // ... guardar → sheet con motivo conflicto → tocar «Ayer» ...
  expect(me.putMeSession).toHaveBeenLastCalledWith(9, 3, expect.objectContaining({ fecha: AYER }));
});

test("edición de sesión ya registrada conserva su fecha (D12)", async () => {
  mockSessions([view(0), view(1), view(2), viewConFecha(3, "2026-06-09"), view(4)]);
  renderEntreno(9, 3);
  // ... guardar sin tocar la fecha ...
  expect(me.putMeSession).toHaveBeenCalledWith(9, 3, expect.objectContaining({ fecha: "2026-06-09" }));
});
```

- [ ] **Step 2: Run FAIL** — `pnpm -C apps/web test -- entreno.fecha` → FAIL.

- [ ] **Step 3: Implementar en EntrenoScreen** — el screen ya carga las views de la semana (de ahí salen `rows`). Agregar estado y derivaciones (cerca de los useState existentes):

```tsx
const hoy = new Date().toISOString().slice(0, 10);
const [fecha, setFecha] = useState<string | null>(null);          // null = aún sin resolver
const [fechaSheet, setFechaSheet] = useState<"conflicto" | "editar" | null>(null);
const [ocupadas, setOcupadas] = useState<string[]>([]);
// Derivar de las views de la semana ya cargadas (sin fetch extra):
//   propia    = views[idx].fecha (edición conserva su fecha — D12)
//   ocupadas  = fechas de las DEMÁS sesiones de la semana (la cross-semana la cubre el 409)
//   mismas-día (turnos AM/PM, D9): excluir de `ocupadas` las sesiones cuyo day === views[idx].day
```

al terminar de cargar las views (en el `.then` existente):

```tsx
const view = views.find((v) => v.sessionIdx === idx);
const propia = view?.fecha;
const myDay = view?.day ?? idx + 1;
const ocupadas = views
  .filter((v) => v.sessionIdx !== idx && v.fecha != null && (v.day ?? v.sessionIdx + 1) !== myDay)
  .map((v) => v.fecha!) ;
setOcupadas(ocupadas);
if (propia) setFecha(propia);
else if (ocupadas.includes(hoy)) setFechaSheet("conflicto");      // D5: upfront, no al final
else setFecha(hoy);
```

en `save()` (líneas 67-79), el call pasa a:

```tsx
await me.putMeSession(week, idx, { fecha: fecha ?? hoy, actuals });
```

con catch ampliado:

```tsx
} catch (e) {
  if (e instanceof FechaOcupadaError) { setFechaSheet("conflicto"); return; }  // red de seguridad (carrera)
  setError(e instanceof Error ? e.message : "No se pudo guardar");
}
```

y el render del sheet (junto al SubstituteSheet, línea ~123):

```tsx
{fechaSheet != null && (
  <FechaSheet
    open motivo={fechaSheet} hoy={hoy} ocupadas={ocupadas}
    fueraDeSemana={startDate ? (f) => fueraDeSemana(f, startDate, week) : undefined}
    onPick={(f) => { setFecha(f); setFechaSheet(null); }}
    onClose={() => setFechaSheet(null)}
  />
)}
```

`startDate` sale de `getMePlan()` si el screen ya lo carga; si no lo carga, omitir el aviso (prop `fueraDeSemana` undefined — degrada con gracia, no agregar fetch). Si el usuario CIERRA el sheet de conflicto sin elegir (onClose), `fecha` queda null → `save()` usa hoy y el server responde 409 → el sheet reaparece: aceptable y honesto.

- [ ] **Step 4: Trigger visible** — en `ResumenDia.tsx`, agregar props opcionales y el trigger encima del botón Iniciar:

```tsx
export function ResumenDia({ rows, barKg, onStart, fecha, onFechaTap }: {
  rows: ResumenRow[]; barKg: number; onStart: () => void;
  fecha?: string; onFechaTap?: () => void;
}) {
```

```tsx
{fecha && onFechaTap && (
  <button type="button" onClick={onFechaTap}
    style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)", padding: "0 0 10px", display: "block" }}>
    Entreno del {fecha} <span aria-hidden>▾</span>
  </button>
)}
```

EntrenoScreen lo cablea: `<ResumenDia … fecha={fecha ?? hoy} onFechaTap={() => setFechaSheet("editar")} />`. Header del player (línea 87): `Entreno · sem {week} · día {idx + 1}` pasa a usar el day real + turno:

```tsx
Entreno · sem {week} · día {myDay}{myTurno ? ` · ${myTurno}` : ""}
```

(`myTurno = view?.turno`).

- [ ] **Step 5: Run PASS** — `pnpm -C apps/web test -- entreno` → PASS (los tests previos del screen + los nuevos).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/screens/atleta/EntrenoScreen.tsx apps/web/src/screens/atleta/entreno/ResumenDia.tsx apps/web/src/screens/atleta/__tests__/entreno.fecha.test.tsx
git commit -m "feat(web): fecha en el player - sheet upfront si hoy ocupada, retry en 409, edicion conserva fecha, header dia/turno (D5/D12)"
```

---

### Task 11: SemanaCard agrupada por día con fechas y turnos

**Files:**
- Modify: `apps/web/src/screens/atleta/hoy/SemanaCard.tsx`
- Modify: `apps/web/src/screens/atleta/__tests__/semana.test.tsx` (append)

- [ ] **Step 1: Tests que fallan**:

```tsx
test("día doble: filas hermanas «Día 1 · AM» / «Día 1 · PM» (D6/D8)", async () => {
  vi.mocked(me.getMeSessions).mockResolvedValueOnce([
    { week: 9, sessionIdx: 0, day: 1, turno: "AM", exercises: [exDone()] },
    { week: 9, sessionIdx: 1, day: 1, turno: "PM", exercises: [exPend()] },
    { week: 9, sessionIdx: 2, day: 2, exercises: [exPend()] },
  ] as never);
  renderCard();
  expect(await screen.findByText("Día 1 · AM")).toBeInTheDocument();
  expect(screen.getByText("Día 1 · PM")).toBeInTheDocument();
  expect(screen.getByText("Día 2")).toBeInTheDocument();
});

test("día hecho muestra su fecha; CTA usa day/turno del próximo pendiente", async () => {
  vi.mocked(me.getMeSessions).mockResolvedValueOnce([
    { week: 9, sessionIdx: 0, fecha: "2026-06-09", exercises: [exDone()] },
    { week: 9, sessionIdx: 1, exercises: [exPend()] },
  ] as never);
  renderCard();
  expect(await screen.findByText(/hecho · 2026-06-09/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Registrar entreno · Día 2/ })).toBeInTheDocument();
});
```

(`exDone`/`exPend` = helpers del archivo o mínimos: `{ movementId: "arranque", sets: 1, reps: 1, movementName: "Arranque", actual: { done: true, … } }` — copiar el shape de los tests existentes del archivo.)

- [ ] **Step 2: Run FAIL** — `pnpm -C apps/web test -- semana` → FAIL.

- [ ] **Step 3: Implementar** — en `SemanaCard.tsx` (estructura actual completa arriba en este plan, Task de contexto): importar `sessionsByDay` de `@holy-oly/core` y reemplazar el bloque del listado (líneas 45-60) y el CTA (34-41):

```tsx
const grouped = sessionsByDay(sessions);
const labelOf = (s: SessionView) => {
  const day = s.day ?? s.sessionIdx + 1;
  return s.turno ? `Día ${day} · ${s.turno}` : `Día ${day}`;
};
```

CTA (la variable `next` no cambia — sigue siendo la primera sesión incompleta en orden de sessionIdx):

```tsx
Registrar entreno · {labelOf(next)}
```

listado — un bloque por sesión, mismo estilo de fila actual, con la fecha cuando está hecha:

```tsx
{grouped.flatMap((g) => g.sesiones).map(({ session: s }) => {
  const total = s.exercises.length;
  const done = doneOf(s);
  const state = done === 0 ? "pendiente" : done === total ? "hecho" : "en curso";
  const dot = state === "hecho" ? "var(--wl-accent)" : state === "en curso" ? "var(--wl-muted)" : "color-mix(in srgb,var(--wl-text) 22%,transparent)";
  const meta = state === "hecho" && s.fecha ? `${done}/${total} · hecho · ${s.fecha}` : `${done}/${total} · ${state}`;
  return (
    <button key={s.sessionIdx} type="button" aria-label={labelOf(s)} onClick={() => navigate(`/atleta/entreno/${week}/${s.sessionIdx}`)}
      style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: "var(--wl-radius)", border: "1px solid color-mix(in srgb,var(--wl-text) 10%,transparent)", background: "var(--wl-bg)", cursor: "pointer" }}>
      <span style={{ width: 9, height: 9, borderRadius: 99, background: dot, flex: "0 0 auto" }} />
      <span style={{ flex: 1, fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 14, color: "var(--wl-text)" }}>{labelOf(s)}</span>
      <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--wl-muted)" }}>{meta}</span>
    </button>
  );
})}
```

(El formato de la fecha en la fila: ISO crudo está bien para v1 — legible y sin librerías; si el owner pide «lun 9», iterar después. Mantener `flatMap` plano: el agrupador garantiza el ORDEN AM→PM contiguo, que es lo que la fila hermana necesita; un sub-encabezado por día sería sobre-diseño para 5-9 filas.)

- [ ] **Step 4: Run PASS** — `pnpm -C apps/web test -- semana` → PASS (incluidos los tests viejos del archivo: la rama sin day/turno/fecha rinde idéntico a hoy).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/screens/atleta/hoy/SemanaCard.tsx apps/web/src/screens/atleta/__tests__/semana.test.tsx
git commit -m "feat(web): SemanaCard agrupada por dia real - filas AM/PM hermanas, fecha en dias hechos, CTA con day/turno"
```

---

### Task 12: Victoria + coach (SessionsSection) con day/turno/fecha

**Files:**
- Modify: `apps/web/src/screens/atleta/entreno/VictoriaScreen.tsx:79` (línea «Día {idx + 1} — …»)
- Modify: `apps/web/src/screens/coach/sessions/SessionsSection.tsx:78` y alrededores
- Test: append en los tests existentes de cada pantalla (ubicar con Glob `apps/web/src/**/__tests__/*ictoria*` y `apps/web/src/screens/coach/**/__tests__/`)

- [ ] **Step 1: Tests que fallan** — Victoria: con view `{ day: 1, turno: "PM", fecha: "2026-06-12" }` el header dice `Día 1 · PM`; coach: una sesión con `fecha` muestra «registrado el 2026-06-12» y una con `turno` titula «Día 1 · AM».

- [ ] **Step 2: VictoriaScreen** — la pantalla ya carga la sesión (de ahí salen `dayMoves`/`comp`). En la línea 79, usar el view:

```tsx
Día {view?.day ?? idx + 1}{view?.turno ? ` · ${view.turno}` : ""} — {dayMoves}<br />{view?.fecha ?? fecha}
```

(la variable local `fecha` existente de la pantalla queda como fallback; la verdad es `view.fecha`.)

- [ ] **Step 3: SessionsSection (coach)** — línea 78:

```tsx
<span style={{ fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 13, color: "var(--wl-text)" }}>
  Día {s.day ?? s.sessionIdx + 1}{s.turno ? ` · ${s.turno}` : ""}
</span>
{s.fecha && (
  <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-muted)", marginLeft: 8 }}>
    registrado el {s.fecha}
  </span>
)}
```

(D13: el coach ve la fecha real — adherencia honesta. `SessionMark`/`SessionAdherence` NO se tocan.)

- [ ] **Step 4: Run PASS** — `pnpm -C apps/web test -- victoria sessions` → PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/screens/atleta/entreno/VictoriaScreen.tsx apps/web/src/screens/coach/sessions/SessionsSection.tsx apps/web/src/screens/atleta/__tests__/ apps/web/src/screens/coach/
git commit -m "feat(web): day/turno/fecha en Victoria y en el drill-down del coach (registrado el X) (D13)"
```

---

### Task 13: Seeds — kv pasa a `bulgaro-6d` (día doble visible a ojo)

**Files:**
- Modify: `apps/api/prisma/seed-demo-data.ts:123-136` (`DEMO_PLAN_INPUTS.kv.macroId`)
- Modify: `apps/web/src/data/seeds.ts` (espejo local si define el plan de kv — verificar con Grep `kv` en el archivo)

- [ ] **Step 1: Cambiar el macro de kv**:

```ts
  kv: {
    macroId: "bulgaro-6d",   // bi-diario AM/PM visible en demo (spec 2026-06-12 D6)
    currentWeek: 12,
    rms: { arranque: 98, envion: 122, sentadilla: 165, frente: 132 },
    comps: [{ name: "Sudamericano", week: 16 }],
  },
```

⚠ `currentWeek: 12` y `week: 16` deben existir en `bulgaro-6d` — verificar el total de semanas del macro en `packages/core/src/data/macrocycles.ts` (buscar `id: 'bulgaro-6d'`); si dura menos, ajustar `currentWeek` a una semana válida y la comp a la última semana.

- [ ] **Step 2: Verificar a ojo en demo local** — `pnpm -C apps/api exec prisma db seed` contra la DB local (o el script de seed local de la casa, `db:seed:local` — ⚠ es DESTRUCTIVO, sólo en DB demo) y abrir el drill-down de kv: la semana debe mostrar días 1/3/5 con AM+PM.

- [ ] **Step 3: Suite api** — `pnpm -C apps/api test` → PASS (si algún test asume que kv está en ruso-5d, ajustarlo o dejar kv como estaba y crear un tercer atleta demo búlgaro — decisión del implementador, documentarla en el commit).

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/seed-demo-data.ts apps/web/src/data/seeds.ts
git commit -m "feat(seed): kv en bulgaro-6d - dia doble AM/PM visible en la demo"
```

---

### Task 14: Suite completa + rulebook + reviews obligatorias (D14)

**Files:**
- Modify: `docs/domain/HOLY-OLY-DOMAIN.md` (sección Registro)

- [ ] **Step 1: Suite completa de los 3 paquetes**

Run: `pnpm -r test && pnpm -r typecheck && pnpm lint`
Expected: todo PASS/limpio. Números de referencia pre-slice: core 321 · web 346 · api 50 — deben SUBIR, jamás bajar.

- [ ] **Step 2: Rulebook** — agregar al `docs/domain/HOLY-OLY-DOMAIN.md` (donde encaje por secciones, estilo de la casa) la regla nueva:

```markdown
### Registro con fecha (spec 2026-06-12)
- Todo registro de sesión lleva **fecha real del entreno** (`SessionRegistro`): default hoy,
  jamás futura, backdating libre. La fecha la declara la atleta; `doneAt` por-ejercicio es
  copia estampada en la misma transacción (procedencia de PRs estable ante ediciones).
- **Máx. 1 entreno por fecha** por atleta (server, 409). Excepción única: turnos AM/PM del
  mismo día de receta de la MISMA semana (pueden compartir fecha, no están obligados).
- El layout día/turno es ADN de la receta (`dayLayoutFor`), NO se persiste ni se edita por
  atleta. `sessionsByDay()` es el ÚNICO agrupador — jamás re-derivar «sesión i = día i» a mano.
- Fecha fuera del rango calendario de la semana del plan → aviso suave, JAMÁS bloqueo.
```

- [ ] **Step 3: Review de dominio — El Carnicero** (obligatoria, D14). El agente vive en `.claude/agents/el-carnicero.md` (⚠ memoria: invocarlo vía agente general-purpose que lea ese archivo como system prompt, en contexto fresco). Pasarle: el spec, el diff completo (`git diff main...HEAD`), y los 4 blancos pre-anotados del spec §9 (fecha auto-declarada en procedencia de PR; doble conteo diario en monitor/ACWR; valor del factor 1.5 del guard SNC diario; backfill min(doneAt) y adherencia falsa). Aplicar TODO CRITICAL/HIGH antes de seguir; MEDIUM a criterio con respuesta escrita.

- [ ] **Step 4: Review TypeScript** — dispatch del agente `typescript-reviewer` sobre el diff. Aplicar CRITICAL/HIGH.

- [ ] **Step 5: Commit de cierre (fixes de reviews + rulebook)**

```bash
git add -A
git commit -m "fix(core+api+web): post-review Carnicero+TS del slice registro-fecha + rulebook actualizado"
```

- [ ] **Step 6: Verificación final** — `pnpm -r test && pnpm -r typecheck && pnpm lint` de nuevo tras los fixes → PASS. Dejar constancia en el mensaje final: suite, números, y qué findings se aplicaron.

---

## Self-review del plan (hecho al escribirlo)

- **Cobertura del spec:** D1-D5 → Tasks 1,2,6,9,10 · D6-D9 → Tasks 3,4,7,11 · D10-D11 → Tasks 5,6 · D12 → Tasks 6,10 · D13 → Tasks 6,12 · D14 → Task 14 · §7 seeds → Task 13 · §6 heat → Task 7. Aviso fuera-de-semana (D2) → Tasks 2,9,10.
- **Sin placeholders:** cada step con código o comando concreto; los puntos que dependen de código no leído (arnés de tests vecinos, variable `fecha` local de Victoria) están anclados a `path:línea` con instrucción de copiar el patrón del archivo.
- **Consistencia de tipos:** `PutMeSessionInput { fecha?, actuals }` (Tasks 1,6,8,10) · `SessionRegistro { week, sessionIdx, fecha }` (1,2,5,6,8) · `dayOf: DayOf` (2,6,8) · `dayLayoutFor(macro, week)` (3,6,7,8) · `sessionsByDay` genérico (3,11).
