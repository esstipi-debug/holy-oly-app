import { z } from "zod";

/** Chilean VAT. Prices below are NET (pre-IVA) — B2B convention is to quote "net + IVA". */
export const IVA_RATE = 0.19;

/** Self-serve coach subscription tiers. Multi-sede (250+) is custom/contact (see MULTISEDE). */
export const CoachPlanIdSchema = z.enum(["coach", "pro", "elite", "box"]);
export type CoachPlanId = z.infer<typeof CoachPlanIdSchema>;

/** Billing cadence. Semiannual is the pushed option (cash flow): paid every 6 months, 1 month free. */
export const BillingPeriodSchema = z.enum(["monthly", "semiannual"]);
export type BillingPeriod = z.infer<typeof BillingPeriodSchema>;

export interface CoachPlan {
  id: CoachPlanId;
  name: string;
  description: string;
  /** NET monthly price in CLP (pre-IVA). */
  priceClpMonthly: number;
  /** NET semiannual price in CLP (paid every 6 months) = 5× monthly → 1 month free. */
  priceClpSemiannual: number;
  /** Max active athletes on the plan. */
  maxAthletes: number;
  /** Max coaches (assistant seats). `null` = unlimited. */
  maxCoaches: number | null;
  features: readonly string[];
}

export const COACH_PLANS: readonly CoachPlan[] = [
  {
    id: "coach",
    name: "Coach",
    description: "Coach individual que arranca.",
    priceClpMonthly: 39_900,
    priceClpSemiannual: 199_500,
    maxAthletes: 15,
    maxCoaches: 1,
    features: ["Hasta 15 atletas", "1 coach", "Programación periodizada + monitor IMR", "Atletas sin costo"],
  },
  {
    id: "pro",
    name: "Pro",
    description: "Coach full-time con el libro completo.",
    priceClpMonthly: 79_900,
    priceClpSemiannual: 399_500,
    maxAthletes: 40,
    maxCoaches: 2,
    features: ["Hasta 40 atletas", "Hasta 2 coaches", "Todo lo de Coach"],
  },
  {
    id: "elite",
    name: "Elite",
    description: "Equipo con coaches asistentes.",
    priceClpMonthly: 139_900,
    priceClpSemiannual: 699_500,
    maxAthletes: 80,
    maxCoaches: 3,
    features: ["Hasta 80 atletas", "Hasta 3 coaches", "Dashboard multi-coach"],
  },
  {
    id: "box",
    name: "Box/Club",
    description: "Instalación con roster compartido.",
    priceClpMonthly: 259_900,
    priceClpSemiannual: 1_299_500,
    maxAthletes: 250,
    maxCoaches: null,
    features: ["Hasta 250 atletas", "Coaches ilimitados", "Roster compartido", "Onboarding asistido + soporte prioritario"],
  },
] as const;

/** Multi-sede (250+ atletas, varias sedes): precio personalizado — no es self-serve. */
export const MULTISEDE = {
  name: "Multi-sede",
  description: "250+ atletas, múltiples sedes. Precio personalizado.",
  fromClpMonthly: 399_900,
} as const;

export function getCoachPlan(planId: CoachPlanId): CoachPlan {
  const plan = COACH_PLANS.find((p) => p.id === planId);
  if (!plan) throw new Error(`unknown plan: ${planId}`);
  return plan;
}

/** Price for a tier at a given billing period (NET, pre-IVA). */
export function planPriceClp(plan: CoachPlan, period: BillingPeriod): number {
  return period === "semiannual" ? plan.priceClpSemiannual : plan.priceClpMonthly;
}

/** Months "free" on the semiannual plan vs 6 monthly — for the "1 mes gratis" copy. */
export function semiannualMonthsFree(plan: CoachPlan): number {
  return Math.round((plan.priceClpMonthly * 6 - plan.priceClpSemiannual) / plan.priceClpMonthly);
}

/** Gross amount (IVA included) for an actual charge, from a NET price. */
export function withIva(netClp: number): number {
  return Math.round(netClp * (1 + IVA_RATE));
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
 * plans in the MP dashboard), e.g. `MERCADOPAGO_PLAN_COACH_SEMIANNUAL`.
 */
export function mercadoPagoPlanEnvKey(planId: CoachPlanId, period: BillingPeriod): string {
  return `MERCADOPAGO_PLAN_${planId.toUpperCase()}_${period.toUpperCase()}`;
}
