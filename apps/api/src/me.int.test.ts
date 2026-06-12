import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "./server";
import { prisma } from "./db/client";

type InjectRes = { cookies: Array<{ name: string; value: string }>; statusCode: number };
function sessionHeader(res: InjectRes): { cookie: string } {
  const c = res.cookies.find((x) => x.name === "session");
  if (!c) throw new Error("no session cookie was set");
  return { cookie: `session=${c.value}` };
}

describe("API integration — athlete self (/me/*)", () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = buildServer();
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.dayLog.deleteMany({ where: { athleteId: "demo-atleta" } });
  });

  async function loginDemoAthlete(): Promise<{ cookie: string }> {
    const res = await app.inject({
      method: "POST", url: "/auth/login",
      payload: { email: "atleta@holyoly.dev", password: "holyoly-demo" },
    });
    expect(res.statusCode).toBe(200);
    return sessionHeader(res);
  }

  it("rejects unauthenticated /me/daylog with 401", async () => {
    const res = await app.inject({ method: "GET", url: "/me/daylog" });
    expect(res.statusCode).toBe(401);
  });

  it("a coach session cannot use the athlete surface (no athleteId → 401)", async () => {
    const login = await app.inject({ method: "POST", url: "/auth/login", payload: { email: "coach@holyoly.dev", password: "holyoly-demo" } });
    const res = await app.inject({ method: "GET", url: "/me/daylog", headers: sessionHeader(login) });
    expect(res.statusCode).toBe(401);
  });

  it("GET /me/plan → plan: null for an unassigned athlete (honest, no fake plan)", async () => {
    const headers = await loginDemoAthlete();
    const res = await app.inject({ method: "GET", url: "/me/plan", headers });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { athlete: { nombre: string }; plan: unknown };
    expect(body.athlete.nombre).toBe("Demo Atleta");
    expect(body.plan).toBeNull();
  });

  it("GET /me/series → 404 for an athlete with no series (sin-dato honesto)", async () => {
    const headers = await loginDemoAthlete();
    const res = await app.inject({ method: "GET", url: "/me/series", headers });
    expect(res.statusCode).toBe(404);
  });

  it("daylog round-trip: empty → PUT → streak 1, entry present", async () => {
    const headers = await loginDemoAthlete();

    const empty = await app.inject({ method: "GET", url: "/me/daylog", headers });
    expect(empty.statusCode).toBe(200);
    const emptyBody = empty.json() as { entry: unknown; streak: number; days: string[]; today: string };
    expect(emptyBody.entry).toBeNull();
    expect(emptyBody.streak).toBe(0);
    expect(typeof emptyBody.today).toBe("string");

    const put = await app.inject({
      method: "PUT", url: "/me/daylog", headers,
      payload: { fatiga: 2, dolor: 1, estres: 3, humor: 4, motivacion: 5, sueno: 4, weight: 80.8 },
    });
    expect(put.statusCode).toBe(200);
    const putBody = put.json() as { entry: { fatiga: number; weight?: number }; streak: number };
    expect(putBody.entry.fatiga).toBe(2);
    expect(putBody.entry.weight).toBe(80.8);
    expect(putBody.streak).toBe(1);

    const after = await app.inject({ method: "GET", url: "/me/daylog", headers });
    const afterBody = after.json() as { entry: { fatiga: number } | null; streak: number; days: string[] };
    expect(afterBody.entry?.fatiga).toBe(2);
    expect(afterBody.streak).toBe(1);
    expect(afterBody.days.length).toBe(1);
  });

  it("PUT is an upsert (re-submitting the same day overwrites, not duplicates)", async () => {
    const headers = await loginDemoAthlete();
    await app.inject({ method: "PUT", url: "/me/daylog", headers, payload: { fatiga: 5, dolor: 5, estres: 5, humor: 1, motivacion: 1, sueno: 1 } });
    const res = await app.inject({ method: "GET", url: "/me/daylog", headers });
    const body = res.json() as { entry: { fatiga: number; weight?: number }; days: string[] };
    expect(body.entry.fatiga).toBe(5);
    expect(body.entry.weight).toBeUndefined(); // weight omitted on the second PUT
    expect(body.days.length).toBe(1); // still one row for today
  });

  it("rejects an out-of-range daylog with 400", async () => {
    const headers = await loginDemoAthlete();
    const res = await app.inject({ method: "PUT", url: "/me/daylog", headers, payload: { fatiga: 9, dolor: 1, estres: 3, humor: 4, motivacion: 5, sueno: 4 } });
    expect(res.statusCode).toBe(400);
  });

  it("rejects a malformed ?date= with 400", async () => {
    const headers = await loginDemoAthlete();
    const res = await app.inject({ method: "GET", url: "/me/daylog?date=not-a-date", headers });
    expect(res.statusCode).toBe(400);
  });

  // ── Recorrido (slice recorrido-ciclos): GET /me/recorrido ──────────────────
  it("GET /me/recorrido → 401 sin sesión y 401 con sesión de coach (superficie del atleta)", async () => {
    expect((await app.inject({ method: "GET", url: "/me/recorrido" })).statusCode).toBe(401);
    const coach = await app.inject({ method: "POST", url: "/auth/login", payload: { email: "coach@holyoly.dev", password: "holyoly-demo" } });
    expect((await app.inject({ method: "GET", url: "/me/recorrido", headers: sessionHeader(coach) })).statusCode).toBe(401);
  });

  it("GET /me/recorrido → { semanas: [] } para un atleta sin plan (honesto)", async () => {
    const headers = await loginDemoAthlete();
    const res = await app.inject({ method: "GET", url: "/me/recorrido", headers });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ semanas: [] });
  });

  it("atleta con actuals en 2 semanas → recorrido correcto por semana (trabajo + calentamiento de lo hecho)", async () => {
    const RMS = { arranque: 80, envion: 100, sentadilla: 140, frente: 110 };
    const coachLogin = await app.inject({ method: "POST", url: "/auth/login", payload: { email: "coach@holyoly.dev", password: "holyoly-demo" } });
    const coach = sessionHeader(coachLogin);
    // Plan fresco para mv (re-instancia la receta) + actuals/registros limpios → test determinista
    // aunque otros archivos int hayan registrado sesiones de mv antes.
    expect((await app.inject({ method: "PUT", url: "/athletes/mv/plan", headers: coach,
      payload: { atletaId: "mv", macroId: "ruso-5d", startWeek: 1, startDate: "2026-04-01", rms: RMS, comps: [] } })).statusCode).toBe(200);
    await prisma.sessionActual.deleteMany({ where: { athleteId: "mv" } });
    await prisma.sessionRegistro.deleteMany({ where: { athleteId: "mv" } });

    const maraLogin = await app.inject({ method: "POST", url: "/auth/login", payload: { email: "mara@holyoly.dev", password: "holyoly-demo" } });
    const athlete = sessionHeader(maraLogin);
    const AYER = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    // Semana 1: 2 series hechas de 60×2 → trabajo 240 kg (+ rampa prescrita del ejercicio hecho).
    expect((await app.inject({ method: "PUT", url: "/me/session/1/0", headers: athlete,
      payload: { actuals: [{ order: 0, movementId: "arranque", done: true, sets: [{ kg: 60, reps: 2, done: true }, { kg: 60, reps: 2, done: true }] }] } })).statusCode).toBe(200);
    // Semana 2: 1 serie hecha de 80×2 → trabajo 160 kg. Fecha explícita ≠ hoy: la regla 1×fecha
    // (spec 2026-06-12 D1) ya no permite dos sesiones distintas el mismo día.
    expect((await app.inject({ method: "PUT", url: "/me/session/2/0", headers: athlete,
      payload: { fecha: AYER, actuals: [{ order: 0, movementId: "arranque", done: true, sets: [{ kg: 80, reps: 2, done: true }] }] } })).statusCode).toBe(200);

    const res = await app.inject({ method: "GET", url: "/me/recorrido", headers: athlete });
    expect(res.statusCode).toBe(200);
    const { semanas } = res.json() as { semanas: Array<{ week: number; trabajoKg: number; calentamientoKg: number; sesionesHechas: number; sesionesTotales: number }> };
    expect(semanas.length).toBe(16); // ruso-5d: TODAS las semanas del macro, con o sin registro
    const [w1, w2, w3] = [semanas[0]!, semanas[1]!, semanas[2]!];
    expect(w1).toMatchObject({ week: 1, trabajoKg: 240, sesionesHechas: 1 });
    expect(w1.calentamientoKg).toBeGreaterThan(0); // la rampa del ejercicio hecho cuenta (regla 06-11)
    expect(w1.sesionesTotales).toBeGreaterThan(1);
    expect(w2).toMatchObject({ week: 2, trabajoKg: 160, sesionesHechas: 1 });
    expect(w3).toMatchObject({ week: 3, trabajoKg: 0, calentamientoKg: 0, sesionesHechas: 0 });
    // HR-1: el payload del atleta no filtra RM/RPE/ACWR — claves EXACTAS, nada más viaja.
    expect(Object.keys(w1).sort()).toEqual(["calentamientoKg", "sesionesHechas", "sesionesTotales", "trabajoKg", "week"]);
    expect(res.body).not.toMatch(/rpe/i);
    expect(res.body).not.toMatch(/"rms"/);
    expect(res.body).not.toMatch(/acwr/i);
  });
});
