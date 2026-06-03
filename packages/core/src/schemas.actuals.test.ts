import { describe, it, expect } from "vitest";
import { SessionActualsInputSchema } from "./schemas";

describe("SessionActualsInputSchema", () => {
  it("accepts a valid per-exercise actuals body", () => {
    expect(SessionActualsInputSchema.safeParse([
      { order: 0, movementId: "arranque", done: true, kg: 58, reps: 3, rpe: 8 },
      { order: 1, movementId: "sentadilla", done: false, note: "molestia rodilla" },
    ]).success).toBe(true);
  });
  it("rejects bad order / kg / rpe / reps", () => {
    expect(SessionActualsInputSchema.safeParse([{ order: -1, movementId: "x", done: true }]).success).toBe(false);
    expect(SessionActualsInputSchema.safeParse([{ order: 0, movementId: "x", done: true, kg: 999 }]).success).toBe(false);
    expect(SessionActualsInputSchema.safeParse([{ order: 0, movementId: "x", done: true, rpe: 11 }]).success).toBe(false);
    expect(SessionActualsInputSchema.safeParse([{ order: 0, movementId: "x", done: true, reps: 200 }]).success).toBe(false);
  });
});
