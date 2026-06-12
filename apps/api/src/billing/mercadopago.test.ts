import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { getCoachPlan, withIva } from "@holy-oly/core";
import {
  buildPreapprovalPlanBody,
  mapMercadoPagoPreapprovalStatus,
  mercadoPagoWebhookEventId,
  verifyMercadoPagoSignature,
} from "./mercadopago";

describe("mercadopago adapter", () => {
  const secret = "test-webhook-secret";

  function sign(opts: { dataId?: string; requestId?: string; ts: string }): string {
    const parts: string[] = [];
    if (opts.dataId) parts.push(`id:${opts.dataId.toLowerCase()};`);
    if (opts.requestId) parts.push(`request-id:${opts.requestId};`);
    parts.push(`ts:${opts.ts};`);
    const v1 = createHmac("sha256", secret).update(parts.join("")).digest("hex");
    return `ts=${opts.ts},v1=${v1}`;
  }

  it("verifies x-signature manifest", () => {
    const ts = "1704908010";
    const dataId = "abc123";
    const requestId = "req-1";
    const xSignature = sign({ dataId, requestId, ts });
    expect(verifyMercadoPagoSignature({ xSignature, xRequestId: requestId, dataId, secret })).toBe(true);
    expect(verifyMercadoPagoSignature({ xSignature: "ts=1,v1=deadbeef", xRequestId: requestId, dataId, secret })).toBe(false);
  });

  it("maps preapproval status to subscription status", () => {
    expect(mapMercadoPagoPreapprovalStatus("authorized")).toBe("active");
    expect(mapMercadoPagoPreapprovalStatus("paused")).toBe("past_due");
    expect(mapMercadoPagoPreapprovalStatus("cancelled")).toBe("canceled");
    expect(mapMercadoPagoPreapprovalStatus("pending")).toBe("none");
  });

  it("builds stable webhook event ids", () => {
    expect(mercadoPagoWebhookEventId({ type: "subscription_preapproval", data: { id: "pre-99" } })).toBe(
      "mp:subscription_preapproval:pre-99",
    );
  });

  it("builds the preapproval_plan body: semiannual → 6 months, gross (net+IVA) amount", () => {
    const b = buildPreapprovalPlanBody(getCoachPlan("coach"), "semiannual", "https://x.app");
    expect(b.auto_recurring.frequency).toBe(6);
    expect(b.auto_recurring.frequency_type).toBe("months");
    expect(b.auto_recurring.transaction_amount).toBe(withIva(199_500));
    expect(b.auto_recurring.currency_id).toBe("CLP");
    expect(b.back_url).toContain("/coach/suscripcion");
  });

  it("monthly → months + monthly gross amount", () => {
    const b = buildPreapprovalPlanBody(getCoachPlan("pro"), "monthly", "https://x.app");
    expect(b.auto_recurring.frequency_type).toBe("months");
    expect(b.auto_recurring.transaction_amount).toBe(withIva(79_900));
  });
});
