# Feedback predictivo por racha de bienestar — Plan de implementación (Parte 1: motor + atleta)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Avisar al atleta "si seguís {durmiendo mal / con estrés / cansada / con molestias / sin ganas}, va a pasar X" cuando una señal de su check-in lleva ≥3 días seguidos en mal estado.

**Architecture:** Función PURA `wellnessStreak` en `@holy-oly/core` que detecta rachas de días malos por ítem (determinística, sin extrapolar). Los dos productores de `DayLogView` (el server `repo.getDayLogView` y el offline `LocalMeClient.getDayLog`) la llaman y adjuntan un `headsUp` redactado. Un componente nuevo `AtencionBlock` lo renderiza en "Hoy", debajo del Titular, solo cuando hay racha. La copy vive en el componente (Spanish hardcoded, como el `Titular` vecino — la superficie "Hoy" aún no está migrada a i18n en esta rama).

**Tech Stack:** TypeScript monorepo (pnpm), Vitest, React, Zod, Prisma. Spec: `docs/superpowers/specs/2026-06-29-feedback-predictivo-bienestar-design.md`.

## Global Constraints

- **HR-1**: al atleta NUNCA le llega readiness/ACWR/sobreentrenamiento/RPE. Este plan solo usa el check-in propio + una consecuencia sentida y reversible. Sin las palabras "sobreentrenamiento", "lesión", "readiness", "ACWR", "RPE".
- **Sin dato → null honesto**: <3 días con check-in, o último check-in rancio (>2 días vs `today`), o sin racha ≥3 → `headsUp = null` (el bloque no se renderiza). Nunca un aviso inventado.
- **El ciclo menstrual NO entra** al cómputo (ni dispara ni suprime).
- **Advisory**: no toca el plan prescrito, ni el motor Prilepin, ni el semáforo `seriesState`.
- **Ítems vigilados (exactos, 5)**: `sueno, estres, fatiga, dolor, motivacion`. `humor` queda afuera.
- **Umbrales (exactos)**: `warn` = 3 días seguidos malos en un ítem; `alert` = 5+ días en un ítem **o** 2+ ítems en racha (≥3) a la vez. Frescura: último check-in a >2 días de `today` → null.
- **"Día malo"**: valor 1..5 con `goodness ≤ 2` (espejo de `goodness()` de `wellness.ts`): `sueno/motivacion ≤ 2`; `estres/fatiga/dolor ≥ 4`.
- **Inmutabilidad**: `wellnessStreak` no muta `logs` (copia antes de ordenar).
- Code style: matchear el archivo vecino (p.ej. `AtencionBlock` reusa la clase CSS `.ho-titular` del `Titular`, sin CSS nuevo).

---

## File Structure

- `packages/core/src/types/index.ts` (modify) — nuevos tipos `WatchedWellnessField`, `StreakHeadsUp`; campo `headsUp` en `DayLogView`.
- `packages/core/src/logic/wellnessStreak.ts` (create) — la función pura.
- `packages/core/src/logic/wellnessStreak.test.ts` (create) — tests del motor.
- `packages/core/src/index.ts` (modify) — export del nuevo módulo.
- `packages/core/src/schemas.ts` (modify) — `StreakHeadsUpSchema` + campo en `DayLogViewSchema`.
- `apps/api/src/repo.ts` (modify) — `getDayLogView` adjunta `headsUp`.
- `apps/web/src/data/LocalMeClient.ts` (modify) — `getDayLog` adjunta `headsUp` (paridad offline).
- `apps/web/src/screens/atleta/hoy/AtencionBlock.tsx` (create) — el bloque "Atención".
- `apps/web/src/screens/atleta/hoy/AtencionBlock.test.tsx` (create) — tests del componente.
- `apps/web/src/screens/atleta/HomeScreen.tsx` (modify) — renderiza `AtencionBlock` bajo el `Titular`.

---

## Task 1: Motor `wellnessStreak` (puro, testeado)

**Files:**
- Modify: `packages/core/src/types/index.ts` (después de `WellnessAnswers`, ~línea 111)
- Create: `packages/core/src/logic/wellnessStreak.ts`
- Create: `packages/core/src/logic/wellnessStreak.test.ts`
- Modify: `packages/core/src/index.ts` (lista de exports)

