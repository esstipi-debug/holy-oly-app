import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "./server";
import { prisma } from "./db/client";
import { generateSessionToken, sessionIdFromToken, purgeExpiredSessions } from "./auth/session";

interface Res {
  cookies: Array<{ name: string; value: string; maxAge?: number }>;
  statusCode: number;
}
const cookieHdr = (res: Res): string => {
  const c = res.cookies.find((x) => x.name === "session");
  if (!c) throw new Error("no session cookie");
  return `session=${c.value}`;
};
let n = 0;
const email = (): string => `sess-${Date.now()}-${n++}@x.dev`;
const PW = "session-pass-1234";

describe("session lifecycle (B3/B4)", () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = buildServer();
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  async function signup(): Promise<Res> {
    const res = (await app.inject({
      method: "POST",
      url: "/auth/signup",
      payload: { email: email(), password: PW, role: "coach" },
    })) as unknown as Res;
    expect(res.statusCode).toBe(201);
    return res;
  }

  it("login/signup sets a session cookie with Max-Age (B4)", async () => {
    const su = await signup();
    const c = su.cookies.find((x) => x.name === "session");
    expect(c?.maxAge).toBeGreaterThan(0);
  });

  it("revoke-all invalidates the session (B3)", async () => {
    const cookie = cookieHdr(await signup());
    expect((await app.inject({ method: "GET", url: "/auth/me", headers: { cookie } })).statusCode).toBe(200);
    const rv = await app.inject({ method: "POST", url: "/auth/sessions/revoke-all", headers: { cookie } });
    expect(rv.statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/auth/me", headers: { cookie } })).statusCode).toBe(401);
  });

  it("single-session login revokes prior sessions when enabled (B3)", async () => {
    const prev = process.env.SINGLE_SESSION_LOGIN;
    process.env.SINGLE_SESSION_LOGIN = "true";
    try {
      const e = email();
      await app.inject({ method: "POST", url: "/auth/signup", payload: { email: e, password: PW, role: "coach" } });
      const c1 = cookieHdr((await app.inject({ method: "POST", url: "/auth/login", payload: { email: e, password: PW } })) as unknown as Res);
      const c2 = cookieHdr((await app.inject({ method: "POST", url: "/auth/login", payload: { email: e, password: PW } })) as unknown as Res);
      expect((await app.inject({ method: "GET", url: "/auth/me", headers: { cookie: c2 } })).statusCode).toBe(200);
      expect((await app.inject({ method: "GET", url: "/auth/me", headers: { cookie: c1 } })).statusCode).toBe(401);
    } finally {
      if (prev === undefined) delete process.env.SINGLE_SESSION_LOGIN;
      else process.env.SINGLE_SESSION_LOGIN = prev;
    }
  });

  it("purgeExpiredSessions deletes expired rows (D5)", async () => {
    const su = await signup();
    const me = (await app.inject({ method: "GET", url: "/auth/me", headers: { cookie: cookieHdr(su) } })).json() as { id: string };
    const token = generateSessionToken();
    await prisma.session.create({
      data: { id: sessionIdFromToken(token), userId: me.id, expiresAt: new Date(Date.now() - 1000) },
    });
    const n = await purgeExpiredSessions(prisma);
    expect(n).toBeGreaterThanOrEqual(1);
    expect(await prisma.session.findUnique({ where: { id: sessionIdFromToken(token) } })).toBeNull();
  });

  it("renews a session inside the renew window and re-issues the cookie (B4/NEW-2)", async () => {
    const su = await signup();
    const me = (await app.inject({ method: "GET", url: "/auth/me", headers: { cookie: cookieHdr(su) } })).json() as { id: string };
    const token = generateSessionToken();
    const soon = new Date(Date.now() + 86_400_000); // 1 day → inside the 15-day renew window
    await prisma.session.create({ data: { id: sessionIdFromToken(token), userId: me.id, expiresAt: soon } });
    const res = (await app.inject({ method: "GET", url: "/auth/me", headers: { cookie: `session=${token}` } })) as unknown as Res;
    expect(res.statusCode).toBe(200);
    const c = res.cookies.find((x) => x.name === "session");
    expect(c?.maxAge ?? 0).toBeGreaterThan(2 * 86_400); // renewed well past the original 1 day
  });
});
