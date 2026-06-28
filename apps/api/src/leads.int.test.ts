import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "./server";
import { prisma } from "./db/client";

// Public lead capture from the marketing landing (POST /leads). Cookieless + cross-origin.
describe("landing leads (POST /leads)", () => {
  let app: FastifyInstance;
  const marker = `lead-${Date.now()}`;

  beforeAll(async () => {
    app = buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await prisma.lead.deleteMany({ where: { email: { contains: marker } } });
    await app.close();
    await prisma.$disconnect();
  });

  it("stores a valid lead and returns 201", async () => {
    const email = `${marker}-ok@x.dev`;
    const res = await app.inject({
      method: "POST",
      url: "/leads",
      payload: { email, athletes: 12, country: "AR" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ ok: true });

    const row = await prisma.lead.findFirst({ where: { email } });
    expect(row).not.toBeNull();
    expect(row?.athletes).toBe(12);
    expect(row?.country).toBe("AR");
    expect(row?.source).toBe("landing-coach");
  });

  it("rejects a malformed payload (bad email) with 400 and stores nothing", async () => {
    const email = `${marker}-bad`;
    const res = await app.inject({
      method: "POST",
      url: "/leads",
      payload: { email, athletes: 5, country: "CL" },
    });
    expect(res.statusCode).toBe(400);
    expect(await prisma.lead.findFirst({ where: { country: "CL", athletes: 5 } })).toBeNull();
  });

  it("rejects a non-integer / out-of-range athletes count", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/leads",
      payload: { email: `${marker}-zero@x.dev`, athletes: 0, country: "MX" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("silently accepts a honeypot hit but persists nothing", async () => {
    const email = `${marker}-bot@x.dev`;
    const res = await app.inject({
      method: "POST",
      url: "/leads",
      payload: { email, athletes: 3, country: "CO", website: "https://spam.example" },
    });
    expect(res.statusCode).toBe(201);
    expect(await prisma.lead.findFirst({ where: { email } })).toBeNull();
  });

  it("answers the CORS preflight and reflects the Origin", async () => {
    const origin = "https://landing.holy-oly.test";
    const pre = await app.inject({
      method: "OPTIONS",
      url: "/leads",
      headers: { origin, "access-control-request-method": "POST" },
    });
    expect(pre.statusCode).toBe(204);
    expect(pre.headers["access-control-allow-origin"]).toBe(origin);
    expect(String(pre.headers["access-control-allow-methods"])).toContain("POST");

    const post = await app.inject({
      method: "POST",
      url: "/leads",
      headers: { origin },
      payload: { email: `${marker}-cors@x.dev`, athletes: 7, country: "UY" },
    });
    expect(post.statusCode).toBe(201);
    expect(post.headers["access-control-allow-origin"]).toBe(origin);
  });
});
