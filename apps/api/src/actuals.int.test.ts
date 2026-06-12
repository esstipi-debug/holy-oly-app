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
  beforeAll(async () => {
    app = buildServer();
    await app.ready();
    // Regla 1×fecha (spec 2026-06-12): otro archivo int pudo dejar OTRA sesión de mv registrada
    // HOY → el primer PUT sin fecha de este archivo daría 409. Estado limpio = determinista.
    await prisma.sessionRegistro.deleteMany({ where: { athleteId: "mv" } });
  });
  afterAll(async () => { await app.close(); await prisma.$disconnect(); });

  const login = (email: string) => app.inject({ method: "POST", url: "/auth/login", payload: { email, password: "holyoly-demo" } });

  it("rejects an athlete actuals body with an unsafe movementId → 400 (D7)", async () => {
    const athlete = sess(await login("mara@holyoly.dev"));
    const res = await app.inject({ method: "PUT", url: "/me/session/1/0", headers: athlete,
      payload: { actuals: [{ order: 0, movementId: "<script>alert(1)</script>", done: true }] } });
    expect(res.statusCode).toBe(400);
  });

  it("athlete records actuals; GET /me/sessions echoes them; coach sees prescribed-vs-real", async () => {
    const coach = sess(await login("coach@holyoly.dev"));
    // ensure mv has the Ruso 5D plan (instantiates the prescription)
    expect((await app.inject({ method: "PUT", url: "/athletes/mv/plan", headers: coach,
      payload: { atletaId: "mv", macroId: "ruso-5d", startWeek: 1, startDate: "2026-04-01", rms: RMS, comps: [] } })).statusCode).toBe(200);

    const athlete = sess(await login("mara@holyoly.dev")); // seeded login → athleteId mv
    const put = await app.inject({ method: "PUT", url: "/me/session/1/0", headers: athlete,
      payload: { actuals: [{ order: 0, movementId: "arranque", done: true, kg: 58, reps: 3 }] } });
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
    await app.inject({ method: "PUT", url: "/me/session/1/0", headers: athlete, payload: { actuals: [{ order: 0, movementId: "arranque", done: true, kg: 60 }] } });
    // clear it
    const cleared = await app.inject({ method: "PUT", url: "/me/session/1/0", headers: athlete, payload: { actuals: [] } });
    expect(cleared.statusCode).toBe(200);
    const mine = await app.inject({ method: "GET", url: "/me/sessions?week=1", headers: athlete });
    const s0 = (mine.json() as Array<{ sessionIdx: number; exercises: Array<{ actual?: unknown }> }>).find((s) => s.sessionIdx === 0)!;
    expect(s0.exercises.every((e) => e.actual === undefined)).toBe(true);
  });

  it("athlete substitutes a movement in-session; coach sees it as substituted (real movement + kg, no false deviation)", async () => {
    // This test is the RED/GREEN gate for B3 (persist + return prescribedMovementId).
    //
    // Scenario:
    //   1. Coach assigns plan → coach edits slot order=0 to "sentadilla".
    //   2. Athlete records: movementId="sentadilla", prescribedMovementId="arranque"
    //      (athlete annotates the original intent before the coach's edit, i.e. they know
    //      the macro default was "arranque" and that the slot was changed — or they simply
    //      note they substituted).  Both `substituted` AND `desfasado` apply here.
    //   3. Coach view: substituted=true (slot movement "sentadilla" ≠ prescribedMovementId "arranque"),
    //      no false kg-deviation (kg=50 is stored as-is, no target to deviate from).
    //
    // WITHOUT B3: prescribedMovementId not stored → server fallback = actual.movementId = "sentadilla"
    //   → substituted = ("sentadilla" !== "sentadilla") = false → assertion FAILS.
    // WITH B3: prescribedMovementId="arranque" stored + returned
    //   → substituted = ("sentadilla" !== "arranque") = true → assertion PASSES.
    const coach = sess(await login("coach@holyoly.dev"));
    // Precondition 1: assign plan so the prescription row exists.
    expect((await app.inject({ method: "PUT", url: "/athletes/mv/plan", headers: coach,
      payload: { atletaId: "mv", macroId: "ruso-5d", startWeek: 1, startDate: "2026-04-01", rms: RMS, comps: [] } })).statusCode).toBe(200);
    // Precondition 2 (critical gate): override slot order=0 week=1 idx=0 to "sentadilla".
    // If this fails silently the slot stays "arranque" == movementId "arranque" → substituted=false
    // and the test would pass WITHOUT B3 (false negative).
    expect((await app.inject({ method: "PUT", url: "/athletes/mv/prescription/1/0", headers: coach,
      payload: [{ movementId: "sentadilla", sets: 5, reps: 3 }] })).statusCode).toBe(200);
    const athlete = sess(await login("mara@holyoly.dev"));
    // Athlete records: did "sentadilla" but prescribedMovementId="arranque" (the original macro intent).
    expect((await app.inject({ method: "PUT", url: "/me/session/1/0", headers: athlete,
      payload: { actuals: [{ order: 0, movementId: "sentadilla", prescribedMovementId: "arranque", done: true, kg: 50 }] } })).statusCode).toBe(200);
    const coachView = await app.inject({ method: "GET", url: "/athletes/mv/prescription?week=1", headers: coach });
    const s0 = (coachView.json() as Array<{ sessionIdx: number; exercises: Array<{ movementId: string; actual?: { substituted: boolean; movementId: string; movementName: string; kg?: number } }> }>).find((s) => s.sessionIdx === 0)!;
    expect(s0.exercises[0]!.actual?.substituted).toBe(true);
    expect(s0.exercises[0]!.actual?.movementId).toBe("sentadilla");
    expect(s0.exercises[0]!.actual?.kg).toBe(50);
  });

  it("requires week on GET, validates the body, and is athlete-self (coach → 401 on /me)", async () => {
    const athlete = sess(await login("mara@holyoly.dev"));
    expect((await app.inject({ method: "GET", url: "/me/sessions", headers: athlete })).statusCode).toBe(400);
    expect((await app.inject({ method: "PUT", url: "/me/session/1/0", headers: athlete, payload: { actuals: [{ order: 0, movementId: "x", done: true, kg: 999 }] } })).statusCode).toBe(400);
    const coach = sess(await login("coach@holyoly.dev"));
    expect((await app.inject({ method: "GET", url: "/me/sessions?week=1", headers: coach })).statusCode).toBe(401);
  });

  it("registra series (sets): resumen=top set, GET devuelve las series, warmup presente en la vista", async () => {
    const coach = sess(await login("coach@holyoly.dev"));
    expect((await app.inject({ method: "PUT", url: "/athletes/mv/plan", headers: coach,
      payload: { atletaId: "mv", macroId: "ruso-5d", startWeek: 1, startDate: "2026-04-01", rms: RMS, comps: [] } })).statusCode).toBe(200);
    const athlete = sess(await login("mara@holyoly.dev"));
    const put = await app.inject({ method: "PUT", url: "/me/session/1/0", headers: athlete,
      payload: { actuals: [{ order: 0, movementId: "arranque", done: true, sets: [
        { kg: 64, reps: 2, done: true }, { kg: 64, reps: 2, done: true }, { kg: 60, reps: 2, done: true },
      ] }] } });
    expect(put.statusCode).toBe(200);

    const mine = await app.inject({ method: "GET", url: "/me/sessions?week=1", headers: athlete });
    const s0 = (mine.json() as Array<{ sessionIdx: number; exercises: Array<{ warmup?: unknown[]; actual?: { kg?: number; sets?: unknown[] } }> }>).find((s) => s.sessionIdx === 0)!;
    expect(s0.exercises[0]!.actual?.kg).toBe(64);          // top set
    expect(s0.exercises[0]!.actual?.sets).toHaveLength(3); // series devueltas
    expect(Array.isArray(s0.exercises[0]!.warmup)).toBe(true); // la vista trae el calentamiento
  });

  it("registra series SIN kg (sustitución/degrade): round-trip honesto, resumen done sin kg (jamás un 0 falso)", async () => {
    const coach = sess(await login("coach@holyoly.dev"));
    expect((await app.inject({ method: "PUT", url: "/athletes/mv/plan", headers: coach,
      payload: { atletaId: "mv", macroId: "ruso-5d", startWeek: 1, startDate: "2026-04-01", rms: RMS, comps: [] } })).statusCode).toBe(200);
    const athlete = sess(await login("mara@holyoly.dev"));
    // El atleta hizo las series pero sin registrar kg (p.ej. tras sustituir un movimiento → kg limpio).
    const put = await app.inject({ method: "PUT", url: "/me/session/1/0", headers: athlete,
      payload: { actuals: [{ order: 0, movementId: "arranque", done: true, sets: [
        { reps: 2, done: true }, { reps: 2, done: true },
      ] }] } });
    expect(put.statusCode).toBe(200);

    const mine = await app.inject({ method: "GET", url: "/me/sessions?week=1", headers: athlete });
    const s0 = (mine.json() as Array<{ sessionIdx: number; exercises: Array<{ actual?: { done: boolean; kg?: number; sets?: Array<{ kg?: number; done: boolean }> } }> }>).find((s) => s.sessionIdx === 0)!;
    const actual = s0.exercises[0]!.actual!;
    expect(actual.done).toBe(true);              // hechas
    expect(actual.kg).toBeUndefined();           // sin kg → resumen sin kg, nunca un 0 inventado
    expect(actual.sets).toHaveLength(2);
    expect(actual.sets![0]!.kg).toBeUndefined(); // la serie vuelve sin kg
  });
});
