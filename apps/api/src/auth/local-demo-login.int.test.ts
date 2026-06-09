import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../server";
import { prisma } from "../db/client";

describe("GET /auth/local-demo-login (local desktop shortcuts)", () => {
  let app: FastifyInstance;
  const prevAllow = process.env.ALLOW_LOCAL_DEMO_LOGIN;

  beforeAll(async () => {
    app = buildServer();
    await app.ready();
  });

  afterAll(async () => {
    process.env.ALLOW_LOCAL_DEMO_LOGIN = prevAllow;
    await app.close();
    await prisma.$disconnect();
  });

  it("returns 404 when ALLOW_LOCAL_DEMO_LOGIN is unset", async () => {
    delete process.env.ALLOW_LOCAL_DEMO_LOGIN;
    const res = await app.inject({
      method: "GET",
      url: "/auth/local-demo-login",
      remoteAddress: "127.0.0.1",
    });
    expect(res.statusCode).toBe(404);
  });

  it("logs in the seeded coach from loopback and redirects to /coach", async () => {
    process.env.ALLOW_LOCAL_DEMO_LOGIN = "true";
    const res = await app.inject({
      method: "GET",
      url: "/auth/local-demo-login?as=coach",
      remoteAddress: "127.0.0.1",
    });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("/coach");
    expect(res.cookies.some((c) => c.name === "session" && c.value)).toBe(true);
  });

  it("logs in the seeded athlete (Kevin) and redirects to /atleta", async () => {
    process.env.ALLOW_LOCAL_DEMO_LOGIN = "true";
    const res = await app.inject({
      method: "GET",
      url: "/auth/local-demo-login?as=atleta",
      remoteAddress: "127.0.0.1",
    });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("/atleta");
    expect(res.cookies.some((c) => c.name === "session" && c.value)).toBe(true);
  });

  it("rejects non-loopback clients", async () => {
    process.env.ALLOW_LOCAL_DEMO_LOGIN = "true";
    const res = await app.inject({
      method: "GET",
      url: "/auth/local-demo-login?as=coach",
      remoteAddress: "203.0.113.10",
    });
    expect(res.statusCode).toBe(404);
  });
});
