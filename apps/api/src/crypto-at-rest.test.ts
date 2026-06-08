import { describe, it, expect, afterEach } from "vitest";
import { encryptAtRest, decryptAtRest } from "./crypto-at-rest";

const KEY = "a".repeat(64); // 32 bytes as hex (dev/test only)
const prev = process.env.CYCLE_ENCRYPTION_KEY;
afterEach(() => {
  if (prev === undefined) delete process.env.CYCLE_ENCRYPTION_KEY;
  else process.env.CYCLE_ENCRYPTION_KEY = prev;
});

describe("crypto-at-rest (D1)", () => {
  it("round-trips with a key; ciphertext is prefixed and != plaintext", () => {
    process.env.CYCLE_ENCRYPTION_KEY = KEY;
    const enc = encryptAtRest("amenorrhea");
    expect(enc).not.toBe("amenorrhea");
    expect(enc.startsWith("enc:")).toBe(true);
    expect(decryptAtRest(enc)).toBe("amenorrhea");
  });

  it("passes through when no key is set (encryption opt-in)", () => {
    delete process.env.CYCLE_ENCRYPTION_KEY;
    expect(encryptAtRest("regular")).toBe("regular");
    expect(decryptAtRest("regular")).toBe("regular");
  });

  it("reads legacy plaintext (no prefix) as-is even with a key set", () => {
    process.env.CYCLE_ENCRYPTION_KEY = KEY;
    expect(decryptAtRest("full")).toBe("full");
  });

  it("rejects tampered ciphertext (GCM auth)", () => {
    process.env.CYCLE_ENCRYPTION_KEY = KEY;
    const enc = encryptAtRest("regular");
    const tampered = enc.slice(0, -1) + (enc.slice(-1) === "A" ? "B" : "A");
    expect(() => decryptAtRest(tampered)).toThrow();
  });

  it("uses a random IV (same plaintext → different ciphertext)", () => {
    process.env.CYCLE_ENCRYPTION_KEY = KEY;
    expect(encryptAtRest("regular")).not.toBe(encryptAtRest("regular"));
  });
});
