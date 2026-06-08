import { describe, it, expect } from "vitest";
import {
  COACH_PLANS,
  getCoachPlan,
  planPriceClp,
  annualMonthsFree,
  withIva,
  mercadoPagoPlanEnvKey,
} from "./plans";

describe("coach plans — tiers + annual", () => {
  it("has the 4 self-serve tiers with ascending athlete caps", () => {
    expect(COACH_PLANS.map((p) => p.id)).toEqual(["coach", "pro", "elite", "box"]);
    const caps = COACH_PLANS.map((p) => p.maxAthletes);
    expect(caps).toEqual([...caps].sort((a, b) => a - b));
  });

  it("every tier's annual price = 10× monthly (2 months free)", () => {
    for (const p of COACH_PLANS) {
      expect(p.priceClpAnnual).toBe(p.priceClpMonthly * 10);
      expect(annualMonthsFree(p)).toBe(2);
    }
  });

  it("planPriceClp picks the price for the period", () => {
    const coach = getCoachPlan("coach");
    expect(planPriceClp(coach, "monthly")).toBe(19_900);
    expect(planPriceClp(coach, "annual")).toBe(199_000);
  });

  it("withIva adds 19%", () => {
    expect(withIva(19_900)).toBe(23_681);
  });

  it("MP env key is per tier + period", () => {
    expect(mercadoPagoPlanEnvKey("coach", "annual")).toBe("MERCADOPAGO_PLAN_COACH_ANNUAL");
    expect(mercadoPagoPlanEnvKey("box", "monthly")).toBe("MERCADOPAGO_PLAN_BOX_MONTHLY");
  });
});
