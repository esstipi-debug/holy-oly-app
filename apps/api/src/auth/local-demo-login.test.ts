import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify from "fastify";
import type { FastifyRequest } from "fastify";
import { isLoopback, localDemoLoginRoutes } from "./local-demo-login";
import { prisma } from "../db/client";

vi.mock("../db/client", () => ({ prisma: { user: { findUnique: vi.fn() } } }));

// Build a minimal request stub carrying only the socket peer address isLoopback inspects.
function reqWithPeer(remoteAddress: string | undefined): Pick<FastifyRequest, "socket"> {
  return { socket: { remoteAddress } } as unknown as Pick<FastifyRequest, "socket">;
}

describe("isLoopback (local-demo-login gate)", () => {
  it("accepts IPv4/IPv6 loopback peers", () => {
    expect(isLoopback(reqWithPeer("127.0.0.1"))).toBe(true);
    expect(isLoopback(reqWithPeer("::1"))).toBe(true);
    expect(isLoopback(reqWithPeer("::ffff:127.0.0.1"))).toBe(true);
  });

  it("rejects non-loopback peers", () => {
    expect(isLoopback(reqWithPeer("203.0.113.10"))).toBe(false);
    expect(isLoopback(reqWithPeer("10.0.0.5"))).toBe(false);
  });

  it("rejects a missing peer address (fail closed)", () => {
    expect(isLoopback(reqWithPeer(undefined))).toBe(false);
  });

  it("keys off the TCP socket peer, NOT req.ip (X-Forwarded-For cannot spoof loopback)", () => {
    // A remote client whose req.ip might read "127.0.0.1" via a spoofed X-Forwarded-For (when
    // trustProxy is on) must still be rejected: the real socket peer is remote.
    const spoof = { ip: "127.0.0.1", socket: { remoteAddress: "203.0.113.10" } } as unknown as Pick<
      FastifyRequest,
      "socket"
    >;
    expect(isLoopback(spoof)).toBe(false);
  });
});

describe("local-demo-login with the database down", () => {
  const prevAllow = process.env.ALLOW_LOCAL_DEMO_LOGIN;

  beforeEach(() => {
    process.env.ALLOW_LOCAL_DEMO_LOGIN = "true";
  });

  afterEach(() => {
    process.env.ALLOW_LOCAL_DEMO_LOGIN = prevAllow;
    vi.restoreAllMocks();
  });

  async function injectLogin() {
    const app = Fastify();
    await app.register(localDemoLoginRoutes);
    const res = await app.inject({
      method: "GET",
      url: "/auth/local-demo-login?as=coach",
      remoteAddress: "127.0.0.1",
    });
    await app.close();
    return res;
  }

  it("returns an honest 503 when Prisma cannot reach the database", async () => {
    // Shape of PrismaClientInitializationError (connection refused / engine can't start).
    const err = Object.assign(new Error("Can't reach database server at 127.0.0.1:5439"), {
      name: "PrismaClientInitializationError",
      errorCode: "P1001",
    });
    vi.mocked(prisma.user.findUnique).mockRejectedValue(err);
    const res = await injectLogin();
    expect(res.statusCode).toBe(503);
    expect(res.json().error).toMatch(/base de datos local/);
  });

  it("does NOT mask unrelated errors as db-down (they keep bubbling to the 500 handler)", async () => {
    vi.mocked(prisma.user.findUnique).mockRejectedValue(new Error("boom"));
    const res = await injectLogin();
    expect(res.statusCode).toBe(500);
    expect(res.json().error).not.toMatch(/base de datos local/);
  });
});
