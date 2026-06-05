import type { WarmupSet } from "../types";

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
