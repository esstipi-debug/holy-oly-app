# Motor Prilepin core dormant — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aterrizar el motor de prescripción Prilepin como módulo puro y dormant en core (`generateWeek`/`phasePlan`/`wavePhase` + `readinessBand`), TDD contra los criterios de la spec.

**Architecture:** Un módulo nuevo `packages/core/src/logic/prilepin.ts` (config + funciones puras, patrón SP1/cycle.ts), tipos `Engine*` en `types/index.ts` (idiom de la casa), una función aditiva `readinessBand` en `readiness.ts`, export en el barrel. Cero UI/API/migración.

**Tech Stack:** TypeScript estricto, vitest (suite core existente: 200 tests verdes como baseline).

**Spec:** `docs/superpowers/specs/2026-06-10-motor-prilepin-design.md` (decisiones D1–D12 — leerla ANTES; los valores esperados de los tests salen de sus tablas).

**Contexto worktree:** `wizardly-wiles-0da5ce`, dependencias ya instaladas (`pnpm install` corrido). Comando de tests core: `pnpm --filter @holy-oly/core test` (todo) o `pnpm --filter @holy-oly/core exec vitest run logic/prilepin` (filtrado).

---

### Task 0: Baseline verde

**Files:** ninguno (verificación).

- [ ] **Step 0.1:** Correr la suite core completa.

Run: `pnpm --filter @holy-oly/core test`
Expected: **200 passed** (baseline pre-slice). Si algo falla acá, PARAR: el problema no es del motor.

---

### Task 1: Tipos + config + `phasePlan`

**Files:**
- Modify: `packages/core/src/types/index.ts` (agregar tipos Engine* al final del archivo)
- Create: `packages/core/src/logic/prilepin.ts`
- Create: `packages/core/src/logic/prilepin.test.ts`

- [ ] **Step 1.1: Tipos en `types/index.ts`** (al final, junto a los tipos SP5):

```ts
// ── Motor Prilepin (core dormant — spec 2026-06-10-motor-prilepin-design.md) ──────────────────

export type EnginePhase = "accumulation" | "intensification" | "peak" | "taper" | "comp_week" | "deload";
export type IntensityZone = "70-80" | "80-90" | "90+";
/** Banda del semáforo diario sobre readiness 0-100 (cortes 70/80, espejo de recoveryState). */
export type ReadinessBand = "green" | "amber" | "red";

export interface EngineInput {
  /** null = sin competencia → ola continua. */
  weeksToComp: number | null;
  /** Lift del RM de la casa (D2) — no el enum del bundle. */
  lift: RmLift;
  /** RM vigente del lift en kg (SP5). Acá jamás se estima. */
  rmKg: number;
  /** ACWR reciente de monitor.ts; null = sin dato → sin ajuste, jamás inventar (D7). */
  recentACWR: number | null;
  /** Posición 1-based en la ola si weeksToComp === null (default 1). */
  waveWeek?: number;
  /** Banda del día (readinessBand); null/ausente = sin dato. */
  readiness?: ReadinessBand | null;
}

export interface EngineSet { sets: number; reps: number; pct: number; weightKg: number; zone: IntensityZone; }

export interface EngineZoneAudit { zone: IntensityZone; optimalReps: number; prescribedReps: number; withinRange: boolean; }

export interface EngineWeek {
  phase: EnginePhase;
  label: string;
  /** Microcopy de supercompensación — explica, no castiga. */
  rationale: string;
  /** Cara del atleta (kg manda; los discos los pinta la UI). */
  sets: EngineSet[];
  /** Material de coach/peek (HR-1: NO va a superficie de atleta — D12). */
  audits: EngineZoneAudit[];
  taper: { base: number; acwrFactor: number; readinessFactor: number; final: number };
  inputs: { acwr: number | null; readiness: ReadinessBand | null };
  /** readiness red + zona 90+ presente → el cableado sugiere mover los singles, no borrarlos. */
  heavySinglesAdvisory: boolean;
}
```