**Interfaces:**
- Consumes: `DayLog` (de `../types`).
- Produces:
  - `type WatchedWellnessField = "sueno" | "estres" | "fatiga" | "dolor" | "motivacion"`
  - `interface StreakHeadsUp { item: WatchedWellnessField; days: number; severity: "warn" | "alert"; alsoStreaking: WatchedWellnessField[] }`
  - `function wellnessStreak(logs: DayLog[], today: string): StreakHeadsUp | null`

- [ ] **Step 1: Añadir los tipos a `types/index.ts`**

Insertar justo después de la línea `export type WellnessAnswers = Record<WellnessField, number>;`:

```ts
/** Ítems del check-in vigilados para rachas de bienestar (humor queda afuera por diseño). */
export type WatchedWellnessField = "sueno" | "estres" | "fatiga" | "dolor" | "motivacion";

/** Heads-up "si esto sigue, va a pasar X": el ítem líder en racha de días malos + severidad.
 *  Hechos estructurados — la copy (frase-factor/consecuencia/acción) vive en la capa web. */
export interface StreakHeadsUp {
  item: WatchedWellnessField;
  days: number;                          // días malos consecutivos del ítem líder
  severity: "warn" | "alert";
  alsoStreaking: WatchedWellnessField[]; // otros ítems en racha (≥3), por prioridad
}
```

- [ ] **Step 2: Escribir el test que falla**

Crear `packages/core/src/logic/wellnessStreak.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { wellnessStreak } from "./wellnessStreak";
import type { DayLog } from "../types";

/** Fixture: un check-in con todos los ítems neutros (3 = no malo), sobreescribiendo los que importan. */
const D = (date: string, o: Partial<DayLog>): DayLog => ({
  date, fatiga: 3, dolor: 3, estres: 3, humor: 3, motivacion: 3, sueno: 3, ...o,
});

describe("wellnessStreak", () => {
  it("3 días seguidos durmiendo mal → warn (item sueno, days 3)", () => {
    const logs = [D("2026-06-27", { sueno: 2 }), D("2026-06-28", { sueno: 1 }), D("2026-06-29", { sueno: 2 })];
    expect(wellnessStreak(logs, "2026-06-29")).toEqual({ item: "sueno", days: 3, severity: "warn", alsoStreaking: [] });
  });

  it("racha de 2 (con un día bueno antes) → null", () => {
    const logs = [D("2026-06-27", { sueno: 5 }), D("2026-06-28", { sueno: 2 }), D("2026-06-29", { sueno: 2 })];
    expect(wellnessStreak(logs, "2026-06-29")).toBeNull();
  });

  it("un hueco de fecha corta la racha → null", () => {
    const logs = [D("2026-06-25", { sueno: 2 }), D("2026-06-27", { sueno: 2 }), D("2026-06-28", { sueno: 2 })];
    expect(wellnessStreak(logs, "2026-06-28")).toBeNull();
  });

  it("5 días seguidos muy cansada → alert (item fatiga, days 5)", () => {
    const logs = ["25", "26", "27", "28", "29"].map((d) => D(`2026-06-${d}`, { fatiga: 5 }));
    expect(wellnessStreak(logs, "2026-06-29")).toEqual({ item: "fatiga", days: 5, severity: "alert", alsoStreaking: [] });
  });

  it("2 ítems en racha (sueño + estrés) → alert; líder por prioridad (sueño antes que estrés)", () => {
    const logs = ["27", "28", "29"].map((d) => D(`2026-06-${d}`, { sueno: 2, estres: 5 }));
    expect(wellnessStreak(logs, "2026-06-29")).toEqual({ item: "sueno", days: 3, severity: "alert", alsoStreaking: ["estres"] });
  });

  it("invierte highBad: estrés alto (5) 3 días → warn (item estres)", () => {
    const logs = ["27", "28", "29"].map((d) => D(`2026-06-${d}`, { estres: 5 }));
    expect(wellnessStreak(logs, "2026-06-29")).toEqual({ item: "estres", days: 3, severity: "warn", alsoStreaking: [] });
  });

  it("guarda de frescura: último check-in a >2 días de today → null", () => {
    const logs = ["25", "26", "27"].map((d) => D(`2026-06-${d}`, { sueno: 2 }));
    expect(wellnessStreak(logs, "2026-06-30")).toBeNull();
  });

  it("menos de 3 check-ins → null", () => {
    expect(wellnessStreak([D("2026-06-29", { sueno: 1 })], "2026-06-29")).toBeNull();
  });

  it("sin check-ins → null", () => {
    expect(wellnessStreak([], "2026-06-29")).toBeNull();
  });
});
```

