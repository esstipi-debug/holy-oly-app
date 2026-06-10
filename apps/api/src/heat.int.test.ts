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

describe("API integration — plan heat (calendario mapa)", () => {
  let app: FastifyInstance;
  beforeAll(async () => { app = buildServer(); await app.ready(); });
  afterAll(async () => { await app.close(); await prisma.$disconnect(); });

  async function login(email: string): Promise<{ cookie: string }> {
    const res = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password: "holyoly-demo" } });
    expect(res.statusCode).toBe(200);
    return sessionHeader(res);
  }

  it("coach: GET /athletes/:id/heat → todas las semanas × 7 slots; días con sesión traen lifts + topPct", async () => {
    const headers = await login("coach@holyoly.dev");
    expect((await app.inject({ method: "PUT", url: "/athletes/mv/plan", headers,
      payload: { atletaId: "mv", macroId: "ruso-5d", startWeek: 1, startDate: "2026-04-01", rms: RMS, comps: [] } })).statusCode).toBe(200);

    const res = await app.inject({ method: "GET", url: "/athletes/mv/heat", headers });
    expect(res.statusCode).toBe(200);
    const heat = res.json() as Array<{ week: number; days: Array<{ topPct?: number; lifts: number } | null> }>;
    expect(heat.length).toBeGreaterThanOrEqual(12); // todas las semanas del macro, con o sin filas
    expect(heat.every((w) => w.days.length === 7)).toBe(true);
    const d0 = heat[0]!.days[0];
    expect(d0).not.toBeNull();
    expect(d0!.lifts).toBeGreaterThan(0);
    expect(d0!.topPct).toBeGreaterThan(0);
    expect(heat[0]!.days[6]).toBeNull(); // 5 días/sem → el domingo descansa
  });

  it("sin sesión → 401; el atleta ve su propio mapa vía GET /me/heat", async () => {
    expect((await app.inject({ method: "GET", url: "/athletes/mv/heat" })).statusCode).toBe(401);

    const athlete = await login("mara@holyoly.dev");
    const res = await app.inject({ method: "GET", url: "/me/heat", headers: athlete });
    expect(res.statusCode).toBe(200);
    const heat = res.json() as Array<{ week: number; days: unknown[] }>;
    expect(heat.length).toBeGreaterThan(0);
    expect(heat.every((w) => w.days.length === 7)).toBe(true);
  });

  it("coach sin Vínculo → 403 (cross-coach, criterio del spec)", async () => {
    const c2 = await app.inject({ method: "POST", url: "/auth/signup",
      payload: { email: `c2-heat-${Date.now()}@x.dev`, password: "another-pass-1", role: "coach", name: "C2" } });
    expect((await app.inject({ method: "GET", url: "/athletes/mv/heat", headers: sessionHeader(c2) })).statusCode).toBe(403);
  });

  it("el payload del atleta no filtra RM ni RPE (sólo % y conteos)", async () => {
    const athlete = await login("mara@holyoly.dev");
    const res = await app.inject({ method: "GET", url: "/me/heat", headers: athlete });
    const raw = res.body;
    expect(raw).not.toMatch(/rpe/i);
    expect(raw).not.toMatch(/"rms"/);
    expect(raw).not.toMatch(/kgOverride/);
  });
});
