import type {
  MacroRecipe, Macrocycle, MacrocyclePhase, PhaseRole, PhaseTemplate, PrescribedExercise,
  RepertoireItem, SchoolDNA, SessionArchetype, SessionTemplate, SlotKind,
} from "../types";
import { MACRO_RECIPES } from "../data/recipes";
import { getBase, getMovement } from "./movements";
import { complexComplexity, complexLoads, complexPctCeiling, complexTotalReps, getComplex, isComplexId } from "./complexes";

// ── Fallback de roles ──────────────────────────────────────────────────────────
// Si una escuela no define arquetipos para un rol, se cae al vecino metodológico más cercano
// (la dosis igual la pone la FASE del macro — el fallback solo presta la estructura de sesión).
const ROLE_FALLBACK: Record<PhaseRole, PhaseRole[]> = {
  base: ["base", "fuerza"],
  fuerza: ["fuerza", "base"],
  intensidad: ["intensidad", "fuerza", "peaking"],
  peaking: ["peaking", "intensidad", "fuerza"],
  descarga: ["descarga", "base", "fuerza", "peaking"],
};

/** Arquetipos de la escuela para un rol, con fallback declarado (jamás inventa estructura). */
export function archetypesFor(dna: SchoolDNA, role: PhaseRole): SessionArchetype[] {
  for (const r of ROLE_FALLBACK[role]) {
    const a = dna.archetypes[r];
    if (a && a.length > 0) return a;
  }
  return [];
}

