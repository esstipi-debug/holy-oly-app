import { describe, it, expect } from "vitest";
import {
  COACH_PLANS,
  getCoachPlan,
  planPriceClp,
  semiannualMonthsFree,
  withIva,
  mercadoPagoPlanEnvKey,
} from "./plans";

describe("coach plans — tiers + semiannual", () => {
  it("has the 4 self-serve tiers with ascending athlete caps", () => {
    expect(COACH_PLANS.map((p) => p.id)).toEqual(["coach", "pro", "elite", "box"]);
    const caps = COACH_PLANS.map((p) => p.maxAthletes);
    expect(caps).toEqual([...caps].sort((a, b) => a - b));
  });

  it("every tier's semiannual price = 5× monthly (1 month free)", () => {
    for (const p of COACH_PLANS) {
      expect(p.priceClpSemiannual).toBe(p.priceClpMonthly * 5);
      expect(semiannualMonthsFree(p)).toBe(1);
    }
  });

  it("planPriceClp picks the price for the period", () => {
    const coach = getCoachPlan("coach");
    expect(planPriceClp(coach, "monthly")).toBe(19_900);
    expect(planPriceClp(coach, "semiannual")).toBe(99_500);
  });

  it("withIva adds 19%", () => {
    expect(withIva(19_900)).toBe(23_681);
  });

  it("MP env key is per tier + period", () => {
    expect(mercadoPagoPlanEnvKey("coach", "semiannual")).toBe("MERCADOPAGO_PLAN_COACH_SEMIANNUAL");
    expect(mercadoPagoPlanEnvKey("box", "monthly")).toBe("MERCADOPAGO_PLAN_BOX_MONTHLY");
  });
});
