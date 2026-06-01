import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "./server";
import { prisma } from "./db/client";

// INTEGRATION — requires a migrated + seeded Postgres (run via the db-verify / e2e harness).
// Excluded from the default unit run by the *.int.test.ts name.

type InjectRes = { cookies: Array<{ name: string; value: string }>; statusCode: number };
function sessionHeader(res: InjectRes): { cookie: string } {
  const c = res.cookies.find((x) => x.name === "session");
  if (!c) throw new Error("no session cookie was set");
  return { cookie: `session=${c.value}` };
}

describe("API integration (auth + coach-scoped reads)", () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = buildServer();
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  async function loginDemoCoach(): Promise<{ cookie: string }> {
    const res = await app.inject({
      method: "POST", url: "/auth/login",
      payload: { email: "coach@holyoly.dev", password: "holyoly-demo" },
    });
    expect(res.statusCode).toBe(200);
    return sessionHeader(res);
  }

  it("rejects an unauthenticated read with 401", async () => {
    const res = await app.inject({ method: "GET", url: "/roster" });
    expect(res.statusCode).toBe(401);
  });

  it("login as the demo coach → /roster returns the 8 seeded athletes", async () => {
    const headers = await loginDemoCoach();
    const res = await app.inject({ method: "GET", url: "/roster", headers });
    expect(res.statusCode).toBe(200);
    const roster = res.json() as Array<{ id: string }>;
    expect(roster.length).toBe(8);
    expect(roster.some((a) => a.id === "mv")).toBe(true);
  });

  it("GET /athletes/mv/series returns Mara's 12-week series", async () => {
    const headers = await loginDemoCoach();
    const res = await app.inject({ method: "GET", url: "/athletes/mv/series", headers });
    expect(res.statusCode).toBe(200);
    expect((res.json() as { weeks: number }).weeks).toBe(12);
  });

  it("GET /athletes/mv/cycle exposes the redacted context, never raw state", async () => {
    const headers = await loginDemoCoach();
    const res = await app.inject({ method: "GET", url: "/athletes/mv/cycle", headers });
    expect(res.statusCode).toBe(200);
    const ctx = res.json() as Record<string, unknown>;
    expect(ctx).toHaveProperty("share");
    expect(ctx).not.toHaveProperty("state"); // raw cycle state must never leak
  });

  it("a different coach (no Vinculo to Mara) gets 403 — tenant isolation", async () => {
    const signup = await app.inject({
      method: "POST", url: "/auth/signup",
      payload: { email: `coach2-${Date.now()}@x.dev`, password: "another-pass-1", role: "coach", name: "Coach Dos" },
    });
    expect(signup.statusCode).toBe(201);
    const headers = sessionHeader(signup);
    const res = await app.inject({ method: "GET", url: "/athletes/mv/series", headers });
    expect(res.statusCode).toBe(403);
  });
});
