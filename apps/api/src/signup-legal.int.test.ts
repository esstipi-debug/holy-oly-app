import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { LEGAL_TERMS_VERSION, LEGAL_PRIVACY_VERSION } from "@holy-oly/core";
import { buildServer } from "./server";
import { prisma } from "./db/client";

// PR-L1: signup must record legal acceptance (timestamp + version the server stamps) and reject
// any signup that does not explicitly accept. The version is set server-side from core constants.
describe("signup legal acceptance (PR-L1)", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it("rejects signup that does not accept terms (no user created)", async () => {
    const email = `noaccept-${Date.now()}@x.dev`;
    const res = await app.inject({
      method: "POST",
      url: "/auth/signup",
      payload: { email, password: "lawful-pass-9", role: "atleta", acceptTerms: false },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: "must accept terms" });
    expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
  });

  it("rejects signup with acceptTerms missing entirely", async () => {
    const email = `missing-${Date.now()}@x.dev`;
    const res = await app.inject({
      method: "POST",
      url: "/auth/signup",
      payload: { email, password: "lawful-pass-9", role: "coach" },
    });
    expect(res.statusCode).toBe(400);
    expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
  });

  it("records acceptance with the server-stamped current versions on success", async () => {
    const email = `accept-${Date.now()}@x.dev`;
    const res = await app.inject({
      method: "POST",
      url: "/auth/signup",
      // Client claims an absurd version — the server must IGNORE it and stamp the real one.
      payload: { email, password: "lawful-pass-9", role: "atleta", acceptTerms: true, termsVersion: "v999" },
    });
    expect(res.statusCode).toBe(201);

    const user = await prisma.user.findUnique({ where: { email } });
    expect(user).not.toBeNull();
    expect(user!.termsVersion).toBe(LEGAL_TERMS_VERSION);
    expect(user!.privacyVersion).toBe(LEGAL_PRIVACY_VERSION);
    expect(user!.termsAcceptedAt).toBeInstanceOf(Date);
    expect(user!.privacyAcceptedAt).toBeInstanceOf(Date);
  });
});