- [ ] **Step 1.2: Test failing de `phasePlan` + invariantes de config** — crear `prilepin.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { PHASE_PROFILE, PRILEPIN, phasePlan } from "./prilepin";
import type { EnginePhase } from "../types";

describe("phasePlan", () => {
  it("3 semanas: intensificación → pico → semana de compe (sin reiniciar)", () => {
    expect(phasePlan(3)).toEqual(["intensification", "peak", "comp_week"]);
  });
  it("casos cortos exactos", () => {
    expect(phasePlan(0)).toEqual(["comp_week"]);
    expect(phasePlan(1)).toEqual(["taper"]);
    expect(phasePlan(2)).toEqual(["peak", "comp_week"]);
    expect(phasePlan(4)).toEqual(["intensification", "peak", "taper", "comp_week"]);
  });
  it("n=7 (el hueco del bundle): 3 acumulaciones + las 4 finales, largo 7", () => {
    expect(phasePlan(7)).toEqual([
      "accumulation", "accumulation", "accumulation",
      "intensification", "peak", "taper", "comp_week",
    ]);
  });
  it("largo = n para n=1..12", () => {
    for (let n = 1; n <= 12; n++) expect(phasePlan(n)).toHaveLength(n);
  });
  it("inválido → [] honesto (negativo, no-entero, NaN, Infinity)", () => {
    expect(phasePlan(-1)).toEqual([]);
    expect(phasePlan(2.5)).toEqual([]);
    expect(phasePlan(NaN)).toEqual([]);
    expect(phasePlan(Infinity)).toEqual([]);
  });
});

describe("PHASE_PROFILE (la inversión volumen↓ / intensidad↑)", () => {
  const chain: EnginePhase[] = ["accumulation", "intensification", "peak", "taper", "comp_week"];
  it("taperFactor estrictamente decreciente hacia la compe", () => {
    for (let i = 1; i < chain.length; i++)
      expect(PHASE_PROFILE[chain[i]!].taperFactor).toBeLessThan(PHASE_PROFILE[chain[i - 1]!].taperFactor);
  });
  it("topPct no-decreciente 85 → 100", () => {
    expect(PHASE_PROFILE.accumulation.topPct).toBe(85);
    expect(PHASE_PROFILE.comp_week.topPct).toBe(100);
    for (let i = 1; i < chain.length; i++)
      expect(PHASE_PROFILE[chain[i]!].topPct).toBeGreaterThanOrEqual(PHASE_PROFILE[chain[i - 1]!].topPct);
  });
  it("cada zoneMix suma 1", () => {
    for (const phase of Object.keys(PHASE_PROFILE) as EnginePhase[]) {
      const mix = PHASE_PROFILE[phase].zoneMix;
      expect(mix["70-80"] + mix["80-90"] + mix["90+"]).toBeCloseTo(1, 9);
    }
  });
  it("la tabla Prilepin es la canónica", () => {
    expect(PRILEPIN["70-80"]).toEqual({ optimal: 18, min: 12, max: 24, repsPerSet: 3 });
    expect(PRILEPIN["80-90"]).toEqual({ optimal: 15, min: 10, max: 20, repsPerSet: 2 });
    expect(PRILEPIN["90+"]).toEqual({ optimal: 4, min: 1, max: 10, repsPerSet: 1 });
  });
});
```

- [ ] **Step 1.3:** Run `pnpm --filter @holy-oly/core exec vitest run logic/prilepin` → Expected: FAIL (módulo no existe).

- [ ] **Step 1.4: Implementación mínima** — crear `prilepin.ts`:

