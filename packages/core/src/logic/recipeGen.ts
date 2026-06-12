import type {
  MacroRecipe, Macrocycle, MacrocyclePhase, PhaseRole, PhaseTemplate, PrescribedExercise,
  RepertoireItem, SchoolDNA, SessionArchetype, SessionTemplate, SlotKind,
} from "../types";
import { MACRO_RECIPES } from "../data/recipes";
import { getBase, getMovement } from "./movements";
import { sessionsPerWeek } from "./schedule";
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
// así un macro nuevo cae en un rol sin tocar el generador. Umbrales anclados por test
// (recipeGen.test.ts) y registrados en el spec §3.4 (enmendado post-Carnicero 2026-06-11).
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
/** FNV-1a sobre las partes unidas — uint32. La rotación de variantes deriva de acá: mismo
 *  (macro, fase, arquetipo, sesión, slot) → mismo índice, SIEMPRE. Cero Math.random.
 *  FNV-1a y NO djb2: el ×33 de djb2 (33 = 3×11) colapsa `hash % peso` al último carácter
 *  cuando el peso comparte factor con 33 — la rotación moría y escuelas enteras perdían un
 *  lift de competencia (HIGH de El Carnicero, 2026-06-11). El primo FNV 16777619 es coprimo
 *  con cualquier peso chico. */
