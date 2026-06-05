import { describe, it, expect } from "vitest";
import { PrescribedExerciseViewSchema } from "./schemas";

describe("PrescribedExerciseViewSchema · warmup", () => {
  it("acepta y conserva warmup", () => {
    const v = PrescribedExerciseViewSchema.parse({
      movementId: "arranque", sets: 5, reps: 2, pct: 80, movementName: "Arranque", targetKg: 64,
      warmup: [{ pct: 0, kg: 15, reps: 5, label: "barra" }],
    });
    expect(v.warmup).toHaveLength(1);
  });
  it("defaultea warmup a [] cuando falta", () => {
    const v = PrescribedExerciseViewSchema.parse({ movementId: "arranque", sets: 5, reps: 2, movementName: "Arranque" });
    expect(v.warmup).toEqual([]);
  });
});
