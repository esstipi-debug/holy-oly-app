import type { FastifyInstance } from "fastify";
import { COACH_PLANS, CoachPlanIdSchema, BillingPeriodSchema, type BillingPeriod } from "@holy-oly/core";
import { z } from "zod";
import { prisma } from "../db/client";
import { requireCoach } from "../auth/guards";
import { recordAudit } from "../audit";
import { appOrigin } from "../email";
import {
  ensureCoachSubscription,
  getCoachSubscription,
  isSubscriptionActive,
  setSubscriptionStatus,
} from "./subscription";
import {
  applyMockWebhook,
  isReplaySafe,
  mockCheckoutUrl,
  verifyMockWebhookSecret,
  type MockWebhookEvent,
} from "./mock";
import {
  applyMercadoPagoPreapproval,
  createMercadoPagoCheckout,
  fetchMercadoPagoPreapproval,
  mercadoPagoConfigured,
  mercadoPagoWebhookEventId,
  parseCheckoutPlanId,
  parseCheckoutPeriod,
  resolveMercadoPagoPlanId,
  verifyMercadoPagoSignature,
  type MercadoPagoWebhookNotification,
} from "./mercadopago";
import { assertBillingProdConfig, billingProvider, mockCheckoutAllowed } from "./config";

const PROVIDER = billingProvider();

const CheckoutBodySchema = z.object({ planId: z.string().optional(), period: z.string().optional() }).optional();

