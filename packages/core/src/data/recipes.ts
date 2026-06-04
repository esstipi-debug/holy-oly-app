import type { MacroRecipe } from "../types";

/** Concrete session programs per macro (SP2). Starts with Ruso 5D; the coach owns/corrects these.
 *  %s of the competition lifts sit in each phase's imrPct corridor; pulls 90–110% of their lift;
 *  squats relative to their own RM; accessories by %×RM. Movement ids are from SP1. */
export const MACRO_RECIPES: MacroRecipe[] = [
  {
    macroId: "ruso-5d",
    phases: [
      { phaseKey: "hipertrofia", sessions: [
        { exercises: [{ movementId: "arranque", sets: 5, reps: 3, pct: 68 }, { movementId: "tiron-arranque", sets: 4, reps: 4, pct: 80 }, { movementId: "sentadilla", sets: 5, reps: 5, pct: 70 }] },
        { exercises: [{ movementId: "cargada-envion", sets: 5, reps: 2, pct: 68 }, { movementId: "sentadilla-frente", sets: 4, reps: 4, pct: 70 }, { movementId: "peso-muerto-rumano", sets: 3, reps: 8, pct: 60 }] },
        { exercises: [{ movementId: "arranque.potencia", sets: 5, reps: 2, pct: 62 }, { movementId: "tiron-cargada", sets: 4, reps: 4, pct: 85 }, { movementId: "press-empuje", sets: 4, reps: 5, pct: 55 }] },
        { exercises: [{ movementId: "arranque", sets: 5, reps: 3, pct: 70 }, { movementId: "sentadilla", sets: 5, reps: 3, pct: 75 }, { movementId: "sentadilla-overhead", sets: 4, reps: 3, pct: 65 }] },
        { exercises: [{ movementId: "cargada", sets: 5, reps: 2, pct: 70 }, { movementId: "envion.tijera", sets: 5, reps: 2, pct: 70 }, { movementId: "buenos-dias", sets: 3, reps: 8, pct: 40 }] },
      ] },
      { phaseKey: "fuerza-basica", sessions: [
        { exercises: [{ movementId: "arranque", sets: 5, reps: 2, pct: 78 }, { movementId: "tiron-arranque", sets: 4, reps: 3, pct: 95 }, { movementId: "sentadilla", sets: 5, reps: 4, pct: 80 }] },
        { exercises: [{ movementId: "cargada-envion", sets: 5, reps: 2, pct: 78 }, { movementId: "sentadilla-frente", sets: 4, reps: 3, pct: 78 }, { movementId: "peso-muerto-rumano", sets: 3, reps: 6, pct: 68 }] },
        { exercises: [{ movementId: "arranque.potencia", sets: 4, reps: 2, pct: 72 }, { movementId: "tiron-cargada", sets: 4, reps: 3, pct: 100 }, { movementId: "press-empuje", sets: 4, reps: 4, pct: 62 }] },
        { exercises: [{ movementId: "arranque", sets: 5, reps: 2, pct: 80 }, { movementId: "sentadilla", sets: 5, reps: 3, pct: 82 }, { movementId: "sentadilla-overhead", sets: 3, reps: 3, pct: 72 }] },
        { exercises: [{ movementId: "cargada", sets: 4, reps: 2, pct: 80 }, { movementId: "envion.tijera", sets: 5, reps: 2, pct: 78 }, { movementId: "buenos-dias", sets: 3, reps: 6, pct: 48 }] },
      ] },
      { phaseKey: "fuerza-potencia", sessions: [
        { exercises: [{ movementId: "arranque", sets: 6, reps: 1, pct: 88 }, { movementId: "tiron-arranque", sets: 4, reps: 2, pct: 105 }, { movementId: "sentadilla", sets: 5, reps: 3, pct: 88 }] },
        { exercises: [{ movementId: "cargada-envion", sets: 5, reps: 1, pct: 88 }, { movementId: "sentadilla-frente", sets: 4, reps: 2, pct: 85 }, { movementId: "peso-muerto-rumano", sets: 3, reps: 5, pct: 72 }] },
        { exercises: [{ movementId: "arranque.potencia", sets: 4, reps: 1, pct: 80 }, { movementId: "tiron-cargada", sets: 4, reps: 2, pct: 108 }, { movementId: "press-empuje", sets: 4, reps: 3, pct: 68 }] },
        { exercises: [{ movementId: "arranque", sets: 5, reps: 1, pct: 90 }, { movementId: "sentadilla", sets: 4, reps: 2, pct: 90 }, { movementId: "sentadilla-overhead", sets: 3, reps: 2, pct: 78 }] },
        { exercises: [{ movementId: "cargada", sets: 4, reps: 1, pct: 90 }, { movementId: "envion.tijera", sets: 5, reps: 1, pct: 88 }] },
      ] },
      { phaseKey: "peaking", sessions: [
        { exercises: [{ movementId: "arranque", sets: 5, reps: 1, pct: 93 }, { movementId: "sentadilla", sets: 3, reps: 2, pct: 92 }] },
        { exercises: [{ movementId: "cargada-envion", sets: 5, reps: 1, pct: 93 }, { movementId: "sentadilla-frente", sets: 3, reps: 1, pct: 90 }] },
        { exercises: [{ movementId: "arranque.potencia", sets: 3, reps: 1, pct: 85 }, { movementId: "tiron-arranque", sets: 3, reps: 1, pct: 100 }] },
        { exercises: [{ movementId: "arranque", sets: 4, reps: 1, pct: 96 }, { movementId: "sentadilla", sets: 2, reps: 1, pct: 95 }] },
        { exercises: [{ movementId: "cargada-envion", sets: 3, reps: 1, pct: 97 }] },
      ] },
    ],
  },
];
