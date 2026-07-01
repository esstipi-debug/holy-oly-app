import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "./server";
import { prisma } from "./db/client";

// INTEGRATION — self-coach: el atleta crea su propio plan vía POST /me/plan (sin coach). Reusa el
// motor (savePlan/setComps/instantiateForPlan). Rate-limit off bajo test (buildServer sin opts).

type InjectRes = { cookies: Array<{ name: string; value: string }>; statusCode: number };
function sessionHeader(res: InjectRes): { cookie: string } {
  const c = res.cookies.find((x) => x.name === "session");
  if (!c) throw new Error("no session cookie was set");
  return { cookie: `session=${c.value}` };
}

const ATH = "demo-atleta";
const RMS = { arranque: 80, envion: 100, sentadilla: 140, frente: 110 };
const future = (days: number): string => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

describe("API integration — self-coach (POST /me/plan)", () => {
  let app: FastifyInstance;
  beforeAll(async () => { app = buildServer(); await app.ready(); });
  afterAll(async () => { await app.close(); await prisma.$disconnect(); });

  beforeEach(async () => {
    await prisma.prescribedExercise.deleteMany({ where: { athleteId: ATH } });
    await prisma.rmUpdate.deleteMany({ where: { athleteId: ATH } });
    await prisma.competencia.deleteMany({ where: { athleteId: ATH } });
    await prisma.plan.deleteMany({ where: { athleteId: ATH } });
  });

  async function loginAthlete(): Promise<{ cookie: string }> {
    const res = await app.inject({ method: "POST", url: "/auth/login", payload: { email: "atleta@holyoly.dev", password: "holyoly-demo" } });
    expect(res.statusCode).toBe(200);
    return sessionHeader(res);
  }

  it("401 sin sesión", async () => {
    const res = await app.inject({ method: "POST", url: "/me/plan", payload: { macroId: "ruso-5d", rms: RMS, startDate: future(7) } });
    expect(res.statusCode).toBe(401);
  });

  it("401 con sesión de coach (superficie del atleta)", async () => {
    const coach = await app.inject({ method: "POST", url: "/auth/login", payload: { email: "coach@holyoly.dev", password: "holyoly-demo" } });
    const res = await app.inject({ method: "POST", url: "/me/plan", headers: sessionHeader(coach), payload: { macroId: "ruso-5d", rms: RMS, startDate: future(7) } });
    expect(res.statusCode).toBe(401);
  });

  it("crea su ciclo con competencia → 200 + plan + prescripción + 4 RM baseline (assign)", async () => {
    const headers = await loginAthlete();
    const res = await app.inject({ method: "POST", url: "/me/plan", headers, payload: { macroId: "ruso-5d", rms: RMS, comp: { name: "Nacional", date: future(120) } } });
    expect(res.statusCode).toBe(200);

    const planRes = await app.inject({ method: "GET", url: "/me/plan", headers });
    const body = planRes.json() as { plan: { macroName: string } | null };
    expect(body.plan).not.toBeNull();
    expect(body.plan!.macroName.length).toBeGreaterThan(0);

    expect(await prisma.prescribedExercise.count({ where: { athleteId: ATH } })).toBeGreaterThan(0);
    expect(await prisma.competencia.count({ where: { athleteId: ATH } })).toBe(1);
    const rms = await prisma.rmUpdate.findMany({ where: { athleteId: ATH } });
    expect(rms.length).toBe(4);
    expect(rms.every((r) => r.reason === "assign")).toBe(true);
  });

  it("crea con startDate (sin compe) → 200", async () => {
    const headers = await loginAthlete();
    const res = await app.inject({ method: "POST", url: "/me/plan", headers, payload: { macroId: "ruso-5d", rms: RMS, startDate: future(3) } });
    expect(res.statusCode).toBe(200);
  });

  it("400 macro inexistente", async () => {
    const headers = await loginAthlete();
    const res = await app.inject({ method: "POST", url: "/me/plan", headers, payload: { macroId: "no-existe-xyz", rms: RMS, startDate: future(7) } });
    expect(res.statusCode).toBe(400);
  });

  it("400 fecha de competencia pasada", async () => {
    const headers = await loginAthlete();
    const res = await app.inject({ method: "POST", url: "/me/plan", headers, payload: { macroId: "ruso-5d", rms: RMS, comp: { name: "Vieja", date: "2020-01-01" } } });
    expect(res.statusCode).toBe(400);
  });

  it("400 sin ancla (ni compe ni startDate)", async () => {
    const headers = await loginAthlete();
    const res = await app.inject({ method: "POST", url: "/me/plan", headers, payload: { macroId: "ruso-5d", rms: RMS } });
    expect(res.statusCode).toBe(400);
  });
});
