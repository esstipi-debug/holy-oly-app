import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../server";
import { prisma } from "../db/client";

describe("GET /auth/demo (public read-only demo login)", () => {
  let app: FastifyInstance;
  const prevEnabled = process.env.DEMO_LOGIN_ENABLED;
  const prevCoach = process.env.DEMO_COACH_EMAIL;

  beforeAll(async () => {
    app = buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  afterEach(() => {
    if (prevEnabled === undefined) delete process.env.DEMO_LOGIN_ENABLED;
    else process.env.DEMO_LOGIN_ENABLED = prevEnabled;
    if (prevCoach === undefined) delete process.env.DEMO_COACH_EMAIL;
    else process.env.DEMO_COACH_EMAIL = prevCoach;
  });

  it("returns 404 when DEMO_LOGIN_ENABLED is not 'true' (off by default)", async () => {
    delete process.env.DEMO_LOGIN_ENABLED;
    const res = await app.inject({ method: "GET", url: "/auth/demo?as=coach" });
    expect(res.statusCode).toBe(404);
  });

  it("logs in the seeded demo coach and redirects to /coach with a session cookie", async () => {
    process.env.DEMO_LOGIN_ENABLED = "true";
    const res = await app.inject({ method: "GET", url: "/auth/demo?as=coach" });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("/coach");
    expect(res.cookies.some((c) => c.name === "session" && c.value)).toBe(true);
  });

  it("logs in the seeded demo athlete (Kevin) and redirects to /atleta", async () => {
    process.env.DEMO_LOGIN_ENABLED = "true";
    const res = await app.inject({ method: "GET", url: "/auth/demo?as=atleta" });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("/atleta");
    expect(res.cookies.some((c) => c.name === "session" && c.value)).toBe(true);
  });

  it("defaults to coach when ?as is missing or unknown", async () => {
    process.env.DEMO_LOGIN_ENABLED = "true";
    const res = await app.inject({ method: "GET", url: "/auth/demo" });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("/coach");
  });

  it("returns 503 (not a broken redirect) when the demo account is not seeded", async () => {
    process.env.DEMO_LOGIN_ENABLED = "true";
    process.env.DEMO_COACH_EMAIL = "nonexistent-demo@holyoly.invalid";
    const res = await app.inject({ method: "GET", url: "/auth/demo?as=coach" });
    expect(res.statusCode).toBe(503);
  });
});
