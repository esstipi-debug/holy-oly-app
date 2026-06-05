import type { ExerciseActual, SessionActual, SessionView, SetActual } from "../types";
import { getMovement } from "./movements";

/** Attach each athlete actual to its prescribed exercise. Exercises in a SessionView are ordered by
 *  `order` (0-based, contiguous from instantiation/edit), so the view index == the row's `order`. */
export function mergeActuals(views: SessionView[], rows: SessionActual[]): SessionView[] {
  return views.map((v) => ({
    ...v,
    exercises: v.exercises.map((e, i) => {
      const a = rows.find((r) => r.week === v.week && r.sessionIdx === v.sessionIdx && r.order === i);
      if (!a) return e;
      const prescribed = a.prescribedMovementId ?? e.movementId;
      const actual: ExerciseActual = {
        done: a.done, kg: a.actualKg, reps: a.actualReps, note: a.note,
        movementId: a.movementId,
        movementName: getMovement(a.movementId)?.name ?? a.movementId,
        substituted: a.movementId !== prescribed,
        desfasado: a.prescribedMovementId != null && a.prescribedMovementId !== e.movementId,
        sets: a.sets,
      };
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

/** Resumen por ejercicio a partir de las series (para coach/charts). Top set = máximo kg hecho. */
export function summarizeSets(sets: SetActual[]): { done: boolean; kg?: number; reps?: number } {
  const done = sets.filter((s) => s.done);
  if (done.length === 0) return { done: false };
  const top = done.reduce((a, b) => ((b.kg ?? -Infinity) > (a.kg ?? -Infinity) ? b : a));
  return { done: true, kg: top.kg, reps: top.reps };
}