// ── Clasificador de rol de fase ────────────────────────────────────────────────
// Del DATO (imrPct/volRel del catálogo, fundado en metodología real), no de mapeos a mano:
// así un macro nuevo cae en un rol sin tocar el generador. Umbrales fijados en el spec
// (entrenamientos-distintivos §3.4) y anclados por test exhaustivo sobre el catálogo.
export function phaseRole(phase: MacrocyclePhase): PhaseRole {
  const [lo, hi] = phase.imrPct;
  const mid = (lo + hi) / 2;
  // Descarga: volumen bajo + % no-pico NO bastan (la precompetencia colombiana también es así);
  // la fase debe DECLARARSE descarga en su propio dato (key/name del catálogo).
  const declaredDeload = /descarga|deload/i.test(`${phase.key} ${phase.name}`);
  if (declaredDeload && phase.volRel <= 40 && hi <= 88) return "descarga";
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

// ── Dosis (constantes nombradas — spec §4; ajustables acá y en ningún otro lado) ──
/** Dónde del corredor imrPct de la fase se paran los lifts según el carácter de la escuela. */
const PCT_BIAS: Record<SchoolDNA["dosage"]["mainBias"], number> = { low: 0.25, mid: 0.5, high: 0.8 };
/** Tope prescribible de clásicos/complejos: 95 (precedente D4 del motor — el 100 es el intento
 *  del día de la compe, no se programa; la receta CURADA del Ruso conserva sus 96/97: curaduría manda). */
const CLASSIC_PCT_CAP = 95;
/** Tirones: % del lift correspondiente por rol (regla de la casa 90–110). */
const PULL_PCT: Record<PhaseRole, number> = { base: 92, fuerza: 100, intensidad: 105, peaking: 105, descarga: 90 };
const EMPUJE_PCT: Record<PhaseRole, number> = { base: 55, fuerza: 62, intensidad: 68, peaking: 70, descarga: 45 };
const BISAGRA_PCT: Record<PhaseRole, number> = { base: 55, fuerza: 62, intensidad: 68, peaking: 60, descarga: 45 };
const METABOLICO_PCT: Record<PhaseRole, number> = { base: 60, fuerza: 60, intensidad: 55, peaking: 55, descarga: 50 };
const RODILLA_REPS: Record<PhaseRole, number> = { base: 5, fuerza: 4, intensidad: 3, peaking: 2, descarga: 4 };
const TIRON_REPS: Record<PhaseRole, number> = { base: 4, fuerza: 3, intensidad: 2, peaking: 2, descarga: 3 };
const EMPUJE_REPS: Record<PhaseRole, number> = { base: 5, fuerza: 4, intensidad: 3, peaking: 3, descarga: 5 };
const BISAGRA_REPS: Record<PhaseRole, number> = { base: 8, fuerza: 6, intensidad: 5, peaking: 5, descarga: 8 };
const METABOLICO_REPS: Record<PhaseRole, number> = { base: 10, fuerza: 10, intensidad: 8, peaking: 8, descarga: 10 };

/** Los 4 clásicos (cuentan como "técnico" junto con los complejos — techo duro 3, D8). */
const CLASSIC_BASES = new Set(["arranque", "cargada", "envion", "cargada-envion"]);

// ── Internals del relleno ──────────────────────────────────────────────────────

interface Filled { ex: PrescribedExercise; slot: SlotKind; slotIdx: number; snc: number; complexity: number }

/** snc/complexity efectivos de un id programable (variante o complejo). */
function effLoads(id: string): { snc: number; complexity: number } {
  if (isComplexId(id)) {
    const cx = getComplex(id);
    return cx ? { snc: complexLoads(cx).snc, complexity: complexComplexity(cx) } : { snc: 1, complexity: 1 };
  }
  const mv = getMovement(id);
  return mv ? { snc: mv.loads.snc, complexity: mv.complexity } : { snc: 1, complexity: 1 };
}

function isTecnicoId(id: string): boolean {
  if (isComplexId(id)) return true;
  const mv = getMovement(id);
  return mv != null && CLASSIC_BASES.has(mv.baseId);
}

/** Pick ponderado determinístico con probe lineal: arranca en el índice que indica el hash y
 *  avanza hasta un candidato aceptable (base no repetida, técnicos bajo techo). Sin candidato
 *  aceptable → null (el slot se omite, honesto — jamás inventar). */
function pickCandidate(
  items: RepertoireItem[], hash: number, usedBases: Set<string>, tecnicos: number, tecnicosMax: number,
  forbidden: Set<string>,
): string | null {
  if (items.length === 0) return null;
  const totalWeight = items.reduce((acc, it) => acc + it.weight, 0);
  // índice de arranque: desenrolla el peso acumulado en la posición hash % totalWeight
  let r = hash % totalWeight;
  let start = 0;
  for (let i = 0; i < items.length; i++) {
    r -= items[i]!.weight;
    if (r < 0) { start = i; break; }
  }
  for (let step = 0; step < items.length; step++) {
    const item = items[(start + step) % items.length]!;
    const id = item.id;
    if (isComplexId(id)) {
      const cx = getComplex(id);
      if (!cx) continue;
      if (cx.links.some((l) => forbidden.has(getMovement(l.movementId)?.baseId ?? ""))) continue;
      if (tecnicos + 1 > tecnicosMax) continue;
      return id;
    }
    const mv = getMovement(id);
    if (!mv || mv.rmRef === "none") continue;            // kg siempre derivable (spec §3.2)
    if (forbidden.has(mv.baseId)) continue;              // defensa en profundidad
    if (usedBases.has(mv.baseId)) continue;              // sin base repetida en la sesión
    if (isTecnicoId(id) && tecnicos + 1 > tecnicosMax) continue;
    return id;
  }
  return null;
}

/** Dosis de un slot: pct/sets/reps dentro del corredor de la fase, capados por los techos. */
function doseSlot(
  slot: SlotKind, id: string, phase: MacrocyclePhase, role: PhaseRole, dna: SchoolDNA,
): { pct: number; sets: number; reps: number } {
  const [lo, hi] = phase.imrPct;
  const bias = PCT_BIAS[dna.dosage.mainBias];
  const corridorPct = Math.round(lo + (hi - lo) * bias);
  const baseSets = phase.volRel >= 85 ? 5 : phase.volRel >= 60 ? 4 : 3;
  const sets = Math.max(2, Math.min(6, baseSets + dna.dosage.setsBias));
  const repsCapAislado = (mvId: string): number => {
    const mv = getMovement(mvId);
    const base = mv ? getBase(mv.baseId) : undefined;
    return base?.repsMax.aislado ?? 1;
  };

  if (isComplexId(id)) {
    const cx = getComplex(id)!;
    const pct = Math.min(corridorPct, complexPctCeiling(cx));
    return { pct, sets, reps: complexTotalReps(cx) };
  }
  if (slot === "olimpico") {
    const pct = Math.max(Math.min(corridorPct, CLASSIC_PCT_CAP), Math.min(lo, CLASSIC_PCT_CAP));
    const zoneReps = pct >= 88 ? 1 : pct >= 80 ? 2 : 3;
    const reps = dna.dosage.singlesPhases.includes(role) && isTecnicoId(id)
      ? 1
      : Math.min(zoneReps, repsCapAislado(id));
    return { pct, sets, reps };
  }
  if (slot === "tiron") return { pct: PULL_PCT[role], sets, reps: Math.min(TIRON_REPS[role], repsCapAislado(id)) };
  if (slot === "rodilla") {
    const pct = Math.min(corridorPct + 5, hi + 5, 100);
    return { pct, sets, reps: Math.min(RODILLA_REPS[role], repsCapAislado(id)) };
  }
  if (slot === "empuje") return { pct: EMPUJE_PCT[role], sets, reps: Math.min(EMPUJE_REPS[role], repsCapAislado(id)) };
  if (slot === "bisagra") return { pct: BISAGRA_PCT[role], sets, reps: Math.min(BISAGRA_REPS[role], repsCapAislado(id)) };
  // metabolico
  return { pct: METABOLICO_PCT[role], sets: Math.min(sets, 4), reps: Math.min(METABOLICO_REPS[role], repsCapAislado(id)) };
}

/** Una sesión: rellena el arquetipo, recorta por presupuesto (sólo slots ≥ optionalFrom) y
 *  ordena por demanda neural descendente con los metabólicos al final. */
function buildSession(
  dna: SchoolDNA, macro: Macrocycle, phase: MacrocyclePhase, role: PhaseRole,
  archetype: SessionArchetype, sessionIdx: number,
): SessionTemplate {
  const forbidden = new Set(dna.forbidden);
  const usedBases = new Set<string>();
  const filled: Filled[] = [];
  let tecnicos = 0;
  archetype.slots.forEach((slot, slotIdx) => {
    const items = dna.repertoire[slot] ?? [];
    const hash = hashIdx([macro.id, phase.key, archetype.key, String(sessionIdx), String(slotIdx)]);
    const id = pickCandidate(items, hash, usedBases, tecnicos, dna.tecnicosMax, forbidden);
    if (id == null) return; // slot sin candidato aceptable → se omite, jamás se inventa
    if (!isComplexId(id)) usedBases.add(getMovement(id)!.baseId);
    if (isTecnicoId(id)) tecnicos++;
    const dose = doseSlot(slot, id, phase, role, dna);
    const { snc, complexity } = effLoads(id);
    const note = dna.sessionNotes?.[slot];
    filled.push({
      ex: { movementId: id, sets: dose.sets, reps: dose.reps, pct: dose.pct, ...(note ? { notes: note } : {}) },
      slot, slotIdx, snc, complexity,
    });
  });

  // Presupuesto SNC por sesión: recorta desde el final SOLO slots opcionales (los firmados quedan).
  const budget = dna.sncBudget[role];
  const optionalFrom = archetype.optionalFrom ?? archetype.slots.length;
  let total = filled.reduce((acc, f) => acc + f.snc, 0);
  for (let i = filled.length - 1; i >= 0 && total > budget; i--) {
    if (filled[i]!.slotIdx >= optionalFrom) {
      total -= filled[i]!.snc;
      filled.splice(i, 1);
    }
  }

  // Orden: lo neural primero (lo olímpico fresco), metabólicos SIEMPRE al cierre. Sort estable.
  const main = filled.filter((f) => f.slot !== "metabolico");
  const metabolicos = filled.filter((f) => f.slot === "metabolico");
  main.sort((a, b) => (b.snc - a.snc) || (b.complexity - a.complexity));
  return { exercises: [...main, ...metabolicos].map((f) => f.ex) };
}

/** Genera la receta de un macro desde el ADN de su escuela — pura, determinística (D10).
 *  Macro con receta CURADA → null (curaduría manda, D4). Sin frecuencia/arquetipos → null
 *  (sin-dato honesto, D13): la UI ya tiene el empty-state. */
export function generateRecipe(dna: SchoolDNA, macro: Macrocycle): MacroRecipe | null {
  if (MACRO_RECIPES.some((r) => r.macroId === macro.id)) return null;
  const n = sessionsPerWeek(macro);
  if (n < 1) return null;
  const phases: PhaseTemplate[] = [];
  for (const phase of macro.phaseProfile) {
    const role = phaseRole(phase);
    const archetypes = archetypesFor(dna, role);
    if (archetypes.length === 0) return null;
    const sessions: SessionTemplate[] = [];
    for (let i = 0; i < n; i++) {
      const archetype = archetypes[i % archetypes.length]!;
      sessions.push(buildSession(dna, macro, phase, role, archetype, i));
    }
    phases.push({ phaseKey: phase.key, sessions });
  }
  return { macroId: macro.id, phases };
}
