import type { MovementBase } from "../types";

/** Curated base lifts. Variants are generated from these (see logic/movements.ts). The coach
 *  owns this list; accessories are extensible. `posicion` is applied by the generator (not here). */
export const MOVEMENT_BASES: MovementBase[] = [
  { id: "arranque", name: "Arranque", aliasEn: "Snatch", rmRef: "arranque", baseComplexity: 9,
    axes: { captura: ["completo", "potencia"], origen: ["piso", "bloques", "colgado"] },
    allowedFlags: ["pausa", "deficit", "sin-recibida"], substituteBases: ["tiron-arranque", "sentadilla-overhead"] },
  { id: "cargada", name: "Cargada", aliasEn: "Clean", rmRef: "envion", baseComplexity: 8,
    axes: { captura: ["completo", "potencia"], origen: ["piso", "bloques", "colgado"] },
    allowedFlags: ["pausa", "deficit"], substituteBases: ["tiron-cargada", "sentadilla-frente"],
    notes: "el clean aislado suele superar el RM de envión (C&J) → SP2/coach programa el % alto cerca del máx" },
  // Curaduría owner 2026-06-11 (oráculo El Carnicero): en competencia "envión" = el C&J COMPLETO
  // (consistente con el RM "Envión"); el jerk aislado en Chile es "segundo tiempo". Los ids NO
  // cambian jamás (recetas/seeds/actuals los referencian) — sólo se cura el `name`.
  { id: "envion", name: "Segundo tiempo", aliasEn: "Jerk", rmRef: "envion", baseComplexity: 7,
    axes: { tipoEnvion: ["tijera", "empuje", "potencia", "fuerza"] },
    allowedFlags: ["pausa"], substituteBases: ["press-empuje"] },
  { id: "cargada-envion", name: "Envión", aliasEn: "Clean and Jerk", rmRef: "envion", baseComplexity: 9,
    axes: { captura: ["completo", "potencia"], origen: ["piso", "bloques", "colgado"] },
    allowedFlags: ["pausa"], substituteBases: ["cargada", "envion"] },
  { id: "tiron-arranque", name: "Tirón de arranque", aliasEn: "Snatch pull", rmRef: "arranque", baseComplexity: 5,
    axes: { origen: ["piso", "bloques", "colgado"] },
    allowedFlags: ["deficit", "pausa"], substituteBases: ["tiron-cargada"], notes: "se programa 90–110%; sustituto = otro patrón de tirón, NO el lift completo" },
  { id: "tiron-cargada", name: "Tirón de cargada", aliasEn: "Clean pull", rmRef: "envion", baseComplexity: 5,
    axes: { origen: ["piso", "bloques", "colgado"] },
    allowedFlags: ["deficit", "pausa"], substituteBases: ["tiron-arranque", "peso-muerto-rumano"], notes: "se programa 90–110%; sustituto = otro patrón de tirón, NO el lift completo" },
  { id: "sentadilla", name: "Sentadilla trasera", aliasEn: "Back squat", rmRef: "sentadilla", baseComplexity: 4,
    axes: {}, allowedFlags: ["pausa", "tempo"], substituteBases: ["sentadilla-frente"] },
  { id: "sentadilla-frente", name: "Sentadilla frontal", aliasEn: "Front squat", rmRef: "frente", baseComplexity: 5,
    axes: {}, allowedFlags: ["pausa", "tempo"], substituteBases: ["sentadilla"] },
  { id: "sentadilla-overhead", name: "Sentadilla de arranque", aliasEn: "Overhead squat", rmRef: "arranque", baseComplexity: 5,
    axes: {}, allowedFlags: ["pausa"], substituteBases: ["sentadilla-frente"],
    notes: "se programa frecuentemente al 80–95% del arranque" },
  { id: "press-empuje", name: "Press de empuje", aliasEn: "Push press", rmRef: "envion", baseComplexity: 3,
    axes: {}, allowedFlags: ["pausa"], substituteBases: ["press-hombros"] },
  { id: "press-hombros", name: "Press militar", aliasEn: "Strict press", rmRef: "envion", baseComplexity: 2,
    axes: {}, allowedFlags: ["tempo"], substituteBases: ["press-empuje"] },
  { id: "peso-muerto-rumano", name: "Peso muerto rumano", aliasEn: "Romanian deadlift", rmRef: "sentadilla", baseComplexity: 2,
    axes: {}, allowedFlags: ["tempo", "pausa"], substituteBases: ["tiron-cargada"] },
  { id: "buenos-dias", name: "Buenos días", aliasEn: "Good morning", rmRef: "sentadilla", baseComplexity: 2,
    axes: {}, allowedFlags: ["tempo"], substituteBases: ["peso-muerto-rumano"] },
  { id: "remo", name: "Remo con barra", aliasEn: "Barbell row", rmRef: "envion", baseComplexity: 2,
    axes: {}, allowedFlags: ["pausa"], substituteBases: [] },
];
