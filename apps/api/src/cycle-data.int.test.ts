import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "./server";
import { prisma } from "./db/client";

type Res = { cookies: Array<{ name: string; value: string }>; statusCode: number };
const sess = (r: Res) => ({ cookie: `session=${r.cookies.find((c) => c.name === "session")!.value}` });
const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => iso(new Date(Date.now() - n * 86_400_000));

describe("API integration — ciclo (slice ciclo-visible)", () => {
  let app: FastifyInstance;
  // Este archivo MUTA la fila de ciclo seedeada de mv (los PUT van por la ruta real) → se captura
  // y restaura para no contaminar a los demás archivos (server.int la asserta). El cifrado del
  // write-path se cubre en cycle-encryption.int.test (clave + atleta descartable); acá sin clave
  // los valores pasan en claro (passthrough documentado de crypto-at-rest).
  type Row = { share: string; state: string; lastPeriodStart: string | null; cycleLengthDays: string | null };
  let prevRow: Row | null = null;
  beforeAll(async () => {
    app = buildServer();
    await app.ready();
    const r = await prisma.cycleConsent.findUnique({ where: { athleteId: "mv" } });
    prevRow = r ? { share: r.share, state: r.state, lastPeriodStart: r.lastPeriodStart, cycleLengthDays: r.cycleLengthDays } : null;
  });
  afterAll(async () => {
    if (prevRow) {
      await prisma.cycleConsent.upsert({ where: { athleteId: "mv" }, create: { athleteId: "mv", ...prevRow }, update: prevRow });
    } else {
      await prisma.cycleConsent.deleteMany({ where: { athleteId: "mv" } });
    }
    await app.close();
    await prisma.$disconnect();
  });

  const login = async (email: string) => {
    const r = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password: "holyoly-demo" } });
    expect(r.statusCode).toBe(200);
    return sess(r as unknown as Res);
  };

  it("PUT/GET /me/cycle roundtrip (la verdad de la atleta vuelve idéntica)", async () => {
    const mara = await login("mara@holyoly.dev");
    // día 20 del ciclo (len 28) → lútea (20 ≥ 28−14)
    const body = { share: "full", state: "regular", lastPeriodStart: daysAgo(20), cycleLengthDays: 28 };
    expect((await app.inject({ method: "PUT", url: "/me/cycle", headers: mara, payload: body })).statusCode).toBe(200);

    const got = (await app.inject({ method: "GET", url: "/me/cycle", headers: mara })).json() as typeof body & { consented: boolean };
    expect(got).toMatchObject(body); // el registro vuelve idéntico…
    expect(got.consented).toBe(true); // …+ la señal de activación (mv viene sembrada consentida)
  });

  it("coach: payload EXACTO {share,inLutealNow,health,reliable} con lúteo REAL — jamás fecha/fase", async () => {
    const mara = await login("mara@holyoly.dev");
    await app.inject({ method: "PUT", url: "/me/cycle", headers: mara,
      payload: { share: "full", state: "regular", lastPeriodStart: daysAgo(20), cycleLengthDays: 28 } });
    const coach = await login("coach@holyoly.dev");
    const res = await app.inject({ method: "GET", url: "/athletes/mv/cycle", headers: coach });
    expect(res.statusCode).toBe(200);
    const ctx = res.json() as Record<string, unknown>;
    expect(Object.keys(ctx).sort()).toEqual(["health", "inLutealNow", "reliable", "share"]);
    expect(ctx.inLutealNow).toBe(true); // día 20 ≥ 28−14 — computado, ya no placeholder
    expect(JSON.stringify(ctx)).not.toMatch(/periodo|lastPeriod|cycleLength|\d{4}-\d{2}-\d{2}/);
  });

  it("share min → lúteo null; volver a none → coach sin contexto", async () => {
    const mara = await login("mara@holyoly.dev");
    const coach = await login("coach@holyoly.dev");
    await app.inject({ method: "PUT", url: "/me/cycle", headers: mara,
      payload: { share: "min", state: "regular", lastPeriodStart: daysAgo(20), cycleLengthDays: 28 } });
    expect(((await app.inject({ method: "GET", url: "/athletes/mv/cycle", headers: coach })).json() as { inLutealNow: unknown }).inLutealNow).toBeNull();
    await app.inject({ method: "PUT", url: "/me/cycle", headers: mara, payload: { share: "none", state: "regular" } });
    expect((await app.inject({ method: "GET", url: "/athletes/mv/cycle", headers: coach })).statusCode).toBe(404);
  });

  it("validación y authz: len fuera de rango 400; sin sesión 401; export incluye el registro crudo", async () => {
    const mara = await login("mara@holyoly.dev");
    expect((await app.inject({ method: "PUT", url: "/me/cycle", headers: mara,
      payload: { share: "full", state: "regular", cycleLengthDays: 50 } })).statusCode).toBe(400);
    expect((await app.inject({ method: "GET", url: "/me/cycle" })).statusCode).toBe(401);
    expect((await app.inject({ method: "PUT", url: "/me/cycle", payload: { share: "none", state: "regular" } })).statusCode).toBe(401);

    await app.inject({ method: "PUT", url: "/me/cycle", headers: mara,
      payload: { share: "full", state: "regular", lastPeriodStart: daysAgo(20), cycleLengthDays: 28 } });
    const exp = (await app.inject({ method: "GET", url: "/me/export", headers: mara })).json() as { cycle: { lastPeriodStart: string | null } };
    expect(exp.cycle.lastPeriodStart).toBe(daysAgo(20)); // descifrado: su dato crudo es suyo (D3)
  });
});
