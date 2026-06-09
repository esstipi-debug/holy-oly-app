import { describe, expect, it } from "vitest";
import type { FastifyRequest } from "fastify";
import { isLoopback } from "./local-demo-login";

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