/** Coach billing status, checkout, and provider webhooks (E3–E5). */
export async function billingRoutes(app: FastifyInstance): Promise<void> {
  // Fail fast: in production, refuse to register billing in mock mode (would charge $0).
  assertBillingProdConfig();

  app.get("/billing/plans", async () => {
    const allPeriods: BillingPeriod[] = [...BillingPeriodSchema.options];
    const isMp = PROVIDER === "mercadopago" && mercadoPagoConfigured();
    return {
      plans: COACH_PLANS.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        priceClpMonthly: p.priceClpMonthly,
        priceClpSemiannual: p.priceClpSemiannual,
        maxAthletes: p.maxAthletes,
        maxCoaches: p.maxCoaches,
        features: [...p.features],
        // Períodos que MP puede cobrar automáticamente (tiene plan_id y entra al techo $350K).
        // Los que no (semestral de los tiers altos) se ofrecen igual, pero se coordinan por interno.
        mpCheckoutPeriods: isMp
          ? allPeriods.filter((pr) => resolveMercadoPagoPlanId(p.id, pr) !== null)
          : allPeriods,
      })),
    };
  });

  app.get("/billing/status", async (req, reply) => {
    const coachId = requireCoach(req, reply);
    if (!coachId) return;
    const sub = await ensureCoachSubscription(prisma, coachId, PROVIDER);
    return {
      provider: sub.provider,
      status: sub.status,
      active: isSubscriptionActive(sub),
      planId: sub.planId,
      currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
    };
  });

  app.post("/billing/checkout", async (req, reply) => {
    const coachId = requireCoach(req, reply);
    if (!coachId) return;

    const body = CheckoutBodySchema.parse(req.body ?? {});
    const planId = parseCheckoutPlanId(body?.planId ?? "coach");
    const period = parseCheckoutPeriod(body?.period); // defaults to "semiannual" (pushed option)
    await ensureCoachSubscription(prisma, coachId, PROVIDER);
    const origin = appOrigin();

    if (PROVIDER === "mercadopago" && mercadoPagoConfigured()) {
      const coach = await prisma.coach.findUnique({
        where: { id: coachId },
        include: { user: { select: { email: true } } },
      });
      if (!coach?.user.email) return reply.code(400).send({ error: "coach email missing" });

      try {
        const { checkoutUrl, preapprovalId } = await createMercadoPagoCheckout({
          coachId,
          planId,
          period,
          payerEmail: coach.user.email,
          origin,
        });
        await prisma.subscription.update({
          where: { coachId },
          data: { provider: "mercadopago", planId, providerSubId: preapprovalId },
        });
        return { checkoutUrl, provider: "mercadopago", planId, period };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "checkout failed";
        return reply.code(503).send({ error: msg });
      }
    }

    // Dev/test convenience: mock checkout when not in production. NEVER falls back to mock in
    // production — there the startup guard (assertBillingProdConfig) already forced a real provider,
    // and this branch is gated so a stray BILLING_PROVIDER value can't reopen the $0 path.
    if (mockCheckoutAllowed()) {
      await prisma.subscription.update({ where: { coachId }, data: { planId } }).catch(() => undefined);
      return { checkoutUrl: mockCheckoutUrl(coachId, origin), provider: "mock", planId, period };
    }

    return reply.code(501).send({ error: "billing provider not configured" });
  });

  app.post("/billing/webhook", async (req, reply) => {
    if (PROVIDER === "mercadopago" && mercadoPagoConfigured()) {
      const body = req.body as MercadoPagoWebhookNotification;
      const dataId = body?.data?.id;
      const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET ?? "";
      const ok = verifyMercadoPagoSignature({
        xSignature: req.headers["x-signature"] as string | undefined,
        xRequestId: req.headers["x-request-id"] as string | undefined,
        dataId,
        secret,
      });
      if (!secret || !ok) return reply.code(401).send({ error: "invalid signature" });

      const eventId = mercadoPagoWebhookEventId(body);
      if (!eventId || !dataId) return reply.code(400).send({ error: "invalid payload" });

      const existing = await prisma.webhookEvent.findUnique({ where: { id: eventId } });
      if (existing) return { ok: true, duplicate: true };

      if (body.type !== "subscription_preapproval") {
        await prisma.webhookEvent.create({ data: { id: eventId, provider: "mercadopago" } });
        return { ok: true, ignored: true };
      }

      try {
        const preapproval = await fetchMercadoPagoPreapproval(dataId);
        const sub = preapproval.external_reference
          ? await getCoachSubscription(prisma, preapproval.external_reference)
          : null;
        const storedPlanId = sub?.planId ? CoachPlanIdSchema.safeParse(sub.planId).data : undefined;
        await prisma.$transaction(async (tx) => {
          await tx.webhookEvent.create({ data: { id: eventId, provider: "mercadopago" } });
          await applyMercadoPagoPreapproval(tx, preapproval, storedPlanId);
        });
        return { ok: true };
      } catch (e) {
        req.log.error({ err: e }, "mercadopago webhook failed");
        return reply.code(502).send({ error: "webhook processing failed" });
      }
    }

    if (!verifyMockWebhookSecret(req.headers["x-billing-signature"] as string | undefined)) {
      return reply.code(401).send({ error: "invalid signature" });
    }
    const evt = req.body as MockWebhookEvent;
    if (!evt?.id || !evt?.data?.coachId || !evt?.created) {
      return reply.code(400).send({ error: "invalid payload" });
    }
    if (!isReplaySafe(evt.created)) {
      return reply.code(400).send({ error: "stale event" });
    }
    const existing = await prisma.webhookEvent.findUnique({ where: { id: evt.id } });
    if (existing) return { ok: true, duplicate: true };
    await prisma.$transaction(async (tx) => {
      await tx.webhookEvent.create({ data: { id: evt.id, provider: PROVIDER } });
      await applyMockWebhook(tx, evt);
    });
    return { ok: true };
  });

  // Dev/demo: activate mock subscription without external payment UI.
  app.post("/billing/mock/activate", async (req, reply) => {
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_MOCK_BILLING !== "true") {
      return reply.code(404).send({ error: "not found" });
    }
    const coachId = requireCoach(req, reply);
    if (!coachId) return;
    const end = new Date(Date.now() + 30 * 86400_000);
    await setSubscriptionStatus(prisma, coachId, "active", end);
    await recordAudit(prisma, { action: "billing.mock_activate", actorUserId: req.userId ?? null, actorRole: "coach", ip: req.ip });
    return { ok: true, status: "active", currentPeriodEnd: end.toISOString() };
  });
}
