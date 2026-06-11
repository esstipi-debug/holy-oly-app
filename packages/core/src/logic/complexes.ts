import type { ComplexDef, MovementLoads, RM, RmRef } from "../types";
import { COMPLEXES } from "../data/complexes";
import { getMovement } from "./movements";

const BY_ID = new Map<string, ComplexDef>(COMPLEXES.map((c) => [c.id, c]));

/** Los complejos viven en el namespace "cx." del campo movementId existente (cero cambio de shape). */
export function isComplexId(id: string): boolean {
  return id.startsWith("cx.");
}

export function getComplex(id: string): ComplexDef | undefined {
  return BY_ID.get(id);
}

/** Reps totales de UNA serie del complejo (suma de eslabones) — techo 6 (D7). */
export function complexTotalReps(c: ComplexDef): number {
  return c.links.reduce((acc, l) => acc + l.reps, 0);
}

/** % máximo programable, inverso al largo (D7): un complejo no se maximiza — para acercarse
 *  al RM se acorta el complejo o se vuelve al lift aislado. */
export function complexPctCeiling(c: ComplexDef): number {
  if (c.links.length <= 2) return 90;
  if (c.links.length === 3) return 85;
  return 80;
}

/** El rmRef del eslabón MÁS DÉBIL (menor RM vigente) — el % del complejo se programa contra
 *  ESTE (D6): si se calcula contra el fuerte, el débil falla. Eslabones rmRef "none" no
 *  existen en el catálogo (test de integridad). */
export function complexWeakRmRef(c: ComplexDef, rms: RM): RmRef {
  let weak: RmRef = "none";
  let weakKg = Number.POSITIVE_INFINITY;
  for (const l of c.links) {
    const mv = getMovement(l.movementId);
    if (!mv || mv.rmRef === "none") continue;
    const kg = rms[mv.rmRef];
    if (Number.isFinite(kg) && kg < weakKg) { weakKg = kg; weak = mv.rmRef; }
  }
  return weak;
}

/** El RM (kg) del eslabón débil — base del kg objetivo del complejo. NaN-safe: sin eslabón
 *  resoluble → undefined (sin-dato honesto, jamás inventar). */
export function complexWeakRmKg(c: ComplexDef, rms: RM): number | undefined {
  const ref = complexWeakRmRef(c, rms);
  if (ref === "none") return undefined;
  const kg = rms[ref];
  return Number.isFinite(kg) && kg > 0 ? kg : undefined;
}

/** Loads combinados: el costo neural/axial lo fija el peor eslabón; lo metabólico se acumula
 *  (cada rep mueve la barra), capado a 10. */
export function complexLoads(c: ComplexDef): MovementLoads {
  let snc = 1, axial = 1, metabolica = 0;
  for (const l of c.links) {
    const mv = getMovement(l.movementId);
    if (!mv) continue;
    snc = Math.max(snc, mv.loads.snc);
    axial = Math.max(axial, mv.loads.axial);
    metabolica += mv.loads.metabolica;
  }
  return { snc, axial, metabolica: Math.min(10, Math.max(1, metabolica)) };
}

/** Complejidad técnica del complejo = la del eslabón más complejo + 1 (la transición también
 *  se entrena), cap 12. */
export function complexComplexity(c: ComplexDef): number {
  let max = 1;
  for (const l of c.links) {
    const mv = getMovement(l.movementId);
    if (mv) max = Math.max(max, mv.complexity);
  }
  return Math.min(12, max + 1);
}
