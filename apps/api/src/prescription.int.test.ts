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

describe("API integration — prescription (SP2)", () => {
  let app: FastifyInstance;
  beforeAll(async () => { app = buildServer(); await app.ready(); });
  afterAll(async () => { await app.close(); await prisma.$disconnect(); });

  async function coach(): Promise<{ cookie: string }> {
    const res = await app.inject({ method: "POST", url: "/auth/login", payload: { email: "coach@holyoly.dev", password: "holyoly-demo" } });
    expect(res.statusCode).toBe(200);
    return sessionHeader(res);
  }
  async function assignRuso(headers: { cookie: string }) {
    return app.inject({ method: "PUT", url: "/athletes/mv/plan", headers,
      payload: { atletaId: "mv", macroId: "ruso-5d", startWeek: 1, startDate: "2026-04-01", rms: RMS, comps: [] } });
  }

  it("assigning Ruso 5D instantiates the prescription; week 1 has the recipe's sessions with derived kg", async () => {
    const headers = await coach();
    expect((await assignRuso(headers)).statusCode).toBe(200);
    const res = await app.inject({ method: "GET", url: "/athletes/mv/prescription?week=1", headers });
    expect(res.statusCode).toBe(200);
    const sessions = res.json() as Array<{ sessionIdx: number; exercises: Array<{ movementId: string; targetKg?: number }> }>;
    expect(sessions.length).toBe(5); // 5 días/sem in the hipertrofia phase
    const s0 = sessions.find((s) => s.sessionIdx === 0)!;
    expect(s0.exercises[0]!.movementId).toBe("arranque");
    expect(s0.exercises[0]!.targetKg).toBe(54); // 68% of 80 = 54.4 → 54
  });

  it("the coach can edit a session (PUT replaces it)", async () => {
    const headers = await coach();
    await assignRuso(headers);
    const put = await app.inject({ method: "PUT", url: "/athletes/mv/prescription/1/0", headers,
      payload: [{ movementId: "arranque.potencia", sets: 4, reps: 2, pct: 65 }] });
    expect(put.statusCode).toBe(200);
    const res = await app.inject({ method: "GET", url: "/athletes/mv/prescription?week=1", headers });
    const s0 = (res.json() as Array<{ sessionIdx: number; exercises: Array<{ movementId: string }> }>).find((s) => s.sessionIdx === 0)!;
    expect(s0.exercises).toHaveLength(1);
    expect(s0.exercises[0]!.movementId).toBe("arranque.potencia");
  });

  it("requires week, validates the body, and is coach-only (athlete 401, no-Vínculo coach 403)", async () => {
    const headers = await coach();
    expect((await app.inject({ method: "GET", url: "/athletes/mv/prescription", headers })).statusCode).toBe(400);
    expect((await app.inject({ method: "PUT", url: "/athletes/mv/prescription/1/0", headers, payload: [{ movementId: "arranque", sets: 0, reps: 2 }] })).statusCode).toBe(400);
    // athlete session → 401 (no coachId)
    const aLogin = await app.inject({ method: "POST", url: "/auth/login", payload: { email: "atleta@holyoly.dev", password: "holyoly-demo" } });
    expect((await app.inject({ method: "GET", url: "/athletes/mv/prescription?week=1", headers: sessionHeader(aLogin) })).statusCode).toBe(401);
    // a second coach with no Vínculo to mv → 403
    const c2 = await app.inject({ method: "POST", url: "/auth/signup", payload: { email: `c2-${Date.now()}@x.dev`, password: "another-pass-1", role: "coach", name: "C2" } });
    expect((await app.inject({ method: "GET", url: "/athletes/mv/prescription?week=1", headers: sessionHeader(c2) })).statusCode).toBe(403);
  });
});
