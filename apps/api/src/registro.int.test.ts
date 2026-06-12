import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "./server";
import { prisma } from "./db/client";

// INTEGRATION — registro con fecha + regla 1×fecha (spec 2026-06-12 D1-D5, D9, D11-D13).
// Corre vía el orquestador db-verify (PG embebido, migrate deploy + seed).

type InjectRes = { cookies: Array<{ name: string; value: string }>; statusCode: number };
function sess(res: InjectRes): { cookie: string } {
  const c = res.cookies.find((x) => x.name === "session");
  if (!c) throw new Error("no session cookie");
  return { cookie: `session=${c.value}` };
}
const RMS = { arranque: 80, envion: 100, sentadilla: 140, frente: 110 };

// Ancladas a UN instante (no cuatro new Date() sueltos) — sin esto un run a las 23:59 UTC
// podía leer HOY un día corrido respecto al todayISO() del server.
const NOW = Date.now();
const iso = (offsetDays: number): string => new Date(NOW + offsetDays * 86_400_000).toISOString().slice(0, 10);
const HOY = iso(0);
const MANANA = iso(1);
const AYER = iso(-1);
const ANTEAYER = iso(-2);

describe("API integration — registro con fecha (regla 1×fecha + excepción AM/PM)", () => {
  let app: FastifyInstance;
  let athlete: { cookie: string }; // mara → mv (ruso-5d, mono-diario)
  let kevin: { cookie: string };   // kevin → kv (bulgaro-6d, bi-diario)
  let coach2: { cookie: string };  // kv es de coach2 (COACH2_ATHLETE_IDS)

  const login = async (email: string) => {
    const res = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password: "holyoly-demo" } });
    expect(res.statusCode).toBe(200);
    return sess(res);
  };

  beforeAll(async () => {
    app = buildServer();
    await app.ready();
    const coach = await login("coach@holyoly.dev");
    coach2 = await login("coach2@holyoly.dev");
    athlete = await login("mara@holyoly.dev");
    kevin = await login("kevin@holyoly.dev");
    // Plan fresco + estado limpio (patrón me.int): la regla 1×fecha haría chocar este archivo
    // con fechas heredadas de otros archivos int → determinista ante cualquier orden.
    expect((await app.inject({ method: "PUT", url: "/athletes/mv/plan", headers: coach,
      payload: { atletaId: "mv", macroId: "ruso-5d", startWeek: 1, startDate: "2026-04-01", rms: RMS, comps: [] } })).statusCode).toBe(200);
    expect((await app.inject({ method: "PUT", url: "/athletes/kv/plan", headers: coach2,
      payload: { atletaId: "kv", macroId: "bulgaro-6d", startWeek: 1, startDate: "2026-04-01", rms: RMS, comps: [] } })).statusCode).toBe(200);
    await prisma.sessionActual.deleteMany({ where: { athleteId: { in: ["mv", "kv"] } } });
    await prisma.sessionRegistro.deleteMany({ where: { athleteId: { in: ["mv", "kv"] } } });
  });
  afterAll(async () => { await app.close(); await prisma.$disconnect(); });

  const put = (week: number, idx: number, payload: object, headers?: { cookie: string }) =>
    app.inject({ method: "PUT", url: `/me/session/${week}/${idx}`, headers: headers ?? athlete, payload });
  const body = (fecha?: string) =>
    ({ ...(fecha ? { fecha } : {}), actuals: [{ order: 0, movementId: "arranque", done: true, kg: 60, reps: 2 }] });

  it("array pelado legacy → 400 (D4: envelope obligatorio, sin retrocompat)", async () => {
    const res = await put(1, 0, [{ order: 0, movementId: "arranque", done: true }]);
    expect(res.statusCode).toBe(400);
  });

  it("fecha futura → 400 (D2: backdating libre, futuro jamás)", async () => {
    expect((await put(1, 0, body(MANANA))).statusCode).toBe(400);
  });

  it("sin fecha → hoy; segunda sesión el mismo día → 409 con conflicto identificado (D1/D5)", async () => {
    expect((await put(1, 0, body())).statusCode).toBe(200);
    const res = await put(1, 1, body());
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: "fecha_ocupada", conflicto: { week: 1, sessionIdx: 0, fecha: HOY } });
  });

  it("edición de la misma sesión jamás conflictúa y conserva su fecha (D12)", async () => {
    expect((await put(1, 0, body())).statusCode).toBe(200);
    const mine = await app.inject({ method: "GET", url: "/me/sessions?week=1", headers: athlete });
    expect(mine.statusCode).toBe(200);
    const s0 = (mine.json() as Array<{ sessionIdx: number; fecha?: string }>).find((s) => s.sessionIdx === 0)!;
    expect(s0.fecha).toBe(HOY);
  });

  it("backdating libre: otra sesión con fecha de ayer → 200 y doneAt = fecha (D3)", async () => {
    expect((await put(1, 1, body(AYER))).statusCode).toBe(200);
    const mine = await app.inject({ method: "GET", url: "/me/sessions?week=1", headers: athlete });
    const s1 = (mine.json() as Array<{ sessionIdx: number; fecha?: string }>).find((s) => s.sessionIdx === 1)!;
    expect(s1.fecha).toBe(AYER);
    // Procedencia D13: doneAt estampado = fecha declarada, verificado en la FILA (lo que consume
    // pr-candidates) — la vista del atleta no transporta doneAt.
    const row = await prisma.sessionActual.findFirst({ where: { athleteId: "mv", week: 1, sessionIdx: 1, order: 0 } });
    expect(row?.doneAt).toBe(AYER);
  });

  it("actuals: [] libera la fecha (D11): otra sesión puede tomarla", async () => {
    expect((await put(1, 1, { actuals: [] })).statusCode).toBe(200);
    expect((await put(1, 2, body(AYER))).statusCode).toBe(200);
  });

  it("GET /me/sessions trae day (ruso-5d mono-diario: day = idx+1)", async () => {
    const mine = await app.inject({ method: "GET", url: "/me/sessions?week=1", headers: athlete });
    const views = mine.json() as Array<{ sessionIdx: number; day?: number }>;
    expect(views.length).toBeGreaterThan(0);
    for (const v of views) expect(v.day).toBe(v.sessionIdx + 1);
  });

  it("excepción AM/PM (D9, bulgaro-6d): turnos del MISMO día comparten fecha; otro día → 409", async () => {
    // Semana 1 Búlgaro: sesiones 0/1 = día 1 AM/PM; sesión 2 = día 2 (dayLayoutFor).
    expect((await put(1, 0, body(ANTEAYER), kevin)).statusCode).toBe(200);
    expect((await put(1, 1, body(ANTEAYER), kevin)).statusCode).toBe(200); // mismo día → permitido
    expect((await put(1, 2, body(ANTEAYER), kevin)).statusCode).toBe(409); // día 2, misma fecha → choca
  });

  it("coach view trae fecha/day/turno (la misma vista sirve a ambos lados)", async () => {
    const res = await app.inject({ method: "GET", url: "/athletes/kv/prescription?week=1", headers: coach2 });
    expect(res.statusCode).toBe(200);
    const s0 = (res.json() as Array<{ sessionIdx: number; day?: number; turno?: string; fecha?: string }>).find((s) => s.sessionIdx === 0)!;
    expect(s0.day).toBe(1);
    expect(s0.turno).toBe("AM");
    expect(s0.fecha).toBe(ANTEAYER);
  });
});
