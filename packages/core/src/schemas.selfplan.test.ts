import { describe, it, expect } from "vitest";
import { SelfPlanInputSchema } from "./schemas";

const RMS = { arranque: 90, envion: 110, sentadilla: 150, frente: 125 };

describe("SelfPlanInputSchema", () => {
  it("acepta con competencia", () => {
    expect(
      SelfPlanInputSchema.safeParse({ macroId: "coreano-5d", rms: RMS, comp: { name: "Nacional", date: "2026-10-01" } }).success,
    ).toBe(true);
  });
  it("acepta con startDate (sin compe)", () => {
    expect(
      SelfPlanInputSchema.safeParse({ macroId: "coreano-5d", rms: RMS, startDate: "2026-07-01" }).success,
    ).toBe(true);
  });
  it("rechaza sin ancla (ni compe ni startDate)", () => {
    expect(SelfPlanInputSchema.safeParse({ macroId: "coreano-5d", rms: RMS }).success).toBe(false);
  });
  it("rechaza RM <= 0", () => {
    expect(
      SelfPlanInputSchema.safeParse({ macroId: "x", rms: { ...RMS, arranque: 0 }, startDate: "2026-07-01" }).success,
    ).toBe(false);
  });
  it("rechaza RM > 500", () => {
    expect(
      SelfPlanInputSchema.safeParse({ macroId: "x", rms: { ...RMS, sentadilla: 501 }, startDate: "2026-07-01" }).success,
    ).toBe(false);
  });
});
