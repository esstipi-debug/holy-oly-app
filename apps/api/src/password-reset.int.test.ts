import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "./server";
import { prisma } from "./db/client";
import { generateOneTimeToken, tokenIdFromRaw } from "./auth/one-time-token";

type InjectRes = { cookies: Array<{ name: string; value: string }>; statusCode: number };
function cookieOf(res: InjectRes): { cookie: string } {
  const c = res.cookies.find((x) => x.name === "session");
  if (!c) throw new Error("no session cookie");
  return { cookie: `session=${c.value}` };
}

describe("password reset (B6)", () => {
  let app: FastifyInstance;
  const email = `reset-${Date.now()}@x.dev`;
  const PW1 = "reset-pass-old-1";
  const PW2 = "reset-pass-new-2";

  beforeAll(async () => {
    app = buildServer();
    await app.ready();
    await app.inject({
      method: "POST",
      url: "/auth/signup",
      payload: { email, password: PW1, role: "atleta", name: "Reset User", acceptTerms: true },
    });
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it("forgot returns ok even for unknown email (anti-enumeration)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/password/forgot",
      payload: { email: "nobody@x.dev" },
    });
    expect(res.statusCode).toBe(200);
  });

  it("reset invalidates sessions and accepts new password", async () => {
    const login1 = (await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email, password: PW1 },
    })) as unknown as InjectRes;
    const cookie = cookieOf(login1);

    await app.inject({ method: "POST", url: "/auth/password/forgot", payload: { email } });
    const user = await prisma.user.findUnique({ where: { email } });
    const raw = generateOneTimeToken();
    await prisma.passwordResetToken.create({
      data: { id: tokenIdFromRaw(raw), userId: user!.id, expiresAt: new Date(Date.now() + 3600_000) },
    });

    const reset = await app.inject({
      method: "POST",
      url: "/auth/password/reset",
      payload: { token: raw, password: PW2 },
    });
    expect(reset.statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/auth/me", headers: cookie })).statusCode).toBe(401);

    const login2 = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password: PW2 } });
    expect(login2.statusCode).toBe(200);
  });
});
