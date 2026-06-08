import { describe, expect, it } from "vitest";
import { signCookiePayload, verifyCookiePayload } from "./signed-cookie";

describe("signed-cookie", () => {
  it("round-trips and rejects tampering", () => {
    const secret = "test-secret";
    const payload = { nonce: "abc", exp: Date.now() + 60_000 };
    const signed = signCookiePayload(payload, secret);
    const ok = verifyCookiePayload<{ nonce: string; exp: number }>(signed, secret);
    expect(ok?.nonce).toBe("abc");

    const tampered = signed.replace("abc", "abd");
    expect(verifyCookiePayload(tampered, secret)).toBeNull();
  });

  it("rejects expired payload", () => {
    const secret = "test-secret";
    const signed = signCookiePayload({ exp: Date.now() - 1 }, secret);
    expect(verifyCookiePayload(signed, secret)).toBeNull();
  });
});
