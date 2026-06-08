import { z } from "zod";

/** Coach subscription tiers. Owner reference: $50.000 / $80.000 CLP/mes — limits provisional. */
export const CoachPlanIdSchema = z.enum(["basico", "equipo"]);
export type CoachPlanId = z.infer<typeof CoachPlanIdSchema>;

/** Billing cadence. Annual is the pushed option (cash flow): paid once/year, ~2 months free. */
export const BillingPeriodSchema = z.enum(["monthly", "annual"]);
export type BillingPeriod = z.infer<typeof BillingPeriodSchema>;

export interface CoachPlan {
  id: CoachPlanId;
  name: string;
  description: string;
  /** Monthly price in Chilean pesos (integer, no decimals). */
  priceClpMonthly: number;
  /** Annual price (paid once/year). ~10× monthly = 2 months free. */
  priceClpAnnual: number;
  /** Max roster size; `null` = unlimited (not offered yet). */
  maxAthletes: number | null;
  features: readonly string[];
}

export const COACH_PLANS: readonly CoachPlan[] = [
  {
    id: "basico",
    name: "Básico",
    description: "Para coaches que empiezan con un roster chico.",
    priceClpMonthly: 50_000,
    priceClpAnnual: 500_000, // 10 meses → 2 gratis
    maxAthletes: 10,
    features: ["Hasta 10 atletas", "Programación y monitor IMR", "Atletas sin costo"],
  },
  {
    id: "equipo",
    name: "Equipo",
    description: "Para equipos que crecen y necesitan más cupos.",
    priceClpMonthly: 80_000,
    priceClpAnnual: 800_000, // 10 meses → 2 gratis
    maxAthletes: 30,
    features: ["Hasta 30 atletas", "Todo lo de Básico", "Más cupos de vínculo"],
  },
] as const;

export function getCoachPlan(planId: CoachPlanId): CoachPlan {
  const plan = COACH_PLANS.find((p) => p.id === planId);
  if (!plan) throw new Error(`unknown plan: ${planId}`);
  return plan;
}

/** Price for a tier at a given billing period. */
export function planPriceClp(plan: CoachPlan, period: BillingPeriod): number {
  return period === "annual" ? plan.priceClpAnnual : plan.priceClpMonthly;
}

/** Months "free" on the annual plan vs paying 12 monthly — for the "X meses gratis" copy. */
export function annualMonthsFree(plan: CoachPlan): number {
  return Math.round((plan.priceClpMonthly * 12 - plan.priceClpAnnual) / plan.priceClpMonthly);
}

export function formatClp(amount: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Env key for the Mercado Pago `preapproval_plan_id` per tier + period (set after creating the
 * plans in the MP dashboard), e.g. `MERCADOPAGO_PLAN_BASICO_ANNUAL`.
 */
export function mercadoPagoPlanEnvKey(planId: CoachPlanId, period: BillingPeriod): string {
  return `MERCADOPAGO_PLAN_${planId.toUpperCase()}_${period.toUpperCase()}`;
}
