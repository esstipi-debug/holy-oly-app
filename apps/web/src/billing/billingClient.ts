const BASE = import.meta.env.VITE_API_URL ?? "";

export type BillingPeriod = "monthly" | "annual";
export type CoachPlanId = "coach" | "pro" | "elite" | "box";

export interface BillingPlan {
  id: CoachPlanId;
  name: string;
  description: string;
  priceClpMonthly: number;
  priceClpAnnual: number;
  maxAthletes: number | null;
  maxCoaches: number | null;
  features: string[];
}

export interface BillingStatus {
  provider: string;
  status: "none" | "active" | "past_due" | "canceled";
  active: boolean;
  planId: string | null;
  currentPeriodEnd: string | null;
}

async function throwIfNotOk(res: Response): Promise<void> {
  if (res.ok) return;
  const body = (await res.json().catch(() => null)) as { error?: string; code?: string } | null;
  const err = new Error(body?.error ?? `request failed (${res.status})`);
  (err as Error & { code?: string }).code = body?.code;
  throw err;
}

export async function billingPlans(): Promise<BillingPlan[]> {
  const res = await fetch(`${BASE}/billing/plans`, { credentials: "include" });
  await throwIfNotOk(res);
  const json = (await res.json()) as { plans: BillingPlan[] };
  return json.plans;
}

export async function billingStatus(): Promise<BillingStatus> {
  const res = await fetch(`${BASE}/billing/status`, { credentials: "include" });
  await throwIfNotOk(res);
  return (await res.json()) as BillingStatus;
}

export async function billingCheckout(
  planId: CoachPlanId,
  period: BillingPeriod = "annual",
): Promise<{ checkoutUrl: string }> {
  const res = await fetch(`${BASE}/billing/checkout`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ planId, period }),
  });
  await throwIfNotOk(res);
  return (await res.json()) as { checkoutUrl: string };
}

export async function mockActivate(): Promise<void> {
  const res = await fetch(`${BASE}/billing/mock/activate`, { method: "POST", credentials: "include" });
  await throwIfNotOk(res);
}
