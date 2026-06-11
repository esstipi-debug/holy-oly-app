import type { MacroRecipe } from "../types";
import { MACROCYCLES } from "./macrocycles";
import { MACRO_RECIPES } from "./recipes";
import { dnaForFamily } from "./schools";
import { generateRecipe } from "../logic/recipeGen";

/** Congela receta + fases + sesiones + ejercicios (freeze superficial dejaba los anidados
 *  mutables — un push de un consumidor corrompería el catálogo para todo el proceso). */
function deepFreezeRecipe(r: MacroRecipe): MacroRecipe {
  for (const ph of r.phases) {
    for (const s of ph.sessions) {
      for (const ex of s.exercises) Object.freeze(ex);
      Object.freeze(s.exercises);
      Object.freeze(s);
    }
    Object.freeze(ph.sessions);
    Object.freeze(ph);
  }
  Object.freeze(r.phases);
  return Object.freeze(r);
}

/** El catálogo COMPLETO de recetas (D2/D4): las curadas a mano (recipes.ts) mandan; el resto
 *  se genera determinísticamente desde el ADN de su escuela EN IMPORT — mismo código + mismos
 *  datos ⇒ mismas recetas, siempre (el snapshot commiteado en recipesAll.test.ts es el
 *  artefacto auditable). Consumidores: usar SIEMPRE esto, no MACRO_RECIPES directo. */
export const ALL_RECIPES: readonly MacroRecipe[] = Object.freeze(
  MACROCYCLES.map((m) => {
    const curated = MACRO_RECIPES.find((r) => r.macroId === m.id);
    if (curated) return curated;
    const dna = dnaForFamily(m.family);
    return dna ? generateRecipe(dna, m) : null;
  })
    .filter((r): r is MacroRecipe => r !== null)
    .map(deepFreezeRecipe),
);

const BY_MACRO = new Map(ALL_RECIPES.map((r) => [r.macroId, r]));

/** Referencia VIVA al catálogo congelado (deep-freeze) — no mutar; clonar si hay que editar. */
export function recipeFor(macroId: string): MacroRecipe | undefined {
  return BY_MACRO.get(macroId);
}
