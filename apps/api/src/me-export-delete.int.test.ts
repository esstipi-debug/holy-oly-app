import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "./server";
import { prisma } from "./db/client";

interface Res {
  cookies: Array<{ name: string; value: string }>;
  statusCode: number;
}
const sess = (r: Res): { cookie: string } => {
  const c = r.cookies.find((x) => x.name === "session");
  if (!c) throw new Error("no session cookie");
  return { cookie: `session=${c.value}` };
};

describe("athlete data export + account deletion (D3/D4)", () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = buildServer();
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  const login = (email: string) =>
    app.inject({ method: "POST", url: "/auth/login", payload: { email, password: "holyoly-demo" } });

  it("GET /me/export returns the athlete's own data incl. raw cycle (D3)", async () => {
    const mara = sess((await login("mara@holyoly.dev")) as unknown as Res);
    const res = await app.inject({ method: "GET", url: "/me/export", headers: mara });
    expect(res.statusCode).toBe(200);
    expect(String(res.headers["content-disposition"] ?? "")).toContain("attachment");
    const data = res.json() as { dayLogs: unknown[]; cycle: unknown; plan: unknown };
    expect(Array.isArray(data.dayLogs)).toBe(true);
    expect(data.dayLogs.length).toBeGreaterThan(0);
    expect(data.cycle).toBeTruthy(); // the athlete gets their OWN raw cycle (they own it)
    expect(data.plan).toBeTruthy();
  });

  it("DELETE /me/account removes the user + cascades all athlete data (D4)", async () => {
    const email = `del-${Date.now()}@x.dev`;
    const su = await app.inject({
      method: "POST",
      url: "/auth/signup",
      payload: { email, password: "delete-me-12345", role: "atleta" },
    });
    expect(su.statusCode).toBe(201);
    const cookie = sess(su as unknown as Res);
    const me = (await app.inject({ method: "GET", url: "/auth/me", headers: cookie })).json() as { athleteId: string };
    const athleteId = me.athleteId;
    // create some child data so we prove the cascade
    await app.inject({
      method: "PUT",
      url: "/me/daylog",
      headers: cookie,
      payload: { fatiga: 3, dolor: 3, estres: 3, humor: 3, motivacion: 3, sueno: 3, weight: 80 },
    });
    expect(await prisma.dayLog.count({ where: { athleteId } })).toBeGreaterThan(0);

    const del = await app.inject({ method: "DELETE", url: "/me/account", headers: cookie });
    expect(del.statusCode).toBe(200);

    expect((await login(email)).statusCode).toBe(401); // user gone
    expect(await prisma.athlete.findUnique({ where: { id: athleteId } })).toBeNull();
    expect(await prisma.dayLog.count({ where: { athleteId } })).toBe(0); // cascaded
  });
});