- [ ] **Step 3: Correr el test y verificar que falla**

Run: `pnpm --filter @holy-oly/core exec vitest run src/logic/wellnessStreak.test.ts`
Expected: FAIL — "Failed to resolve import './wellnessStreak'" / `wellnessStreak is not a function`.

- [ ] **Step 4: Implementar el motor**

Crear `packages/core/src/logic/wellnessStreak.ts`:

```ts
import type { DayLog, StreakHeadsUp, WatchedWellnessField } from "../types";

/** Los 5 ítems vigilados + su polaridad: highBad = un valor ALTO es malo (fatiga/dolor/estrés);
 *  para sueño/motivación, un valor BAJO es malo. Espejo de WELLNESS_ITEMS (wellness.ts). */
const WATCHED: { field: WatchedWellnessField; highBad: boolean }[] = [
  { field: "sueno", highBad: false },
  { field: "estres", highBad: true },
  { field: "fatiga", highBad: true },
  { field: "dolor", highBad: true },
  { field: "motivacion", highBad: false },
];

/** Desempate cuando varias rachas empatan en largo: dolor primero (deriva al coach por seguridad). */
const PRIORITY: WatchedWellnessField[] = ["dolor", "sueno", "fatiga", "estres", "motivacion"];

const WARN_DAYS = 3;
const ALERT_DAYS = 5;
const STALE_DAYS = 2; // último check-in más viejo que esto vs `today` → no se avisa

/** Día entero (UTC) de una fecha ISO YYYY-MM-DD, para diferencias en días calendario. */
function dayNumber(iso: string): number {
  return Math.floor(Date.parse(`${iso}T00:00:00Z`) / 86_400_000);
}

/** Un día es "malo" para un ítem si su valor cae en el extremo feo (goodness ≤ 2). */
function isBadDay(log: DayLog, field: WatchedWellnessField, highBad: boolean): boolean {
  const v = log[field];
  if (typeof v !== "number" || !Number.isFinite(v)) return false;
  const good = highBad ? 6 - v : v; // espejo de goodness()
  return good <= 2;
}

/** Largo de la racha de días malos consecutivos (fechas contiguas) de un ítem, terminando en el
 *  día más reciente. `sorted` viene asc por fecha. */
function streakLen(sorted: DayLog[], field: WatchedWellnessField, highBad: boolean): number {
  let len = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (!isBadDay(sorted[i]!, field, highBad)) break;
    if (i < sorted.length - 1 && dayNumber(sorted[i + 1]!.date) - dayNumber(sorted[i]!.date) !== 1) break;
    len++;
  }
  return len;
}

/**
 * Heads-up de racha de bienestar (atleta): el ítem líder en racha de días malos + severidad, o
 * `null` si no hay racha ≥3, si el último check-in está rancio (>2 días), o si faltan datos.
 * PURO: no muta `logs`. La copy vive en la capa web (keyed por item × severity).
 */
export function wellnessStreak(logs: DayLog[], today: string): StreakHeadsUp | null {
  if (logs.length < WARN_DAYS) return null;
  const sorted = [...logs].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const last = sorted[sorted.length - 1]!;
  if (dayNumber(today) - dayNumber(last.date) > STALE_DAYS) return null;

  const streaks = WATCHED
    .map(({ field, highBad }) => ({ field, len: streakLen(sorted, field, highBad) }))
    .filter((s) => s.len >= WARN_DAYS);
  if (streaks.length === 0) return null;

  const leader = streaks.slice().sort((a, b) =>
    b.len - a.len || PRIORITY.indexOf(a.field) - PRIORITY.indexOf(b.field))[0]!;
  const severity: "warn" | "alert" = leader.len >= ALERT_DAYS || streaks.length >= 2 ? "alert" : "warn";
  const alsoStreaking = streaks
    .filter((s) => s.field !== leader.field)
    .sort((a, b) => PRIORITY.indexOf(a.field) - PRIORITY.indexOf(b.field))
    .map((s) => s.field);

  return { item: leader.field, days: leader.len, severity, alsoStreaking };
}
```

