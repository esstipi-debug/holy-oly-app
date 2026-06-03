import { describe, it, expect } from "vitest";
import type { SessionView, SessionActual } from "../types";
import { mergeActuals, kgDeviation } from "./actuals";

const views: SessionView[] = [{
  week: 1, sessionIdx: 0, exercises: [
    { movementId: "arranque", sets: 5, reps: 3, pct: 70, movementName: "Arranque", targetKg: 56 },
    { movementId: "sentadilla", sets: 5, reps: 5, pct: 80, movementName: "Sentadilla", targetKg: 112 },
  ],
}];
const rows: SessionActual[] = [
  { week: 1, sessionIdx: 0, order: 0, movementId: "arranque", done: true, actualKg: 58, actualReps: 3, actualRpe: 8 },
];

describe("mergeActuals", () => {
  it("attaches the actual to the matching exercise by (week, sessionIdx, order=index)", () => {
    const merged = mergeActuals(views, rows);
    expect(merged[0]!.exercises[0]!.actual).toEqual({ done: true, kg: 58, reps: 3, rpe: 8, note: undefined });
    expect(merged[0]!.exercises[1]!.actual).toBeUndefined();
  });
  it("is a no-op when there are no rows", () => {
    expect(mergeActuals(views, [])[0]!.exercises[0]!.actual).toBeUndefined();
  });
});

describe("kgDeviation", () => {
  it("classifies real vs target", () => {
    expect(kgDeviation(56, 58)).toBe("mas");
    expect(kgDeviation(56, 54)).toBe("menos");
    expect(kgDeviation(56, 56)).toBe("igual");
    expect(kgDeviation(undefined, 56)).toBe("none");
    expect(kgDeviation(56, undefined)).toBe("none");
  });
});
