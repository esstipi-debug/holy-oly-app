import { createHmac, timingSafeEqual } from "node:crypto";
import type { Prisma, PrismaClient, SubscriptionStatus } from "@prisma/client";
import {
  CoachPlanIdSchema,
  BillingPeriodSchema,
  getCoachPlan,
  mercadoPagoPlanEnvKey,
  planPriceClp,
  withIva,
  type CoachPlan,
  type CoachPlanId,
  type BillingPeriod,
} from "@holy-oly/core";
import { ensureCoachSubscription, setSubscriptionStatus } from "./subscription";

type Db = PrismaClient | Prisma.TransactionClient;

const MP_API = "https://api.mercadopago.com";

export interface MercadoPagoWebhookNotification {
  id?: number;
  type?: string;
  action?: string;
  data?: { id?: string };
  date_created?: string;
}

export interface MercadoPagoPreapproval {
  id: string;
  status: string;
  external_reference?: string;
  next_payment_date?: string;
  auto_recurring?: { end_date?: string };
  payer_email?: string;
}

export function mercadoPagoConfigured(): boolean {
  return Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN?.trim());
}

export function resolveMercadoPagoPlanId(planId: CoachPlanId, period: BillingPeriod): string | null {
  const fromEnv = process.env[mercadoPagoPlanEnvKey(planId, period)]?.trim();
  return fromEnv || null;
}

/** Validates MP webhook `x-signature` (HMAC-SHA256 manifest). */
export function verifyMercadoPagoSignature(opts: {
  xSignature: string | undefined;
  xRequestId: string | undefined;
  dataId: string | undefined;
  secret: string;
}): boolean {
  const { xSignature, xRequestId, dataId, secret } = opts;
  if (!xSignature || !secret) return false;

  let ts: string | undefined;
  let v1: string | undefined;
  for (const part of xSignature.split(",")) {
    const [k, v] = part.split("=", 2);
    if (k === "ts") ts = v;
    if (k === "v1") v1 = v;
  }
  if (!ts || !v1) return false;

  const parts: string[] = [];
  if (dataId) parts.push(`id:${dataId.toLowerCase()};`);
  if (xRequestId) parts.push(`request-id:${xRequestId};`);
  parts.push(`ts:${ts};`);
  const manifest = parts.join("");

  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(v1, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

export function mapMercadoPagoPreapprovalStatus(mpStatus: string): SubscriptionStatus {
  switch (mpStatus) {
    case "authorized":
      return "active";
    case "paused":
      return "past_due";
    case "cancelled":
      return "canceled";
    case "pending":
    default:
      return "none";
  }
}

export function mercadoPagoWebhookEventId(body: MercadoPagoWebhookNotification): string | null {
  const topic = body.type ?? "unknown";
  const resourceId = body.data?.id;
  if (!resourceId) return null;
  return `mp:${topic}:${resourceId}`;
}

export async function fetchMercadoPagoPreapproval(preapprovalId: string): Promise<MercadoPagoPreapproval> {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!token) throw new Error("MERCADOPAGO_ACCESS_TOKEN not configured");

  const res = await fetch(`${MP_API}/preapproval/${encodeURIComponent(preapprovalId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`mercadopago preapproval fetch failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return (await res.json()) as MercadoPagoPreapproval;
}

export async function createMercadoPagoCheckout(opts: {
  coachId: string;
  planId: CoachPlanId;
  period: BillingPeriod;
  payerEmail: string;
  origin: string;
}): Promise<{ checkoutUrl: string; preapprovalId: string }> {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!token) throw new Error("MERCADOPAGO_ACCESS_TOKEN not configured");

  const plan = getCoachPlan(opts.planId);
  // The MP preapproval_plan (created in the dashboard) defines the cadence (monthly/annual) and amount.
  const preapprovalPlanId = resolveMercadoPagoPlanId(opts.planId, opts.period);
  if (!preapprovalPlanId) {
    throw new Error(`Mercado Pago plan not configured for "${opts.planId}/${opts.period}" (${mercadoPagoPlanEnvKey(opts.planId, opts.period)})`);
  }
  const periodLabel = opts.period === "annual" ? "Anual" : "Mensual";

  const res = await fetch(`${MP_API}/preapproval`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      preapproval_plan_id: preapprovalPlanId,
      payer_email: opts.payerEmail,
      back_url: `${opts.origin}/coach/suscripcion?checkout=return`,
      external_reference: opts.coachId,
      reason: `Holy Oly — ${plan.name} (${periodLabel})`,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`mercadopago checkout failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const data = (await res.json()) as { id?: string; init_point?: string; sandbox_init_point?: string };
  const checkoutUrl = data.init_point ?? data.sandbox_init_point;
  if (!data.id || !checkoutUrl) throw new Error("mercadopago checkout missing init_point");

  return { checkoutUrl, preapprovalId: data.id };
}

export async function applyMercadoPagoPreapproval(
  prisma: Db,
  preapproval: MercadoPagoPreapproval,
  planId?: CoachPlanId | null,
): Promise<void> {
  const coachId = preapproval.external_reference?.trim();
  if (!coachId) throw new Error("preapproval missing external_reference (coachId)");

  const status = mapMercadoPagoPreapprovalStatus(preapproval.status);
  const endRaw = preapproval.next_payment_date ?? preapproval.auto_recurring?.end_date;
  const currentPeriodEnd = endRaw ? new Date(endRaw) : status === "active" ? new Date(Date.now() + 30 * 86400_000) : null;

  await ensureCoachSubscription(prisma, coachId, "mercadopago");
  await setSubscriptionStatus(prisma, coachId, status, currentPeriodEnd, {
    providerSubId: preapproval.id,
    planId: planId ?? undefined,
  });
}

export interface PreapprovalPlanBody {
  reason: string;
  auto_recurring: { frequency: number; frequency_type: "months"; transaction_amount: number; currency_id: "CLP" };
  back_url: string;
}

/**
 * MP `preapproval_plan` payload for a tier+period. `transaction_amount` is GROSS (net price + IVA),
 * which is what MP actually charges; annual → 12 months, monthly → 1 month.
 */
export function buildPreapprovalPlanBody(plan: CoachPlan, period: BillingPeriod, origin: string): PreapprovalPlanBody {
  return {
    reason: `Holy Oly — ${plan.name} (${period === "annual" ? "Anual" : "Mensual"})`,
    auto_recurring: {
      frequency: period === "annual" ? 12 : 1,
      frequency_type: "months",
      transaction_amount: withIva(planPriceClp(plan, period)),
      currency_id: "CLP",
    },
    back_url: `${origin}/coach/suscripcion?checkout=return`,
  };
}

/** Create a `preapproval_plan` in Mercado Pago; returns its id (for MERCADOPAGO_PLAN_* env). */
export async function createPreapprovalPlan(body: PreapprovalPlanBody): Promise<string> {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!token) throw new Error("MERCADOPAGO_ACCESS_TOKEN not configured");
  const res = await fetch(`${MP_API}/preapproval_plan`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { id?: string };
  if (!res.ok || !data.id) throw new Error(`preapproval_plan create failed (${res.status})`);
  return data.id;
}

export function parseCheckoutPlanId(raw: unknown): CoachPlanId {
  const parsed = CoachPlanIdSchema.safeParse(raw);
  if (!parsed.success) throw new Error("invalid planId");
  return parsed.data;
}

/** Billing period from the checkout body; defaults to annual (the pushed option). */
export function parseCheckoutPeriod(raw: unknown): BillingPeriod {
  return BillingPeriodSchema.safeParse(raw).data ?? "annual";
}
