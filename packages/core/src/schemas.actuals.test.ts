import { describe, it, expect } from "vitest";
import { SessionActualsInputSchema, ExerciseActualSchema } from "./schemas";

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
  it("accepts an item with prescribedMovementId (SP4)", () => {
    expect(SessionActualsInputSchema.safeParse([
      { order: 0, movementId: "arranque-pausa", done: true, kg: 60, prescribedMovementId: "arranque" },
    ]).success).toBe(true);
  });
  it("accepts an item without prescribedMovementId (SP3 backward-compat)", () => {
    expect(SessionActualsInputSchema.safeParse([
      { order: 0, movementId: "arranque", done: true },
    ]).success).toBe(true);
  });
});

describe("ExerciseActualSchema (view-side)", () => {
  it("accepts a full actual with substitution flags", () => {
    expect(ExerciseActualSchema.safeParse({
      done: true,
      kg: 60,
      reps: 3,
      rpe: 8,
      note: "bien",
      movementId: "arranque-pausa",
      movementName: "Arranque con Pausa",
      substituted: true,
      desfasado: false,
    }).success).toBe(true);
  });
  it("rejects a view actual missing movementId / movementName / substituted / desfasado", () => {
    expect(ExerciseActualSchema.safeParse({ done: true }).success).toBe(false);
    expect(ExerciseActualSchema.safeParse({ done: true, movementId: "x", movementName: "X", substituted: true }).success).toBe(false);
    expect(ExerciseActualSchema.safeParse({ done: true, movementId: "x", movementName: "X", desfasado: false }).success).toBe(false);
  });
});
