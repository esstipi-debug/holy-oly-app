import { describe, expect, it } from "vitest";
import { signCookiePayload, verifyCookiePayload } from "./signed-cookie";

describe("signed-cookie", () => {
  it("round-trips and rejects tampering", () => {
    const secret = "test-secret";
    const payload = { nonce: "abc", exp: Date.now() + 60_000 };
    const signed = signCookiePayload(payload, secret);
    const ok = verifyCookiePayload<{ nonce: string; exp: number }>(signed, secret);
    expect(ok?.nonce).toBe("abc");

    // Flip a real character in the base64url body (the literal "abc" is encoded, so a string
    // replace of "abc" would be a no-op and not actually tamper anything).
    const tampered = (signed[0] === "A" ? "B" : "A") + signed.slice(1);
    expect(verifyCookiePayload(tampered, secret)).toBeNull();
  });

  it("rejects expired payload", () => {
    const secret = "test-secret";
    const signed = signCookiePayload({ exp: Date.now() - 1 }, secret);
    expect(verifyCookiePayload(signed, secret)).toBeNull();
  });
});
