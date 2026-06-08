import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "./server";
import { prisma } from "./db/client";

type InjectRes = { cookies: Array<{ name: string; value: string }>; statusCode: number };
function cookieOf(res: InjectRes): { cookie: string } {
  const c = res.cookies.find((x) => x.name === "session");
  if (!c) throw new Error("no session cookie");
  return { cookie: `session=${c.value}` };
}

describe("billing (E3–E5 mock)", () => {
  let app: FastifyInstance;
  let coachH: { cookie: string };
  let coachId: string;
  let athleteId: string;
  const prevEnforce = process.env.BILLING_ENFORCE;

  beforeAll(async () => {
    process.env.BILLING_ENFORCE = "true";
    app = buildServer();
    await app.ready();
    const u = Date.now();
    const coach = await app.inject({
      method: "POST",
      url: "/auth/signup",
      payload: { email: `bill-${u}@x.dev`, password: "billing-pass-1", role: "coach" },
    });
    coachH = cookieOf(coach as unknown as InjectRes);
    const coachUserId = (coach.json() as { id: string }).id;
    const coachRow = await prisma.coach.findUnique({ where: { userId: coachUserId } });
    coachId = coachRow!.id;
    await prisma.user.update({ where: { id: coachUserId }, data: { emailVerified: true } });

    athleteId = `ba-${u}`;
    await prisma.athlete.create({
      data: { id: athleteId, nombre: "Bill Athlete", iniciales: "BA", nivel: "intermediate" },
    });
    await prisma.vinculo.create({ data: { coachId, athleteId, estado: "activo" } });
  });

  afterAll(async () => {
    if (prevEnforce === undefined) delete process.env.BILLING_ENFORCE;
    else process.env.BILLING_ENFORCE = prevEnforce;
    await app.close();
    await prisma.$disconnect();
  });

  it("blocks coach writes without active subscription (402)", async () => {
    const put = await app.inject({
      method: "PUT",
      url: `/athletes/${athleteId}/plan`,
      headers: coachH,
      payload: {
        atletaId: athleteId,
        macroId: "ruso-5d",
        startWeek: 1,
        startDate: "2026-03-09",
        rms: { arranque: 90, envion: 115, sentadilla: 150, frente: 120 },
        comps: [],
      },
    });
    expect(put.statusCode).toBe(402);
  });

  it("mock activate unlocks writes", async () => {
    const act = await app.inject({ method: "POST", url: "/billing/mock/activate", headers: coachH });
    expect(act.statusCode).toBe(200);
    const put = await app.inject({
      method: "PUT",
      url: `/athletes/${athleteId}/plan`,
      headers: coachH,
      payload: {
        atletaId: athleteId,
        macroId: "ruso-5d",
        startWeek: 1,
        startDate: "2026-03-09",
        rms: { arranque: 90, envion: 115, sentadilla: 150, frente: 120 },
        comps: [],
      },
    });
    expect(put.statusCode).toBe(200);
  });

  it("webhook is idempotent", async () => {
    const evt = {
      id: `evt-${Date.now()}`,
      type: "subscription.updated",
      created: Math.floor(Date.now() / 1000),
      data: { coachId, status: "active" as const, currentPeriodEnd: new Date(Date.now() + 86400_000).toISOString() },
    };
    const sig = { "x-billing-signature": process.env.BILLING_WEBHOOK_SECRET ?? "dev-mock-webhook-secret" };
    const first = await app.inject({ method: "POST", url: "/billing/webhook", headers: sig, payload: evt });
    const second = await app.inject({ method: "POST", url: "/billing/webhook", headers: sig, payload: evt });
    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect((second.json() as { duplicate?: boolean }).duplicate).toBe(true);
  });
});