export function hashIdx(parts: string[]): number {
  let h = 0x811c9dc5; // offset basis FNV-1a 32-bit
  const s = parts.join("·");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

// ── Frecuencia → sesiones por semana (D15) ─────────────────────────────────────
/** Overrides nombrados para las dos frecuencias no numéricas del catálogo:
 *  usa-school "4-5d/sem" → 5 (el perfil USA estándar entrena 5 cuando hay compe en el ciclo);
 *  hibrido-block "variable" → 4 (el bloque modular canónico se ondula sobre 4 días). */
const FREQUENCY_OVERRIDES: Record<string, number> = { "usa-school": 5, "hibrido-block": 4 };

export function sessionsPerWeekFor(macro: Macrocycle): number {
  const override = FREQUENCY_OVERRIDES[macro.id];
  if (override != null) return override;
  const n = sessionsPerWeek(macro.frequency); // parser de la casa (schedule.ts)
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

/** % por BASE que pisa la tabla del slot — para los movimientos cuyo % real NO es el del patrón
 *  genérico contra su RM de referencia (HIGH-3 de El Carnicero: el press militar al 55-70% del
 *  RM de envión ES su 1RM real; el sots vive bajo; el jerk-dip vive SUPRA-máximo — su propio
 *  `notes` en movements.ts lo dice y el generador lo obedece acá). Defendible fisiológicamente;
 *  los valores exactos son curaduría del coach. */
const PCT_BY_BASE: Record<string, Record<PhaseRole, number>> = {
  "press-hombros": { base: 35, fuerza: 38, intensidad: 40, peaking: 40, descarga: 28 },
  "sots-press": { base: 28, fuerza: 30, intensidad: 32, peaking: 30, descarga: 22 },
  "jerk-dip": { base: 92, fuerza: 98, intensidad: 102, peaking: 105, descarga: 90 },
  "remo-menton": { base: 30, fuerza: 32, intensidad: 32, peaking: 30, descarga: 25 },
  "remo": { base: 45, fuerza: 48, intensidad: 45, peaking: 45, descarga: 40 },
  "buenos-dias": { base: 30, fuerza: 34, intensidad: 36, peaking: 32, descarga: 25 },
};

/** Los 4 clásicos (cuentan como "técnico" junto con los complejos — techo duro 3, D8). */
const CLASSIC_BASES = new Set(["arranque", "cargada", "envion", "cargada-envion"]);

/** Tabla Prilepin de la casa POR SESIÓN Y ZONA (la unidad correcta — MEDIUM de El Carnicero):
 *  las reps totales de CLÁSICOS de una sesión en una zona viven en [min, max]. */
const PRILEPIN_SESSION: Record<"70-80" | "80-90" | "90+", [number, number]> = {
  "70-80": [12, 24], "80-90": [10, 20], "90+": [1, 10],
};
const zoneOf = (pct: number): "70-80" | "80-90" | "90+" | null =>
  pct >= 90 ? "90+" : pct >= 80 ? "80-90" : pct >= 70 ? "70-80" : null;

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

/** Familia de competencia de un candidato (para el `focus` del arquetipo): arranque-pattern vs
 *  envión-pattern, por el RM que referencia. Complejo → la familia de su primer eslabón clásico. */
function familyOf(id: string): "arranque" | "envion" | null {
  if (isComplexId(id)) {
    const cx = getComplex(id);
    if (!cx) return null;
    for (const l of cx.links) {
      const f = familyOf(l.movementId);
      if (f) return f;
    }
    return null;
  }
  const mv = getMovement(id);
  if (!mv) return null;
  if (mv.rmRef === "arranque") return "arranque";
  if (mv.rmRef === "envion") return "envion";
  return null;
}

/** Eslabones de un complejo → baseIds (para no repetir el patrón aislado en la misma sesión). */
function complexBaseIds(id: string): string[] {
  const cx = getComplex(id);
  return cx ? cx.links.map((l) => getMovement(l.movementId)?.baseId ?? "").filter(Boolean) : [];
}

/** Especificidad del pico (regla del SISTEMA, transversal a las escuelas — la receta curada
 *  del Ruso lo muestra igual): en peaking el slot olímpico sólo admite lo que se compite
 *  (arranque, envión completo, segundo tiempo en tijera), el slot de pierna sólo las
 *  sentadillas de fuerza (OHS/balance son herramientas de técnica, no de semana de pico) y
 *  los complejos no entran (defensa en profundidad — ningún ADN los pide hoy). */
const PEAKING_OLIMPICO = new Set(["arranque", "cargada-envion", "envion.tijera"]);
const PEAKING_RODILLA = new Set(["sentadilla", "sentadilla-frente"]);

function allowedAtPeaking(slot: SlotKind, id: string, baseId: string): boolean {
  if (slot === "olimpico") return PEAKING_OLIMPICO.has(id);
  if (slot === "rodilla") return PEAKING_RODILLA.has(baseId);
  return true;
}

/** Pick ponderado determinístico con probe lineal: arranca en el índice que indica el hash y
 *  avanza hasta un candidato aceptable (base no repetida, técnicos bajo techo, focus del
 *  arquetipo, especificidad del pico). Sin candidato aceptable → null (el slot se omite,
 *  honesto — jamás inventar). */
function pickCandidate(
  items: RepertoireItem[], hash: number, usedBases: Set<string>, tecnicos: number, tecnicosMax: number,
  forbidden: Set<string>, role: PhaseRole, slot: SlotKind, focus?: "arranque" | "envion",
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
  const focusApplies = focus != null && (slot === "olimpico" || slot === "complejo");
  for (let step = 0; step < items.length; step++) {
    const item = items[(start + step) % items.length]!;
    const id = item.id;
    if (focusApplies && familyOf(id) !== focus) continue;
    if (isComplexId(id)) {
      const cx = getComplex(id);
      if (!cx) continue;
      if (role === "peaking") continue; // especificidad del pico: el gesto, no el complejo
      const linkBases = complexBaseIds(id);
      if (linkBases.some((b) => forbidden.has(b))) continue;
      if (linkBases.some((b) => usedBases.has(b))) continue; // el patrón del eslabón no se repite aislado
      if (tecnicos + 1 > tecnicosMax) continue;
      return id;
    }
    const mv = getMovement(id);
    if (!mv || mv.rmRef === "none") continue;            // kg siempre derivable (spec §3.2)
    if (forbidden.has(mv.baseId)) continue;              // defensa en profundidad
    if (usedBases.has(mv.baseId)) continue;              // sin base repetida en la sesión
    if (role === "peaking" && !allowedAtPeaking(slot, id, mv.baseId)) continue;
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
  const mv = isComplexId(id) ? undefined : getMovement(id);
  const repsCapAislado = mv ? (getBase(mv.baseId)?.repsMax.aislado ?? 1) : 1;

  if (isComplexId(id)) {
    const cx = getComplex(id);
    if (!cx) return { pct: corridorPct, sets, reps: 1 }; // inalcanzable (pickCandidate validó) — guard honesto
    const pct = Math.min(corridorPct, complexPctCeiling(cx));
    return { pct, sets, reps: complexTotalReps(cx) };
  }
  // % por base pisa la tabla del slot (press militar/sots/jerk-dip/remos/GM — ver PCT_BY_BASE)
  const basePctOverride = mv ? PCT_BY_BASE[mv.baseId]?.[role] : undefined;
  if (slot === "olimpico") {
    const pct = Math.max(Math.min(corridorPct, CLASSIC_PCT_CAP), Math.min(lo, CLASSIC_PCT_CAP));
    // bordes de zona = los de la tabla Prilepin de la casa (90/80) — reps y auditoría alineadas
    const zoneReps = pct >= 90 ? 1 : pct >= 80 ? 2 : 3;
    const reps = dna.dosage.singlesPhases.includes(role) && isTecnicoId(id)
      ? 1
      : Math.min(zoneReps, repsCapAislado);
    return { pct, sets, reps };
  }
  if (slot === "tiron") {
    const pct = basePctOverride ?? PULL_PCT[role];
    return { pct, sets, reps: Math.min(TIRON_REPS[role], repsCapAislado) };
  }
  if (slot === "rodilla") {
    // El techo del rulebook (hi+5, cap 100) es TECHO, no objetivo; en descarga ni siquiera se
    // empuja sobre el corredor. Reps zone-aware: un doble al 96%+ no existe (HIGH-2 Carnicero).
    const bump = role === "descarga" ? 0 : 5;
    const pct = Math.min(corridorPct + bump, hi + bump, 100);
    const roleReps = RODILLA_REPS[role];
    const reps = pct >= 95 ? 1 : pct >= 90 ? Math.min(2, roleReps) : roleReps;
    return { pct, sets, reps: Math.min(reps, repsCapAislado) };
  }
  if (slot === "empuje") {
    const pct = basePctOverride ?? EMPUJE_PCT[role];
    return { pct, sets, reps: Math.min(EMPUJE_REPS[role], repsCapAislado) };
  }
  if (slot === "bisagra") {
    const pct = basePctOverride ?? BISAGRA_PCT[role];
    return { pct, sets, reps: Math.min(BISAGRA_REPS[role], repsCapAislado) };
  }
  // metabolico
  const pct = basePctOverride ?? METABOLICO_PCT[role];
  return { pct, sets: Math.min(sets, 4), reps: Math.min(METABOLICO_REPS[role], repsCapAislado) };
}

/** Ajuste Prilepin POR SESIÓN Y ZONA sobre los clásicos (la unidad correcta): si el total de
 *  reps de una zona quedó bajo el mínimo se sube el PRIMER clásico (el lift principal recibe
 *  el volumen); si excede el máximo se recorta el ÚLTIMO (sets jamás < 2 ni > 6). */
function applyPrilepinSessionClamp(ordered: Filled[]): void {
  const classics = ordered.filter(
    (f) => !isComplexId(f.ex.movementId) && CLASSIC_BASES.has(getMovement(f.ex.movementId)?.baseId ?? ""),
  );
  const byZone = new Map<"70-80" | "80-90" | "90+", Filled[]>();
  for (const f of classics) {
    const z = f.ex.pct != null ? zoneOf(f.ex.pct) : null;
    if (z == null) continue;
    if (!byZone.has(z)) byZone.set(z, []);
    byZone.get(z)!.push(f);
  }
  for (const [zone, group] of byZone) {
    const [min, max] = PRILEPIN_SESSION[zone];
    const total = (): number => group.reduce((acc, f) => acc + f.ex.sets * f.ex.reps, 0);
    let guard = 64;
    while (total() < min && guard-- > 0) {
      const first = group.find((f) => f.ex.sets < 6);
      if (!first) break;
      first.ex.sets += 1;
    }
    while (total() > max && guard-- > 0) {
      const last = [...group].reverse().find((f) => f.ex.sets > 2);
      if (!last) break;
      last.ex.sets -= 1;
    }
  }
}

/** Techo SNC del DÍA (D7): los turnos de un día doble suman contra esto. Factor curaduría
 *  del coach (calibrable acá): 1.5× el presupuesto de sesión — dos sesiones cortas caben,
 *  dos sesiones llenas no. El Carnicero revisa el valor. */
const DAILY_SNC_FACTOR = 1.5;

const sessionSnc = (s: SessionTemplate): number =>
  s.exercises.reduce((acc, ex) => acc + effLoads(ex.movementId).snc, 0);

/** Arquetipo de un turno (Abadjiev): AM busca focus arranque, PM focus envión. Escuela sin
 *  ese focus declarado → rota por día (jamás inventa estructura). */
function archetypeForTurno(archetypes: SessionArchetype[], turno: "AM" | "PM", day: number): SessionArchetype {
  const want = turno === "AM" ? "arranque" : "envion";
  return archetypes.find((a) => a.focus === want)
    ?? archetypes[(day - 1 + (turno === "PM" ? 1 : 0)) % archetypes.length]!;
}

/** Una sesión: rellena el arquetipo, recorta por presupuesto (sólo slots ≥ optionalFrom),
 *  ordena por demanda neural descendente con los metabólicos al final y ajusta Prilepin. */
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
    const id = pickCandidate(items, hash, usedBases, tecnicos, dna.tecnicosMax, forbidden, role, slot, archetype.focus);
    if (id == null) return; // slot sin candidato aceptable → se omite, jamás se inventa
    if (isComplexId(id)) {
      for (const b of complexBaseIds(id)) usedBases.add(b); // el eslabón no se repite aislado (M de Carnicero)
    } else {
      usedBases.add(getMovement(id)!.baseId);
    }
    if (isTecnicoId(id)) tecnicos++;
    const dose = doseSlot(slot, id, phase, role, dna);
    const { snc, complexity } = effLoads(id);
    // Notas de escuela (p.ej. EMOM ucraniano): JAMÁS sobre trabajo pesado — un single al 90%+
    // cada 60s es instrucción insegura (MEDIUM de El Carnicero). Sólo bajo 85%.
    const note = dose.pct < 85 ? dna.sessionNotes?.[slot] : undefined;
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
  const ordered = [...main, ...metabolicos];
  applyPrilepinSessionClamp(ordered);
  return { exercises: ordered.map((f) => f.ex) };
}

/** Genera la receta de un macro desde el ADN de su escuela — pura, determinística (D10).
 *  Macro con receta CURADA → null (curaduría manda, D4). Sin frecuencia/arquetipos → null
 *  (sin-dato honesto, D13): la UI ya tiene el empty-state. */
export function generateRecipe(dna: SchoolDNA, macro: Macrocycle): MacroRecipe | null {
  if (MACRO_RECIPES.some((r) => r.macroId === macro.id)) return null;
  const n = sessionsPerWeekFor(macro);
  if (n < 1) return null;
  const phases: PhaseTemplate[] = [];
  for (const phase of macro.phaseProfile) {
    const role = phaseRole(phase);
    const archetypes = archetypesFor(dna, role);
    if (archetypes.length === 0) return null;
    const sessions: SessionTemplate[] = [];
    if (dna.sessionsPerDay === 2) {
      // Bi-diario (D6): días IMPARES dobles, pares simples — mezcla visible de layouts,
      // volumen sano para humanos (curaduría v1; El Carnicero revisa). sessionIdx = posición
      // del array (idx corrido), day/turno viajan en el template (D9).
      const dailyCap = Math.round(dna.sncBudget[role] * DAILY_SNC_FACTOR);
      let idx = 0;
      for (let day = 1; day <= n; day++) {
        if (day % 2 === 1) {
          const am = buildSession(dna, macro, phase, role, archetypeForTurno(archetypes, "AM", day), idx);
          const pm = buildSession(dna, macro, phase, role, archetypeForTurno(archetypes, "PM", day), idx + 1);
          if (sessionSnc(am) + sessionSnc(pm) <= dailyCap) {
            sessions.push({ ...am, day, turno: "AM" }, { ...pm, day, turno: "PM" });
            idx += 2;
          } else {
            // Guard D7: el día no aguanta dos turnos → degrada a día simple (honesto)
            sessions.push({ ...am, day });
            idx += 1;
          }
        } else {
          sessions.push({ ...buildSession(dna, macro, phase, role, archetypes[(day / 2 - 1) % archetypes.length]!, idx), day }); // días pares alternan arquetipos — sin esto todos caían en B y el lift de foco A quedaba subexpuesto (curaduría)
          idx += 1;
        }
      }
    } else {
      for (let i = 0; i < n; i++) {
        const archetype = archetypes[i % archetypes.length]!;
        sessions.push(buildSession(dna, macro, phase, role, archetype, i));
      }
    }
    phases.push({ phaseKey: phase.key, sessions });
  }
  return { macroId: macro.id, phases };
}
