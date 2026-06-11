import { describe, it, expect } from "vitest";
import type { SessionView, SessionActual, SetActual } from "../types";
import { mergeActuals, kgDeviation, summarizeSets } from "./actuals";

const views: SessionView[] = [{
  week: 1, sessionIdx: 0, exercises: [
    { movementId: "arranque", sets: 5, reps: 3, pct: 70, movementName: "Arranque", targetKg: 56 },
    { movementId: "sentadilla", sets: 5, reps: 5, pct: 80, movementName: "Sentadilla", targetKg: 112 },
  ],
}];
const rows: SessionActual[] = [
  { week: 1, sessionIdx: 0, order: 0, movementId: "arranque", done: true, actualKg: 58, actualReps: 3 },
];

describe("mergeActuals", () => {
  it("attaches the actual to the matching exercise by (week, sessionIdx, order=index)", () => {
    const merged = mergeActuals(views, rows);
    expect(merged[0]!.exercises[0]!.actual).toMatchObject({ done: true, kg: 58, reps: 3, note: undefined });
    expect(merged[0]!.exercises[1]!.actual).toBeUndefined();
  });
  it("is a no-op when there are no rows", () => {
    expect(mergeActuals(views, [])[0]!.exercises[0]!.actual).toBeUndefined();
  });
  it("ignores a row whose order is beyond the exercise count", () => {
    const merged = mergeActuals(views, [{ week: 1, sessionIdx: 0, order: 5, movementId: "x", done: true, actualKg: 99 }]);
    expect(merged[0]!.exercises[0]!.actual).toBeUndefined();
    expect(merged[0]!.exercises[1]!.actual).toBeUndefined();
  });

  it("flags a substitution: actual.movementId ≠ prescribedMovementId", () => {
    const v: SessionView[] = [{ week: 1, sessionIdx: 0, exercises: [
      { movementId: "arranque", sets: 5, reps: 2, pct: 80, movementName: "Arranque", targetKg: 64 },
    ] }];
    const r: SessionActual[] = [{ week: 1, sessionIdx: 0, order: 0, movementId: "arranque.potencia.colgado.rodilla", prescribedMovementId: "arranque", done: true, actualKg: 55 }];
    const a = mergeActuals(v, r)[0]!.exercises[0]!.actual!;
    expect(a.substituted).toBe(true);
    expect(a.desfasado).toBe(false);
    expect(a.movementId).toBe("arranque.potencia.colgado.rodilla");
    expect(a.movementName).toMatch(/Arranque de potencia desde colgado/);
  });

  it("flags desfase: prescribedMovementId ≠ the current slot's movement (coach edited after)", () => {
    const v: SessionView[] = [{ week: 1, sessionIdx: 0, exercises: [
      { movementId: "sentadilla", sets: 5, reps: 5, pct: 80, movementName: "Sentadilla", targetKg: 112 },
    ] }];
    const r: SessionActual[] = [{ week: 1, sessionIdx: 0, order: 0, movementId: "arranque", prescribedMovementId: "arranque", done: true, actualKg: 60 }];
    const a = mergeActuals(v, r)[0]!.exercises[0]!.actual!;
    expect(a.desfasado).toBe(true);
    expect(a.substituted).toBe(false);
  });

  it("SP3 rows (no prescribedMovementId) are not substituted/desfasado", () => {
    const v: SessionView[] = [{ week: 1, sessionIdx: 0, exercises: [
      { movementId: "arranque", sets: 5, reps: 3, pct: 70, movementName: "Arranque", targetKg: 56 },
    ] }];
    const r: SessionActual[] = [{ week: 1, sessionIdx: 0, order: 0, movementId: "arranque", done: true, actualKg: 58 }];
    const a = mergeActuals(v, r)[0]!.exercises[0]!.actual!;
    expect(a.substituted).toBe(false);
    expect(a.desfasado).toBe(false);
    expect(a.movementId).toBe("arranque");
    expect(a.movementName).toMatch(/Arranque/);
  });
  it("flags both substituted and desfasado: athlete swapped, then coach edited the slot", () => {
    const v: SessionView[] = [{ week: 1, sessionIdx: 0, exercises: [
      { movementId: "sentadilla", sets: 5, reps: 5, pct: 80, movementName: "Sentadilla", targetKg: 112 },
    ] }];
    const r: SessionActual[] = [{ week: 1, sessionIdx: 0, order: 0, movementId: "arranque.potencia.colgado.rodilla", prescribedMovementId: "arranque", done: true, actualKg: 55 }];
    const a = mergeActuals(v, r)[0]!.exercises[0]!.actual!;
    expect(a.substituted).toBe(true);
    expect(a.desfasado).toBe(true);
  });

  it("adjunta las series (sets) del row al actual mergeado", () => {
    const r: SessionActual[] = [{
      week: 1, sessionIdx: 0, order: 0, movementId: "arranque", done: true, actualKg: 64,
      sets: [{ kg: 64, reps: 2, done: true }, { kg: 60, reps: 2, done: true }],
    }];
    const a = mergeActuals(views, r)[0]!.exercises[0]!.actual!;
    expect(a.sets).toHaveLength(2);
    expect(a.sets![1]).toEqual({ kg: 60, reps: 2, done: true });
  });

  it("el actual mergeado no expone rpe", () => {
    const v: SessionView[] = [{ week: 1, sessionIdx: 0, exercises: [
      { movementId: "arranque", sets: 5, reps: 2, pct: 80, movementName: "Arranque", targetKg: 64 } ]}];
    const rows: SessionActual[] = [{ week: 1, sessionIdx: 0, order: 0, movementId: "arranque", done: true, actualKg: 60 }];
    const a = mergeActuals(v, rows)[0]!.exercises[0]!.actual!;
    expect((a as { rpe?: number }).rpe).toBeUndefined();
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

describe("summarizeSets", () => {
  it("resumen = top set (máximo kg hecho)", () => {
    const sets: SetActual[] = [
      { kg: 90, reps: 2, done: true }, { kg: 90, reps: 2, done: true }, { kg: 85, reps: 2, done: true },
    ];
    expect(summarizeSets(sets)).toEqual({ done: true, kg: 90, reps: 2 });
  });
  it("ninguna serie hecha → done:false sin kg", () => {
    expect(summarizeSets([{ kg: 90, reps: 2, done: false }])).toEqual({ done: false });
  });
  it("series hechas sin kg (sustituido) → done:true, kg undefined", () => {
    expect(summarizeSets([{ reps: 3, done: true }])).toEqual({ done: true, kg: undefined, reps: 3 });
  });
});