```ts
/**
 * Motor Prilepin — generador semanal sets × reps × % → kg (core dormant, v1).
 * Spec: docs/superpowers/specs/2026-06-10-motor-prilepin-design.md (decisiones D1–D12).
 * Config + funciones PURAS: el caller ancla fechas (weeksToComp desde Competencia.date, §2b
 * del rulebook) y pasa el RM vigente (SP5). Sin RPE en ningún shape; sin ciclo como input.
 */
import type { EnginePhase, IntensityZone, RmLift } from "../types";

/** Tabla de Prilepin: reps óptimas y rango por zona (heurística observacional soviética, no ECA). */
export const PRILEPIN: Record<IntensityZone, { optimal: number; min: number; max: number; repsPerSet: number }> = {
  "70-80": { optimal: 18, min: 12, max: 24, repsPerSet: 3 },
  "80-90": { optimal: 15, min: 10, max: 20, repsPerSet: 2 },
  "90+": { optimal: 4, min: 1, max: 10, repsPerSet: 1 },
};

/** Perfil por fase: fracción del óptimo Prilepin por zona + techo de % de la semana. */
export const PHASE_PROFILE: Record<EnginePhase, {
  taperFactor: number; zoneMix: Record<IntensityZone, number>; topPct: number; label: string;
}> = {
  accumulation: { taperFactor: 1.0, zoneMix: { "70-80": 0.6, "80-90": 0.4, "90+": 0 }, topPct: 85, label: "Acumulación" },
  intensification: { taperFactor: 0.8, zoneMix: { "70-80": 0.3, "80-90": 0.6, "90+": 0.1 }, topPct: 90, label: "Intensificación" },
  peak: { taperFactor: 0.55, zoneMix: { "70-80": 0.1, "80-90": 0.5, "90+": 0.4 }, topPct: 95, label: "Pico" },
  taper: { taperFactor: 0.4, zoneMix: { "70-80": 0.1, "80-90": 0.4, "90+": 0.5 }, topPct: 100, label: "Taper" },
  comp_week: { taperFactor: 0.25, zoneMix: { "70-80": 0, "80-90": 0.3, "90+": 0.7 }, topPct: 100, label: "Semana de competencia" },
  deload: { taperFactor: 0.5, zoneMix: { "70-80": 0.8, "80-90": 0.2, "90+": 0 }, topPct: 80, label: "Descarga" },
};

/** Semanas restantes → fase de CADA semana hasta la compe. Inválido → [] (sin plan honesto). */
export function phasePlan(weeksToComp: number): EnginePhase[] {
  if (!Number.isInteger(weeksToComp) || weeksToComp < 0) return [];
  if (weeksToComp === 0) return ["comp_week"];
  if (weeksToComp === 1) return ["taper"];
  if (weeksToComp === 2) return ["peak", "comp_week"];
  if (weeksToComp === 3) return ["intensification", "peak", "comp_week"];
  return [
    ...Array<EnginePhase>(weeksToComp - 4).fill("accumulation"),
    "intensification", "peak", "taper", "comp_week",
  ];
}
```

(Nota: `phasePlan(4)` cae en la rama final con `Array(0)` → exactamente las 4 finales.)

- [ ] **Step 1.5:** Run filtrado de nuevo → Expected: PASS (los `describe` de Task 1).
- [ ] **Step 1.6:** Commit: `git add -A && git commit -m "feat(core): motor prilepin - tipos Engine*, tabla Prilepin, PHASE_PROFILE y phasePlan (TDD)"`

---

### Task 2: `wavePhase` (ola continua de 6 semanas)

**Files:** Modify `prilepin.ts` + `prilepin.test.ts`.

- [ ] **Step 2.1: Test failing** — agregar a `prilepin.test.ts` (importar `wavePhase`):

```ts
describe("wavePhase (ola continua, mini-pico en semana 5)", () => {
  it("semanas 1..6", () => {
    expect([1, 2, 3, 4, 5, 6].map(wavePhase)).toEqual([
      "accumulation", "accumulation", "intensification", "intensification", "peak", "deload",
    ]);
  });
  it("cicla indefinidamente", () => {
    expect(wavePhase(7)).toBe("accumulation");
    expect(wavePhase(11)).toBe("peak");
    expect(wavePhase(12)).toBe("deload");
    expect(wavePhase(13)).toBe("accumulation");
  });
  it("inválida → null (jamás fabricar fase desde NaN)", () => {
    expect(wavePhase(0)).toBeNull();
    expect(wavePhase(-3)).toBeNull();
    expect(wavePhase(1.5)).toBeNull();
    expect(wavePhase(NaN)).toBeNull();
  });
});
```

