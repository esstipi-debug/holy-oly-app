import {
  BillingPeriodSchema,
  mercadoPagoPlanEnvKey,
  type BillingPeriod,
} from "@holy-oly/core";
import { mercadoPagoConfigured } from "./mercadopago";

/**
 * Default billing provider when `BILLING_PROVIDER` is unset.
 *
 * `mock` is fine for dev/test, but it would silently let everyone subscribe for $0 if it ever
 * reached production. {@link assertBillingProdConfig} is the guard that makes that impossible.
 */
export const DEFAULT_BILLING_PROVIDER = "mock";

export function billingProvider(): string {
  // Treat blank/whitespace (a common `.env` mistake like `BILLING_PROVIDER=`) as unset → default.
  return process.env.BILLING_PROVIDER?.trim() || DEFAULT_BILLING_PROVIDER;
}

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Whether `POST /billing/checkout` may use the $0 mock checkout. True ONLY outside production —
 * in prod the real provider is mandatory (and enforced at startup by {@link assertBillingProdConfig}),
 * so the mock path can never charge nothing. This is the load-bearing invariant for D2.
 */
export function mockCheckoutAllowed(): boolean {
  return !isProduction();
}

/** Plan env keys that must be present for MercadoPago: COACH tier × 2 periods (monthly + semiannual). */
function requiredPlanEnvKeys(): string[] {
  // PRO / ELITE / BOX are sold via direct contact — no MP plan id required in prod.
  const periods = BillingPeriodSchema.options as readonly BillingPeriod[];
  return periods.map((period) => mercadoPagoPlanEnvKey("coach", period));
}

/** Returns the list of missing prod-billing config items (empty = fully configured). */
export function missingBillingProdConfig(): string[] {
  const missing: string[] = [];

  const provider = billingProvider();
  if (provider !== "mercadopago") {
    missing.push(`BILLING_PROVIDER must be "mercadopago" in production (got "${provider}")`);
    // Without the real provider the remaining checks are moot — but list them anyway so the
    // operator sees the full set of vars to set in one pass instead of one redeploy at a time.
  }

  if (!mercadoPagoConfigured()) missing.push("MERCADOPAGO_ACCESS_TOKEN");
  if (!process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim()) missing.push("MERCADOPAGO_WEBHOOK_SECRET");

  for (const key of requiredPlanEnvKeys()) {
    if (!process.env[key]?.trim()) missing.push(key);
  }

  return missing;
}

/**
 * Fail-fast guard called at billing-plugin registration. In production, refuses to start unless
 * MercadoPago is the provider and fully configured (access token, webhook secret, all plan ids),
 * so prod can never silently fall back to the $0 mock checkout. No-op outside production.
 *
 * @throws Error listing exactly which billing env vars are missing.
 */
export function assertBillingProdConfig(): void {
  if (!isProduction()) return;

  const missing = missingBillingProdConfig();
  if (missing.length === 0) return;

  throw new Error(
    [
      "Billing is not configured for production — refusing to start in mock mode (would charge $0).",
      "Set the following before deploying:",
      ...missing.map((m) => `  - ${m}`),
      "Generate the MERCADOPAGO_PLAN_* ids with: pnpm --filter @holy-oly/api exec tsx scripts/mp-setup-plans.ts",
    ].join("\n"),
  );
}
