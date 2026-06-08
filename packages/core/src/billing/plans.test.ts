import { describe, it, expect } from "vitest";
import {
  COACH_PLANS,
  getCoachPlan,
  planPriceClp,
  annualMonthsFree,
  mercadoPagoPlanEnvKey,
} from "./plans";

describe("coach plans — annual", () => {
  it("every tier has an annual price cheaper than 12× monthly (incentivo)", () => {
    for (const p of COACH_PLANS) {
      expect(p.priceClpAnnual).toBeGreaterThan(0);
      expect(p.priceClpAnnual).toBeLessThan(p.priceClpMonthly * 12);
    }
  });

  it("planPriceClp picks the price for the period", () => {
    const basico = getCoachPlan("basico");
    expect(planPriceClp(basico, "monthly")).toBe(basico.priceClpMonthly);
    expect(planPriceClp(basico, "annual")).toBe(basico.priceClpAnnual);
  });

  it("annual gives 2 months free at the reference prices", () => {
    expect(annualMonthsFree(getCoachPlan("basico"))).toBe(2);
    expect(annualMonthsFree(getCoachPlan("equipo"))).toBe(2);
  });

  it("MP env key is per tier + period", () => {
    expect(mercadoPagoPlanEnvKey("basico", "annual")).toBe("MERCADOPAGO_PLAN_BASICO_ANNUAL");
    expect(mercadoPagoPlanEnvKey("equipo", "monthly")).toBe("MERCADOPAGO_PLAN_EQUIPO_MONTHLY");
  });
});
