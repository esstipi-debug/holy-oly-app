import { describe, it, expect } from "vitest";
import { generateSessionToken, sessionIdFromToken } from "./session";

describe("session token", () => {
  it("generates distinct base32 tokens", () => {
    const a = generateSessionToken();
    const b = generateSessionToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[a-z2-7]+$/); // base32 lowercase, no padding
    expect(a.length).toBeGreaterThanOrEqual(16);
  });

  it("derives a stable 64-hex session id (sha256) from a token", () => {
    const token = "a-token";
    expect(sessionIdFromToken(token)).toBe(sessionIdFromToken(token));
    expect(sessionIdFromToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(sessionIdFromToken("other")).not.toBe(sessionIdFromToken(token));
  });
});
