import { z } from "zod";

/** Chilean VAT. Prices below are NET (pre-IVA) — B2B convention is to quote "net + IVA". */
export const IVA_RATE = 0.19;

/** Self-serve coach subscription tiers. Multi-sede (250+) is custom/contact (see MULTISEDE). */
export const CoachPlanIdSchema = z.enum(["coach", "pro", "elite", "box"]);
export type CoachPlanId = z.infer<typeof CoachPlanIdSchema>;

/** Billing cadence. Annual is the pushed option (cash flow): paid once/year, 2 months free. */
export const BillingPeriodSchema = z.enum(["monthly", "annual"]);
export type BillingPeriod = z.infer<typeof BillingPeriodSchema>;

export interface CoachPlan {
  id: CoachPlanId;
  name: string;
  description: string;
  /** NET monthly price in CLP (pre-IVA). */
  priceClpMonthly: number;
  /** NET annual price in CLP (paid once/year) = 10× monthly → 2 months free. */
  priceClpAnnual: number;
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
    priceClpMonthly: 19_900,
    priceClpAnnual: 199_000,
    maxAthletes: 15,
    maxCoaches: 1,
    features: ["Hasta 15 atletas", "1 coach", "Programación periodizada + monitor IMR", "Atletas sin costo"],
  },
  {
    id: "pro",
    name: "Pro",
    description: "Coach full-time con el libro completo.",
    priceClpMonthly: 39_900,
    priceClpAnnual: 399_000,
    maxAthletes: 40,
    maxCoaches: 2,
    features: ["Hasta 40 atletas", "Hasta 2 coaches", "Todo lo de Coach"],
  },
  {
    id: "elite",
    name: "Elite",
    description: "Equipo con coaches asistentes.",
    priceClpMonthly: 69_900,
    priceClpAnnual: 699_000,
    maxAthletes: 80,
    maxCoaches: 3,
    features: ["Hasta 80 atletas", "Hasta 3 coaches", "Dashboard multi-coach"],
  },
  {
    id: "box",
    name: "Box/Club",
    description: "Instalación con roster compartido.",
    priceClpMonthly: 129_900,
    priceClpAnnual: 1_299_000,
    maxAthletes: 250,
    maxCoaches: null,
    features: ["Hasta 250 atletas", "Coaches ilimitados", "Roster compartido", "Onboarding asistido + soporte prioritario"],
  },
] as const;

/** Multi-sede (250+ atletas, varias sedes): precio personalizado — no es self-serve. */
export const MULTISEDE = {
  name: "Multi-sede",
  description: "250+ atletas, múltiples sedes. Precio personalizado.",
  fromClpMonthly: 199_900,
} as const;

export function getCoachPlan(planId: CoachPlanId): CoachPlan {
  const plan = COACH_PLANS.find((p) => p.id === planId);
  if (!plan) throw new Error(`unknown plan: ${planId}`);
  return plan;
}

/** Price for a tier at a given billing period (NET, pre-IVA). */
export function planPriceClp(plan: CoachPlan, period: BillingPeriod): number {
  return period === "annual" ? plan.priceClpAnnual : plan.priceClpMonthly;
}

/** Months "free" on the annual plan vs 12 monthly — for the "X meses gratis" copy. */
export function annualMonthsFree(plan: CoachPlan): number {
  return Math.round((plan.priceClpMonthly * 12 - plan.priceClpAnnual) / plan.priceClpMonthly);
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
 * plans in the MP dashboard), e.g. `MERCADOPAGO_PLAN_COACH_ANNUAL`.
 */
export function mercadoPagoPlanEnvKey(planId: CoachPlanId, period: BillingPeriod): string {
  return `MERCADOPAGO_PLAN_${planId.toUpperCase()}_${period.toUpperCase()}`;
}
