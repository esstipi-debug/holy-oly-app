import type { PrescribedExerciseView, SetActual } from "../types";

/** Tonelaje de una serie: kg×reps sólo si está hecha y tiene ambos datos. 0 en otro caso. */
export function setTonnage(set: SetActual): number {
  return set.done && set.kg != null && set.reps != null ? set.kg * set.reps : 0;
}

/** Carga de TRABAJO de la sesión = suma del tonelaje de las series hechas de todos los
 *  ejercicios. El calentamiento NO entra acá (vive en exercise.warmup, nunca en actual.sets) —
 *  su volumen se reporta aparte vía `warmupTonnage`. */
export function sessionTonnage(exercises: PrescribedExerciseView[]): number {
  return exercises.reduce(
    (sum, e) => sum + (e.actual?.sets ?? []).reduce((s, set) => s + setTonnage(set), 0),
    0,
  );
}

/** ¿El ejercicio cuenta como hecho? (≥1 serie hecha; sin series, el flag done). */
function exerciseDone(e: PrescribedExerciseView): boolean {
  const sets = e.actual?.sets;
  if (sets && sets.length > 0) return sets.some((s) => s.done);
  return e.actual?.done === true;
}

/** Tonelaje del CALENTAMIENTO (decisión owner 2026-06-11: la rampa cuenta como volumen de base
 *  para hipertrofia + afinación técnica, VISIBLE en superficies del atleta). Es un ESTIMADO:
 *  suma la rampa PRESCRITA (kg×reps) de los ejercicios hechos; la rampa no se registra serie a
 *  serie. Ejercicio sustituido en vivo → su rampa no se mostró → no suma.
 *  NEVER entra a ACWR/IMR/MonitorSeries/semáforo (rulebook §3): la rampa es casi-constante por
 *  sesión y metería un sumando parejo en aguda Y crónica → comprime el ratio → falso-ok. */
export function warmupTonnage(exercises: PrescribedExerciseView[]): number {
  return exercises.reduce((sum, e) => {
    if (!exerciseDone(e) || e.actual?.substituted) return sum;
    return sum + (e.warmup ?? []).reduce((s, w) => s + w.kg * w.reps, 0);
  }, 0);
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
  return { done: exercises.filter(exerciseDone).length, total: exercises.length };
}
