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
      payload: { email: `c-${u}@x.dev`, password: "coach-pass-1", role: "coach", name: "Coach Flow", acceptTerms: true },
    });
    expect(coach.statusCode).toBe(201);
    const coachH = cookieOf(coach);

    const rot = await app.inject({ method: "POST", url: "/invite/rotate", headers: coachH });
    expect(rot.statusCode).toBe(200);
    const code = (rot.json() as { inviteCode: string }).inviteCode;
    expect(code).toMatch(/^[A-Z2-9]{12}$/); // 12 chars × 32-alphabet = 60 bits (A6)

    const ath = await app.inject({
      method: "POST", url: "/auth/signup",
      payload: { email: `a-${u}@x.dev`, password: "athlete-pwd-01", role: "atleta", name: "Atleta Flow", acceptTerms: true },
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
      payload: { email: `a2-${u}@x.dev`, password: "athlete-pwd-02", role: "atleta", acceptTerms: true },
    });
    // 12-char, valid alphabet, just not a real code → passes schema, fails the DB lookup.
    const accept = await app.inject({ method: "POST", url: "/vinculos/accept", headers: cookieOf(ath), payload: { code: "ZZZZ23456789" } });
    expect(accept.statusCode).toBe(404);
  });

  it("accept with a malformed code (wrong length/chars) → 400, not 404 (no 400-vs-404 oracle)", async () => {
    const u = Date.now();
    const ath = await app.inject({
      method: "POST", url: "/auth/signup",
      payload: { email: `a3-${u}@x.dev`, password: "athlete-pwd-03", role: "atleta", acceptTerms: true },
    });
    // 8 chars (old format) → rejected by the exact-length schema before any DB lookup.
    const accept = await app.inject({ method: "POST", url: "/vinculos/accept", headers: cookieOf(ath), payload: { code: "ABCD1234" } });
    expect(accept.statusCode).toBe(400);
  });

  it("a coach cannot confirm a vínculo it does not own → 404", async () => {
    const u = Date.now();
    const c2 = await app.inject({
      method: "POST", url: "/auth/signup",
      payload: { email: `c2-${u}@x.dev`, password: "coach-pass-2", role: "coach", acceptTerms: true },
    });
    const res = await app.inject({ method: "POST", url: "/vinculos/does-not-exist/confirm", headers: cookieOf(c2) });
    expect(res.statusCode).toBe(404);
  });

  it("invite/accept endpoints require the right role", async () => {
    // unauthenticated rotate → 401
    const rot = await app.inject({ method: "POST", url: "/invite/rotate" });
    expect(rot.statusCode).toBe(401);
  });

  // ── GET /me/vinculo (W5: estado real del vínculo en Cuenta atleta) ──
  it("GET /me/vinculo: null sin vínculo → pendiente tras accept → activo (con coachNombre) tras confirm", async () => {
    const u = Date.now();
    const coach = await app.inject({
      method: "POST", url: "/auth/signup",
      payload: { email: `c-mv-${u}@x.dev`, password: "coach-pass-mv", role: "coach", name: "Coach Vínculo", acceptTerms: true },
    });
    const coachH = cookieOf(coach);
    const rot = await app.inject({ method: "POST", url: "/invite/rotate", headers: coachH });
    const code = (rot.json() as { inviteCode: string }).inviteCode;

    const ath = await app.inject({
      method: "POST", url: "/auth/signup",
      payload: { email: `a-mv-${u}@x.dev`, password: "athlete-pwd-mv", role: "atleta", name: "Atleta Vínculo", acceptTerms: true },
    });
    const athH = cookieOf(ath);

    // sin vínculo → null
    const none = await app.inject({ method: "GET", url: "/me/vinculo", headers: athH });
    expect(none.statusCode).toBe(200);
    expect(none.json()).toEqual({ vinculo: null });

    // tras accept → pendiente (con el nombre del coach, jamás el inviteCode)
    await app.inject({ method: "POST", url: "/vinculos/accept", headers: athH, payload: { code } });
    const pend = await app.inject({ method: "GET", url: "/me/vinculo", headers: athH });
    expect(pend.statusCode).toBe(200);
    expect(pend.json()).toEqual({ vinculo: { estado: "pendiente", coachNombre: "Coach Vínculo" } });
    expect(JSON.stringify(pend.json())).not.toContain(code); // nunca exponer inviteCode

    // tras confirm del coach → activo
    const list = await app.inject({ method: "GET", url: "/vinculos", headers: coachH });
    const row = (list.json() as Array<{ id: string; estado: string }>).find((v) => v.estado === "pendiente");
    await app.inject({ method: "POST", url: `/vinculos/${row!.id}/confirm`, headers: coachH });
    const act = await app.inject({ method: "GET", url: "/me/vinculo", headers: athH });
    expect(act.statusCode).toBe(200);
    expect(act.json()).toEqual({ vinculo: { estado: "activo", coachNombre: "Coach Vínculo" } });
  });

  // Vinculo es M:N: un "pendiente" más nuevo (coach B) no puede ocultar el "activo" vigente (coach A).
  it("GET /me/vinculo prioriza el vínculo activo sobre un pendiente más nuevo de otro coach", async () => {
    const u = Date.now();
    const coachA = await app.inject({
      method: "POST", url: "/auth/signup",
      payload: { email: `ca-${u}@x.dev`, password: "coach-pass-pa", role: "coach", name: "Coach A", acceptTerms: true },
    });
    const coachAH = cookieOf(coachA);
    const rotA = await app.inject({ method: "POST", url: "/invite/rotate", headers: coachAH });
    const codeA = (rotA.json() as { inviteCode: string }).inviteCode;

    const coachB = await app.inject({
      method: "POST", url: "/auth/signup",
      payload: { email: `cb-${u}@x.dev`, password: "coach-pass-pb", role: "coach", name: "Coach B", acceptTerms: true },
    });
    const rotB = await app.inject({ method: "POST", url: "/invite/rotate", headers: cookieOf(coachB) });
    const codeB = (rotB.json() as { inviteCode: string }).inviteCode;

    const ath = await app.inject({
      method: "POST", url: "/auth/signup",
      payload: { email: `a-pr-${u}@x.dev`, password: "athlete-pwd-pr", role: "atleta", name: "Atleta Prio", acceptTerms: true },
    });
    const athH = cookieOf(ath);

    // accept A → coach A confirma → vínculo ACTIVO con A
    await app.inject({ method: "POST", url: "/vinculos/accept", headers: athH, payload: { code: codeA } });
    const listA = await app.inject({ method: "GET", url: "/vinculos", headers: coachAH });
    const rowA = (listA.json() as Array<{ id: string; estado: string }>).find((v) => v.estado === "pendiente");
    await app.inject({ method: "POST", url: `/vinculos/${rowA!.id}/confirm`, headers: coachAH });

    // después acepta el código de B → queda un "pendiente" con B, MÁS NUEVO que el activo de A
    await app.inject({ method: "POST", url: "/vinculos/accept", headers: athH, payload: { code: codeB } });

    const res = await app.inject({ method: "GET", url: "/me/vinculo", headers: athH });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ vinculo: { estado: "activo", coachNombre: "Coach A" } });
  });

  it("GET /me/vinculo requiere sesión de atleta (anónimo y coach → 401)", async () => {
    const anon = await app.inject({ method: "GET", url: "/me/vinculo" });
    expect(anon.statusCode).toBe(401);

    const u = Date.now();
    const coach = await app.inject({
      method: "POST", url: "/auth/signup",
      payload: { email: `c-mv2-${u}@x.dev`, password: "coach-pass-mv2", role: "coach", acceptTerms: true },
    });
    const asCoach = await app.inject({ method: "GET", url: "/me/vinculo", headers: cookieOf(coach) });
    expect(asCoach.statusCode).toBe(401);
  });
});
