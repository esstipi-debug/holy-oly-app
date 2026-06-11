import { describe, expect, it } from "vitest";
import { PHASE_PROFILE, PRILEPIN, athleteWeekView, generateWeek, phasePlan, wavePhase } from "./prilepin";
import type { EngineInput, EnginePhase } from "../types";

const base = (over: Partial<EngineInput> = {}): EngineInput => ({
  countdownWeeks: 3, weekIdx: 0, lift: "arranque", rmKg: 100, recentACWR: 1.1, readiness: "green", ...over,
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

describe("generateWeek — countdown fijado al anclar (D13, HIGH de El Carnicero)", () => {
  it("la secuencia VIVIDA (weekIdx 0..n−1) ES el array: el taper no reaparece en n=3", () => {
    const lived3 = [0, 1, 2].map((i) => generateWeek(base({ weekIdx: i }))!.phase);
    expect(lived3).toEqual(["intensification", "peak", "comp_week"]);
    const lived5 = [0, 1, 2, 3, 4].map((i) => generateWeek(base({ countdownWeeks: 5, weekIdx: i }))!.phase);
    expect(lived5).toEqual(phasePlan(5));
  });
  it("weekIdx fuera del countdown o degenerado → null honesto", () => {
    expect(generateWeek(base({ weekIdx: 3 }))).toBeNull(); // countdown de 3: idx máx 2
    expect(generateWeek(base({ weekIdx: -1 }))).toBeNull();
    expect(generateWeek(base({ weekIdx: 1.5 }))).toBeNull();
    expect(generateWeek(base({ weekIdx: NaN }))).toBeNull();
  });
  it("countdown SIN weekIdx → null honesto (la posición es estado, igual que la ola — D13c)", () => {
    expect(generateWeek({ countdownWeeks: 3, lift: "arranque", rmKg: 100, recentACWR: 1.1 })).toBeNull();
  });
  it("en modo ola weekIdx no se usa (la posición es waveWeek)", () => {
    expect(generateWeek(base({ countdownWeeks: null, waveWeek: 5, weekIdx: 99 }))!.phase).toBe("peak");
  });
});

describe("generateWeek — ajuste híbrido por ACWR (banda de la casa [0.8, 1.3], D3)", () => {
  const acc = (acwr: number | null) =>
    generateWeek(base({ countdownWeeks: 8, lift: "sentadilla", recentACWR: acwr, readiness: null }))!;
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
  it("comp_week (n=1): el set más pesado va a 95, jamás 100 (aperturas)", () => {
    const w = generateWeek(base({ countdownWeeks: 1 }))!;
    expect(w.phase).toBe("comp_week");
    expect(Math.max(...w.sets.map((s) => s.pct))).toBe(95);
    expect(w.sets).toEqual([
      { sets: 1, reps: 2, pct: 85, weightKg: 85, zone: "80-90" },
      { sets: 1, reps: 1, pct: 95, weightKg: 95, zone: "90+" },
    ]);
  });
  it("taper (n=4, weekIdx 2): top 90+ también capado a 95", () => {
    const w = generateWeek(base({ countdownWeeks: 4, weekIdx: 2 }))!;
    expect(w.phase).toBe("taper");
    expect(Math.max(...w.sets.map((s) => s.pct))).toBe(95);
  });
  it("propiedad: ningún set prescrito supera 95% en ninguna fase (el 100 jamás se programa)", () => {
    const cases = [];
    for (let idx = 0; idx < 6; idx++)
      for (const lift of ["arranque", "sentadilla"] as const)
        cases.push(base({ countdownWeeks: 6, weekIdx: idx, lift, recentACWR: null, readiness: null }));
    for (let wv = 1; wv <= 6; wv++) cases.push(base({ countdownWeeks: null, waveWeek: wv }));
    for (const c of cases)
      for (const s of generateWeek(c)!.sets) expect(s.pct).toBeLessThanOrEqual(95);
  });
  it("deload por ola: topPct 80 capa a la zona top 80-90", () => {
    const w = generateWeek(base({ countdownWeeks: null, waveWeek: 6, lift: "sentadilla" }))!;
    expect(w.phase).toBe("deload");
    expect(w.sets).toEqual([
      { sets: 2, reps: 3, pct: 75, weightKg: 75, zone: "70-80" },
      { sets: 1, reps: 2, pct: 80, weightKg: 80, zone: "80-90" },
    ]);
  });
  it("kg a 1 kg de la casa, NO múltiplos de 2.5 (rm 91 @ 85% → 77)", () => {
    const w = generateWeek(base({ countdownWeeks: 8, rmKg: 91, recentACWR: null, readiness: null }))!;
    const z85 = w.sets.find((s) => s.pct === 85)!;
    expect(z85.weightKg).toBe(77);
  });
});

describe("generateWeek — clásicos vs sentadilla (criterio 8)", () => {
  it("arranque usa 2 reps/set en 70-80; sentadilla usa 3", () => {
    const cl = generateWeek(base({ countdownWeeks: 8, recentACWR: null, readiness: null }))!;
    const sq = generateWeek(base({ countdownWeeks: 8, lift: "sentadilla", recentACWR: null, readiness: null }))!;
    expect(cl.sets.find((s) => s.zone === "70-80")!.reps).toBe(2);
    expect(sq.sets.find((s) => s.zone === "70-80")!.reps).toBe(3);
  });
  it("ola sin waveWeek → null honesto (la posición en la ola es estado, no un default); semana 5 → mini-pico", () => {
    expect(generateWeek(base({ countdownWeeks: null }))).toBeNull();
    expect(generateWeek(base({ countdownWeeks: null, waveWeek: 5 }))!.phase).toBe("peak");
  });
  it("envión es clásico (2 reps/set en 70-80); frente es sentadilla frontal → tabla (3)", () => {
    const en = generateWeek(base({ countdownWeeks: 8, lift: "envion", recentACWR: null, readiness: null }))!;
    const fr = generateWeek(base({ countdownWeeks: 8, lift: "frente", recentACWR: null, readiness: null }))!;
    expect(en.sets.find((s) => s.zone === "70-80")!.reps).toBe(2);
    expect(fr.sets.find((s) => s.zone === "70-80")!.reps).toBe(3);
  });
  it("red en fase sin zona 90+ (acumulación) → advisory false (no hay single que mover)", () => {
    const w = generateWeek(base({ countdownWeeks: 8, readiness: "red" }))!;
    expect(w.heavySinglesAdvisory).toBe(false);
  });
});

describe("generateWeek — sin-dato honesto, jamás inventar (D7 / lección NaN del Carnicero)", () => {
  it("RM degenerado → null", () => {
    expect(generateWeek(base({ rmKg: 0 }))).toBeNull();
    expect(generateWeek(base({ rmKg: -50 }))).toBeNull();
    expect(generateWeek(base({ rmKg: NaN }))).toBeNull();
  });
  it("compe pasada / semanas degeneradas → null", () => {
    expect(generateWeek(base({ countdownWeeks: 0 }))).toBeNull();
    expect(generateWeek(base({ countdownWeeks: -1 }))).toBeNull();
    expect(generateWeek(base({ countdownWeeks: NaN }))).toBeNull();
    expect(generateWeek(base({ countdownWeeks: 2.5 }))).toBeNull();
  });
  it("ola degenerada → null", () => {
    expect(generateWeek(base({ countdownWeeks: null, waveWeek: 0 }))).toBeNull();
    expect(generateWeek(base({ countdownWeeks: null, waveWeek: NaN }))).toBeNull();
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

describe("athleteWeekView — redacción HR-1 en core (patrón redactCycle, D12)", () => {
  it("SOLO phase/label/rationale/sets — sin audits, sin factores, sin ACWR crudo", () => {
    const view = athleteWeekView(generateWeek(base())!);
    expect(Object.keys(view).sort()).toEqual(["label", "phase", "rationale", "sets"]);
    const json = JSON.stringify(view).toLowerCase();
    expect(json).not.toContain("acwr");
    expect(json).not.toContain("audit");
    expect(json).not.toContain("advisory");
  });
});

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

describe("phasePlan", () => {
  it("3 semanas: intensificación → pico → semana de compe (sin reiniciar)", () => {
    expect(phasePlan(3)).toEqual(["intensification", "peak", "comp_week"]);
  });
  it("casos cortos exactos (la compe SIEMPRE es la última semana)", () => {
    expect(phasePlan(1)).toEqual(["comp_week"]);
    expect(phasePlan(2)).toEqual(["peak", "comp_week"]);
    expect(phasePlan(4)).toEqual(["intensification", "peak", "taper", "comp_week"]);
  });
  it("comp_week es la última semana y aparece exactamente una vez (n=1..12)", () => {
    for (let n = 1; n <= 12; n++) {
      const plan = phasePlan(n);
      expect(plan[plan.length - 1]).toBe("comp_week");
      expect(plan.filter((p) => p === "comp_week")).toHaveLength(1);
    }
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
  it("inválido o sin semanas → [] honesto (0 = compe pasada, negativo, no-entero, NaN, Infinity)", () => {
    expect(phasePlan(0)).toEqual([]);
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
