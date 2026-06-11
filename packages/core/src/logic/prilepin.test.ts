import { describe, expect, it } from "vitest";
import { PHASE_PROFILE, PRILEPIN, phasePlan, wavePhase } from "./prilepin";
import type { EnginePhase } from "../types";

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
