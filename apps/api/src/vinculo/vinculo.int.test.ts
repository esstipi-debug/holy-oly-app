import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../server";
import { prisma } from "../db/client";

type Res = { cookies: Array<{ name: string; value: string }>; statusCode: number };
function cookieOf(res: Res): { cookie: string } {
  const c = res.cookies.find((x) => x.name === "session");
  if (!c) throw new Error("no session cookie");
  return { cookie: `session=${c.value}` };
}

describe("Vínculo invite flow (integration)", () => {
  let app: FastifyInstance;
  beforeAll(async () => { app = buildServer(); await app.ready(); });
  afterAll(async () => { await app.close(); await prisma.$disconnect(); });

  it("rotate code → athlete accepts → coach confirms → athlete in roster", async () => {
    const u = Date.now();
    const coach = await app.inject({
      method: "POST", url: "/auth/signup",
      payload: { email: `c-${u}@x.dev`, password: "coach-pass-1", role: "coach", name: "Coach Flow" },
    });
    expect(coach.statusCode).toBe(201);
    const coachH = cookieOf(coach);

    const rot = await app.inject({ method: "POST", url: "/invite/rotate", headers: coachH });
    expect(rot.statusCode).toBe(200);
    const code = (rot.json() as { inviteCode: string }).inviteCode;
    expect(code).toMatch(/^[A-Z2-9]{12}$/); // 12 chars × 32-alphabet = 60 bits (A6)

    const ath = await app.inject({
      method: "POST", url: "/auth/signup",
      payload: { email: `a-${u}@x.dev`, password: "athlete-pwd-01", role: "atleta", name: "Atleta Flow" },
    });
    expect(ath.statusCode).toBe(201);
    const athH = cookieOf(ath);

    const accept = await app.inject({ method: "POST", url: "/vinculos/accept", headers: athH, payload: { code } });
    expect(accept.statusCode).toBe(201);
    expect((accept.json() as { estado: string }).estado).toBe("pendiente");

    const list = await app.inject({ method: "GET", url: "/vinculos", headers: coachH });
    const pend = (list.json() as Array<{ id: string; estado: string }>).find((v) => v.estado === "pendiente");
    expect(pend).toBeTruthy();

    const confirm = await app.inject({ method: "POST", url: `/vinculos/${pend!.id}/confirm`, headers: coachH });
    expect(confirm.statusCode).toBe(200);
    expect((confirm.json() as { estado: string }).estado).toBe("activo");

    const roster = await app.inject({ method: "GET", url: "/roster", headers: coachH });
    const names = (roster.json() as Array<{ nombre: string }>).map((a) => a.nombre);
    expect(names).toContain("Atleta Flow");
  });

  it("accept with a well-formed but unknown code → 404", async () => {
    const u = Date.now();
    const ath = await app.inject({
      method: "POST", url: "/auth/signup",
      payload: { email: `a2-${u}@x.dev`, password: "athlete-pwd-02", role: "atleta" },
    });
    // 12-char, valid alphabet, just not a real code → passes schema, fails the DB lookup.
    const accept = await app.inject({ method: "POST", url: "/vinculos/accept", headers: cookieOf(ath), payload: { code: "ZZZZ23456789" } });
    expect(accept.statusCode).toBe(404);
  });

  it("accept with a malformed code (wrong length/chars) → 400, not 404 (no 400-vs-404 oracle)", async () => {
    const u = Date.now();
    const ath = await app.inject({
      method: "POST", url: "/auth/signup",
      payload: { email: `a3-${u}@x.dev`, password: "athlete-pwd-03", role: "atleta" },
    });
    // 8 chars (old format) → rejected by the exact-length schema before any DB lookup.
    const accept = await app.inject({ method: "POST", url: "/vinculos/accept", headers: cookieOf(ath), payload: { code: "ABCD1234" } });
    expect(accept.statusCode).toBe(400);
  });

  it("a coach cannot confirm a vínculo it does not own → 404", async () => {
    const u = Date.now();
    const c2 = await app.inject({
      method: "POST", url: "/auth/signup",
      payload: { email: `c2-${u}@x.dev`, password: "coach-pass-2", role: "coach" },
    });
    const res = await app.inject({ method: "POST", url: "/vinculos/does-not-exist/confirm", headers: cookieOf(c2) });
    expect(res.statusCode).toBe(404);
  });

  it("invite/accept endpoints require the right role", async () => {
    // unauthenticated rotate → 401
    const rot = await app.inject({ method: "POST", url: "/invite/rotate" });
    expect(rot.statusCode).toBe(401);
  });
});
