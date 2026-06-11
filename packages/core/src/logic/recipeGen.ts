import type { Macrocycle, MacrocyclePhase, PhaseRole } from "../types";

// ── Clasificador de rol de fase ────────────────────────────────────────────────
// Del DATO (imrPct/volRel del catálogo, fundado en metodología real), no de mapeos a mano:
// así un macro nuevo cae en un rol sin tocar el generador. Umbrales fijados en el spec
// (entrenamientos-distintivos §3.4) y anclados por test exhaustivo sobre el catálogo.
export function phaseRole(phase: MacrocyclePhase): PhaseRole {
  const [lo, hi] = phase.imrPct;
  const mid = (lo + hi) / 2;
  if (phase.volRel <= 40 && hi <= 88) return "descarga";
  if (hi >= 95) return "peaking";
  if (hi >= 87) return "intensidad";
  if (mid < 74) return "base";
  return "fuerza";
}

// ── Hash determinístico (D10) ──────────────────────────────────────────────────
/** djb2 sobre las partes unidas — uint32. La rotación de variantes/arquetipos deriva de acá:
 *  mismo (macro, fase, arquetipo, slot) → mismo índice, SIEMPRE. Cero Math.random. */
export function hashIdx(parts: string[]): number {
  let h = 5381;
  const s = parts.join("·");
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; // h*33 + c, wrap uint32
  }
  return h >>> 0;
}

// ── Frecuencia → sesiones por semana (D15) ─────────────────────────────────────
/** Overrides nombrados para las dos frecuencias no numéricas del catálogo:
 *  usa-school "4-5d/sem" → 5 (el perfil USA estándar entrena 5 cuando hay compe en el ciclo);
 *  hibrido-block "variable" → 4 (el bloque modular canónico se ondula sobre 4 días). */
const FREQUENCY_OVERRIDES: Record<string, number> = { "usa-school": 5, "hibrido-block": 4 };

export function sessionsPerWeek(macro: Macrocycle): number {
  const override = FREQUENCY_OVERRIDES[macro.id];
  if (override != null) return override;
  const m = /^(\d+)/.exec(macro.frequency);
  const n = m ? Number(m[1]) : NaN;
  return Number.isInteger(n) && n >= 1 && n <= 7 ? n : 0;
}
