import { describe, it, expect } from "vitest";
import { rescaleSchoolPhases, buildAdaptivePlan } from "./adaptivePlan";
import { MACROCYCLES } from "../data/macrocycles";
import type { MacrocyclePhase } from "../types";

const ph = (key: string, w0: number, w1: number): MacrocyclePhase => ({
  key, name: key, weeks: [w0, w1], imrPct: [70, 90], volRel: 100, focus: "",
});
const triplet = (plan: { phaseKey: string }[], a: string, b: string, c: string): [number, number, number] => [
  plan.filter((p) => p.phaseKey === a).length,
  plan.filter((p) => p.phaseKey === b).length,
  plan.filter((p) => p.phaseKey === c).length,
];

// Tres fases iguales 4/4/4 (espejo de un Coreano normalizado).
const CO = [ph("cim", 1, 4), ph("trans", 5, 8), ph("real", 9, 12)];

describe("rescaleSchoolPhases", () => {
  it("largo natural → sin cambios (4/4/4), ordenado base→pico semana 1..12", () => {
    const p = rescaleSchoolPhases(CO, 12);
    expect(p).toHaveLength(12);
    expect(triplet(p, "cim", "trans", "real")).toEqual([4, 4, 4]);
    expect(p[0]).toEqual({ week: 1, phaseKey: "cim" });
    expect(p[11]).toEqual({ week: 12, phaseKey: "real" });
  });

  it("comprime 12→7 protegiendo el pico (2/2/3)", () => {
    expect(triplet(rescaleSchoolPhases(CO, 7), "cim", "trans", "real")).toEqual([2, 2, 3]);
  });

  it("comprime 12→4 (1/1/2)", () => {
    expect(triplet(rescaleSchoolPhases(CO, 4), "cim", "trans", "real")).toEqual([1, 1, 2]);
  });

  it("12→3 proporcional (1/1/1)", () => {
    expect(triplet(rescaleSchoolPhases(CO, 3), "cim", "trans", "real")).toEqual([1, 1, 1]);
  });

  it("12→2: la base cede primero (0/1/1)", () => {
    expect(triplet(rescaleSchoolPhases(CO, 2), "cim", "trans", "real")).toEqual([0, 1, 1]);
  });

  it("12→1: sólo el pico (0/0/1)", () => {
    expect(triplet(rescaleSchoolPhases(CO, 1), "cim", "trans", "real")).toEqual([0, 0, 1]);
  });

  it("weeks<=0 → []", () => {
    expect(rescaleSchoolPhases(CO, 0)).toEqual([]);
    expect(rescaleSchoolPhases(CO, -3)).toEqual([]);
  });

  it("una sola fase → todas las semanas esa fase (plano)", () => {
    const p = rescaleSchoolPhases([ph("flat", 1, 12)], 6);
    expect(p).toHaveLength(6);
    expect(p.every((w) => w.phaseKey === "flat")).toBe(true);
  });
});

describe("buildAdaptivePlan", () => {
  const coreano = MACROCYCLES.find((m) => m.id === "coreano-5d")!;
  const bulgaro = MACROCYCLES.find((m) => m.id === "bulgaro-6d")!;

  it("sin comps → phaseProfile natural por semana", () => {
    const p = buildAdaptivePlan(coreano, []);
    expect(p).toHaveLength(12);
    expect(p[0]!.phaseKey).toBe("cimentacion");
    expect(p[4]!.phaseKey).toBe("transformacion"); // semana 5
    expect(p[11]!.phaseKey).toBe("realizacion");
  });

  it("peaks:false (Búlgaro) con compe en sem 6 → 6 semanas planas, sin re-pico", () => {
    const p = buildAdaptivePlan(bulgaro, [6]);
    expect(p).toHaveLength(6);
    expect(p.every((w) => w.phaseKey === "dailymax")).toBe(true);
  });

  it("1 compe pico (sem 7) → Coreano comprimido 2/2/3, pica en la fecha", () => {
    const p = buildAdaptivePlan(coreano, [7]);
    expect(p).toHaveLength(7);
    expect(triplet(p, "cimentacion", "transformacion", "realizacion")).toEqual([2, 2, 3]);
    expect(p[6]!.phaseKey).toBe("realizacion");
  });

  it("multi-pico (sem 7 y 11): el 2º bloque saltea la base (re-pico fiel)", () => {
    const p = buildAdaptivePlan(coreano, [7, 11]);
    expect(p).toHaveLength(11);
    const block2 = p.slice(7).map((w) => w.phaseKey); // semanas 8..11
    expect(block2).toEqual(["transformacion", "transformacion", "realizacion", "realizacion"]);
    expect(p.filter((w) => w.phaseKey === "cimentacion")).toHaveLength(2); // sólo en el bloque 1
    expect(p[10]!.phaseKey).toBe("realizacion"); // pica en la 2ª compe
  });
});