- [ ] **Step 2.2:** Run filtrado → FAIL (`wavePhase` no exportada).
- [ ] **Step 2.3: Implementación** — agregar a `prilepin.ts`:

```ts
const WAVE: readonly EnginePhase[] = [
  "accumulation", "accumulation", "intensification", "intensification", "peak", "deload",
];

/** Fase de la ola sin compe (1-based, cicla). `peak` en semana 5 = mini-pico (test opcional). */
export function wavePhase(waveWeek: number): EnginePhase | null {
  if (!Number.isInteger(waveWeek) || waveWeek < 1) return null;
  return WAVE[(waveWeek - 1) % WAVE.length]!;
}
```

- [ ] **Step 2.4:** Run filtrado → PASS.
- [ ] **Step 2.5:** Commit: `git commit -am "feat(core): wavePhase - ola continua de 6 semanas con mini-pico, cicla, null ante input degenerado"`

---

### Task 3: `readinessBand` (aditivo en `readiness.ts`)

**Files:** Modify `packages/core/src/logic/readiness.ts` + `packages/core/src/logic/readiness.test.ts`.

- [ ] **Step 3.1: Test failing** — agregar a `readiness.test.ts` (importar `readinessBand`):

```ts
describe("readinessBand (bandas sobre readiness 0-100, cortes espejo de recoveryState)", () => {
  it("cortes 70/80", () => {
    expect(readinessBand(100)).toBe("green");
    expect(readinessBand(80)).toBe("green");
    expect(readinessBand(79)).toBe("amber");
    expect(readinessBand(70)).toBe("amber");
    expect(readinessBand(69)).toBe("red");
    expect(readinessBand(0)).toBe("red");
  });
  it("sin dato → null, jamás una banda inventada", () => {
    expect(readinessBand(undefined)).toBeNull();
    expect(readinessBand(NaN)).toBeNull();
  });
});
```

- [ ] **Step 3.2:** Run `pnpm --filter @holy-oly/core exec vitest run logic/readiness` → FAIL.
- [ ] **Step 3.3: Implementación** — agregar a `readiness.ts` (import type de `../types`):

```ts
import type { MonitorSeries, ReadinessBand } from "../types";

/** Banda del semáforo diario sobre readiness 0-100 (cortes 70/80, espejo de recoveryState —
 *  misma escala). Sin dato → null, jamás una banda inventada. El semáforo worse-of existente
 *  (seriesState) NO se toca: esto es la banda que consume el motor Prilepin. */
export function readinessBand(score: number | undefined): ReadinessBand | null {
  if (score == null || !Number.isFinite(score)) return null;
  return score < 70 ? "red" : score < 80 ? "amber" : "green";
}
```

- [ ] **Step 3.4:** Run filtrado readiness → PASS.
- [ ] **Step 3.5:** Commit: `git commit -am "feat(core): readinessBand 70/80 sobre readiness - la banda que consume el motor (sin tocar el semaforo worse-of)"`

---

### Task 4: `generateWeek` — camino feliz + factores + auditoría

**Files:** Modify `prilepin.ts` + `prilepin.test.ts`.

- [ ] **Step 4.1: Tests failing** — agregar (importar `generateWeek` y los tipos):

