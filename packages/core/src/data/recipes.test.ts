import { describe, it, expect } from "vitest";
import { MACRO_RECIPES } from "./recipes";
import { MACROCYCLES } from "./macrocycles";
import { getMovement } from "../logic/movements";

describe("Ruso 5D — sin RPE", () => {
  it("la receta Ruso 5D no usa RPE — los accesorios traen pct", () => {
    const fb = MACRO_RECIPES[0]!.phases.find((p) => p.phaseKey === "fuerza-basica")!;
    const rdl = fb.sessions[1]!.exercises[2]!;
    expect(rdl.movementId).toBe("peso-muerto-rumano");
    expect(rdl.pct).toBe(68);
    expect((rdl as { rpe?: number }).rpe).toBeUndefined();
  });
});

describe("MACRO_RECIPES integrity", () => {
  it("Ruso 5D recipe exists and references the real phase keys", () => {
    const r = MACRO_RECIPES.find((x) => x.macroId === "ruso-5d")!;
    expect(r).toBeDefined();
    const macro = MACROCYCLES.find((m) => m.id === "ruso-5d")!;
    const phaseKeys = new Set(macro.phaseProfile.map((p) => p.key));
    for (const ph of r.phases) expect(phaseKeys.has(ph.phaseKey)).toBe(true);
    expect(r.phases.map((p) => p.phaseKey)).toEqual(["hipertrofia", "fuerza-basica", "fuerza-potencia", "peaking"]);
  });
  it("every movementId in the recipe exists in the SP1 library", () => {
    for (const r of MACRO_RECIPES)
      for (const ph of r.phases)
        for (const s of ph.sessions)
          for (const ex of s.exercises)
            expect(getMovement(ex.movementId), `${ex.movementId} must exist`).toBeDefined();
  });
  it("pct (when present) is in 1..120; sets/reps ≥ 1", () => {
    for (const r of MACRO_RECIPES)
      for (const ph of r.phases)
        for (const s of ph.sessions)
          for (const ex of s.exercises) {
            if (ex.pct != null) expect(ex.pct).toBeGreaterThanOrEqual(1), expect(ex.pct).toBeLessThanOrEqual(120);
            expect(ex.sets).toBeGreaterThanOrEqual(1);
            expect(ex.reps).toBeGreaterThanOrEqual(1);
          }
  });
});
