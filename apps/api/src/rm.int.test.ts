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
// kg únicos de este archivo para que los filtros del historial no choquen con otros archivos.
const RMS = { arranque: 81, envion: 101, sentadilla: 141, frente: 111 };
const START = "2026-03-04";
const PLAN = { atletaId: "mv", macroId: "ruso-5d", startWeek: 1, startDate: START, rms: RMS, comps: [] };

interface HistRow { lift: string; kg: number; setAt: string; reason: string }
interface Candidate { lift: string; movementId: string; movementName: string; kg: number; week: number; sessionIdx: number; doneAt?: string }
const TODAY = new Date().toISOString().slice(0, 10);

describe("API integration — RMs (SP5: updateRms / historial / PRs)", () => {
  let app: FastifyInstance;
  beforeAll(async () => { app = buildServer(); await app.ready(); });
  afterAll(async () => { await app.close(); await prisma.$disconnect(); });

  const login = async (email: string) => {
    const res = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password: "holyoly-demo" } });
    expect(res.statusCode).toBe(200);
    return sess(res);
  };

  it("savePlan siembra 4 baselines (reason assign, setAt = HOY — la fecha del acto, no el startDate)", async () => {
    const coach = await login("coach@holyoly.dev");
    expect((await app.inject({ method: "PUT", url: "/athletes/mv/plan", headers: coach, payload: PLAN })).statusCode).toBe(200);

    const res = await app.inject({ method: "GET", url: "/athletes/mv/rm-history", headers: coach });
    expect(res.statusCode).toBe(200);
    const hist = res.json() as HistRow[];
    // setAt = today: con anclaje por compe el startDate cae en el pasado → retro-fechar sería falso-stale.
    const baselines = hist.filter((h) => h.reason === "assign" && h.setAt === TODAY && h.kg >= 81 && h.kg <= 141);
    expect(new Set(baselines.map((b) => b.lift))).toEqual(new Set(["arranque", "envion", "sentadilla", "frente"]));
    expect(baselines.find((b) => b.lift === "arranque")!.kg).toBe(81);
    expect(hist.some((h) => h.setAt === START)).toBe(false);
  });

  it("PUT rms: cascada de kg + prescripción intacta (la edición del coach sobrevive) + historial al frente", async () => {
    const coach = await login("coach@holyoly.dev");
    await app.inject({ method: "PUT", url: "/athletes/mv/plan", headers: coach, payload: PLAN });

    // El coach edita la sesión 1/0 a mano — updateRms NO debe pisarla (no re-instanciar).
    expect((await app.inject({ method: "PUT", url: "/athletes/mv/prescription/1/0", headers: coach,
      payload: [{ movementId: "sentadilla", sets: 5, reps: 5, pct: 70 }] })).statusCode).toBe(200);

    const put = await app.inject({ method: "PUT", url: "/athletes/mv/rms", headers: coach,
      payload: { updates: [{ lift: "sentadilla", kg: 160 }], reason: "manual" } });
    expect(put.statusCode).toBe(200);

    // Plan refleja el RM nuevo; los demás lifts intactos.
    const plan = (await app.inject({ method: "GET", url: "/athletes/mv/plan", headers: coach })).json() as { rms: Record<string, number> };
    expect(plan.rms.sentadilla).toBe(160);
    expect(plan.rms.arranque).toBe(81);

    // Cascada: el kg derivado de la sesión EDITADA usa el RM nuevo (70% de 160 = 112), y la edición sobrevivió.
    const week = (await app.inject({ method: "GET", url: "/athletes/mv/prescription?week=1", headers: coach }))
      .json() as Array<{ sessionIdx: number; exercises: Array<{ movementId: string; sets: number; targetKg?: number }> }>;
    const s0 = week.find((s) => s.sessionIdx === 0)!;
    expect(s0.exercises).toHaveLength(1);
    expect(s0.exercises[0]!.movementId).toBe("sentadilla");
    expect(s0.exercises[0]!.sets).toBe(5);
    expect(s0.exercises[0]!.targetKg).toBe(112);

    // Historial: la fila nueva (manual, hoy) viene primero (orden desc).
    const hist = (await app.inject({ method: "GET", url: "/athletes/mv/rm-history", headers: coach })).json() as HistRow[];
    expect(hist[0]).toMatchObject({ lift: "sentadilla", kg: 160, reason: "manual" });
  });

  it("PR: el atleta levanta > RM → candidato; confirmar (subir el RM) lo auto-resuelve", async () => {
    const coach = await login("coach@holyoly.dev");
    await app.inject({ method: "PUT", url: "/athletes/mv/plan", headers: coach, payload: PLAN });

    const athlete = await login("mara@holyoly.dev");
    expect((await app.inject({ method: "PUT", url: "/me/session/2/0", headers: athlete,
      payload: [{ order: 0, movementId: "arranque.potencia", done: true, kg: 86, reps: 1 }] })).statusCode).toBe(200);

    let cands = (await app.inject({ method: "GET", url: "/athletes/mv/pr-candidates", headers: coach })).json() as Candidate[];
    const arr = cands.find((c) => c.lift === "arranque")!;
    expect(arr).toBeDefined();
    expect(arr.kg).toBe(86);
    expect(arr.week).toBe(2);
    expect(arr.movementName).toMatch(/potencia/i);
    expect(arr.doneAt).toBe(TODAY); // procedencia anclada a fecha real (la estampa el write de /me/session)

    // Confirmar: el coach entra el valor final (88) con reason "pr" → el candidato desaparece (86 > 88 es falso).
    expect((await app.inject({ method: "PUT", url: "/athletes/mv/rms", headers: coach,
      payload: { updates: [{ lift: "arranque", kg: 88 }], reason: "pr" } })).statusCode).toBe(200);
    cands = (await app.inject({ method: "GET", url: "/athletes/mv/pr-candidates", headers: coach })).json() as Candidate[];
    expect(cands.find((c) => c.lift === "arranque")).toBeUndefined();

    const hist = (await app.inject({ method: "GET", url: "/athletes/mv/rm-history", headers: coach })).json() as HistRow[];
    expect(hist[0]).toMatchObject({ lift: "arranque", kg: 88, reason: "pr" });
  });

  it("authz: sin sesión 401; sesión de atleta 401; coach sin Vínculo 403", async () => {
    expect((await app.inject({ method: "GET", url: "/athletes/mv/rm-history" })).statusCode).toBe(401);
    expect((await app.inject({ method: "GET", url: "/athletes/mv/pr-candidates" })).statusCode).toBe(401);

    const athlete = await login("mara@holyoly.dev");
    expect((await app.inject({ method: "PUT", url: "/athletes/mv/rms", headers: athlete,
      payload: { updates: [{ lift: "arranque", kg: 90 }], reason: "manual" } })).statusCode).toBe(401);

    const c2 = await app.inject({ method: "POST", url: "/auth/signup",
      payload: { email: `c2-rm-${Date.now()}@x.dev`, password: "another-pass-1", role: "coach", name: "C2" } });
    expect((await app.inject({ method: "GET", url: "/athletes/mv/rm-history", headers: sess(c2) })).statusCode).toBe(403);
    expect((await app.inject({ method: "PUT", url: "/athletes/mv/rms", headers: sess(c2),
      payload: { updates: [{ lift: "arranque", kg: 90 }], reason: "manual" } })).statusCode).toBe(403);
  });

  it("input inválido 400; sin plan 404 y reads vacíos honestos", async () => {
    const coach = await login("coach@holyoly.dev");
    expect((await app.inject({ method: "PUT", url: "/athletes/mv/rms", headers: coach,
      payload: { updates: [], reason: "manual" } })).statusCode).toBe(400);
    expect((await app.inject({ method: "PUT", url: "/athletes/mv/rms", headers: coach,
      payload: { updates: [{ lift: "arranque", kg: 90 }], reason: "assign" } })).statusCode).toBe(400);

    // ap (Ana P.) es del coach1 y el seed no le da plan; el deleteMany es defensivo por si otro
    // archivo se lo creó. Caso sin-plan: write 404, reads [] honestos.
    await prisma.plan.deleteMany({ where: { athleteId: "ap" } });
    expect((await app.inject({ method: "PUT", url: "/athletes/ap/rms", headers: coach,
      payload: { updates: [{ lift: "arranque", kg: 90 }], reason: "manual" } })).statusCode).toBe(404);
    expect((await app.inject({ method: "GET", url: "/athletes/ap/pr-candidates", headers: coach })).json()).toEqual([]);
  });
});
