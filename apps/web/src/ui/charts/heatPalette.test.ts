import { describe, it, expect } from "vitest";
import { heatRgb, heatAlpha, heatCellColor, HEAT_STOPS, HEAT_NEUTRAL_RGB } from "./heatPalette";

describe("heatPalette", () => {
  it("mapea % a las paradas de la rampa (≤74 fría … 93+ caliente)", () => {
    expect(heatRgb(70)).toBe(HEAT_STOPS[0]![1]);
    expect(heatRgb(74)).toBe(HEAT_STOPS[0]![1]);
    expect(heatRgb(75)).toBe(HEAT_STOPS[1]![1]);
    expect(heatRgb(85)).toBe(HEAT_STOPS[2]![1]);
    expect(heatRgb(90)).toBe(HEAT_STOPS[3]![1]);
    expect(heatRgb(95)).toBe(HEAT_STOPS[4]![1]);
    expect(heatRgb(120)).toBe(HEAT_STOPS[4]![1]);
  });

  it("sin % → tono neutro (no se inventa intensidad)", () => {
    expect(heatRgb(undefined)).toBe(HEAT_NEUTRAL_RGB);
  });

  it("alpha por volumen: piso 0.35, techo 1, sin máximo conocido → 1", () => {
    expect(heatAlpha(0, 40)).toBeCloseTo(0.35);
    expect(heatAlpha(40, 40)).toBeCloseTo(1);
    expect(heatAlpha(20, 40)).toBeCloseTo(0.675);
    expect(heatAlpha(80, 40)).toBeCloseTo(1); // clamp
    expect(heatAlpha(10, 0)).toBe(1);
  });

  it("color de celda compone tono + alpha", () => {
    expect(heatCellColor(95, 40, 40)).toBe(`rgba(${HEAT_STOPS[4]![1]},1.00)`);
    expect(heatCellColor(undefined, 0, 40)).toBe(`rgba(${HEAT_NEUTRAL_RGB},0.35)`);
  });
});
