import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { weekOfDate } from "@holy-oly/core";
import { buildServer } from "./server";
import { prisma } from "./db/client";

// INTEGRATION — competencias compartidas del coach (slice 2026-06-14). Corre vía el orquestador
// db-verify (PG embebido, migrate deploy + seed). Verifica CRUD, acople pico/paso, la
// sincronización pico → Competencia (peaking), y la autorización (coach dueño + vínculo activo).

type InjectRes = { cookies: Array<{ name: string; value: string }>; statusCode: number };
function sess(res: InjectRes): { cookie: string } {
  const c = res.cookies.find((x) => x.name === "session");
  if (!c) throw new Error("no session cookie");
  return { cookie: `session=${c.value}` };
}

const RMS = { arranque: 80, envion: 100, sentadilla: 140, frente: 110 };
const START = "2026-04-01";       // ruso-5d, 16 semanas
const TOTAL = 16;
const COMP_DATE = "2026-06-15";
const NEW_DATE = "2026-07-20";
const NAME = "INT Nacional Test";

describe("API integration — competencias compartidas del coach", () => {
  let app: FastifyInstance;
  let coach: { cookie: string };  // dueño de mv (mara)
  let coach2: { cookie: string }; // dueño de kv (kevin) — NO vinculado a coach
  let coachId: string;
  let coach2Id: string;
  let compId: string;

  const login = async (email: string) => {
    const res = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password: "holyoly-demo" } });
    expect(res.statusCode).toBe(200);
    return sess(res);
  };
  const acople = (id: string, headers: { cookie: string }, entries: object[]) =>
    app.inject({ method: "POST", url: `/competitions/${id}/entries`, headers, payload: { entries } });
  const detail = async (id: string, headers: { cookie: string }) =>
    app.inject({ method: "GET", url: `/competitions/${id}`, headers });
  const syncedRows = (athleteId: string) =>
    prisma.competencia.findMany({ where: { athleteId, competitionId: compId } });

  beforeAll(async () => {
    app = buildServer();
    await app.ready();
    coach = await login("coach@holyoly.dev");
    coach2 = await login("coach2@holyoly.dev");
    coachId = (await prisma.coach.findFirstOrThrow({ where: { user: { email: "coach@holyoly.dev" } } })).id;
    coach2Id = (await prisma.coach.findFirstOrThrow({ where: { user: { email: "coach2@holyoly.dev" } } })).id;
    // mv con plan anclado → el pico puede ubicar su semana.
    expect((await app.inject({ method: "PUT", url: "/athletes/mv/plan", headers: coach,
      payload: { atletaId: "mv", macroId: "ruso-5d", startWeek: 1, startDate: START, rms: RMS, comps: [] } })).statusCode).toBe(200);
    await prisma.competition.deleteMany({ where: { coachId: { in: [coachId, coach2Id] } } });
  });

  afterAll(async () => {
    await prisma.competition.deleteMany({ where: { coachId: { in: [coachId, coach2Id] } } });
    await prisma.competencia.deleteMany({ where: { athleteId: "mv", competitionId: { not: null } } });
    await app.close();
    await prisma.$disconnect();
  });

  it("GET /competitions sin sesión de coach → 401", async () => {
    expect((await app.inject({ method: "GET", url: "/competitions" })).statusCode).toBe(401);
  });

  it("crea una competencia → 201 con id", async () => {
    const res = await app.inject({ method: "POST", url: "/competitions", headers: coach,
      payload: { name: NAME, date: COMP_DATE, place: "Santiago" } });
    expect(res.statusCode).toBe(201);
    const body = res.json() as { id: string; name: string; date: string; place?: string };
    expect(body.name).toBe(NAME);
    expect(body.date).toBe(COMP_DATE);
    expect(body.place).toBe("Santiago");
    compId = body.id;
  });

  it("la lista la trae con conteo de acoplados en 0", async () => {
    const res = await app.inject({ method: "GET", url: "/competitions", headers: coach });
    expect(res.statusCode).toBe(200);
    const list = res.json() as Array<{ id: string; athleteCount: number; picoCount: number }>;
    const mine = list.find((c) => c.id === compId)!;
    expect(mine).toBeTruthy();
    expect(mine.athleteCount).toBe(0);
    expect(mine.picoCount).toBe(0);
  });

  it("otro coach no ve la compe ajena → 404", async () => {
    expect((await detail(compId, coach2)).statusCode).toBe(404);
  });

  it("acopla a mara como pico → 200 y sincroniza la fila Competencia en la semana derivada", async () => {
    expect((await acople(compId, coach, [{ athleteId: "mv", role: "pico" }])).statusCode).toBe(200);
    const rows = await syncedRows("mv");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.week).toBe(weekOfDate(START, COMP_DATE, TOTAL));
    expect(rows[0]!.date).toBe(COMP_DATE);
    const d = (await detail(compId, coach)).json() as { entries: Array<{ athleteId: string; role: string; peakWeek?: number }> };
    const mv = d.entries.find((e) => e.athleteId === "mv")!;
    expect(mv.role).toBe("pico");
    expect(mv.peakWeek).toBe(weekOfDate(START, COMP_DATE, TOTAL));
  });

  it("acoplar un atleta NO vinculado al coach → 403", async () => {
    expect((await acople(compId, coach, [{ athleteId: "kv", role: "pico" }])).statusCode).toBe(403);
  });

  it("re-acoplar como compe de paso → 200 y borra la fila Competencia (no ancla)", async () => {
    expect((await acople(compId, coach, [{ athleteId: "mv", role: "paso" }])).statusCode).toBe(200);
    expect(await syncedRows("mv")).toHaveLength(0);
    const d = (await detail(compId, coach)).json() as { entries: Array<{ athleteId: string; role: string; peakWeek?: number }> };
    const mv = d.entries.find((e) => e.athleteId === "mv")!;
    expect(mv.role).toBe("paso");
    expect(mv.peakWeek).toBeUndefined();
  });

  it("editar la fecha re-sincroniza la semana del pico", async () => {
    expect((await acople(compId, coach, [{ athleteId: "mv", role: "pico" }])).statusCode).toBe(200);
    expect((await app.inject({ method: "PATCH", url: `/competitions/${compId}`, headers: coach,
      payload: { name: NAME, date: NEW_DATE } })).statusCode).toBe(200);
    const rows = await syncedRows("mv");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.week).toBe(weekOfDate(START, NEW_DATE, TOTAL));
    // otro coach no puede editarla
    expect((await app.inject({ method: "PATCH", url: `/competitions/${compId}`, headers: coach2,
      payload: { name: "x", date: NEW_DATE } })).statusCode).toBe(404);
  });

  it("desacopla a mara → borra la entry y la fila Competencia linkeada", async () => {
    expect((await app.inject({ method: "DELETE", url: `/competitions/${compId}/entries/mv`, headers: coach })).statusCode).toBe(200);
    expect(await syncedRows("mv")).toHaveLength(0);
    const d = (await detail(compId, coach)).json() as { entries: unknown[] };
    expect(d.entries).toHaveLength(0);
  });

  it("borrar la compe: ajeno → 404, dueño → 200 y desaparece de la lista", async () => {
    expect((await app.inject({ method: "DELETE", url: `/competitions/${compId}`, headers: coach2 })).statusCode).toBe(404);
    expect((await app.inject({ method: "DELETE", url: `/competitions/${compId}`, headers: coach })).statusCode).toBe(200);
    const list = (await app.inject({ method: "GET", url: "/competitions", headers: coach })).json() as Array<{ id: string }>;
    expect(list.find((c) => c.id === compId)).toBeUndefined();
  });

  it("validación: fecha inválida → 400", async () => {
    expect((await app.inject({ method: "POST", url: "/competitions", headers: coach,
      payload: { name: "X", date: "not-a-date" } })).statusCode).toBe(400);
  });
});
