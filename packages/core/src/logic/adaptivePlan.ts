import type { Macrocycle, MacrocyclePhase } from "../types";
import { phaseForWeek } from "../data/macrocycles";

/** Una semana del plan adaptado: qué fase (por `phaseKey` de la escuela) le toca. */
export interface PlanWeek { week: number; phaseKey: string }

const natLen = (p: MacrocyclePhase): number => p.weeks[1] - p.weeks[0] + 1;

function expand(blocks: { key: string; n: number }[]): PlanWeek[] {
  const out: PlanWeek[] = [];
  let w = 1;
  for (const b of blocks) for (let k = 0; k < b.n; k++) out.push({ week: w++, phaseKey: b.key });
  return out;
}

/**
 * Reescala una lista ORDENADA de fases (base→pico) a `weeks` semanas.
 * Determinístico, fiel a la escuela:
 *  - proporcional al peso natural de cada fase;
 *  - PISO al pico (última fase): conserva ≥ `ceil(su proporción × weeks)`, mínimo 1;
 *  - la BASE cede primero (el reparto del resto se llena desde la fase pre-pico hacia atrás);
 *  - `weeks` menor que el piso del pico → todo el bloque es el pico.
 * Una sola fase → todas las semanas esa fase (escuelas planas, p.ej. Búlgaro).
 */
export function rescaleSchoolPhases(phases: readonly MacrocyclePhase[], weeks: number): PlanWeek[] {
  if (weeks <= 0 || phases.length === 0) return [];
  if (phases.length === 1) return expand([{ key: phases[0]!.key, n: weeks }]);

  const macroLen = phases.reduce((s, p) => s + natLen(p), 0);
  const last = phases.length - 1;
  const peak = Math.min(weeks, Math.max(1, Math.ceil((natLen(phases[last]!) / macroLen) * weeks)));

  const alloc: number[] = new Array(phases.length).fill(0);
  alloc[last] = peak;
  const earlierLen = phases.slice(0, last).reduce((s, p) => s + natLen(p), 0);
  let remaining = weeks - peak;
  // Llenar desde la fase pre-pico hacia atrás → la fase más temprana (la base) es la que cede primero.
  for (let i = last - 1; i >= 0 && remaining > 0; i--) {
    const ideal = earlierLen > 0 ? Math.round((natLen(phases[i]!) / earlierLen) * (weeks - peak)) : 0;
    const give = Math.min(ideal, remaining);
    alloc[i] = give;
    remaining -= give;
  }
  // Sobrante por redondeo → a la fase pre-pico (favorece las fases tardías, nunca infla la base).
  if (remaining > 0) alloc[last - 1] = (alloc[last - 1] ?? 0) + remaining;

  return expand(phases.map((p, i) => ({ key: p.key, n: alloc[i]! })));
}

/**
 * Plan de fases por semana para toda la línea de tiempo del atleta, fiel a la escuela y anclado
 * a las competencias. `compWeeks` = semanas (1-based, relativas al startDate) de las compes objetivo.
 *  - Sin comps → `phaseProfile` natural del macro, semana a semana (comportamiento clásico).
 *  - `peaks:false` (Búlgaro y demás sin pico) → un solo bloque reescalado, SIN mini-ciclos de re-pico,
 *    aunque haya compes (su identidad es no-periodizar; una compe en el medio no cambia la programación).
 *  - `peaks:true` → multi-pico fiel: bloque 1 = progresión completa de la escuela; cada bloque
 *    siguiente (entre compe y compe) reescala las fases de la escuela SALTEANDO la base (re-pico con
 *    fases reales de la escuela, sin inventar "descarga"/"re-intensificación").
 */
export function buildAdaptivePlan(macro: Macrocycle, compWeeks: readonly number[]): PlanWeek[] {
  const phases = macro.phaseProfile;
  if (phases.length === 0) return [];

  const comps = [...compWeeks].filter((w) => Number.isFinite(w) && w > 0).sort((a, b) => a - b);

  if (comps.length === 0) {
    const naturalLen = phases[phases.length - 1]!.weeks[1];
    return Array.from({ length: naturalLen }, (_, i) => {
      const week = i + 1;
      return { week, phaseKey: (phaseForWeek(macro, week) ?? phases[phases.length - 1]!).key };
    });
  }

  const lastComp = comps[comps.length - 1]!;
  if (!macro.peaks) {
    // Escuela plana / sin pico planificado: un solo bloque reescalado, sin re-pico entre compes.
    return rescaleSchoolPhases(phases, lastComp);
  }

  // Multi-pico fiel: el primer bloque trae la progresión completa; los siguientes saltean la base.
  const out: PlanWeek[] = [];
  let prev = 0;
  comps.forEach((cw, idx) => {
    const blockLen = cw - prev;
    if (blockLen <= 0) return; // dos compes en la misma semana: la segunda no agrega bloque
    const blockPhases = idx === 0 ? phases : phases.slice(1);
    for (const p of rescaleSchoolPhases(blockPhases, blockLen)) {
      out.push({ week: p.week + prev, phaseKey: p.phaseKey });
    }
    prev = cw;
  });
  return out;
}
