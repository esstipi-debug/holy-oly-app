import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "./server";
import { prisma } from "./db/client";

type InjectRes = { cookies: Array<{ name: string; value: string }>; statusCode: number };
function sessionHeader(res: InjectRes): { cookie: string } {
  const c = res.cookies.find((x) => x.name === "session");
  if (!c) throw new Error("no session cookie");
  return { cookie: `session=${c.value}` };
}
const RMS = { arranque: 80, envion: 100, sentadilla: 140, frente: 110 };

// EngineWeek crudo (coach-only): pct/zonas/audits presentes; jamás RPE.
type EngineSet = { sets: number; reps: number; pct: number; weightKg: number; zone: string };
type EngineWeek = {
  phase: string; label: string; rationale: string; sets: EngineSet[];
  audits: Array<{ zone: string; withinRange: boolean }>;
  taper: { final: number }; inputs: { acwr: number | null; readiness: string | null };
  heavySinglesAdvisory: boolean;
};

describe("API integration — preview Prilepin (cableado coach-only)", () => {
  let app: FastifyInstance;
  beforeAll(async () => { app = buildServer(); await app.ready(); });
  afterAll(async () => { await app.close(); await prisma.$disconnect(); });

  async function coach(): Promise<{ cookie: string }> {
    const res = await app.inject({ method: "POST", url: "/auth/login", payload: { email: "coach@holyoly.dev", password: "holyoly-demo" } });
    expect(res.statusCode).toBe(200);
    return sessionHeader(res);
  }
  /** Asigna Ruso 5D a mv con una COMPETENCIA en la semana 12 (vía PUT comps) para anclar el countdown. */
  async function assignWithComp(headers: { cookie: string }) {
    const plan = await app.inject({ method: "PUT", url: "/athletes/mv/plan", headers,
      payload: { atletaId: "mv", macroId: "ruso-5d", startWeek: 1, startDate: "2026-04-06", rms: RMS, comps: [] } });
    expect(plan.statusCode).toBe(200);
    // La compe en la semana 12 del macro → countdownWeeks 12, la compe es la última semana.
    const comps = await app.inject({ method: "PUT", url: "/athletes/mv/comps", headers,
      payload: [{ name: "Nacional", week: 12, date: "2026-06-22" }] });
    expect(comps.statusCode).toBe(200);
  }

  it("vinculado con RMs: la semana de la compe (12) es comp_week con sets de % y kg, sin RPE", async () => {
    const headers = await coach();
    await assignWithComp(headers);
    const res = await app.inject({ method: "GET", url: "/athletes/mv/prilepin-week?week=12&lift=arranque", headers });
    expect(res.statusCode).toBe(200);
    const week = res.json() as EngineWeek;
    expect(week).not.toBeNull();
    expect(week.phase).toBe("comp_week");
    expect(week.label).toBe("Semana de competencia");
    expect(week.sets.length).toBeGreaterThan(0);
    // El coach SÍ ve pct/zonas; ningún set supera el tope prescribible 95%.
    for (const s of week.sets) {
      expect(s.pct).toBeLessThanOrEqual(95);
      expect(s.weightKg).toBeGreaterThan(0);
    }
    // HR-1 coach-facing: audits presentes. Y jamás RPE en el shape.
    expect(week.audits.length).toBeGreaterThan(0);
    expect(JSON.stringify(week).toLowerCase()).not.toContain("rpe");
  });

  it("una semana temprana del countdown largo es accumulation", async () => {
    const headers = await coach();
    await assignWithComp(headers);
    const res = await app.inject({ method: "GET", url: "/athletes/mv/prilepin-week?week=1&lift=envion", headers });
    expect(res.statusCode).toBe(200);
    expect((res.json() as EngineWeek).phase).toBe("accumulation");
  });

  it("requiere week y lift válidos (400 sin ellos)", async () => {
    const headers = await coach();
    await assignWithComp(headers);
    expect((await app.inject({ method: "GET", url: "/athletes/mv/prilepin-week?lift=arranque", headers })).statusCode).toBe(400);
    expect((await app.inject({ method: "GET", url: "/athletes/mv/prilepin-week?week=1", headers })).statusCode).toBe(400);
    expect((await app.inject({ method: "GET", url: "/athletes/mv/prilepin-week?week=1&lift=pull", headers })).statusCode).toBe(400);
  });

  it("coach-only: atleta → 401, coach sin Vínculo → 403", async () => {
    const aLogin = await app.inject({ method: "POST", url: "/auth/login", payload: { email: "atleta@holyoly.dev", password: "holyoly-demo" } });
    expect((await app.inject({ method: "GET", url: "/athletes/mv/prilepin-week?week=1&lift=arranque", headers: sessionHeader(aLogin) })).statusCode).toBe(401);
    const c2 = await app.inject({ method: "POST", url: "/auth/signup", payload: { email: `c2-pw-${Date.now()}@x.dev`, password: "another-pass-1", role: "coach", name: "C2", acceptTerms: true } });
    expect((await app.inject({ method: "GET", url: "/athletes/mv/prilepin-week?week=1&lift=arranque", headers: sessionHeader(c2) })).statusCode).toBe(403);
  });
});
