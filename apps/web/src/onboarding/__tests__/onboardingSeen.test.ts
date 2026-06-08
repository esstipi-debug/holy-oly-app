import { describe, it, expect } from "vitest";
import { MemStorage } from "../../test-utils/MemStorage";
import { onboardingKey, isOnboardingSeen, markOnboardingSeen } from "../onboardingSeen";

describe("onboardingSeen", () => {
  it("builds a per-user key under the ho: namespace", () => {
    expect(onboardingKey("user-123")).toBe("ho:onboard:user-123");
  });

  it("round-trips unseen -> seen for a given key", () => {
    const s = new MemStorage();
    const key = onboardingKey("u1");
    expect(isOnboardingSeen(s, key)).toBe(false);
    markOnboardingSeen(s, key);
    expect(isOnboardingSeen(s, key)).toBe(true);
  });

  it("keeps users isolated (one seen does not mark another)", () => {
    const s = new MemStorage();
    markOnboardingSeen(s, onboardingKey("u1"));
    expect(isOnboardingSeen(s, onboardingKey("u2"))).toBe(false);
  });

  it("degrades to seen=true when storage reads throw (private mode)", () => {
    const throwing: Storage = {
      get length() { return 0; },
      clear() {},
      getItem() { throw new Error("blocked"); },
      key() { return null; },
      removeItem() {},
      setItem() {},
    };
    expect(isOnboardingSeen(throwing, "ho:onboard:x")).toBe(true);
  });
});
