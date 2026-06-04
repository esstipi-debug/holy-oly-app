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
const RMS = { arranque: 80, envion: 100, sentadilla: 140, frente: 110 };

describe("API integration — actuals (SP3)", () => {
  let app: FastifyInstance;
  beforeAll(async () => { app = buildServer(); await app.ready(); });
  afterAll(async () => { await app.close(); await prisma.$disconnect(); });

  const login = (email: string) => app.inject({ method: "POST", url: "/auth/login", payload: { email, password: "holyoly-demo" } });

  it("athlete records actuals; GET /me/sessions echoes them; coach sees prescribed-vs-real", async () => {
    const coach = sess(await login("coach@holyoly.dev"));
    // ensure mv has the Ruso 5D plan (instantiates the prescription)
    expect((await app.inject({ method: "PUT", url: "/athletes/mv/plan", headers: coach,
      payload: { atletaId: "mv", macroId: "ruso-5d", startWeek: 1, startDate: "2026-04-01", rms: RMS, comps: [] } })).statusCode).toBe(200);

    const athlete = sess(await login("mara@holyoly.dev")); // seeded login → athleteId mv
    const put = await app.inject({ method: "PUT", url: "/me/session/1/0", headers: athlete,
      payload: [{ order: 0, movementId: "arranque", done: true, kg: 58, reps: 3, rpe: 8 }] });
    expect(put.statusCode).toBe(200);

    const mine = await app.inject({ method: "GET", url: "/me/sessions?week=1", headers: athlete });
    expect(mine.statusCode).toBe(200);
    const s0 = (mine.json() as Array<{ sessionIdx: number; exercises: Array<{ actual?: { kg?: number } }> }>).find((s) => s.sessionIdx === 0)!;
    expect(s0.exercises[0]!.actual?.kg).toBe(58);

    const coachView = await app.inject({ method: "GET", url: "/athletes/mv/prescription?week=1", headers: coach });
    const cs0 = (coachView.json() as Array<{ sessionIdx: number; exercises: Array<{ targetKg?: number; actual?: { kg?: number } }> }>).find((s) => s.sessionIdx === 0)!;
    expect(cs0.exercises[0]!.actual?.kg).toBe(58); // coach sees the real next to target
  });

  it("PUT [] clears a session's actuals (replace, no duplicate)", async () => {
    const coach = sess(await login("coach@holyoly.dev"));
    await app.inject({ method: "PUT", url: "/athletes/mv/plan", headers: coach,
      payload: { atletaId: "mv", macroId: "ruso-5d", startWeek: 1, startDate: "2026-04-01", rms: RMS, comps: [] } });
    const athlete = sess(await login("mara@holyoly.dev"));
    await app.inject({ method: "PUT", url: "/me/session/1/0", headers: athlete, payload: [{ order: 0, movementId: "arranque", done: true, kg: 60 }] });
    // clear it
    const cleared = await app.inject({ method: "PUT", url: "/me/session/1/0", headers: athlete, payload: [] });
    expect(cleared.statusCode).toBe(200);
    const mine = await app.inject({ method: "GET", url: "/me/sessions?week=1", headers: athlete });
    const s0 = (mine.json() as Array<{ sessionIdx: number; exercises: Array<{ actual?: unknown }> }>).find((s) => s.sessionIdx === 0)!;
    expect(s0.exercises.every((e) => e.actual === undefined)).toBe(true);
  });

  it("athlete substitutes a movement in-session; coach sees it as substituted (real movement + kg, no false deviation)", async () => {
    // This test REQUIRES B3 (persist + return prescribedMovementId).
    // Setup: prescription has order=0 = "sentadilla".
    // Athlete does: movementId="sentadilla", prescribedMovementId="arranque" (athlete overrides the
    //   prescribed column to say "I was meant to do arranque but did sentadilla").
    // WITHOUT B3: prescribedMovementId is not stored; server fallback = e.movementId = "sentadilla";
    //   substituted = ("sentadilla" !== "sentadilla") = false → assertion fails.
    // WITH B3: prescribedMovementId="arranque" is stored; server returns it;
    //   substituted = ("sentadilla" !== "arranque") = true → assertion passes.
    const coach = sess(await login("coach@holyoly.dev"));
    await app.inject({ method: "PUT", url: "/athletes/mv/plan", headers: coach, payload: { atletaId: "mv", macroId: "ruso-5d", startWeek: 1, startDate: "2026-04-01", rms: RMS, comps: [] } });
    // Override prescription order=0 to "sentadilla"
    await app.inject({ method: "PUT", url: "/athletes/mv/prescription/1/0", headers: coach,
      payload: [{ movementId: "sentadilla", sets: 5, reps: 3 }] });
    const athlete = sess(await login("mara@holyoly.dev"));
    // Athlete did "sentadilla" at order=0, but prescribedMovementId = "arranque" (the original intent
    //   before the coach edited — or the athlete's own annotation that they substituted)
    await app.inject({ method: "PUT", url: "/me/session/1/0", headers: athlete,
      payload: [{ order: 0, movementId: "sentadilla", prescribedMovementId: "arranque", done: true, kg: 50 }] });
    const coachView = await app.inject({ method: "GET", url: "/athletes/mv/prescription?week=1", headers: coach });
    const s0 = (coachView.json() as Array<{ sessionIdx: number; exercises: Array<{ movementId: string; actual?: { substituted: boolean; movementId: string; movementName: string; kg?: number } }> }>).find((s) => s.sessionIdx === 0)!;
    expect(s0.exercises[0]!.actual?.substituted).toBe(true);
    expect(s0.exercises[0]!.actual?.movementId).toBe("sentadilla");
    expect(s0.exercises[0]!.actual?.kg).toBe(50);
  });

  it("requires week on GET, validates the body, and is athlete-self (coach → 401 on /me)", async () => {
    const athlete = sess(await login("mara@holyoly.dev"));
    expect((await app.inject({ method: "GET", url: "/me/sessions", headers: athlete })).statusCode).toBe(400);
    expect((await app.inject({ method: "PUT", url: "/me/session/1/0", headers: athlete, payload: [{ order: 0, movementId: "x", done: true, kg: 999 }] })).statusCode).toBe(400);
    const coach = sess(await login("coach@holyoly.dev"));
    expect((await app.inject({ method: "GET", url: "/me/sessions?week=1", headers: coach })).statusCode).toBe(401);
  });
});
