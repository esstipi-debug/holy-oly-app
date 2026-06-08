import { describe, it, expect, beforeEach } from "vitest";
import {
  isAccountLocked,
  recordLoginFailure,
  clearLoginFailures,
  resetLockoutStore,
  lockoutStoreSize,
  MAX_LOGIN_FAILS,
  LOGIN_LOCK_MS,
} from "./lockout";

describe("login lockout (per-account, IP-independent)", () => {
  beforeEach(() => resetLockoutStore());

  it("locks an account after MAX_LOGIN_FAILS failures", () => {
    const email = "a@x.com";
    for (let i = 0; i < MAX_LOGIN_FAILS; i++) {
      expect(isAccountLocked(email)).toBe(false);
      recordLoginFailure(email);
    }
    expect(isAccountLocked(email)).toBe(true);
  });

  it("is per-account: a different email stays unlocked", () => {
    for (let i = 0; i < MAX_LOGIN_FAILS; i++) recordLoginFailure("victim@x.com");
    expect(isAccountLocked("victim@x.com")).toBe(true);
    expect(isAccountLocked("other@x.com")).toBe(false);
  });

  it("a successful login (clearLoginFailures) resets the counter", () => {
    for (let i = 0; i < MAX_LOGIN_FAILS - 1; i++) recordLoginFailure("a@x.com");
    clearLoginFailures("a@x.com");
    recordLoginFailure("a@x.com");
    expect(isAccountLocked("a@x.com")).toBe(false);
  });

  it("unlocks after the lock window elapses", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < MAX_LOGIN_FAILS; i++) recordLoginFailure("a@x.com", t0);
    expect(isAccountLocked("a@x.com", t0)).toBe(true);
    expect(isAccountLocked("a@x.com", t0 + LOGIN_LOCK_MS + 1)).toBe(false);
  });

  it("evicts an expired entry on read (no unbounded growth — DoS guard)", () => {
    const t0 = 2_000_000;
    for (let i = 0; i < MAX_LOGIN_FAILS; i++) recordLoginFailure("z@x.com", t0);
    expect(lockoutStoreSize()).toBe(1);
    expect(isAccountLocked("z@x.com", t0 + LOGIN_LOCK_MS + 1)).toBe(false);
    expect(lockoutStoreSize()).toBe(0);
  });
});
