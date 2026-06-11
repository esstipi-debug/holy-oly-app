import { describe, it, expect } from "vitest";
import type { RM } from "../types";
import { COMPLEXES } from "../data/complexes";
import {
  getComplex, complexTotalReps, complexPctCeiling, complexWeakRmRef, complexWeakRmKg,
  complexLoads, complexComplexity, isComplexId,
} from "./complexes";
import { getMovement, getBase } from "./movements";

const RMS: RM = { arranque: 100, envion: 120, sentadilla: 150, frente: 130 };

describe("COMPLEXES (integridad del catálogo, D6/D7)", () => {
  it("ids con namespace cx., únicos, 2..4 eslabones", () => {
    const ids = COMPLEXES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of COMPLEXES) {
      expect(c.id.startsWith("cx.")).toBe(true);
      expect(c.links.length).toBeGreaterThanOrEqual(2);
      expect(c.links.length).toBeLessThanOrEqual(4);
    }
  });
  it("todo eslabón existe en la librería y respeta repsMax.enComplejo", () => {
    for (const c of COMPLEXES)
      for (const l of c.links) {
        const mv = getMovement(l.movementId);
        expect(mv, `${c.id}: ${l.movementId} debe existir`).toBeDefined();
        const base = getBase(mv!.baseId)!;
        expect(l.reps, `${c.id}: ${l.movementId} reps ≤ enComplejo`).toBeLessThanOrEqual(base.repsMax.enComplejo);
        expect(l.reps).toBeGreaterThanOrEqual(1);
      }
  });
  it("total de reps por serie ≤ 6 (D7)", () => {
    for (const c of COMPLEXES) expect(complexTotalReps(c)).toBeLessThanOrEqual(6);
  });
  it("ningún eslabón usa rmRef 'none' (kg siempre derivable)", () => {
    for (const c of COMPLEXES)
      for (const l of c.links) expect(getMovement(l.movementId)!.rmRef).not.toBe("none");
  });
  it("el nombre incluye la notación de reps", () => {
    const c = getComplex("cx.cargada+frontal+2t")!;
    expect(c.name).toContain("(1+1+1)");
  });
});

describe("techos y resolución (D6/D7)", () => {
  it("pctCeiling inverso al largo: 2→90, 3→85, 4→80", () => {
    expect(complexPctCeiling(getComplex("cx.tiron-arranque+arranque")!)).toBe(90);
    expect(complexPctCeiling(getComplex("cx.cargada+frontal+2t")!)).toBe(85);
  });
  it("weakRmRef = rmRef del eslabón con menor RM (el jerk limita C+F+2T)", () => {
    const c = getComplex("cx.cargada+frontal+2t")!;
    // cargada→envion 120 · frontal→frente 130 · 2t→envion 120 ⇒ débil = envion
    expect(complexWeakRmRef(c, RMS)).toBe("envion");
    expect(complexWeakRmKg(c, RMS)).toBe(120);
    // arranque+ohs: ambos arranque ⇒ arranque
    expect(complexWeakRmRef(getComplex("cx.arranque+ohs")!, RMS)).toBe("arranque");
  });
  it("loads combinados: snc = max, axial = max, metabolica = suma capada a 10", () => {
    const c = getComplex("cx.cargada+frontal+2t")!;
    const loads = complexLoads(c);
    expect(loads.snc).toBe(8);        // max(cargada 8, frontal 7, 2t-tijera 8)
    expect(loads.axial).toBe(8);      // max(7, 8, 6)
    expect(loads.metabolica).toBe(10); // 5+6+3 = 14 → cap 10
  });
  it("complexity = max de eslabones + 1 transición, cap 12", () => {
    const c = getComplex("cx.cargada+frontal+2t")!;
    expect(complexComplexity(c)).toBe(9); // max(8, 5, 7) + 1
  });
  it("isComplexId distingue el namespace", () => {
    expect(isComplexId("cx.arranque+ohs")).toBe(true);
    expect(isComplexId("arranque")).toBe(false);
  });
  it("getComplex desconocido → undefined (sin throw)", () => {
    expect(getComplex("cx.nope")).toBeUndefined();
  });
});
