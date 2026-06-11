import type { RM, WarmupSet } from "../types";
import { getMovement, getBase } from "./movements";
import { getComplex, complexWeakRmKg, isComplexId } from "./complexes";

const FRACTIONS: ReadonlyArray<{ f: number; reps: number; minW?: number }> = [
  { f: 0.50, reps: 5 },
  { f: 0.70, reps: 3 },
  { f: 0.85, reps: 2 },
  { f: 0.93, reps: 1, minW: 85 }, // single de aproximación SÓLO en días pesados (W>=85)
];

/** Un set de rampa = fracción `f` del peso de trabajo (`f·W`).
 *  Se normaliza a 2 decimales antes de derivar pct/kg para evitar artefactos IEEE 754
 *  (e.g. 0.70*90 = 62.999… → se normaliza a 63.00 antes de redondear). */
function rampSet(f: number, reps: number, workingPct: number, rm: number): WarmupSet {
  const rawPct = Math.round(f * workingPct * 100) / 100; // snap a 2 decimales
  const pct = Math.round(rawPct);
  return { pct, kg: Math.round((rawPct / 100) * rm), reps, label: "rampa" };
}

/** Cada set < trabajo; sin kg duplicados (queda el de más reps); sin sets sub-barra. La barra pasa siempre. */
function dedupeAndGuard(sets: WarmupSet[], workingKg: number, barKg: number): WarmupSet[] {
  const seen = new Map<number, WarmupSet>();
  for (const s of sets) {
    const isBar = s.label === "barra";
    if (!isBar && (s.kg <= barKg || s.kg >= workingKg)) continue;
    const prev = seen.get(s.kg);
    if (!prev || s.reps > prev.reps) seen.set(s.kg, s);
  }
  return [...seen.values()].sort((a, b) => a.kg - b.kg);
}

/** Rampa de calentamiento. Sets como fracción del peso de trabajo W (= workingPct), no %s fijos del RM.
 *  Barra vacía SÓLO en el 1er movimiento. Sin-dato → []. kg = round(pct/100·RM). */
export function warmupSets(workingPct: number, rm: number, barKg: number, isFirstMovement: boolean): WarmupSet[] {
  if (!Number.isFinite(workingPct) || !Number.isFinite(rm) || rm <= 0 || workingPct <= 0) return [];
  const workingKg = Math.round((workingPct / 100) * rm);
  const out: WarmupSet[] = [];
  if (isFirstMovement) out.push({ pct: 0, kg: barKg, reps: 5, label: "barra" });
  if (workingPct <= 55) {
    out.push(rampSet(0.75, 3, workingPct, rm));
    return dedupeAndGuard(out, workingKg, barKg);
  }
  for (const { f, reps, minW } of FRACTIONS) {
    if (minW != null && workingPct < minW) continue;
    out.push(rampSet(f, reps, workingPct, rm));
  }
  return dedupeAndGuard(out, workingKg, barKg);
}

export { rampSet, dedupeAndGuard, FRACTIONS };

/** Decide la forma del calentamiento por ejercicio:
 *  - OHS no-primero → 2 feelers (movilidad overhead)
 *  - accesorio (baseComplexity<=3) no-primero → 1 feeler (ya está caliente)
 *  - resto (lifts, sentadillas, tirones, y cualquiera cuando es el 1er mov) → rampa completa
 *  Sin movimiento / rmRef "none" / sin pct / RM<=0 → []. `order===0` = 1er movimiento. */
export function warmupForExercise(
  args: { movementId: string; pct?: number; order: number },
  rms: RM, barKg: number,
): WarmupSet[] {
  if (args.pct == null) return [];
  // Complejo: rampa completa hacia el kg de trabajo del complejo (pct sobre el RM del eslabón
  // débil — D6); la transición se calienta con el primer eslabón, mismos kg de rampa.
  if (isComplexId(args.movementId)) {
    const cx = getComplex(args.movementId);
    const weakKg = cx ? complexWeakRmKg(cx, rms) : undefined;
    if (weakKg == null) return [];
    return warmupSets(args.pct, weakKg, barKg, args.order === 0);
  }
  const mv = getMovement(args.movementId);
  if (!mv || mv.rmRef === "none") return [];
  const rm = rms[mv.rmRef];
  if (!Number.isFinite(rm) || rm <= 0) return [];
  const W = args.pct;
  const isFirst = args.order === 0;
  const workingKg = Math.round((W / 100) * rm);
  const base = getBase(mv.baseId);

  if (!isFirst && mv.baseId === "sentadilla-overhead") {
    return dedupeAndGuard([rampSet(0.5, 5, W, rm), rampSet(0.7, 3, W, rm)], workingKg, barKg);
  }
  if (!isFirst && base != null && base.baseComplexity <= 3) {
    return dedupeAndGuard([rampSet(0.6, 5, W, rm)], workingKg, barKg);
  }
  return warmupSets(W, rm, barKg, isFirst);
}
