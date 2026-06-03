import type { ExerciseActual, SessionActual, SessionView } from "../types";

/** Attach each athlete actual to its prescribed exercise. Exercises in a SessionView are ordered by
 *  `order` (0-based, contiguous from instantiation/edit), so the view index == the row's `order`. */
export function mergeActuals(views: SessionView[], rows: SessionActual[]): SessionView[] {
  return views.map((v) => ({
    ...v,
    exercises: v.exercises.map((e, i) => {
      const a = rows.find((r) => r.week === v.week && r.sessionIdx === v.sessionIdx && r.order === i);
      if (!a) return e;
      const actual: ExerciseActual = { done: a.done, kg: a.actualKg, reps: a.actualReps, rpe: a.actualRpe, note: a.note };
      return { ...e, actual };
    }),
  }));
}

/** Real-vs-target classification for the coach's deviation marker. `none` when either side is missing. */
export function kgDeviation(targetKg: number | undefined, actualKg: number | undefined): "none" | "igual" | "mas" | "menos" {
  if (targetKg == null || actualKg == null) return "none";
  if (actualKg > targetKg) return "mas";
  if (actualKg < targetKg) return "menos";
  return "igual";
}