- [ ] **Step 5: Exportar el módulo en `core/src/index.ts`**

Añadir junto a los otros `export * from "./logic/..."` (p.ej. después de la línea `export * from "./logic/wellness";`):

```ts
export * from "./logic/wellnessStreak";
```

- [ ] **Step 6: Correr el test y verificar que pasa**

Run: `pnpm --filter @holy-oly/core exec vitest run src/logic/wellnessStreak.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 7: Typecheck del core**

Run: `pnpm --filter @holy-oly/core typecheck`
Expected: sin errores.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/types/index.ts packages/core/src/logic/wellnessStreak.ts packages/core/src/logic/wellnessStreak.test.ts packages/core/src/index.ts
git commit -m "feat(core): motor wellnessStreak (racha de bienestar → heads-up predictivo)"
```

---

## Task 2: Adjuntar `headsUp` a `DayLogView` (tipo + schema + ambos productores)

**Files:**
- Modify: `packages/core/src/types/index.ts` (`DayLogView`, ~línea 127)
- Modify: `packages/core/src/schemas.ts` (`DayLogViewSchema`, ~línea 187)
- Modify: `apps/api/src/repo.ts` (`getDayLogView`, ~línea 312; import de core)
- Modify: `apps/web/src/data/LocalMeClient.ts` (`getDayLog`, ~línea 85; import de core línea 16)

**Interfaces:**
- Consumes: `wellnessStreak`, `StreakHeadsUp` (Task 1); `toDayLog`, `computeStreak` (existentes en repo.ts / core).
- Produces: `DayLogView.headsUp: StreakHeadsUp | null` poblado por server y offline.

- [ ] **Step 1: Añadir `headsUp` al tipo `DayLogView`**

En `packages/core/src/types/index.ts`, cambiar:

```ts
export interface DayLogView {
  entry: DayLog | null;
  streak: number;
  days: string[]; // ISO dates with a logged entry (for the heatmap)
  today: string;  // ISO
}
```

por (campo **opcional + nullable** a propósito — ver nota):

```ts
export interface DayLogView {
  entry: DayLog | null;
  streak: number;
  days: string[]; // ISO dates with a logged entry (for the heatmap)
  today: string;  // ISO
  headsUp?: StreakHeadsUp | null; // racha de bienestar (si esto sigue, va a pasar X), o null
}
```

> **Nota (por qué opcional):** ~10 tests/mocks construyen `DayLogView` literales sin `headsUp`
> (`meClient.test.ts`, `home.test.tsx`, `CrearCicloSheet.test.tsx`, etc.) y `schemas.daylog.test.ts`
> espera que un objeto sin `headsUp` parsee OK. Hacerlo requerido rompería ese test y el typecheck de
> esos mocks. Opcional+nullable no rompe nada; los dos productores reales (Task 2 Steps 3–4) igual lo
> setean siempre (a valor o `null`).

- [ ] **Step 2: Añadir `StreakHeadsUpSchema` y el campo al `DayLogViewSchema`**

En `packages/core/src/schemas.ts`, justo antes de `export const DayLogViewSchema`:

```ts
export const StreakHeadsUpSchema = z.object({
  item: z.enum(["sueno", "estres", "fatiga", "dolor", "motivacion"]),
  days: z.number().int().positive(),
  severity: z.enum(["warn", "alert"]),
  alsoStreaking: z.array(z.enum(["sueno", "estres", "fatiga", "dolor", "motivacion"])),
});
```

y dentro de `DayLogViewSchema` añadir el campo:

```ts
export const DayLogViewSchema = z.object({
  entry: DayLogSchema.nullable(),
  streak: z.number().int().nonnegative(),
  days: z.array(IsoDateSchema).max(2000),
  today: IsoDateSchema,
  headsUp: StreakHeadsUpSchema.nullable().optional(),
});
```