```ts
import type { EngineInput } from "../types";

const base = (over: Partial<EngineInput> = {}): EngineInput => ({
  weeksToComp: 3, lift: "arranque", rmKg: 100, recentACWR: 1.1, readiness: "green", ...over,
});
const totalReps = (w: { sets: { sets: number; reps: number }[] }): number =>
  w.sets.reduce((t, s) => t + s.sets * s.reps, 0);

describe("generateWeek — intensificación a 3 semanas (caso canónico del owner)", () => {
  const w = generateWeek(base())!;
  it("fase, label y rationale presentes", () => {
    expect(w.phase).toBe("intensification");
    expect(w.label).toBe("Intensificación");
    expect(w.rationale).toContain("volumen");
  });
  it("sets exactos: 2×2@75 · 4×2@85 · 1×1@90 (piso de la zona top, D5)", () => {
    expect(w.sets).toEqual([
      { sets: 2, reps: 2, pct: 75, weightKg: 75, zone: "70-80" },
      { sets: 4, reps: 2, pct: 85, weightKg: 85, zone: "80-90" },
      { sets: 1, reps: 1, pct: 90, weightKg: 90, zone: "90+" },
    ]);
  });
  it("audits de TODAS las zonas prescritas, withinRange aritmético", () => {
    expect(w.audits).toEqual([
      { zone: "70-80", optimalReps: 18, prescribedReps: 4, withinRange: false },
      { zone: "80-90", optimalReps: 15, prescribedReps: 8, withinRange: false },
      { zone: "90+", optimalReps: 4, prescribedReps: 1, withinRange: true },
    ]);
  });
  it("eco auditable: taper y inputs", () => {
    expect(w.taper.base).toBe(0.8);
    expect(w.taper.acwrFactor).toBe(1);
    expect(w.taper.readinessFactor).toBe(1);
    expect(w.taper.final).toBeCloseTo(0.8, 9);
    expect(w.inputs).toEqual({ acwr: 1.1, readiness: "green" });
    expect(w.heavySinglesAdvisory).toBe(false);
  });
});

describe("generateWeek — ajuste híbrido por ACWR (banda de la casa [0.8, 1.3], D3)", () => {
  const acc = (acwr: number | null) =>
    generateWeek(base({ weeksToComp: 8, lift: "sentadilla", recentACWR: acwr, readiness: null }))!;
  it("neutro (en banda) = sin dato: mismo volumen, inputs honestos", () => {
    const neutral = acc(1.0);
    const sinDato = acc(null);
    expect(totalReps(neutral)).toBe(18);
    expect(totalReps(sinDato)).toBe(18);
    expect(sinDato.inputs.acwr).toBeNull();
    expect(sinDato.taper.acwrFactor).toBe(1);
  });
  it("cargado (>1.3) baja volumen; liviano (<0.8) lo sube; bordes en banda", () => {
    expect(totalReps(acc(1.5))).toBeLessThan(18);
    expect(totalReps(acc(0.7))).toBeGreaterThan(18);
    expect(acc(1.3).taper.acwrFactor).toBe(1);
    expect(acc(0.8).taper.acwrFactor).toBe(1);
  });
});

describe("generateWeek — readiness modula el día (criterio 5)", () => {
  it("amber y red reducen volumen vs green", () => {
    const g = generateWeek(base())!;
    const a = generateWeek(base({ readiness: "amber" }))!;
    const r = generateWeek(base({ readiness: "red" }))!;
    expect(totalReps(a)).toBeLessThan(totalReps(g));
    expect(totalReps(r)).toBeLessThan(totalReps(g));
    expect(r.taper.readinessFactor).toBe(0.75);
  });
  it("red + zona 90+ → advisory true y el single top NO se borra (mover ≠ borrar)", () => {
    const r = generateWeek(base({ readiness: "red" }))!;
    expect(r.heavySinglesAdvisory).toBe(true);
    expect(r.sets.some((s) => s.zone === "90+")).toBe(true);
  });
  it("green/null → advisory false", () => {
    expect(generateWeek(base())!.heavySinglesAdvisory).toBe(false);
    expect(generateWeek(base({ readiness: null }))!.heavySinglesAdvisory).toBe(false);
  });
});

describe("generateWeek — % y kg (D4 + D6)", () => {
  it("comp_week: el set más pesado va a 95, jamás 100 (aperturas)", () => {
    const w = generateWeek(base({ weeksToComp: 0 }))!;
    expect(Math.max(...w.sets.map((s) => s.pct))).toBe(95);
    expect(w.sets).toEqual([
      { sets: 1, reps: 2, pct: 85, weightKg: 85, zone: "80-90" },
      { sets: 1, reps: 1, pct: 95, weightKg: 95, zone: "90+" },
    ]);
  });
  it("taper (n=1): top 90+ también capado a 95", () => {
    const w = generateWeek(base({ weeksToComp: 1 }))!;
    expect(w.phase).toBe("taper");
    expect(Math.max(...w.sets.map((s) => s.pct))).toBe(95);
  });
  it("deload por ola: topPct 80 capa a la zona top 80-90", () => {
    const w = generateWeek(base({ weeksToComp: null, waveWeek: 6, lift: "sentadilla" }))!;
    expect(w.phase).toBe("deload");
    expect(w.sets).toEqual([
      { sets: 2, reps: 3, pct: 75, weightKg: 75, zone: "70-80" },
      { sets: 1, reps: 2, pct: 80, weightKg: 80, zone: "80-90" },
    ]);
  });
  it("kg a 1 kg de la casa, NO múltiplos de 2.5 (rm 91 @ 85% → 77)", () => {
    const w = generateWeek(base({ weeksToComp: 8, rmKg: 91, recentACWR: null, readiness: null }))!;
    const z85 = w.sets.find((s) => s.pct === 85)!;
    expect(z85.weightKg).toBe(77);
  });
});

describe("generateWeek — clásicos vs sentadilla (criterio 8)", () => {
  it("arranque usa 2 reps/set en 70-80; sentadilla usa 3", () => {
    const cl = generateWeek(base({ weeksToComp: 8, recentACWR: null, readiness: null }))!;
    const sq = generateWeek(base({ weeksToComp: 8, lift: "sentadilla", recentACWR: null, readiness: null }))!;
    expect(cl.sets.find((s) => s.zone === "70-80")!.reps).toBe(2);
    expect(sq.sets.find((s) => s.zone === "70-80")!.reps).toBe(3);
  });
  it("ola sin waveWeek → default semana 1 (acumulación); semana 5 → mini-pico", () => {
    expect(generateWeek(base({ weeksToComp: null }))!.phase).toBe("accumulation");
    expect(generateWeek(base({ weeksToComp: null, waveWeek: 5 }))!.phase).toBe("peak");
  });
});
```

