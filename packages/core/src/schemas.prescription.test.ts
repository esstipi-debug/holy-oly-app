import { describe, it, expect } from "vitest";
import { PrescribedExercisesSchema, SessionViewsSchema } from "./schemas";

describe("PrescribedExercisesSchema", () => {
  it("accepts a valid session body", () => {
    expect(PrescribedExercisesSchema.safeParse([
      { movementId: "arranque", sets: 5, reps: 2, pct: 80 },
      { movementId: "peso-muerto-rumano", sets: 3, reps: 8, flags: ["pausa"] },
    ]).success).toBe(true);
  });
  it("rejects out-of-range pct / non-positive sets", () => {
    expect(PrescribedExercisesSchema.safeParse([{ movementId: "arranque", sets: 0, reps: 2 }]).success).toBe(false);
    expect(PrescribedExercisesSchema.safeParse([{ movementId: "arranque", sets: 5, reps: 2, pct: 130 }]).success).toBe(false);
  });
});

describe("SessionViewsSchema", () => {
  it("accepts a derived session view", () => {
    expect(SessionViewsSchema.safeParse([
      { week: 1, sessionIdx: 0, exercises: [{ movementId: "arranque", sets: 5, reps: 2, pct: 80, movementName: "Arranque", targetKg: 64 }] },
    ]).success).toBe(true);
  });
});