(`.optional()` mantiene verde `schemas.daylog.test.ts:19`, que parsea un view sin `headsUp`.)

- [ ] **Step 3: Server — `getDayLogView` calcula y adjunta `headsUp`**

En `apps/api/src/repo.ts`:

(a) Añadir `wellnessStreak` al import existente desde `@holy-oly/core` (cerca del tope del archivo, junto a `MACROCYCLES`, `availableWeeksToComp`, etc.):

```ts
import { wellnessStreak } from "@holy-oly/core";
```
(si ya hay un import agrupado de `@holy-oly/core`, agregá `wellnessStreak` a esa lista en vez de duplicar el import.)

(b) Reemplazar el cuerpo de `getDayLogView`:

```ts
export async function getDayLogView(prisma: PrismaClient, athleteId: string, today: string, date?: string): Promise<DayLogView> {
  const target = date ?? today;
  const rows = await prisma.dayLog.findMany({ where: { athleteId }, select: { date: true } });
  const days = rows.map((r) => r.date);
  const entry = await prisma.dayLog.findUnique({ where: { athleteId_date: { athleteId, date: target } } });
  // Racha de bienestar: las últimas ~14 filas CON valores alcanzan para racha + guarda de frescura.
  const recent = await prisma.dayLog.findMany({ where: { athleteId }, orderBy: { date: "desc" }, take: 14 });
  const headsUp = wellnessStreak(recent.map(toDayLog), today);
  return { entry: entry ? toDayLog(entry) : null, streak: computeStreak(days, today), days, today, headsUp };
}
```

- [ ] **Step 4: Offline — `LocalMeClient.getDayLog` adjunta `headsUp`**

En `apps/web/src/data/LocalMeClient.ts`:

(a) Añadir `wellnessStreak` a la lista de imports de `@holy-oly/core` (línea ~16, junto a `buildMePlanView, computeStreak, ...`).

(b) Reemplazar el `return` de `getDayLog`:

```ts
  async getDayLog(date?: string): Promise<DayLogView> {
    const today = this.today();
    const logs = this.dayLogs();
    const days = logs.map((l) => l.date);
    const target = date ?? today;
    const entry = logs.find((l) => l.date === target) ?? null;
    return { entry, streak: computeStreak(days, today), days, today, headsUp: wellnessStreak(logs, today) };
  }
```

- [ ] **Step 5: Typecheck de todo el repo**

Run: `pnpm -r typecheck`
Expected: sin errores. (Confirma que `httpMeClient` — que hace `DayLogViewSchema.parse(...)` — sigue compilando; el `headsUp` viaja por el parse automáticamente.)

- [ ] **Step 6: Tests de core (el schema nuevo no rompe los existentes)**

Run: `pnpm --filter @holy-oly/core test`
Expected: PASS (incluye `schemas.daylog.test.ts` y `wellnessStreak.test.ts`).

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/types/index.ts packages/core/src/schemas.ts apps/api/src/repo.ts apps/web/src/data/LocalMeClient.ts
git commit -m "feat(core,api,web): DayLogView lleva headsUp de racha (server + offline)"
```

---

## Task 3: Componente `AtencionBlock` (presentacional, testeado)

**Files:**
- Create: `apps/web/src/screens/atleta/hoy/AtencionBlock.tsx`
- Create: `apps/web/src/screens/atleta/hoy/AtencionBlock.test.tsx`

**Interfaces:**
- Consumes: `StreakHeadsUp`, `WatchedWellnessField` (de `@holy-oly/core`); `STATUS` (de `../../../ui/status`); la clase CSS `.ho-titular` (ya existe, del `Titular`).
- Produces: `function AtencionBlock({ headsUp }: { headsUp: StreakHeadsUp | null | undefined }): JSX.Element | null`

- [ ] **Step 1: Escribir el test que falla**

Crear `apps/web/src/screens/atleta/hoy/AtencionBlock.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AtencionBlock } from "./AtencionBlock";

