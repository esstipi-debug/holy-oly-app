import { describe, it, expect } from "vitest";
import { MACROCYCLES, MACROCYCLE_FAMILIES, phaseForWeek } from "./macrocycles";

describe("catalog", () => {
  it("has 24 programs across 10 families", () => {
    expect(MACROCYCLES).toHaveLength(24);
    expect(MACROCYCLE_FAMILIES).toHaveLength(10);
  });
  it("every program has a non-empty phaseProfile", () => {
    for (const m of MACROCYCLES) expect(m.phaseProfile.length).toBeGreaterThan(0);
  });
  it("phaseForWeek returns the phase whose week range contains the week", () => {
    const ruso = MACROCYCLES.find((m) => m.id === "ruso-5d")!;
    expect(phaseForWeek(ruso, 1)?.key).toBe("hipertrofia");
    expect(phaseForWeek(ruso, 14)?.key).toBe("peaking");
  });
});
