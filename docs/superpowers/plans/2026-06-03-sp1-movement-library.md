# SP1 — Librería de movimientos · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Olympic-weightlifting movement library in `core` — a curated set of base lifts plus a generator that expands them (by axes: captura × origen × posición × tipoEnvión) into the full variant catalog, with pure query helpers (complexity ranking, "lower complexity", substitutions, RM mapping, bilingual search). Foundation (SP1) of the execution pillar; SP2–SP5 build on it.

**Architecture:** Pure `core`, no DB/UI. `data/movements.ts` holds ONLY the curated `MOVEMENT_BASES` (data). `logic/movements.ts` holds all logic — `computeComplexity`, `movementDisplayName`, `buildMovements`, the generated `MOVEMENTS = buildMovements(MOVEMENT_BASES)`, and the query helpers. This one-directional `logic → data` import avoids a cycle (the spec's literal "MOVEMENTS in data/" would force `data → logic` for the derivation helpers and cycle back). Variants are flag-less; flags are a type-supported modifier that SP2 applies at prescription time via the exported `computeComplexity`/`movementDisplayName`.

**Tech Stack:** TypeScript (strict), Vitest. Mirrors existing core modules (`data/macrocycles.ts`, `logic/monitor.ts`, `logic/schedule.ts`).

**Spec:** [`docs/superpowers/specs/2026-06-03-sp1-movement-library-design.md`](../specs/2026-06-03-sp1-movement-library-design.md)

---

## File Structure

- **Modify** `packages/core/src/types/index.ts` — add `RmRef`, `Captura`, `Origen`, `Posicion`, `TipoEnvion`, `MovementFlag`, `MovementModifiers`, `MovementBase`, `Movement`.
- **Create** `packages/core/src/data/movements.ts` — `MOVEMENT_BASES: MovementBase[]` (the 14 curated bases, pure data).
- **Create** `packages/core/src/logic/movements.ts` — `computeComplexity`, `movementDisplayName`, `buildMovements`, `MOVEMENTS`, and query helpers (`getMovement`, `getBase`, `variantsOf`, `canonicalVariant`, `simplerVariants`, `substitutesOf`, `movementsForRm`, `searchMovements`).
- **Create** `packages/core/src/logic/movements.test.ts` — catalog integrity, generation, derivation, and helper tests.
- **Modify** `packages/core/src/index.ts` — `export * from "./data/movements"; export * from "./logic/movements";`.

Commands: `pnpm --filter @holy-oly/core test [filter]` · `pnpm --filter @holy-oly/core exec tsc --noEmit`.

---

## Task 1: Types

**Files:**
- Modify: `packages/core/src/types/index.ts` (append at end of file)

- [ ] **Step 1: Append the types**

```typescript
// ── Movement library (SP1 · pilar de ejecución). A Movement is a base lift × modifiers
//    (captura/origen/posición/tipoEnvión); the catalog is generated from the bases. ──
export type RmRef = "arranque" | "envion" | "sentadilla" | "frente" | "none";
export type Captura = "completo" | "potencia";          // squat catch vs power
export type Origen = "piso" | "bloques" | "colgado";    // floor / blocks / hang
export type Posicion = "alto" | "rodilla" | "bajo";     // only when origen ∈ {bloques, colgado}
export type TipoEnvion = "tijera" | "empuje" | "potencia" | "fuerza"; // split / push / power / strict-rack
export type MovementFlag = "pausa" | "deficit" | "tempo" | "sin-recibida";

/** Concrete modifiers of a variant. `flags` is always present (`[]` in the generated catalog). */
export interface MovementModifiers {
  captura?: Captura;
  origen?: Origen;
  posicion?: Posicion;
  tipoEnvion?: TipoEnvion;
  flags: MovementFlag[];
}

/** Hand-curated base lift. Declares which axes it admits; variants are generated from these. */
export interface MovementBase {
  id: string;            // slug: "arranque", "tiron-arranque", "sentadilla-frente"…
  name: string;          // "Arranque"
  aliasEn?: string;      // "Snatch" — bilingual search
  rmRef: RmRef;
  baseComplexity: number;
  /** `posicion` is NOT declared per base — the generator applies all 3 when origen ∈ {bloques, colgado}. */
  axes: {
    captura?: Captura[];
    origen?: Origen[];
    tipoEnvion?: TipoEnvion[];
  };
  /** Flags that make sense for this base (SP2 applies them at prescription time; NOT pre-generated). */
  allowedFlags: MovementFlag[];
  /** Curated substitute base ids (same pattern/objetivo; may cross family). */
  substituteBases: string[];
  notes?: string;
}

/** A concrete variant — GENERATED from base × axes. Flag-less in the catalog. */
export interface Movement {
  id: string;            // "arranque.potencia.colgado.rodilla" (canonical = baseId)
  baseId: string;
  name: string;          // "Arranque de potencia colgado (rodilla)"
  rmRef: RmRef;          // = base.rmRef
  complexity: number;    // derived (1..12)
  modifiers: MovementModifiers;
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm --filter @holy-oly/core exec tsc --noEmit`
Expected: PASS (types only; `export * from "./types"` already in `index.ts` auto-exports them).

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/types/index.ts
git commit -m "feat(core): tipos de la librería de movimientos (Movement/MovementBase/ejes)"
```

---

## Task 2: Curated bases + generator + derivation

**Files:**
- Create: `packages/core/src/data/movements.ts`
- Create: `packages/core/src/logic/movements.ts`
- Create: `packages/core/src/logic/movements.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write the failing test** (`packages/core/src/logic/movements.test.ts`)

```typescript
import { describe, it, expect } from "vitest";
import { MOVEMENT_BASES } from "../data/movements";
import { MOVEMENTS, computeComplexity, movementDisplayName, getMovement } from "./movements";

describe("MOVEMENT_BASES (catalog integrity)", () => {
  it("has unique base ids", () => {
    const ids = MOVEMENT_BASES.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("every substituteBases id refers to an existing base", () => {
    const ids = new Set(MOVEMENT_BASES.map((b) => b.id));
    for (const b of MOVEMENT_BASES) for (const s of b.substituteBases) expect(ids.has(s)).toBe(true);
  });
  it("every rmRef is one of the 5 valid values", () => {
    const valid = new Set(["arranque", "envion", "sentadilla", "frente", "none"]);
    for (const b of MOVEMENT_BASES) expect(valid.has(b.rmRef)).toBe(true);
  });
});

describe("computeComplexity", () => {
  it("applies the deltas and clamps to 1..12", () => {
    expect(computeComplexity(9, { flags: [] })).toBe(9); // full from floor
    expect(computeComplexity(9, { captura: "potencia", origen: "colgado", posicion: "rodilla", flags: [] })).toBe(5); // hang power snatch (rodilla)
    expect(computeComplexity(9, { captura: "potencia", origen: "colgado", posicion: "alto", flags: [] })).toBe(4); // above-knee: even easier
    expect(computeComplexity(9, { captura: "completo", origen: "colgado", posicion: "bajo", flags: [] })).toBe(8); // below-knee hardest hang variant, still < floor (9)
    expect(computeComplexity(7, { tipoEnvion: "fuerza", flags: [] })).toBe(5);
    expect(computeComplexity(2, { flags: ["pausa", "tempo"] })).toBe(4);
    expect(computeComplexity(2, { captura: "potencia", flags: [] })).toBe(1); // clamp ≥1
  });
});

describe("movementDisplayName", () => {
  it("composes the Spanish name from base + modifiers", () => {
    expect(movementDisplayName("Arranque", { captura: "potencia", origen: "colgado", posicion: "rodilla", flags: [] }))
      .toBe("Arranque de potencia colgado (rodilla)");
    expect(movementDisplayName("Envión", { tipoEnvion: "tijera", flags: [] })).toBe("Envión en tijera");
    expect(movementDisplayName("Sentadilla", { flags: ["pausa"] })).toBe("Sentadilla con pausa");
    expect(movementDisplayName("Arranque", { captura: "completo", origen: "piso", flags: [] })).toBe("Arranque");
  });
});

describe("MOVEMENTS (generation)", () => {
  it("generates the full variant set (68)", () => {
    expect(MOVEMENTS.length).toBe(68);
  });
  it("the canonical full snatch from floor is id 'arranque'", () => {
    const a = getMovement("arranque");
    expect(a).toBeDefined();
    expect(a!.rmRef).toBe("arranque");
    expect(a!.complexity).toBe(9);
  });
  it("hang power snatch (rodilla) exists with the derived id/name/complexity", () => {
    const m = getMovement("arranque.potencia.colgado.rodilla");
    expect(m).toBeDefined();
    expect(m!.rmRef).toBe("arranque");
    expect(m!.complexity).toBe(5);
    expect(m!.name).toContain("potencia");
    expect(m!.name).toContain("colgado");
  });
  it("posición never appears with origen 'piso'; ids are unique", () => {
    for (const m of MOVEMENTS) if (m.modifiers.origen === "piso") expect(m.modifiers.posicion).toBeUndefined();
    const ids = MOVEMENTS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of MOVEMENTS) expect(m.complexity).toBeGreaterThanOrEqual(1);
  });
  it("the jerk has no bare 'envion' id (always a tipoEnvion suffix)", () => {
    expect(getMovement("envion")).toBeUndefined();
    expect(getMovement("envion.tijera")).toBeDefined();
  });
});
```

- [ ] **Step 2: Run it — verify it fails**

Run: `pnpm --filter @holy-oly/core test movements`
Expected: FAIL — `Cannot find module '../data/movements'`.

- [ ] **Step 3: Create `packages/core/src/data/movements.ts`**

```typescript
import type { MovementBase } from "../types";

/** Curated base lifts. Variants are generated from these (see logic/movements.ts). The coach
 *  owns this list; accessories are extensible. `posicion` is applied by the generator (not here). */
export const MOVEMENT_BASES: MovementBase[] = [
  { id: "arranque", name: "Arranque", aliasEn: "Snatch", rmRef: "arranque", baseComplexity: 9,
    axes: { captura: ["completo", "potencia"], origen: ["piso", "bloques", "colgado"] },
    allowedFlags: ["pausa", "deficit", "sin-recibida"], substituteBases: ["tiron-arranque", "sentadilla-overhead"] },
  { id: "cargada", name: "Cargada", aliasEn: "Clean", rmRef: "envion", baseComplexity: 8,
    axes: { captura: ["completo", "potencia"], origen: ["piso", "bloques", "colgado"] },
    allowedFlags: ["pausa", "deficit"], substituteBases: ["tiron-cargada", "sentadilla-frente"] },
  { id: "envion", name: "Envión", aliasEn: "Jerk", rmRef: "envion", baseComplexity: 7,
    axes: { tipoEnvion: ["tijera", "empuje", "potencia", "fuerza"] },
    allowedFlags: ["pausa"], substituteBases: ["press-empuje"] },
  { id: "cargada-envion", name: "Cargada y Envión", aliasEn: "Clean and Jerk", rmRef: "envion", baseComplexity: 9,
    axes: { captura: ["completo", "potencia"], origen: ["piso", "bloques", "colgado"] },
    allowedFlags: ["pausa"], substituteBases: ["cargada", "envion"] },
  { id: "tiron-arranque", name: "Tirón de arranque", aliasEn: "Snatch pull", rmRef: "arranque", baseComplexity: 5,
    axes: { origen: ["piso", "bloques", "colgado"] },
    allowedFlags: ["deficit", "pausa"], substituteBases: ["arranque"], notes: "se programa 90–110%" },
  { id: "tiron-cargada", name: "Tirón de cargada", aliasEn: "Clean pull", rmRef: "envion", baseComplexity: 5,
    axes: { origen: ["piso", "bloques", "colgado"] },
    allowedFlags: ["deficit", "pausa"], substituteBases: ["cargada"], notes: "se programa 90–110%" },
  { id: "sentadilla", name: "Sentadilla", aliasEn: "Back squat", rmRef: "sentadilla", baseComplexity: 4,
    axes: {}, allowedFlags: ["pausa", "tempo"], substituteBases: ["sentadilla-frente"] },
  { id: "sentadilla-frente", name: "Sentadilla frontal", aliasEn: "Front squat", rmRef: "frente", baseComplexity: 5,
    axes: {}, allowedFlags: ["pausa", "tempo"], substituteBases: ["sentadilla"] },
  { id: "sentadilla-overhead", name: "Sentadilla de arranque", aliasEn: "Overhead squat", rmRef: "none", baseComplexity: 5,
    axes: {}, allowedFlags: ["pausa"], substituteBases: ["sentadilla-frente"] },
  { id: "press-empuje", name: "Push press", aliasEn: "Push press", rmRef: "none", baseComplexity: 3,
    axes: {}, allowedFlags: ["pausa"], substituteBases: ["envion", "press-hombros"] },
  { id: "press-hombros", name: "Press de hombros", aliasEn: "Strict press", rmRef: "none", baseComplexity: 2,
    axes: {}, allowedFlags: ["tempo"], substituteBases: ["press-empuje"] },
  { id: "peso-muerto-rumano", name: "Peso muerto rumano", aliasEn: "Romanian deadlift", rmRef: "none", baseComplexity: 2,
    axes: {}, allowedFlags: ["tempo", "pausa"], substituteBases: ["tiron-cargada"] },
  { id: "buenos-dias", name: "Buenos días", aliasEn: "Good morning", rmRef: "none", baseComplexity: 2,
    axes: {}, allowedFlags: ["tempo"], substituteBases: ["peso-muerto-rumano"] },
  { id: "remo", name: "Remo con barra", aliasEn: "Barbell row", rmRef: "none", baseComplexity: 2,
    axes: {}, allowedFlags: ["pausa"], substituteBases: [] },
];
```

- [ ] **Step 4: Create `packages/core/src/logic/movements.ts`** (generation + derivation; query helpers added in Task 3)

```typescript
import type {
  Captura, Movement, MovementBase, MovementFlag, MovementModifiers, Origen, Posicion, TipoEnvion,
} from "../types";
import { MOVEMENT_BASES } from "../data/movements";

const POSICIONES: Posicion[] = ["alto", "rodilla", "bajo"];

/** Complexity 1..12: full-from-floor is hardest; power & blocks/hang lower it; pausa/déficit/tempo raise it. */
export function computeComplexity(baseComplexity: number, m: MovementModifiers): number {
  let c = baseComplexity;
  if (m.captura === "potencia") c -= 2;
  if (m.origen === "bloques" || m.origen === "colgado") c -= 2; // hang/blocks: shorter pull, no floor pickup
  if (m.posicion === "alto") c -= 1;
  else if (m.posicion === "bajo") c += 1; // below-knee = longer pull, harder than at/above knee
  if (m.tipoEnvion === "empuje" || m.tipoEnvion === "potencia") c -= 1;
  else if (m.tipoEnvion === "fuerza") c -= 2;
  for (const f of m.flags) {
    if (f === "pausa" || f === "deficit" || f === "tempo") c += 1;
    else if (f === "sin-recibida") c -= 1;
  }
  return Math.max(1, Math.min(12, c));
}

const TIPO_ENVION_LABEL: Record<TipoEnvion, string> = {
  tijera: "en tijera", empuje: "de empuje", potencia: "de potencia", fuerza: "de fuerza",
};
const FLAG_LABEL: Record<MovementFlag, string> = {
  pausa: "con pausa", deficit: "con déficit", tempo: "tempo", "sin-recibida": "sin recibida",
};

/** Spanish display name: base + (de potencia) + (origen/posición) + (tipoEnvión) + flags. Defaults (completo, piso) omitted. */
export function movementDisplayName(baseName: string, m: MovementModifiers): string {
  const parts: string[] = [baseName];
  if (m.captura === "potencia") parts.push("de potencia");
  if (m.origen === "bloques") parts.push(m.posicion ? `desde bloques (${m.posicion})` : "desde bloques");
  else if (m.origen === "colgado") parts.push(m.posicion ? `colgado (${m.posicion})` : "colgado");
  if (m.tipoEnvion) parts.push(TIPO_ENVION_LABEL[m.tipoEnvion]);
  for (const f of m.flags) parts.push(FLAG_LABEL[f]);
  return parts.join(" ");
}

/** Variant id: base + non-default modifiers (completo & piso omitted). Flags are NOT in the id. */
function movementId(baseId: string, m: MovementModifiers): string {
  const parts = [baseId];
  if (m.captura === "potencia") parts.push("potencia");
  if (m.origen === "bloques" || m.origen === "colgado") {
    parts.push(m.origen);
    if (m.posicion) parts.push(m.posicion);
  }
  if (m.tipoEnvion) parts.push(m.tipoEnvion);
  return parts.join(".");
}

/** Expand each base over its axes into concrete (flag-less) variants. Complete by construction. */
export function buildMovements(bases: MovementBase[]): Movement[] {
  const out: Movement[] = [];
  for (const base of bases) {
    const capturas: (Captura | undefined)[] = base.axes.captura ?? [undefined];
    const origenes: (Origen | undefined)[] = base.axes.origen ?? [undefined];
    const tipos: (TipoEnvion | undefined)[] = base.axes.tipoEnvion ?? [undefined];
    for (const captura of capturas) {
      for (const tipoEnvion of tipos) {
        for (const origen of origenes) {
          const posiciones: (Posicion | undefined)[] =
            origen === "bloques" || origen === "colgado" ? POSICIONES : [undefined];
          for (const posicion of posiciones) {
            const modifiers: MovementModifiers = { flags: [] };
            if (captura) modifiers.captura = captura;
            if (origen) modifiers.origen = origen;
            if (posicion) modifiers.posicion = posicion;
            if (tipoEnvion) modifiers.tipoEnvion = tipoEnvion;
            out.push({
              id: movementId(base.id, modifiers),
              baseId: base.id,
              name: movementDisplayName(base.name, modifiers),
              rmRef: base.rmRef,
              complexity: computeComplexity(base.baseComplexity, modifiers),
              modifiers,
            });
          }
        }
      }
    }
  }
  return out;
}

/** The generated catalog. */
export const MOVEMENTS: Movement[] = buildMovements(MOVEMENT_BASES);

const BY_ID = new Map<string, Movement>(MOVEMENTS.map((m) => [m.id, m]));

/** Look up a generated variant by id. */
export function getMovement(id: string): Movement | undefined {
  return BY_ID.get(id);
}
```

- [ ] **Step 5: Add barrel exports** — in `packages/core/src/index.ts`, append after the existing exports:

```typescript
export * from "./data/movements";
export * from "./logic/movements";
```

- [ ] **Step 6: Run tests + typecheck — verify they pass**

Run: `pnpm --filter @holy-oly/core test movements && pnpm --filter @holy-oly/core exec tsc --noEmit`
Expected: PASS (integrity + computeComplexity + movementDisplayName + generation, incl. `MOVEMENTS.length === 68`).

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/data/movements.ts packages/core/src/logic/movements.ts packages/core/src/logic/movements.test.ts packages/core/src/index.ts
git commit -m "feat(core): catálogo de movimientos + generador por ejes (68 variantes)"
```

---

## Task 3: Query helpers

**Files:**
- Modify: `packages/core/src/logic/movements.ts` (append helpers)
- Modify: `packages/core/src/logic/movements.test.ts` (append helper tests)

- [ ] **Step 1: Write the failing tests** — append to `packages/core/src/logic/movements.test.ts` (and extend the import on line 3 to add the helpers):

```typescript
import {
  MOVEMENTS, computeComplexity, movementDisplayName, getMovement,
  getBase, variantsOf, canonicalVariant, simplerVariants, substitutesOf, movementsForRm, searchMovements,
} from "./movements";

// … (existing describe blocks stay) …

describe("query helpers", () => {
  it("variantsOf returns a base's variants sorted by complexity desc", () => {
    const vs = variantsOf("arranque");
    expect(vs.length).toBe(14);
    expect(vs[0]!.id).toBe("arranque"); // full from floor, complexity 9
    for (let i = 1; i < vs.length; i++) expect(vs[i - 1]!.complexity).toBeGreaterThanOrEqual(vs[i]!.complexity);
  });
  it("canonicalVariant picks the most-complex variant (split jerk for envión)", () => {
    expect(canonicalVariant("arranque")!.id).toBe("arranque");
    expect(canonicalVariant("envion")!.id).toBe("envion.tijera");
    expect(canonicalVariant("sentadilla")!.id).toBe("sentadilla");
  });
  it("simplerVariants = same base, lower complexity (lower the complexity)", () => {
    const s = simplerVariants("arranque");
    expect(s.every((m) => m.complexity < 9)).toBe(true);
    expect(s.some((m) => m.id === "arranque")).toBe(false); // excludes the full lift itself
    expect(s.length).toBe(13);
  });
  it("substitutesOf resolves substituteBases to their canonical variants", () => {
    const subs = substitutesOf("arranque").map((m) => m.id);
    expect(subs).toContain("tiron-arranque");
    expect(subs).toContain("sentadilla-overhead");
  });
  it("movementsForRm filters by the referenced RM", () => {
    expect(movementsForRm("frente").some((m) => m.baseId === "sentadilla-frente")).toBe(true);
    expect(movementsForRm("frente").every((m) => m.rmRef === "frente")).toBe(true);
  });
  it("searchMovements matches Spanish and English terms (accent-insensitive)", () => {
    expect(searchMovements("hang power snatch").some((m) => m.id === "arranque.potencia.colgado.rodilla")).toBe(true);
    expect(searchMovements("arranque potencia colgado").some((m) => m.modifiers.origen === "colgado")).toBe(true);
    expect(searchMovements("sentadilla frontal").some((m) => m.baseId === "sentadilla-frente")).toBe(true);
    expect(searchMovements("").length).toBe(0);
  });
  it("getBase returns the base definition", () => {
    expect(getBase("arranque")!.aliasEn).toBe("Snatch");
    expect(getBase("nope")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it — verify it fails**

Run: `pnpm --filter @holy-oly/core test movements`
Expected: FAIL — `getBase`/`variantsOf`/… not exported.

- [ ] **Step 3: Append the helpers to `packages/core/src/logic/movements.ts`**

```typescript
import type { RmRef } from "../types";

const BASE_BY_ID = new Map<string, MovementBase>(MOVEMENT_BASES.map((b) => [b.id, b]));

export function getBase(baseId: string): MovementBase | undefined {
  return BASE_BY_ID.get(baseId);
}

/** All variants of a base, sorted by complexity descending (most complex first). */
export function variantsOf(baseId: string): Movement[] {
  return MOVEMENTS.filter((m) => m.baseId === baseId).sort((a, b) => b.complexity - a.complexity);
}

/** The representative variant of a base (most complex: full-from-floor / split jerk / the single squat). */
export function canonicalVariant(baseId: string): Movement | undefined {
  return variantsOf(baseId)[0];
}

/** Same base, strictly lower complexity — i.e. "bajar la complejidad". Sorted by complexity desc. */
export function simplerVariants(id: string): Movement[] {
  const m = getMovement(id);
  if (!m) return [];
  return variantsOf(m.baseId).filter((v) => v.complexity < m.complexity);
}

/** Curated substitutes: the canonical variant of each of the base's substituteBases. */
export function substitutesOf(id: string): Movement[] {
  const m = getMovement(id);
  if (!m) return [];
  const base = getBase(m.baseId);
  if (!base) return [];
  return base.substituteBases
    .map((b) => canonicalVariant(b))
    .filter((x): x is Movement => x !== undefined);
}

export function movementsForRm(rmRef: RmRef): Movement[] {
  return MOVEMENTS.filter((m) => m.rmRef === rmRef);
}

const norm = (s: string): string =>
  s.toLowerCase()
    .replace(/[áàä]/g, "a").replace(/[éèë]/g, "e").replace(/[íìï]/g, "i")
    .replace(/[óòö]/g, "o").replace(/[úùü]/g, "u"); // accent-insensitive (composed chars, transcription-safe)

/** English search tokens for a variant (so "hang power snatch" matches the Spanish-named variant). */
function enTokens(m: Movement, base: MovementBase | undefined): string {
  const t: string[] = [base?.aliasEn ?? ""];
  const mod = m.modifiers;
  if (mod.captura === "potencia") t.push("power");
  if (mod.origen === "colgado") t.push("hang");
  if (mod.origen === "bloques") t.push("block blocks");
  if (mod.posicion === "alto") t.push("above knee");
  if (mod.posicion === "rodilla") t.push("knee");
  if (mod.posicion === "bajo") t.push("below knee");
  if (mod.tipoEnvion === "tijera") t.push("split");
  if (mod.tipoEnvion === "empuje") t.push("push");
  if (mod.tipoEnvion === "potencia") t.push("power");
  if (mod.tipoEnvion === "fuerza") t.push("strict");
  for (const f of mod.flags) t.push(f === "pausa" ? "pause" : f === "sin-recibida" ? "no catch" : f);
  return t.join(" ");
}

/** Multi-term, accent-insensitive search over the Spanish name + English tokens. Empty query → []. */
export function searchMovements(q: string): Movement[] {
  const terms = norm(q).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  return MOVEMENTS.filter((m) => {
    const hay = norm(`${m.name} ${enTokens(m, getBase(m.baseId))}`);
    return terms.every((t) => hay.includes(t));
  });
}
```

- [ ] **Step 4: Run tests + typecheck — verify they pass**

Run: `pnpm --filter @holy-oly/core test movements && pnpm --filter @holy-oly/core exec tsc --noEmit`
Expected: PASS (all generation + helper cases).

- [ ] **Step 5: Full core check + commit**

Run: `pnpm --filter @holy-oly/core test`
Expected: green (existing 68 + the new movement cases).

```bash
git add packages/core/src/logic/movements.ts packages/core/src/logic/movements.test.ts
git commit -m "feat(core): helpers de movimientos (variantes/complejidad/sustitutos/búsqueda)"
```

---

## Verification (final)

Run: `pnpm --filter @holy-oly/core test && pnpm --filter @holy-oly/core exec tsc --noEmit && pnpm --filter @holy-oly/core exec eslint src`
Expected: all green. (No web/api changes — SP1 is core-only; no `verify`/`e2e`/web build needed. The deploy of SP1 is a no-op for the running app until SP2 consumes it, so this can ship to `main` bundled with SP2 or on its own.)

---

## Self-Review — spec coverage map

| Spec (§) | Requirement | Task |
|---|---|---|
| §3 | Types (`RmRef`/axes/`MovementModifiers`/`MovementBase`/`Movement`) | Task 1 |
| §4 | 14 curated bases (`MOVEMENT_BASES`) | Task 2 (step 3) |
| §5 | Generator (per-base axes, posición only for bloques/colgado, flag-less), id canónico (defaults omitted), display name, complexity deltas+clamp | Task 2 (step 4) |
| §6 | Helpers `getMovement`/`getBase`/`variantsOf`/`canonicalVariant`/`simplerVariants`/`substitutesOf`/`movementsForRm`/`computeComplexity`/`movementDisplayName`/`searchMovements` | Task 2 (derivation) + Task 3 (queries) |
| §7 | Catalog-integrity + generation + helper tests; `MOVEMENTS.length` (68); hang power snatch exists; posición∉piso | Task 2 + Task 3 tests |
| §8 | File structure + barrel exports | Tasks 1–3 |
| §9 | SP2+ build on top (out of SP1) | N/A (not implemented here) |

**Architecture note (deviation from spec §8, intentional):** `MOVEMENTS` + `buildMovements` live in `logic/movements.ts` (not `data/`) to keep `data → logic` one-directional and avoid an import cycle (`buildMovements` needs `computeComplexity`/`movementDisplayName`, which the query helpers' file also owns). `data/movements.ts` holds only `MOVEMENT_BASES`. Documented in the plan header.

**Placeholder scan:** none. **Type consistency:** `Movement`/`MovementBase`/`MovementModifiers` field names match across Task 1 (types), Task 2 (generator), Task 3 (helpers); `computeComplexity(baseComplexity, modifiers)` and `movementDisplayName(baseName, modifiers)` signatures used consistently.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-03-sp1-movement-library.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — fresh subagent per task + two-stage review (spec → quality). Only 3 small core tasks, so this is quick.

**2. Inline Execution** — execute here with `superpowers:executing-plans`, batched with checkpoints.

**Which approach?**
