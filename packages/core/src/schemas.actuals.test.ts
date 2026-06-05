import { describe, it, expect } from "vitest";
import { SessionActualsInputSchema, ExerciseActualSchema, ExerciseActualInputSchema } from "./schemas";

describe("SessionActualsInputSchema", () => {
  it("accepts a valid per-exercise actuals body", () => {
    expect(SessionActualsInputSchema.safeParse([
      { order: 0, movementId: "arranque", done: true, kg: 58, reps: 3 },
      { order: 1, movementId: "sentadilla", done: false, note: "molestia rodilla" },
    ]).success).toBe(true);
  });
  it("rejects bad order / kg / reps", () => {
    expect(SessionActualsInputSchema.safeParse([{ order: -1, movementId: "x", done: true }]).success).toBe(false);
    expect(SessionActualsInputSchema.safeParse([{ order: 0, movementId: "x", done: true, kg: 999 }]).success).toBe(false);
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

describe("ExerciseActualInputSchema · sets", () => {
  it("acepta sets acotados", () => {
    const r = ExerciseActualInputSchema.parse({
      order: 0, movementId: "arranque", done: true,
      sets: [{ kg: 90, reps: 2, done: true }, { reps: 0, done: false }],
    });
    expect(r.sets).toHaveLength(2);
  });
  it("rechaza más de 20 series", () => {
    const many = Array.from({ length: 21 }, () => ({ kg: 50, reps: 1, done: true }));
    expect(ExerciseActualInputSchema.safeParse({ order: 0, movementId: "x", done: true, sets: many }).success).toBe(false);
  });
});
