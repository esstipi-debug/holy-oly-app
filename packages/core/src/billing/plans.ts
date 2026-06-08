import { z } from "zod";

/** Coach subscription tiers (CLP/mes). Owner reference: $50.000 / $80.000 — limits provisional until confirmed. */
export const CoachPlanIdSchema = z.enum(["basico", "equipo"]);
export type CoachPlanId = z.infer<typeof CoachPlanIdSchema>;

export interface CoachPlan {
  id: CoachPlanId;
  name: string;
  description: string;
  /** Monthly price in Chilean pesos (integer, no decimals). */
  priceClp: number;
  /** Max roster size; `null` = unlimited (not offered yet). */
  maxAthletes: number | null;
  features: readonly string[];
}

export const COACH_PLANS: readonly CoachPlan[] = [
  {
    id: "basico",
    name: "Básico",
    description: "Para coaches que empiezan con un roster chico.",
    priceClp: 50_000,
    maxAthletes: 10,
    features: ["Hasta 10 atletas", "Programación y monitor IMR", "Atletas sin costo"],
  },
  {
    id: "equipo",
    name: "Equipo",
    description: "Para equipos que crecen y necesitan más cupos.",
    priceClp: 80_000,
    maxAthletes: 30,
    features: ["Hasta 30 atletas", "Todo lo de Básico", "Más cupos de vínculo"],
  },
] as const;

export function getCoachPlan(planId: CoachPlanId): CoachPlan {
  const plan = COACH_PLANS.find((p) => p.id === planId);
  if (!plan) throw new Error(`unknown plan: ${planId}`);
  return plan;
}

export function formatClp(amount: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Env key for Mercado Pago `preapproval_plan_id` per tier (set after creating plans in MP dashboard). */
export function mercadoPagoPlanEnvKey(planId: CoachPlanId): string {
  return `MERCADOPAGO_PLAN_${planId.toUpperCase()}`;
}
