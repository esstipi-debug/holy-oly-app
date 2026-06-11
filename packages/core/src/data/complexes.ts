import type { ComplexDef } from "../types";

/** Catálogo curado de complejos (D6). Composición de movimientos EXISTENTES de la librería;
 *  una serie = los eslabones en orden con UNA barra. Techos en logic/complexes.ts (D7):
 *  reps por eslabón ≤ repsMax.enComplejo, total ≤ 6, % máximo inverso al largo, % contra el
 *  eslabón más débil. Los ids quedan congelados (las recetas generadas los referencian). */
export const COMPLEXES: ComplexDef[] = [
  // ── De arranque ──────────────────────────────────────────
  { id: "cx.tiron-arranque+arranque", name: "Tirón de arranque + Arranque (2+1)",
    links: [{ movementId: "tiron-arranque", reps: 2 }, { movementId: "arranque", reps: 1 }],
    notes: "fuerza de tirón → transferencia técnica inmediata" },
  { id: "cx.arranque+ohs", name: "Arranque + Sentadilla de arranque (1+2)",
    links: [{ movementId: "arranque", reps: 1 }, { movementId: "sentadilla-overhead", reps: 2 }],
    notes: "confianza en la recepción profunda" },
  { id: "cx.arranque-potencia+arranque", name: "Arranque de potencia + Arranque (1+1)",
    links: [{ movementId: "arranque.potencia", reps: 1 }, { movementId: "arranque", reps: 1 }],
    notes: "velocidad → profundidad (firma cubana)" },
  { id: "cx.arranque-colgado+arranque", name: "Arranque desde colgado + Arranque (1+1)",
    links: [{ movementId: "arranque.colgado.rodilla", reps: 1 }, { movementId: "arranque", reps: 1 }],
    notes: "posición sobre la rodilla → tirón completo" },
  { id: "cx.tiron-arranque+arranque+ohs", name: "Tirón + Arranque + Sent. de arranque (1+1+1)",
    links: [{ movementId: "tiron-arranque", reps: 1 }, { movementId: "arranque", reps: 1 }, { movementId: "sentadilla-overhead", reps: 1 }],
    notes: "bloque completo de acumulación" },

  // ── De cargada / envión ──────────────────────────────────
  { id: "cx.cargada+frontal+2t", name: "Cargada + Sent. frontal + Segundo tiempo (1+1+1)",
    links: [{ movementId: "cargada", reps: 1 }, { movementId: "sentadilla-frente", reps: 1 }, { movementId: "envion.tijera", reps: 1 }],
    notes: "el complejo rey del C&J — el techo lo pone el jerk" },
  { id: "cx.cargada+2t-doble", name: "Cargada + Segundo tiempo ×2 (1+2)",
    links: [{ movementId: "cargada", reps: 1 }, { movementId: "envion.tijera", reps: 2 }],
    notes: "resistencia del jerk bajo fatiga" },
  { id: "cx.tiron-cargada+cargada", name: "Tirón de cargada + Cargada (2+1)",
    links: [{ movementId: "tiron-cargada", reps: 2 }, { movementId: "cargada", reps: 1 }],
    notes: "fuerza de tirón pesada → técnica" },
  { id: "cx.cargada-potencia+frontal", name: "Cargada de potencia + Sent. frontal (1+2)",
    links: [{ movementId: "cargada.potencia", reps: 1 }, { movementId: "sentadilla-frente", reps: 2 }],
    notes: "recepción alta + pierna" },
  { id: "cx.press-empuje+2t", name: "Press de empuje + Segundo tiempo (1+1)",
    links: [{ movementId: "press-empuje", reps: 1 }, { movementId: "envion.tijera", reps: 1 }],
    notes: "drive del jerk (para el jerk débil)" },
];
