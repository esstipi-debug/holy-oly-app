import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "./server";
import { prisma } from "./db/client";

type InjectRes = { cookies: Array<{ name: string; value: string }>; statusCode: number };
function sessionHeader(res: InjectRes): { cookie: string } {
  const c = res.cookies.find((x) => x.name === "session");
  if (!c) throw new Error("no session cookie was set");
  return { cookie: `session=${c.value}` };
}

describe("API integration — athlete self (/me/*)", () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = buildServer();
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  async function loginDemoAthlete(): Promise<{ cookie: string }> {
    const res = await app.inject({
      method: "POST", url: "/auth/login",
      payload: { email: "atleta@holyoly.dev", password: "holyoly-demo" },
    });
    expect(res.statusCode).toBe(200);
    return sessionHeader(res);
  }

  it("rejects unauthenticated /me/daylog with 401", async () => {
    const res = await app.inject({ method: "GET", url: "/me/daylog" });
    expect(res.statusCode).toBe(401);
  });

  it("a coach session cannot use the athlete surface (no athleteId → 401)", async () => {
    const login = await app.inject({ method: "POST", url: "/auth/login", payload: { email: "coach@holyoly.dev", password: "holyoly-demo" } });
    const res = await app.inject({ method: "GET", url: "/me/daylog", headers: sessionHeader(login) });
    expect(res.statusCode).toBe(401);
  });

  it("GET /me/plan → plan: null for an unassigned athlete (honest, no fake plan)", async () => {
    const headers = await loginDemoAthlete();
    const res = await app.inject({ method: "GET", url: "/me/plan", headers });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { athlete: { nombre: string }; plan: unknown };
    expect(body.athlete.nombre).toBe("Demo Atleta");
    expect(body.plan).toBeNull();
  });

  it("GET /me/series → 404 for an athlete with no series (sin-dato honesto)", async () => {
    const headers = await loginDemoAthlete();
    const res = await app.inject({ method: "GET", url: "/me/series", headers });
    expect(res.statusCode).toBe(404);
  });

  it("daylog round-trip: empty → PUT → streak 1, entry present", async () => {
    const headers = await loginDemoAthlete();

    const empty = await app.inject({ method: "GET", url: "/me/daylog", headers });
    expect(empty.statusCode).toBe(200);
    const emptyBody = empty.json() as { entry: unknown; streak: number; days: string[]; today: string };
    expect(emptyBody.entry).toBeNull();
    expect(emptyBody.streak).toBe(0);
    expect(typeof emptyBody.today).toBe("string");

    const put = await app.inject({
      method: "PUT", url: "/me/daylog", headers,
      payload: { fatiga: 2, dolor: 1, estres: 3, humor: 4, motivacion: 5, sueno: 4, weight: 80.8 },
    });
    expect(put.statusCode).toBe(200);
    const putBody = put.json() as { entry: { fatiga: number; weight?: number }; streak: number };
    expect(putBody.entry.fatiga).toBe(2);
    expect(putBody.entry.weight).toBe(80.8);
    expect(putBody.streak).toBe(1);

    const after = await app.inject({ method: "GET", url: "/me/daylog", headers });
    const afterBody = after.json() as { entry: { fatiga: number } | null; streak: number; days: string[] };
    expect(afterBody.entry?.fatiga).toBe(2);
    expect(afterBody.streak).toBe(1);
    expect(afterBody.days.length).toBe(1);
  });

  it("PUT is an upsert (re-submitting the same day overwrites, not duplicates)", async () => {
    const headers = await loginDemoAthlete();
    await app.inject({ method: "PUT", url: "/me/daylog", headers, payload: { fatiga: 5, dolor: 5, estres: 5, humor: 1, motivacion: 1, sueno: 1 } });
    const res = await app.inject({ method: "GET", url: "/me/daylog", headers });
    const body = res.json() as { entry: { fatiga: number; weight?: number }; days: string[] };
    expect(body.entry.fatiga).toBe(5);
    expect(body.entry.weight).toBeUndefined(); // weight omitted on the second PUT
    expect(body.days.length).toBe(1); // still one row for today
  });

  it("rejects an out-of-range daylog with 400", async () => {
    const headers = await loginDemoAthlete();
    const res = await app.inject({ method: "PUT", url: "/me/daylog", headers, payload: { fatiga: 9, dolor: 1, estres: 3, humor: 4, motivacion: 5, sueno: 4 } });
    expect(res.statusCode).toBe(400);
  });
});
