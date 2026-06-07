import { describe, it, expect } from "vitest";
import { MemStorage } from "../test-utils/MemStorage";
import { isTourSeen, markTourSeen, TOUR_SEEN_KEY } from "./demoTour";

describe("demoTour", () => {
  it("starts unseen, becomes seen after markTourSeen", () => {
    const s = new MemStorage();
    expect(isTourSeen(s)).toBe(false);
    markTourSeen(s);
    expect(isTourSeen(s)).toBe(true);
    expect(s.getItem(TOUR_SEEN_KEY)).toBe("1");
  });

  it("uses the ho: namespace so a demo reset clears it", () => {
    expect(TOUR_SEEN_KEY.startsWith("ho:")).toBe(true);
  });
});