- [ ] **Step 4.2:** Run filtrado → FAIL (`generateWeek` no existe).
- [ ] **Step 4.3: Implementación** — agregar a `prilepin.ts` (imports: sumar `EngineInput, EngineSet, EngineWeek, EngineZoneAudit, ReadinessBand` al import de types):

```ts
/** Microcopy de supercompensación por fase — explica, no castiga (spec [4] §1). */
const RATIONALE: Record<EnginePhase, string> = {
  accumulation: "Semana de volumen alto: acá se acumula el estímulo que después se convierte en fuerza.",
  intensification: "Últimos kg de fuerza útil: baja el volumen, sube la intensidad.",
  peak: "Afinamos a peso de competencia. Menos trabajo, mismo peso.",
  taper: "Quitamos cansancio sin perder fuerza: el descanso es la mitad del trabajo.",
  comp_week: "Solo aperturas: disipamos fatiga para que llegues afilado el día de la competencia.",
  deload: "Descarga: acá es donde el cuerpo reconstruye y se vuelve más fuerte.",
};

const ZONES: readonly IntensityZone[] = ["70-80", "80-90", "90+"]; // orden ascendente
const ZONE_BASE: Record<IntensityZone, number> = { "70-80": 75, "80-90": 85, "90+": 92 };
/** Techo prescribible por zona. 90+ topea en 95: nunca se programa >95% — el 100 es el intento
 *  del día de la compe, no una carga de entrenamiento (D4). */
const ZONE_CEIL: Record<IntensityZone, number> = { "70-80": 80, "80-90": 90, "90+": 95 };

/** Clásicos: la técnica degrada antes que en sentadilla → menos reps/set. */
const REPS_PER_SET_CLASSIC: Record<IntensityZone, number> = { "70-80": 2, "80-90": 2, "90+": 1 };
const CLASSIC_LIFTS: readonly RmLift[] = ["arranque", "envion"];

// Banda segura ACWR de la casa [0.8, 1.3] (monitor.ts / rulebook §2) — no la del bundle (D3).
const ACWR_HIGH = 1.3;
const ACWR_LOW = 0.8;

/** La prescripción de la semana, o null honesto (RM/semana degenerados — jamás inventar). */
export function generateWeek(input: EngineInput): EngineWeek | null {
  if (!Number.isFinite(input.rmKg) || input.rmKg <= 0) return null;

  const phase: EnginePhase | null = input.weeksToComp !== null
    ? phasePlan(input.weeksToComp)[0] ?? null
    : wavePhase(input.waveWeek ?? 1);
  if (phase === null) return null;
  const profile = PHASE_PROFILE[phase];

  const acwr = input.recentACWR !== null && Number.isFinite(input.recentACWR) ? input.recentACWR : null;
  const acwrFactor = acwr === null ? 1 : acwr > ACWR_HIGH ? 0.9 : acwr < ACWR_LOW ? 1.1 : 1;
  const readiness = input.readiness ?? null;
  const readinessFactor = readiness === "amber" ? 0.9 : readiness === "red" ? 0.75 : 1;
  const taperFinal = profile.taperFactor * acwrFactor * readinessFactor;

  const repsClassic = CLASSIC_LIFTS.includes(input.lift);
  const mixed = ZONES.filter((z) => profile.zoneMix[z] > 0);
  const topZone = mixed[mixed.length - 1];

  const sets: EngineSet[] = [];
  const audits: EngineZoneAudit[] = [];
  for (const zone of mixed) {
    const z = PRILEPIN[zone];
    let targetReps = Math.round(z.optimal * taperFinal * profile.zoneMix[zone]);
    // Piso de la zona top: la fase no pierde su seña de intensidad (D5). Las demás se omiten.
    if (zone === topZone) targetReps = Math.max(1, targetReps);
    if (targetReps < 1) continue;
    const reps = repsClassic ? REPS_PER_SET_CLASSIC[zone] : z.repsPerSet;
    const numSets = Math.max(1, Math.round(targetReps / reps));
    const pct = zone === topZone
      ? Math.min(ZONE_CEIL[zone], profile.topPct)
      : Math.min(ZONE_BASE[zone], profile.topPct);
    sets.push({ sets: numSets, reps, pct, weightKg: Math.round((pct / 100) * input.rmKg), zone });
    audits.push({
      zone, optimalReps: z.optimal, prescribedReps: numSets * reps,
      withinRange: numSets * reps >= z.min && numSets * reps <= z.max,
    });
  }

  return {
    phase,
    label: profile.label,
    rationale: RATIONALE[phase],
    sets,
    audits,
    taper: { base: profile.taperFactor, acwrFactor, readinessFactor, final: taperFinal },
    inputs: { acwr, readiness },
    heavySinglesAdvisory: readiness === "red" && sets.some((s) => s.zone === "90+"),
  };
}
```

