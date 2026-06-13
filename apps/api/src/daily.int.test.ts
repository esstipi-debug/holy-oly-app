import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import type { AthleteDailyView } from "@holy-oly/core";
import { buildServer } from "./server";
import { prisma } from "./db/client";

type InjectRes = { cookies: Array<{ name: string; value: string }>; statusCode: number };
function sess(res: InjectRes): { cookie: string } {
  const c = res.cookies.find((x) => x.name === "session");
  if (!c) throw new Error("no session cookie");
  return { cookie: `session=${c.value}` };
}
const RMS = { arranque: 80, envion: 100, sentadilla: 140, frente: 110 };
// startDate = HOY (defaultStartDate hoy→sem1) → la semana 1 cae HOY y entra a la ventana del día a día.
const TODAY = new Date().toISOString().slice(0, 10);

describe("API integration — día a día (lazo diario atleta→coach)", () => {
  let app: FastifyInstance;
  beforeAll(async () => { app = buildServer(); await app.ready(); });
  afterAll(async () => { await app.close(); await prisma.$disconnect(); });
  // DB compartida entre los archivos int (fileParallelism:false): cada test parte de una adherencia
  // LIMPIA para mv, así un actual/registro sembrado por otro archivo (p.ej. actuals.int / registro.int)
  // no se filtra acá. (re-asignar plan NO resetea adherencia a propósito — el re-anclaje la conserva.)
  beforeEach(async () => {
    await prisma.sessionActual.deleteMany({ where: { athleteId: "mv" } });
    await prisma.sessionMark.deleteMany({ where: { athleteId: "mv" } });
    await prisma.sessionRegistro.deleteMany({ where: { athleteId: "mv" } });
  });

  const login = (email: string) => app.inject({ method: "POST", url: "/auth/login", payload: { email, password: "holyoly-demo" } });
  const assignRuso = (headers: { cookie: string }) =>
    app.inject({ method: "PUT", url: "/athletes/mv/plan", headers,
      payload: { atletaId: "mv", macroId: "ruso-5d", startWeek: 1, startDate: TODAY, rms: RMS, comps: [] } });

  it("coach vinculado ve el check-in crudo del atleta (6 ítems + peso, SIN rpe ni ciclo)", async () => {
    const coach = sess(await login("coach@holyoly.dev"));
    expect((await assignRuso(coach)).statusCode).toBe(200);

    const athlete = sess(await login("mara@holyoly.dev")); // login sembrado → athleteId mv
    const put = await app.inject({ method: "PUT", url: "/me/daylog", headers: athlete,
      payload: { fatiga: 2, dolor: 1, estres: 3, humor: 4, motivacion: 5, sueno: 4, weight: 61 } });
    expect(put.statusCode).toBe(200);

    const res = await app.inject({ method: "GET", url: "/athletes/mv/daily", headers: coach });
    expect(res.statusCode).toBe(200);
    const view = res.json() as AthleteDailyView & Record<string, unknown>;
    const todayCheckin = view.checkins.find((c) => c.date === TODAY)!;
    expect(todayCheckin).toMatchObject({ fatiga: 2, dolor: 1, estres: 3, humor: 4, motivacion: 5, sueno: 4, weight: 61 });
    // SIN RPE en ninguna parte del payload, SIN nada del ciclo.
    expect(JSON.stringify(view)).not.toMatch(/rpe/i);
    expect(JSON.stringify(view)).not.toMatch(/luteal|cycle|ciclo/i);
  });

  it("adherencia reconciliada: el actual del atleta GANA sobre el toggle del coach (divergencia)", async () => {
    const coach = sess(await login("coach@holyoly.dev"));
    expect((await assignRuso(coach)).statusCode).toBe(200);
    // El coach marca la sesión (1,0) como 'done' a mano…
    expect((await app.inject({ method: "PUT", url: "/athletes/mv/sessions", headers: coach,
      payload: [{ week: 1, idx: 0, status: "done" }] })).statusCode).toBe(200);
    // …pero el atleta registra esa misma sesión como NO hecha (todas las series sin hacer).
    const athlete = sess(await login("mara@holyoly.dev"));
    expect((await app.inject({ method: "PUT", url: "/me/session/1/0", headers: athlete,
      payload: { actuals: [{ order: 0, movementId: "arranque", done: false }] } })).statusCode).toBe(200);

    const res = await app.inject({ method: "GET", url: "/athletes/mv/daily", headers: coach });
    const view = res.json() as AthleteDailyView;
    const s = view.adherence.find((a) => a.week === 1 && a.idx === 0)!;
    expect(s).toMatchObject({ status: "skipped", source: "athlete" }); // verdad del atleta manda
  });

  it("sin actuals, cae al mark del coach (source 'coach'); sesión sin dato → none", async () => {
    const coach = sess(await login("coach@holyoly.dev"));
    expect((await assignRuso(coach)).statusCode).toBe(200); // re-asignar resetea actuals/marks previos
    // El coach marca SÓLO (1,1) como done; el atleta no registra nada.
    expect((await app.inject({ method: "PUT", url: "/athletes/mv/sessions", headers: coach,
      payload: [{ week: 1, idx: 1, status: "done" }] })).statusCode).toBe(200);

    const res = await app.inject({ method: "GET", url: "/athletes/mv/daily", headers: coach });
    const view = res.json() as AthleteDailyView;
    expect(view.adherence.find((a) => a.week === 1 && a.idx === 1)).toMatchObject({ status: "done", source: "coach" });
    // Una sesión planificada sin actual ni mark → none/none (jamás inventar).
    expect(view.adherence.find((a) => a.week === 1 && a.idx === 2)).toMatchObject({ status: "none", source: "none" });
  });

  it("es coach-only y respeta authz: atleta → 401; coach NO vinculado → 403", async () => {
    // athlete session → 401 (no coachId)
    const aLogin = await login("mara@holyoly.dev");
    expect((await app.inject({ method: "GET", url: "/athletes/mv/daily", headers: sess(aLogin) })).statusCode).toBe(401);
    // segundo coach sin Vínculo a mv → 403 (aislamiento de tenant)
    const c2 = await app.inject({ method: "POST", url: "/auth/signup",
      payload: { email: `c2-daily-${Date.now()}@x.dev`, password: "another-pass-1", role: "coach", name: "C2", acceptTerms: true } });
    expect((await app.inject({ method: "GET", url: "/athletes/mv/daily", headers: sess(c2) })).statusCode).toBe(403);
  });
});
