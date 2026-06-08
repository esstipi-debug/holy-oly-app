import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "./server";
import { prisma } from "./db/client";

describe("signup honeypot (E1)", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it("rejects signup when honeypot field is filled", async () => {
    const email = `bot-${Date.now()}@x.dev`;
    const res = await app.inject({
      method: "POST",
      url: "/auth/signup",
      payload: { email, password: "honeypot-pass-1", role: "coach", website: "https://spam.example" },
    });
    expect(res.statusCode).toBe(400);
    expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
  });
});