(Nota TS: `CLASSIC_LIFTS.includes(input.lift)` tipa bien porque ambos son `RmLift`. El
`rationale` de acumulación contiene "volumen" — el test del Step 4.1 lo usa.)

- [ ] **Step 4.4:** Run filtrado → PASS (todos los describe de Task 4).
- [ ] **Step 4.5:** Commit: `git commit -am "feat(core): generateWeek - fase + ajuste ACWR/readiness + Prilepin por zona con piso top, audits completos y eco auditable"`

---

### Task 5: Disciplina sin-dato + regresión anti-RPE

**Files:** Modify `prilepin.test.ts` (la implementación de Task 4 ya cubre los guards — estos tests los CLAVAN para que nadie los afloje).

- [ ] **Step 5.1: Tests** — agregar:

```ts
describe("generateWeek — sin-dato honesto, jamás inventar (D7 / lección NaN del Carnicero)", () => {
  it("RM degenerado → null", () => {
    expect(generateWeek(base({ rmKg: 0 }))).toBeNull();
    expect(generateWeek(base({ rmKg: -50 }))).toBeNull();
    expect(generateWeek(base({ rmKg: NaN }))).toBeNull();
  });
  it("compe en el pasado / semanas degeneradas → null", () => {
    expect(generateWeek(base({ weeksToComp: -1 }))).toBeNull();
    expect(generateWeek(base({ weeksToComp: NaN }))).toBeNull();
    expect(generateWeek(base({ weeksToComp: 2.5 }))).toBeNull();
  });
  it("ola degenerada → null", () => {
    expect(generateWeek(base({ weeksToComp: null, waveWeek: 0 }))).toBeNull();
    expect(generateWeek(base({ weeksToComp: null, waveWeek: NaN }))).toBeNull();
  });
  it("ACWR no-finito se trata como sin dato (factor 1, eco null)", () => {
    const w = generateWeek(base({ recentACWR: NaN }))!;
    expect(w.taper.acwrFactor).toBe(1);
    expect(w.inputs.acwr).toBeNull();
  });
});

describe("regla intocable: cero RPE en el shape (D1)", () => {
  it("el JSON serializado no contiene ninguna key rpe", () => {
    const w = generateWeek(base())!;
    expect(JSON.stringify(w).toLowerCase()).not.toContain("rpe");
  });
});
```

