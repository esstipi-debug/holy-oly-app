import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "./server";
import { prisma } from "./db/client";

// INTEGRATION — coach-authorized writes (Fase 4 slice 1). Requires a migrated Postgres
// (run via the verify harness). Uses a FRESH coach + athlete + activo Vínculo so it never
// disturbs the demo coach's roster (server.int.test fixes that at 8).

type InjectRes = { cookies: Array<{ name: string; value: string }>; statusCode: number };
function cookieOf(res: InjectRes): { cookie: string } {
  const c = res.cookies.find((x) => x.name === "session");
  if (!c) throw new Error("no session cookie was set");
  return { cookie: `session=${c.value}` };
}

describe("Coach-authorized writes (integration)", () => {
  let app: FastifyInstance;
  let coachH: { cookie: string };
  let strangerH: { cookie: string };
  let athleteId: string;

  beforeAll(async () => {
    app = buildServer();
    await app.ready();
    const u = Date.now();

    const coach = await app.inject({
      method: "POST", url: "/auth/signup",
      payload: { email: `wc-${u}@x.dev`, password: "writes-pass-1", role: "coach", name: "Writes Coach" },
    });
    coachH = cookieOf(coach);
    const coachUserId = (coach.json() as { id: string }).id;
    const coachRow = await prisma.coach.findUnique({ where: { userId: coachUserId } });

    athleteId = `wa-${u}`;
    await prisma.athlete.create({
      data: { id: athleteId, nombre: "Writes Athlete", iniciales: "WA", nivel: "intermediate", compite: true },
    });
    await prisma.vinculo.create({ data: { coachId: coachRow!.id, athleteId, estado: "activo" } });

    // A second coach with NO Vínculo to the athlete → must be forbidden.
    const stranger = await app.inject({
      method: "POST", url: "/auth/signup",
      payload: { email: `wc2-${u}@x.dev`, password: "writes-pass-2", role: "coach" },
    });
    strangerH = cookieOf(stranger);
  });

  afterAll(async () => { await app.close(); await prisma.$disconnect(); });

  it("PUT /athletes/:id/plan upserts the plan (and ignores body comps)", async () => {
    const plan = {
      atletaId: athleteId, macroId: "ruso-5d", startWeek: 1,
      rms: { arranque: 90, envion: 115, sentadilla: 150, frente: 120 },
      comps: [{ name: "ShouldBeIgnored", week: 99 }], // savePlan must NOT write comps (setComps owns them)
    };
    const put = await app.inject({ method: "PUT", url: `/athletes/${athleteId}/plan`, headers: coachH, payload: plan });
    expect(put.statusCode).toBe(200);

    const get = await app.inject({ method: "GET", url: `/athletes/${athleteId}/plan`, headers: coachH });
    expect(get.statusCode).toBe(200);
    const got = get.json() as { macroId: string; startWeek: number; rms: { arranque: number }; comps: unknown[] };
    expect(got.macroId).toBe("ruso-5d");
    expect(got.startWeek).toBe(1);
    expect(got.rms.arranque).toBe(90);
    expect(got.comps).toEqual([]); // body comps ignored; Competencia table is the only comp store
  });

  it("POST /athletes/:id/medals appends a medal", async () => {
    const before = await app.inject({ method: "GET", url: `/athletes/${athleteId}/medals`, headers: coachH });
    const n = (before.json() as unknown[]).length;

    const medal = { comp: "Test Open", date: "2026-05", cat: "81kg", medal: "oro", sn: 90, cj: 115, place: "1º" };
    const post = await app.inject({ method: "POST", url: `/athletes/${athleteId}/medals`, headers: coachH, payload: medal });
    expect(post.statusCode).toBe(201);

    const after = await app.inject({ method: "GET", url: `/athletes/${athleteId}/medals`, headers: coachH });
    const list = after.json() as Array<{ comp: string }>;
    expect(list.length).toBe(n + 1);
    expect(list.some((m) => m.comp === "Test Open")).toBe(true);
  });

  it("PUT /athletes/:id/comps replaces the whole list (transactional)", async () => {
    const first = await app.inject({
      method: "PUT", url: `/athletes/${athleteId}/comps`, headers: coachH,
      payload: [{ name: "Apertura", week: 6 }, { name: "Nacional", week: 14 }],
    });
    expect(first.statusCode).toBe(200);
    let got = (await app.inject({ method: "GET", url: `/athletes/${athleteId}/comps`, headers: coachH })).json() as Array<{ name: string; week: number }>;
    expect(got).toEqual([{ name: "Apertura", week: 6 }, { name: "Nacional", week: 14 }]);

    const second = await app.inject({
      method: "PUT", url: `/athletes/${athleteId}/comps`, headers: coachH,
      payload: [{ name: "Solo", week: 10 }],
    });
    expect(second.statusCode).toBe(200);
    got = (await app.inject({ method: "GET", url: `/athletes/${athleteId}/comps`, headers: coachH })).json() as Array<{ name: string; week: number }>;
    expect(got).toEqual([{ name: "Solo", week: 10 }]); // old two gone — full replace
  });

  it("PUT /athletes/:id/sessions replaces the adherence log (transactional)", async () => {
    const first = await app.inject({
      method: "PUT", url: `/athletes/${athleteId}/sessions`, headers: coachH,
      payload: [{ week: 1, idx: 0, status: "done" }, { week: 1, idx: 1, status: "missed" }],
    });
    expect(first.statusCode).toBe(200);
    let got = (await app.inject({ method: "GET", url: `/athletes/${athleteId}/sessions`, headers: coachH })).json() as Array<{ week: number; idx: number; status: string }>;
    expect(got).toEqual([{ week: 1, idx: 0, status: "done" }, { week: 1, idx: 1, status: "missed" }]);

    const second = await app.inject({
      method: "PUT", url: `/athletes/${athleteId}/sessions`, headers: coachH,
      payload: [{ week: 2, idx: 0, status: "done" }],
    });
    expect(second.statusCode).toBe(200);
    got = (await app.inject({ method: "GET", url: `/athletes/${athleteId}/sessions`, headers: coachH })).json() as Array<{ week: number; idx: number; status: string }>;
    expect(got).toEqual([{ week: 2, idx: 0, status: "done" }]); // full replace
  });

  it("forbids a coach with no active Vínculo from writing sessions (403)", async () => {
    const res = await app.inject({
      method: "PUT", url: `/athletes/${athleteId}/sessions`, headers: strangerH,
      payload: [{ week: 1, idx: 0, status: "done" }],
    });
    expect(res.statusCode).toBe(403);
  });

  it("rejects an unauthenticated write with 401", async () => {
    const res = await app.inject({
      method: "PUT", url: `/athletes/${athleteId}/comps`, payload: [{ name: "X", week: 1 }],
    });
    expect(res.statusCode).toBe(401);
  });

  it("rejects a coach with no active Vínculo with 403 (tenant isolation)", async () => {
    const plan = await app.inject({
      method: "PUT", url: `/athletes/${athleteId}/plan`, headers: strangerH,
      payload: { atletaId: athleteId, macroId: "ruso-5d", startWeek: 1, rms: { arranque: 1, envion: 1, sentadilla: 1, frente: 1 }, comps: [] },
    });
    expect(plan.statusCode).toBe(403);
    const medal = await app.inject({
      method: "POST", url: `/athletes/${athleteId}/medals`, headers: strangerH,
      payload: { comp: "x", date: "2026-01", cat: "81kg", medal: "oro", sn: 1, cj: 1, place: "1º" },
    });
    expect(medal.statusCode).toBe(403);
    const comps = await app.inject({
      method: "PUT", url: `/athletes/${athleteId}/comps`, headers: strangerH,
      payload: [{ name: "x", week: 1 }],
    });
    expect(comps.statusCode).toBe(403); // destructive replace must be gated too
  });

  it("rejects a plan whose body atletaId ≠ the path id with 400 (no cross-athlete write)", async () => {
    const res = await app.inject({
      method: "PUT", url: `/athletes/${athleteId}/plan`, headers: coachH,
      payload: { atletaId: "someone-else", macroId: "ruso-5d", startWeek: 1, rms: { arranque: 1, envion: 1, sentadilla: 1, frente: 1 }, comps: [] },
    });
    expect(res.statusCode).toBe(400);
  });
});
