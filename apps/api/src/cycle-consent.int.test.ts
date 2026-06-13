import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { CYCLE_CONSENT_VERSION } from "@holy-oly/core";
import { buildServer } from "./server";
import { prisma } from "./db/client";

type Res = { cookies: Array<{ name: string; value: string }>; statusCode: number };
const sess = (r: Res) => ({ cookie: `session=${r.cookies.find((c) => c.name === "session")!.value}` });

// PR-L2: opt-in EXPLÍCITO del ciclo (§3). `demo-atleta` (atleta@holyoly.dev) se siembra SIN fila
// CycleConsent → es la atleta "todavía no activó". Cada test la deja en ese estado prístino.
describe("API integration — consentimiento del ciclo (PR-L2)", () => {
  let app: FastifyInstance;
  beforeAll(async () => { app = buildServer(); await app.ready(); });
  afterAll(async () => {
    await prisma.cycleConsent.deleteMany({ where: { athleteId: "demo-atleta" } });
    await app.close();
    await prisma.$disconnect();
  });
  beforeEach(async () => {
    await prisma.cycleConsent.deleteMany({ where: { athleteId: "demo-atleta" } });
  });

  const login = async () => {
    const r = await app.inject({ method: "POST", url: "/auth/login", payload: { email: "atleta@holyoly.dev", password: "holyoly-demo" } });
    expect(r.statusCode).toBe(200);
    return sess(r as unknown as Res);
  };

  it("sin activar: GET consented=false (default honesto); PUT sin consentimiento → 400, sin fila", async () => {
    const a = await login();
    const got = (await app.inject({ method: "GET", url: "/me/cycle", headers: a })).json() as { consented: boolean; share: string };
    expect(got.consented).toBe(false);
    expect(got.share).toBe("none");

    const res = await app.inject({ method: "PUT", url: "/me/cycle", headers: a, payload: { share: "min", state: "regular" } });
    expect(res.statusCode).toBe(400);
    expect(await prisma.cycleConsent.findUnique({ where: { athleteId: "demo-atleta" } })).toBeNull();
  });

  it("activar con consent:true sella consentedAt + versión vigente y deja consented=true", async () => {
    const a = await login();
    const res = await app.inject({ method: "PUT", url: "/me/cycle", headers: a, payload: { share: "min", state: "regular", consent: true } });
    expect(res.statusCode).toBe(200);
    const row = await prisma.cycleConsent.findUnique({ where: { athleteId: "demo-atleta" } });
    expect(row!.consentedAt).toBeInstanceOf(Date);
    expect(row!.consentVersion).toBe(CYCLE_CONSENT_VERSION);
    const got = (await app.inject({ method: "GET", url: "/me/cycle", headers: a })).json() as { consented: boolean };
    expect(got.consented).toBe(true);
  });

  it("ya consentida: un PUT posterior sin consent edita libremente (200)", async () => {
    const a = await login();
    await app.inject({ method: "PUT", url: "/me/cycle", headers: a, payload: { share: "min", state: "regular", consent: true } });
    const res = await app.inject({ method: "PUT", url: "/me/cycle", headers: a, payload: { share: "full", state: "regular" } });
    expect(res.statusCode).toBe(200);
  });

  it("DELETE /me/cycle revoca (borra la fila) → vuelve a consented=false (dueña del dato)", async () => {
    const a = await login();
    await app.inject({ method: "PUT", url: "/me/cycle", headers: a, payload: { share: "full", state: "regular", consent: true } });
    const del = await app.inject({ method: "DELETE", url: "/me/cycle", headers: a });
    expect(del.statusCode).toBe(200);
    expect(await prisma.cycleConsent.findUnique({ where: { athleteId: "demo-atleta" } })).toBeNull();
    const got = (await app.inject({ method: "GET", url: "/me/cycle", headers: a })).json() as { consented: boolean };
    expect(got.consented).toBe(false);
  });

  it("sin sesión: 401 en GET/PUT/DELETE", async () => {
    expect((await app.inject({ method: "GET", url: "/me/cycle" })).statusCode).toBe(401);
    expect((await app.inject({ method: "PUT", url: "/me/cycle", payload: { share: "none", state: "regular" } })).statusCode).toBe(401);
    expect((await app.inject({ method: "DELETE", url: "/me/cycle" })).statusCode).toBe(401);
  });
});