describe("AtencionBlock", () => {
  it("no renderiza nada sin heads-up", () => {
    const { container } = render(<AtencionBlock headsUp={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("warn: nombra el factor y la consecuencia, con acción presente", () => {
    render(<AtencionBlock headsUp={{ item: "sueno", days: 3, severity: "warn", alsoStreaking: [] }} />);
    expect(screen.getByText(/Llevás 3 días durmiendo mal/)).toBeInTheDocument();
    expect(screen.getByText(/recuperación caer/)).toBeInTheDocument();
    expect(screen.getByText(/priorizá descanso/)).toBeInTheDocument();
  });

  it("alert deriva al coach", () => {
    render(<AtencionBlock headsUp={{ item: "fatiga", days: 5, severity: "alert", alsoStreaking: [] }} />);
    expect(screen.getByText(/cuentes a tu coach/)).toBeInTheDocument();
  });

  it("dolor deriva al coach aún en warn (ítem sensible)", () => {
    render(<AtencionBlock headsUp={{ item: "dolor", days: 3, severity: "warn", alsoStreaking: [] }} />);
    expect(screen.getByText(/cuentes a tu coach/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm --filter @holy-oly/web exec vitest run src/screens/atleta/hoy/AtencionBlock.test.tsx`
Expected: FAIL — "Failed to resolve import './AtencionBlock'".

- [ ] **Step 3: Implementar el componente**

Crear `apps/web/src/screens/atleta/hoy/AtencionBlock.tsx`:

```tsx
import type { StreakHeadsUp, WatchedWellnessField } from "@holy-oly/core";
import { STATUS } from "../../../ui/status";

/** Copy del aviso (Spanish hardcoded, como el Titular vecino — "Hoy" aún no está en i18n).
 *  Consecuencia REVERSIBLE y sentida; jamás readiness/sobreentrenamiento/RPE (HR-1). */
const FACTOR: Record<WatchedWellnessField, string> = {
  sueno: "durmiendo mal",
  estres: "con la cabeza a full",
  fatiga: "muy cansada",
  dolor: "con molestias",
  motivacion: "sin ganas",
};
const CONSEQ: Record<WatchedWellnessField, string> = {
  sueno: "vas a notar la recuperación caer y el plan se te va a hacer más pesado",
  estres: "te va a costar concentrarte y sostener la intensidad",
  fatiga: "el cansancio se acumula y vas a rendir por debajo de lo tuyo",
  dolor: "forzar sobre una molestia que no cede puede frenarte",
  motivacion: "las ganas se siguen apagando y te va a costar arrancar las sesiones",
};
const ACTION: Record<WatchedWellnessField, string> = {
  sueno: "Esta semana bajá un cambio y priorizá descanso.",
  estres: "Buscá bajar revoluciones fuera del gym.",
  fatiga: "Date margen: dormir y comer mejor esta semana.",
  dolor: "Contáselo a tu coach antes de cargar fuerte.",
  motivacion: "Aflojá la exigencia un toque; volvé a lo que disfrutás.",
};
const TO_COACH = "Conviene que se lo cuentes a tu coach.";

/** Bloque "Atención" de Hoy: aparece SOLO con una racha activa (si esto sigue, va a pasar X).
 *  Reusa la clase .ho-titular del Titular para no agregar CSS. */
export function AtencionBlock({ headsUp }: { headsUp: StreakHeadsUp | null | undefined }) {
  if (!headsUp) return null;
  const { item, days, severity } = headsUp;
  const col = severity === "alert" ? STATUS.alert : STATUS.warn;
  const action = severity === "alert" || item === "dolor" ? TO_COACH : ACTION[item];
  return (
    <section aria-label="Atención" className="ho-titular" style={{
      background: `color-mix(in srgb, ${col} 14%, transparent)`,
      borderColor: `color-mix(in srgb, ${col} 45%, transparent)`,
    }}>
      <div className="ho-titular__row">
        <span className="ho-titular__dot" style={{ background: col, boxShadow: `0 0 18px ${col}99` }} />
        <div>
          <div className="ho-titular__lbl">Atención</div>
          <div className="ho-titular__st" style={{ color: col }}>Llevás {days} días {FACTOR[item]}</div>
        </div>
      </div>
      <p className="ho-titular__msg">Si sigue, <b>{CONSEQ[item]}</b>. {action}</p>
    </section>
  );
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm --filter @holy-oly/web exec vitest run src/screens/atleta/hoy/AtencionBlock.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/screens/atleta/hoy/AtencionBlock.tsx apps/web/src/screens/atleta/hoy/AtencionBlock.test.tsx
git commit -m "feat(web): AtencionBlock — aviso de racha de bienestar del atleta"
```

---

## Task 4: Renderizar en `HomeScreen` + verificación en el preview

**Files:**
- Modify: `apps/web/src/screens/atleta/HomeScreen.tsx` (import ~línea 7; render ~línea 105)

**Interfaces:**
- Consumes: `AtencionBlock` (Task 3); `daylog.headsUp` (Task 2).

- [ ] **Step 1: Importar `AtencionBlock`**

En `apps/web/src/screens/atleta/HomeScreen.tsx`, junto a los imports de `./hoy/...` (después de `import { EstadoTip } from "./hoy/EstadoTip";`):

```ts
import { AtencionBlock } from "./hoy/AtencionBlock";
```

- [ ] **Step 2: Renderizar el bloque bajo el Titular**

Cambiar:

```tsx
      <Titular state={titularState} />
      {/* Tip del día ... */}
      <EstadoTip state={titularState} entry={daylog.entry} seed={Number(daylog.today.replaceAll("-", "")) || 0} />
```

por:

```tsx
      <Titular state={titularState} />
      {/* Aviso de racha: "si esto sigue, va a pasar X". Aparece solo con racha activa (else null). */}
      <AtencionBlock headsUp={daylog.headsUp} />
      {/* Tip del día ... */}
      <EstadoTip state={titularState} entry={daylog.entry} seed={Number(daylog.today.replaceAll("-", "")) || 0} />
```

- [ ] **Step 3: Typecheck del web**

Run: `pnpm --filter @holy-oly/web typecheck`
Expected: sin errores.

- [ ] **Step 4: Verificar en el preview (offline / LocalMeClient)**

Levantar el dev server (`preview_start` del workflow de verificación) y abrir la Home del atleta. Con un atleta cuyos últimos ≥3 check-ins tengan sueño bajo, el bloque "Atención" debe aparecer **debajo de "Mi estado de hoy"** con el texto "Llevás N días durmiendo mal… Si sigue, vas a notar la recuperación caer…". Sin racha, el bloque NO aparece.
- `preview_console_logs`: sin errores.
- `preview_screenshot`: capturar el bloque para compartir como prueba.

Si el seed local no tiene una racha, registrar 3 check-ins seguidos con sueño = 1 vía el check-in (o ajustar el seed de demo) para gatillarlo.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/screens/atleta/HomeScreen.tsx
git commit -m "feat(web): mostrar AtencionBlock en Hoy, bajo Mi estado de hoy"
```

---

## Parte 2 (plan aparte): superficie del coach

NO incluida acá a propósito. El coach **no tiene hoy en el web ninguna superficie que cargue los check-ins diarios** (`getDaily` / `AthleteDailyView` existen en la API pero no se renderizan), así que su parte necesita su propia plomería de datos y merece un plan independiente:

- `coachStreakRisk(logs, series, week): CoachRisk | null` en core (reusa `wellnessStreak`, suma ACWR sostenido / `readinessTrend`).
- Llevar los `DayLog` recientes por atleta al roster (nuevo método de `Repository` o campo en el endpoint del plantel) — decisión de diseño de esa parte.
- Chip en `AtletaMiniCard` + línea de rationale en el drill-down (acá sí "sobrecarga/ACWR/readiness").

Se planifica como `docs/superpowers/plans/2026-06-29-feedback-predictivo-coach.md` cuando arranquemos esa parte.

---

## Verificación final (Parte 1)

- [ ] `pnpm -r typecheck` sin errores.
- [ ] `pnpm --filter @holy-oly/core test` y `pnpm --filter @holy-oly/web test` verdes.
- [ ] Preview: bloque "Atención" visible con racha, ausente sin racha; consola limpia.
- [ ] Lint: `pnpm lint` sin nuevos errores en los archivos tocados.
