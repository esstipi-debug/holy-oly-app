import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../server";
import { prisma } from "../db/client";

/** Log into a seeded demo account and return the `session=<token>` cookie header. */
async function demoCookie(app: FastifyInstance, as: "coach" | "atleta"): Promise<string> {
  process.env.DEMO_LOGIN_ENABLED = "true";
  const res = await app.inject({ method: "GET", url: `/auth/demo?as=${as}` });
  const c = res.cookies.find((x) => x.name === "session" && x.value);
  if (!c) throw new Error("no session cookie returned by /auth/demo");
  return `session=${c.value}`;
}

describe("read-only gate — demo sessions can browse but never mutate", () => {
  let app: FastifyInstance;
  const prevEnabled = process.env.DEMO_LOGIN_ENABLED;

  beforeAll(async () => {
    app = buildServer();
    await app.ready();
  });

  afterAll(async () => {
    if (prevEnabled === undefined) delete process.env.DEMO_LOGIN_ENABLED;
    else process.env.DEMO_LOGIN_ENABLED = prevEnabled;
    await app.close();
    await prisma.$disconnect();
  });

  afterEach(() => {
    // demoCookie() sets DEMO_LOGIN_ENABLED='true'; restore after each test so it can't bleed into
    // sibling tests/files (mirrors demo-login.int.test.ts).
    if (prevEnabled === undefined) delete process.env.DEMO_LOGIN_ENABLED;
    else process.env.DEMO_LOGIN_ENABLED = prevEnabled;
  });

  it("/auth/me reports demo:true for a demo coach session", async () => {
    const cookie = await demoCookie(app, "coach");
    const res = await app.inject({ method: "GET", url: "/auth/me", headers: { cookie } });
    expect(res.statusCode).toBe(200);
    expect(res.json().demo).toBe(true);
  });

  it("allows GET reads (the whole product is browsable) — e.g. /roster", async () => {
    const cookie = await demoCookie(app, "coach");
    const res = await app.inject({ method: "GET", url: "/roster", headers: { cookie } });
    expect(res.statusCode).toBe(200);
  });

  it("BLOCKS the real MercadoPago checkout (POST /billing/checkout) — no charge possible", async () => {
    const cookie = await demoCookie(app, "coach");
    const res = await app.inject({
      method: "POST",
      url: "/billing/checkout",
      headers: { cookie },
      payload: { planId: "coach", period: "monthly" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("demo_read_only");
  });

  it("BLOCKS a coach write (POST /competitions)", async () => {
    const cookie = await demoCookie(app, "coach");
    const res = await app.inject({
      method: "POST",
      url: "/competitions",
      headers: { cookie },
      payload: { nombre: "Demo write", fecha: "2026-12-01" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("demo_read_only");
  });

  it("BLOCKS an athlete write (PUT /me/daylog) for a demo atleta", async () => {
    const cookie = await demoCookie(app, "atleta");
    const res = await app.inject({ method: "PUT", url: "/me/daylog", headers: { cookie }, payload: {} });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("demo_read_only");
  });

  it("BLOCKS account deletion (DELETE /me/account) for a demo atleta", async () => {
    const cookie = await demoCookie(app, "atleta");
    const res = await app.inject({ method: "DELETE", url: "/me/account", headers: { cookie } });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("demo_read_only");
  });

  it("BLOCKS the mock billing activation (POST /billing/mock/activate) for a demo coach", async () => {
    const cookie = await demoCookie(app, "coach");
    const res = await app.inject({ method: "POST", url: "/billing/mock/activate", headers: { cookie } });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("demo_read_only");
  });

  it("BLOCKS revoke-all sessions (POST /auth/sessions/revoke-all) for a demo coach", async () => {
    const cookie = await demoCookie(app, "coach");
    const res = await app.inject({ method: "POST", url: "/auth/sessions/revoke-all", headers: { cookie } });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("demo_read_only");
  });

  it("ALLOWS logout so a demo visitor can exit", async () => {
    const cookie = await demoCookie(app, "coach");
    const res = await app.inject({ method: "POST", url: "/auth/logout", headers: { cookie } });
    expect(res.statusCode).toBe(200);
  });

  it("does NOT apply to anonymous (non-demo) requests — the gate is session-scoped", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "nobody@holyoly.invalid", password: "wrong-password" },
    });
    // Bad credentials → 401, NOT a demo_read_only 403. Proves the gate only fires for demo sessions.
    expect(res.statusCode).not.toBe(403);
  });
});
