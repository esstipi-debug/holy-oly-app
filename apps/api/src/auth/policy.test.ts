import { describe, it, expect } from "vitest";
import { SignupSchema } from "./schemas";
import { dummyHash, verifyPassword } from "./password";

describe("SignupSchema password policy (B5)", () => {
  const base = { email: "a@b.com", role: "atleta" as const };

  it("rejects passwords shorter than 8 chars", () => {
    expect(SignupSchema.safeParse({ ...base, password: "short12" }).success).toBe(false); // 7
  });

  it("accepts an 8-char password (the minimum)", () => {
    expect(SignupSchema.safeParse({ ...base, password: "x9k2-Lm7" }).success).toBe(true); // 8, not common
  });

  it("rejects common passwords even when long enough", () => {
    expect(SignupSchema.safeParse({ ...base, password: "password1234" }).success).toBe(false);
  });

  it("rejects a common 8-char password (block stays meaningful at the floor)", () => {
    expect(SignupSchema.safeParse({ ...base, password: "password" }).success).toBe(false); // 8, common
  });

  it("accepts a strong 12+ char password", () => {
    expect(SignupSchema.safeParse({ ...base, password: "x9k2-Lm7-Qp4w" }).success).toBe(true);
  });
});

describe("dummy hash (B1 anti-enumeration timing)", () => {
  it("dummyHash is a real argon2 hash, so verify runs even when the user doesn't exist", async () => {
    const h = await dummyHash();
    expect(typeof h).toBe("string");
    expect(h.length).toBeGreaterThan(0);
    expect(await verifyPassword(h, "whatever-the-attacker-typed")).toBe(false);
  });
});
