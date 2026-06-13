import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "./server";
import { prisma } from "./db/client";

// Rate limiting is off by default under NODE_ENV=test (so the rest of the int suite is unaffected);
// this file opts in explicitly to assert the 429 behavior end-to-end.
describe("rate limiting (integration)", () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = buildServer({ rateLimit: true });
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it("blocks rapid wrong-password logins with 429", async () => {
    const email = `rl-${Date.now()}@x.dev`;
    const su = await app.inject({
      method: "POST",
      url: "/auth/signup",
      payload: { email, password: "correct-horse-battery-staple", role: "atleta", acceptTerms: true },
    });
    expect(su.statusCode).toBe(201);

    let saw429 = false;
    for (let i = 0; i < 14; i++) {
      const res = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { email, password: "wrong-password" },
      });
      if (res.statusCode === 429) {
        saw429 = true;
        break;
      }
      expect(res.statusCode).toBe(401);
    }
    expect(saw429).toBe(true);
  });
});
