import type { PrescribedExerciseView, SetActual } from "../types";

/** Tonelaje de una serie: kg×reps sólo si está hecha y tiene ambos datos. 0 en otro caso. */
export function setTonnage(set: SetActual): number {
  return set.done && set.kg != null && set.reps != null ? set.kg * set.reps : 0;
}

/** Carga total de la sesión = suma del tonelaje de las series hechas de todos los ejercicios.
 *  El calentamiento NO entra (vive en exercise.warmup, nunca en actual.sets). */
export function sessionTonnage(exercises: PrescribedExerciseView[]): number {
  return exercises.reduce(
    (sum, e) => sum + (e.actual?.sets ?? []).reduce((s, set) => s + setTonnage(set), 0),
    0,
  );
}

/** La serie hecha de mayor kg, con el movimiento realmente ejecutado. null si ninguna tiene kg. */
export function heaviestSet(
  exercises: PrescribedExerciseView[],
): { movementName: string; kg: number } | null {
  let best: { movementName: string; kg: number } | null = null;
  for (const e of exercises) {
    const name = e.actual?.movementName ?? e.movementName;
    for (const set of e.actual?.sets ?? []) {
      if (set.done && set.kg != null && (best === null || set.kg > best.kg)) {
        best = { movementName: name, kg: set.kg };
      }
    }
  }
  return best;
}

/** Cumplimiento: cantidad de ejercicios con ≥1 serie hecha, sobre el total de ejercicios. */
export function completion(
  exercises: PrescribedExerciseView[],
): { done: number; total: number } {
  const done = exercises.filter((e) => {
    const sets = e.actual?.sets;
    if (sets && sets.length > 0) return sets.some((s) => s.done);
    return e.actual?.done === true;
  }).length;
  return { done, total: exercises.length };
}
