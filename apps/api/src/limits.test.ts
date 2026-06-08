import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "./server";

// A7: cap request body size so a single large payload can't exhaust memory (DoS). The 413 is
// raised during body parsing, before the route handler — so this needs no DB.
describe("request body limit (A7)", () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = buildServer();
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
  });

  it("rejects an oversized JSON body with 413", async () => {
    const huge = "x".repeat(300 * 1024); // 300 KB > 256 KB limit
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ email: "a@b.com", password: huge }),
    });
    expect(res.statusCode).toBe(413);
  });
});
