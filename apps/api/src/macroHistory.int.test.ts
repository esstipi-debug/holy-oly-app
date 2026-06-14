import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "./server";
import { prisma } from "./db/client";

type InjectRes = { cookies: Array<{ name: string; value: string }>; statusCode: number };
function sess(res: InjectRes): { cookie: string } {
  const c = res.cookies.find((x) => x.name === "session");
  if (!c) throw new Error("no session cookie");
  return { cookie: `session=${c.value}` };
}

interface Entry { macroId: string; macroName: string; ordinal: number; adherencePct: number; sessionsDone: number; sessionsTotal: number; rmEnd?: Record<string, number> }
interface View { entries: Entry[]; cyclesDone: number; avgAdherencePct: number }
interface Atleta { id: string; needsRm?: boolean }

describe("API integration — macro-history + needsRm (slice macro-history)", () => {
  let app: FastifyInstance;
  beforeAll(async () => { app = buildServer(); await app.ready(); });
  afterAll(async () => { await app.close(); await prisma.$disconnect(); });

  const login = async (email: string) => {
    const res = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password: "holyoly-demo" } });
    expect(res.statusCode).toBe(200);
    return sess(res);
  };

  const seedHistory = async (athleteId: string) => {
    await prisma.macroHistory.deleteMany({ where: { athleteId } });
    await prisma.macroHistory.createMany({
      data: [
        { athleteId, macroId: "ruso-5d", ordinal: 1, startDate: "2025-01-06", endDate: "2025-04-27", weeks: 16, sessionsDone: 56, sessionsTotal: 80, rmEnd: { arranque: 70, envion: 90, sentadilla: 120, frente: 96 } },
        { athleteId, macroId: "ruso-5d", ordinal: 2, startDate: "2025-05-12", endDate: "2025-08-31", weeks: 16, sessionsDone: 76, sessionsTotal: 80, rmEnd: { arranque: 78, envion: 98, sentadilla: 130, frente: 105 } },
      ],
    });
  };

  it("coach reads macro-history newest-first with derived adherence + aggregates", async () => {
    const coach = await login("coach@holyoly.dev");
    await seedHistory("mv");

    const res = await app.inject({ method: "GET", url: "/athletes/mv/macro-history", headers: coach });
    expect(res.statusCode).toBe(200);
    const view = res.json() as View;
    expect(view.entries.map((e) => e.ordinal)).toEqual([2, 1]);   // newest first
    expect(view.entries[0]!.adherencePct).toBe(95);               // 76/80
    expect(view.entries[1]!.adherencePct).toBe(70);               // 56/80
    expect(view.entries[0]!.macroName).not.toBe("ruso-5d");       // resolved display name
    expect(view.entries[0]!.rmEnd?.sentadilla).toBe(130);
    expect(view.cyclesDone).toBe(2);
    expect(view.avgAdherencePct).toBe(83);                        // round((95+70)/2)
  });

  it("athlete reads OWN macro-history at /me/macro-history", async () => {
    await seedHistory("mv");
    const mara = await login("mara@holyoly.dev");
    const res = await app.inject({ method: "GET", url: "/me/macro-history", headers: mara });
    expect(res.statusCode).toBe(200);
    expect((res.json() as View).cyclesDone).toBe(2);
  });

  it("empty history → 0 cycles, 0 average (honest, never invented)", async () => {
    const coach = await login("coach@holyoly.dev");
    await prisma.macroHistory.deleteMany({ where: { athleteId: "lr" } });
    const view = (await app.inject({ method: "GET", url: "/athletes/lr/macro-history", headers: coach })).json() as View;
    expect(view).toEqual({ entries: [], cyclesDone: 0, avgAdherencePct: 0 });
  });

  it("roster flags needsRm: an athlete without RM is true, one with a full plan is false", async () => {
    const coach = await login("coach@holyoly.dev");
    // ds is a coach1 athlete the base seed leaves planless → needs RM.
    await prisma.plan.deleteMany({ where: { athleteId: "ds" } });
    // mv gets a full plan → has RM.
    await app.inject({ method: "PUT", url: "/athletes/mv/plan", headers: coach,
      payload: { atletaId: "mv", macroId: "ruso-5d", startWeek: 1, startDate: "2026-03-29", rms: { arranque: 78, envion: 98, sentadilla: 130, frente: 105 }, comps: [] } });

    const roster = (await app.inject({ method: "GET", url: "/roster", headers: coach })).json() as Atleta[];
    expect(roster.find((a) => a.id === "ds")?.needsRm).toBe(true);
    expect(roster.find((a) => a.id === "mv")?.needsRm).toBe(false);
  });

  it("authz: no session 401; athlete on coach route 401; coach without Vínculo 403", async () => {
    expect((await app.inject({ method: "GET", url: "/athletes/mv/macro-history" })).statusCode).toBe(401);

    const mara = await login("mara@holyoly.dev");
    expect((await app.inject({ method: "GET", url: "/athletes/mv/macro-history", headers: mara })).statusCode).toBe(401);

    const c2 = await app.inject({ method: "POST", url: "/auth/signup",
      payload: { email: `c2-mh-${Date.now()}@x.dev`, password: "another-pass-1", role: "coach", name: "C2", acceptTerms: true } });
    expect((await app.inject({ method: "GET", url: "/athletes/mv/macro-history", headers: sess(c2) })).statusCode).toBe(403);
  });
});
