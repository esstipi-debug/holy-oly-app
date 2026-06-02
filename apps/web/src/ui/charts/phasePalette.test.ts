import { describe, it, expect } from "vitest";
import { PHASE_RAMP, phaseColor } from "./phasePalette";

describe("phasePalette", () => {
  it("phaseColor: color por orden de fase (0-based)", () => {
    expect(phaseColor(0)).toBe(PHASE_RAMP[0]);
    expect(phaseColor(1)).toBe(PHASE_RAMP[1]);
  });
  it("phaseColor: envuelve con modulo si hay más fases que colores", () => {
    expect(phaseColor(PHASE_RAMP.length)).toBe(PHASE_RAMP[0]);
  });
  it("phaseColor: índice inválido (-1, sin fase) → primer color, sin crashear", () => {
    expect(phaseColor(-1)).toBe(PHASE_RAMP[0]);
  });
});
