import { describe, it, expect } from "vitest";
import { MemStorage } from "../test-utils/MemStorage";
import { resetDemoStorage } from "./resetDemo";

describe("resetDemoStorage", () => {
  it("removes ho:/holyoly: keys, leaves others, returns the count", () => {
    const s = new MemStorage();
    s.setItem("ho:roster", "[]");
    s.setItem("ho:seeded", "5");
    s.setItem("ho:daylog:kv", "[]");
    s.setItem("holyoly:prescription:kv", "[]");
    s.setItem("other:thing", "keep");

    const n = resetDemoStorage(s);

    expect(n).toBe(4);
    expect(s.getItem("ho:roster")).toBeNull();
    expect(s.getItem("ho:seeded")).toBeNull();
    expect(s.getItem("holyoly:prescription:kv")).toBeNull();
    expect(s.getItem("other:thing")).toBe("keep"); // non-demo prefix survives
  });

  it("is a no-op (0) on empty storage", () => {
    expect(resetDemoStorage(new MemStorage())).toBe(0);
  });
});