- [ ] **Step 5.2:** Run filtrado → Expected: PASS directo (guards ya implementados en Task 4; si algo falla, el guard está mal — arreglar implementación, no el test).
- [ ] **Step 5.3:** Commit: `git commit -am "test(core): clavar disciplina sin-dato del motor (null honesto) + regresion anti-rpe en el shape"`

---

### Task 6: Barrel + verificación completa

**Files:** Modify `packages/core/src/index.ts`.

- [ ] **Step 6.1:** Agregar al barrel (después de `export * from "./logic/cycle";`):

```ts
export * from "./logic/prilepin";
```

- [ ] **Step 6.2:** Suite completa core: `pnpm --filter @holy-oly/core test` → Expected: 200 + ~38 nuevos, 0 fail.
- [ ] **Step 6.3:** Typecheck monorepo: `pnpm -r typecheck` → Expected: limpio (la api necesita `prisma generate` previo en worktree — si el typecheck de api falla por el client, correr `pnpm --filter @holy-oly/api exec prisma generate` y reintentar; gotcha conocido del rulebook §5).
- [ ] **Step 6.4:** Lint (script del root, mismo de las sesiones previas): `pnpm lint` → Expected: 0 errors (1 warning preexistente permitido).
- [ ] **Step 6.5:** Commit: `git commit -am "feat(core): export del motor prilepin en el barrel (dormant - sin consumidores aun)"`

---

### Task 7: Reviews de la casa (post-implementación)

- [ ] **Step 7.1:** El Carnicero (dominio) sobre el diff del slice — foco: D3/D4/D5 (umbrales, tope 95, piso top), disciplina sin-dato, §3 (cero ciclo), HR-1 (audit ≠ superficie atleta, dicho en D12).
- [ ] **Step 7.2:** typescript-reviewer sobre el diff.
- [ ] **Step 7.3:** Aplicar CRITICAL/HIGH; documentar los no-aplicados conscientes.
- [ ] **Step 7.4:** Commit fixes + handoff `docs/superpowers/HANDOFF-2026-06-10-motor-prilepin.md` + memoria.

## Self-review del plan

- **Cobertura spec→tasks:** §2 contrato → T1.1/T4; §3 config → T1; §4 → T1; §5 → T2; §6 → T4; D1 → T5; D2 → T1.1; D3 → T4 (bordes 1.3/0.8); D4 → T4 (%); D5 → T4 (caso canónico); D6 → T4 (rm 91); D7 → T4+T5; D8 → T4 (audits 3/3); D9 → T3; D10 → T4 (withinRange false en secundarias); D11 → valores recomputados acá, no copiados; D12 → comentario en tipos. Criterios 1-13 ↔ tests: 1/2→T1, 3→T1, 4→T4, 5→T4, 6→T4, 7→T4, 8→T4, 9→T2, 10→T4, 11→T5, 12→T5, 13→T3. Sin huecos.
- **Placeholders:** ninguno — todo step de código trae el código.
- **Consistencia de tipos:** `EngineInput.readiness?: ReadinessBand | null` y los tests usan `readiness: null` vía spread ✓; `wavePhase` retorna `EnginePhase | null` y `generateWeek` lo propaga ✓; nombres idénticos en T1.1/T4.3.
