import { describe, it, expect } from "vitest";
import { weekOfDate, dateOfWeek, defaultStartDate, sessionsPerWeek } from "./schedule";

describe("weekOfDate", () => {
  const start = "2026-01-05"; // a Monday

  it("maps the start date and the rest of week 1 to week 1", () => {
    expect(weekOfDate(start, "2026-01-05", 16)).toBe(1);
    expect(weekOfDate(start, "2026-01-11", 16)).toBe(1); // +6 days, still week 1
  });

  it("rolls to the next week after 7 days", () => {
    expect(weekOfDate(start, "2026-01-12", 16)).toBe(2); // +7 days
    expect(weekOfDate(start, "2026-01-19", 16)).toBe(3); // +14 days
  });

  it("clamps to [1, totalWeeks]", () => {
    expect(weekOfDate(start, "2025-12-01", 16)).toBe(1); // before start
    expect(weekOfDate(start, "2027-01-05", 16)).toBe(16); // far past the macro
  });
});

describe("dateOfWeek", () => {
  it("returns the ISO date of a week's start", () => {
    expect(dateOfWeek("2026-01-05", 1)).toBe("2026-01-05");
    expect(dateOfWeek("2026-01-05", 3)).toBe("2026-01-19");
  });
});

describe("defaultStartDate", () => {
  it("anchors today to the current week (today − (currentWeek−1) weeks)", () => {
    expect(defaultStartDate("2026-04-06", 12)).toBe("2026-01-19");
  });

  it("round-trips: today maps back to the current week", () => {
    const sd = defaultStartDate("2026-04-06", 12);
    expect(weekOfDate(sd, "2026-04-06", 16)).toBe(12);
  });
});

describe("sessionsPerWeek", () => {
  it("reads the first integer of a frequency string", () => {
    expect(sessionsPerWeek("5d/sem")).toBe(5);
    expect(sessionsPerWeek("3d/sem")).toBe(3);
    expect(sessionsPerWeek("4-5d/sem")).toBe(4); // first integer
  });

  it("returns 0 when no count is present", () => {
    expect(sessionsPerWeek("var")).toBe(0);
    expect(sessionsPerWeek("")).toBe(0);
  });
});
