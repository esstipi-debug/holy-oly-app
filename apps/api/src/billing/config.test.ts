import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BillingPeriodSchema,
  CoachPlanIdSchema,
  mercadoPagoPlanEnvKey,
  type BillingPeriod,
  type CoachPlanId,
} from "@holy-oly/core";
import {
  assertBillingProdConfig,
  billingProvider,
  missingBillingProdConfig,
  mockCheckoutAllowed,
} from "./config";

/** Stub a fully-configured MercadoPago env (provider + token + secret + all 8 plan ids). */
function stubFullMercadoPagoEnv(): void {
  vi.stubEnv("BILLING_PROVIDER", "mercadopago");
  vi.stubEnv("MERCADOPAGO_ACCESS_TOKEN", "APP_USR-test-token");
  vi.stubEnv("MERCADOPAGO_WEBHOOK_SECRET", "whsec-test");
  for (const planId of CoachPlanIdSchema.options as readonly CoachPlanId[]) {
    for (const period of BillingPeriodSchema.options as readonly BillingPeriod[]) {
      vi.stubEnv(mercadoPagoPlanEnvKey(planId, period), `mp-plan-${planId}-${period}`);
    }
  }
}

describe("billing config guard (assertBillingProdConfig)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("throws in production when the provider is mock", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BILLING_PROVIDER", "mock");

    expect(() => assertBillingProdConfig()).toThrowError(/refusing to start in mock mode/i);
  });

  it("throws in production when BILLING_PROVIDER is unset (defaults to mock)", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BILLING_PROVIDER", undefined);

    expect(billingProvider()).toBe("mock");
    expect(() => assertBillingProdConfig()).toThrow();
  });

  it("treats a blank BILLING_PROVIDER as the mock default (and still throws in prod)", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BILLING_PROVIDER", "   ");

    expect(billingProvider()).toBe("mock");
    expect(() => assertBillingProdConfig()).toThrowError(/refusing to start in mock mode/i);
  });

  it("error message lists exactly what is missing (provider, token, secret, plan ids)", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BILLING_PROVIDER", "mock");
    vi.stubEnv("MERCADOPAGO_ACCESS_TOKEN", "");
    vi.stubEnv("MERCADOPAGO_WEBHOOK_SECRET", "");
    for (const planId of CoachPlanIdSchema.options as readonly CoachPlanId[]) {
      for (const period of BillingPeriodSchema.options as readonly BillingPeriod[]) {
        vi.stubEnv(mercadoPagoPlanEnvKey(planId, period), "");
      }
    }

    let message = "";
    try {
      assertBillingProdConfig();
    } catch (e) {
      message = e instanceof Error ? e.message : String(e);
    }

    expect(message).toContain("BILLING_PROVIDER");
    expect(message).toContain("MERCADOPAGO_ACCESS_TOKEN");
    expect(message).toContain("MERCADOPAGO_WEBHOOK_SECRET");
    expect(message).toContain("MERCADOPAGO_PLAN_COACH_ANNUAL");
    expect(message).toContain("MERCADOPAGO_PLAN_BOX_MONTHLY");
    // Points the operator at the plan-generation script.
    expect(message).toContain("mp-setup-plans");
  });

  it("does NOT throw in production when MercadoPago is fully configured", () => {
    vi.stubEnv("NODE_ENV", "production");
    stubFullMercadoPagoEnv();

    expect(missingBillingProdConfig()).toEqual([]);
    expect(() => assertBillingProdConfig()).not.toThrow();
  });

  it("still throws in production if a single plan id is missing", () => {
    vi.stubEnv("NODE_ENV", "production");
    stubFullMercadoPagoEnv();
    vi.stubEnv("MERCADOPAGO_PLAN_ELITE_MONTHLY", ""); // one hole

    expect(() => assertBillingProdConfig()).toThrowError(/MERCADOPAGO_PLAN_ELITE_MONTHLY/);
  });

  it("still throws in production if only the webhook secret is missing", () => {
    vi.stubEnv("NODE_ENV", "production");
    stubFullMercadoPagoEnv();
    vi.stubEnv("MERCADOPAGO_WEBHOOK_SECRET", "");

    expect(() => assertBillingProdConfig()).toThrowError(/MERCADOPAGO_WEBHOOK_SECRET/);
  });

  it("treats whitespace-only secrets as missing", () => {
    vi.stubEnv("NODE_ENV", "production");
    stubFullMercadoPagoEnv();
    vi.stubEnv("MERCADOPAGO_ACCESS_TOKEN", "   ");

    expect(() => assertBillingProdConfig()).toThrowError(/MERCADOPAGO_ACCESS_TOKEN/);
  });

  it("never throws outside production — dev + mock is allowed", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("BILLING_PROVIDER", "mock");

    expect(() => assertBillingProdConfig()).not.toThrow();
  });

  it("never throws in test env even with nothing configured", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("BILLING_PROVIDER", "");

    expect(() => assertBillingProdConfig()).not.toThrow();
  });
});

describe("checkout mock-fallback gate (mockCheckoutAllowed)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("forbids the $0 mock checkout in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(mockCheckoutAllowed()).toBe(false);
  });

  it("allows the mock checkout in development and test", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(mockCheckoutAllowed()).toBe(true);
    vi.stubEnv("NODE_ENV", "test");
    expect(mockCheckoutAllowed()).toBe(true);
  });

  it("is not reopened by BILLING_PROVIDER=mock in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BILLING_PROVIDER", "mock");
    expect(mockCheckoutAllowed()).toBe(false);
  });
});
