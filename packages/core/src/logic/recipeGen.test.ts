import { describe, it, expect } from "vitest";
import type { SessionTemplate } from "../types";
import { MACROCYCLES, phaseForWeek } from "../data/macrocycles";
import { phaseRole, hashIdx, sessionsPerWeekFor } from "./recipeGen";

const macro = (id: string) => MACROCYCLES.find((m) => m.id === id)!;
const phase = (macroId: string, key: string) => macro(macroId).phaseProfile.find((p) => p.key === key)!;

describe("phaseRole (clasificador de rol de fase — del dato, no de mapeos a mano)", () => {
  it("clasifica las fases ancla del catálogo", () => {
    expect(phaseRole(phase("bulgaro-6d", "dailymax"))).toBe("peaking");
    expect(phaseRole(phase("ruso-5d", "hipertrofia"))).toBe("base");
    expect(phaseRole(phase("ruso-5d", "fuerza-basica"))).toBe("fuerza");
    expect(phaseRole(phase("ruso-5d", "fuerza-potencia"))).toBe("intensidad");
    expect(phaseRole(phase("ruso-5d", "peaking"))).toBe("peaking");
    expect(phaseRole(phase("chino-5d", "descarga"))).toBe("descarga");
    expect(phaseRole(phase("chino-5d", "choque"))).toBe("peaking");
    expect(phaseRole(phase("polaco-5d", "singles"))).toBe("peaking");
    expect(phaseRole(phase("usa-master", "realizacion"))).toBe("intensidad"); // hi 92 < 95
    expect(phaseRole(phase("hibrido-4d", "transmutacion"))).toBe("fuerza");   // hi 86 < 87
    expect(phaseRole(phase("coreano-5d", "cimentacion"))).toBe("base");        // mid 73 < 74
    expect(phaseRole(phase("cubano-novicio-2d", "cimentacion"))).toBe("base");
    expect(phaseRole(phase("colombiano-5d", "realizacion"))).toBe("peaking");
    // vol 30 + hi 82 PERO no declarada descarga → es la intensificación pre-compe de Urrutia, no un deload
    expect(phaseRole(phase("colombiano-5d", "precompetencia"))).toBe("fuerza");
    expect(phaseRole(phase("ucraniano-3d", "intensificacion"))).toBe("intensidad"); // hi 94 < 95
  });
  it("toda fase del catálogo cae en un rol", () => {
    const roles = new Set(["base", "fuerza", "intensidad", "peaking", "descarga"]);
    for (const m of MACROCYCLES) for (const p of m.phaseProfile) expect(roles.has(phaseRole(p))).toBe(true);
  });
});

describe("hashIdx (rotación determinística, D10)", () => {
  it("estable para el mismo input y distinto para inputs distintos", () => {
    const a = hashIdx(["ruso-5d", "hipertrofia", "A", "0"]);
    expect(hashIdx(["ruso-5d", "hipertrofia", "A", "0"])).toBe(a);
    expect(hashIdx(["ruso-5d", "hipertrofia", "A", "1"])).not.toBe(a);
    expect(Number.isInteger(a)).toBe(true);
    expect(a).toBeGreaterThanOrEqual(0);
  });
});

describe("sessionsPerWeek (frecuencia → sesiones, D15)", () => {
  it("parsea Nd/sem y aplica los overrides nombrados", () => {
    expect(sessionsPerWeekFor(macro("ruso-5d"))).toBe(5);
    expect(sessionsPerWeekFor(macro("cubano-novicio-2d"))).toBe(2);
    expect(sessionsPerWeekFor(macro("usa-school"))).toBe(5);   // "4-5d/sem"
    expect(sessionsPerWeekFor(macro("hibrido-block"))).toBe(4); // "variable"
  });
});

describe("SessionTemplate.day/turno (D9 — shape de doble sesión)", () => {
  it("los campos opcionales compilan y ausentes = comportamiento actual", () => {
    const s: SessionTemplate = { exercises: [], day: 3, turno: "AM" };
    expect(s.day).toBe(3);
    const legacy: SessionTemplate = { exercises: [] };
    expect(legacy.day).toBeUndefined();
  });
});

// ── generateRecipe (el generador completo) ─────────────────────────────────────
import type { MacroRecipe, PrescribedExercise, SchoolDNA } from "../types";
import { generateRecipe } from "./recipeGen";
import { dnaForFamily } from "../data/schools";
import { getMovement } from "./movements";
import { getComplex, isComplexId, complexPctCeiling, complexTotalReps, complexLoads, complexComplexity } from "./complexes";

/** snc/complexity efectivos de una fila (variante o complejo) — espejo de lo que ordena el generador. */
function loadsOf(ex: PrescribedExercise): { snc: number; complexity: number } {
  if (isComplexId(ex.movementId)) {
    const cx = getComplex(ex.movementId)!;
    return { snc: complexLoads(cx).snc, complexity: complexComplexity(cx) };
  }
  const mv = getMovement(ex.movementId)!;
  return { snc: mv.loads.snc, complexity: mv.complexity };
}
const isTecnico = (ex: PrescribedExercise): boolean =>
  isComplexId(ex.movementId) || ["arranque", "cargada", "envion", "cargada-envion"].includes(getMovement(ex.movementId)!.baseId);
const isMetabolico = (dna: SchoolDNA, ex: PrescribedExercise): boolean =>
  (dna.repertoire.metabolico ?? []).some((r) => r.id === ex.movementId);

function genAll(): { macro: ReturnType<typeof macro>; recipe: MacroRecipe }[] {
  return MACROCYCLES.filter((m) => m.id !== "ruso-5d").map((m) => ({
    macro: m,
    recipe: generateRecipe(dnaForFamily(m.family)!, m)!,
  }));
}

describe("generateRecipe (D10 — determinístico, dentro de techos)", () => {
  it("genera receta para todo macro no-curado, con las phaseKeys reales", () => {
    for (const { macro: m, recipe } of genAll()) {
      expect(recipe, m.id).toBeDefined();
      expect(recipe.macroId).toBe(m.id);
      expect(recipe.phases.map((p) => p.phaseKey)).toEqual(m.phaseProfile.map((p) => p.key));
      for (const ph of recipe.phases) {
        expect(ph.sessions.length).toBe(sessionsPerWeekFor(m));
        for (const s of ph.sessions) expect(s.exercises.length).toBeGreaterThan(0);
      }
    }
  });
  it("dos corridas → deep-equal (determinismo)", () => {
    const m = macro("coreano-5d");
    const dna = dnaForFamily("Coreano")!;
    expect(generateRecipe(dna, m)).toEqual(generateRecipe(dna, m));
  });
  it("macro con receta curada (ruso-5d) → null: el generador lo salta (D4)", () => {
    expect(generateRecipe(dnaForFamily("Ruso")!, macro("ruso-5d"))).toBeNull();
  });
  it("dosis en corredor: clásicos ∈ [imrLo, min(imrHi,95)]; sentadillas ≤ imrHi+5 (cap 100); tirones 90–110", () => {
    for (const { macro: m, recipe } of genAll()) {
      for (const ph of recipe.phases) {
        const fase = m.phaseProfile.find((p) => p.key === ph.phaseKey)!;
        const [lo, hi] = fase.imrPct;
        for (const s of ph.sessions) for (const ex of s.exercises) {
          expect(ex.pct, `${m.id}/${ph.phaseKey}: ${ex.movementId} sin pct`).toBeDefined();
          if (isComplexId(ex.movementId)) {
            expect(ex.pct!).toBeLessThanOrEqual(complexPctCeiling(getComplex(ex.movementId)!));
            continue;
          }
          const mv = getMovement(ex.movementId)!;
          const baseId = mv.baseId;
          if (["arranque", "cargada", "envion", "cargada-envion"].includes(baseId)) {
            expect(ex.pct!, `${m.id}/${ph.phaseKey} clásico ${ex.movementId}`).toBeGreaterThanOrEqual(Math.min(lo, 95));
            expect(ex.pct!).toBeLessThanOrEqual(Math.min(hi, 95));
          } else if (baseId.startsWith("tiron-")) {
            expect(ex.pct!).toBeGreaterThanOrEqual(90);
            expect(ex.pct!).toBeLessThanOrEqual(110);
          } else if (["sentadilla", "sentadilla-frente", "sentadilla-overhead"].includes(baseId)) {
            expect(ex.pct!).toBeLessThanOrEqual(Math.min(hi + 5, 100));
          }
        }
      }
    }
  });
  it("techos duros: repsMax por base; cx total ≤6; ≤3 técnicos/sesión; cero rmRef none; sets ∈ [2,6]", () => {
    for (const { macro: m, recipe } of genAll()) {
      for (const ph of recipe.phases) for (const s of ph.sessions) {
        let tecnicos = 0;
        for (const ex of s.exercises) {
          expect(ex.sets).toBeGreaterThanOrEqual(2);
          expect(ex.sets).toBeLessThanOrEqual(6);
          if (isComplexId(ex.movementId)) {
            tecnicos++;
            expect(ex.reps).toBe(complexTotalReps(getComplex(ex.movementId)!));
            continue;
          }
          const mv = getMovement(ex.movementId)!;
          expect(mv.rmRef, `${m.id}: ${ex.movementId}`).not.toBe("none");
          const base = MOVEMENT_BASES_BY_ID.get(mv.baseId)!;
          expect(ex.reps, `${m.id}/${ph.phaseKey}: ${ex.movementId}`).toBeLessThanOrEqual(base.repsMax.aislado);
          if (isTecnico(ex)) tecnicos++;
        }
        expect(tecnicos, `${m.id}/${ph.phaseKey}`).toBeLessThanOrEqual(3);
      }
    }
  });
  it("secuencia: (snc, complexity) no-creciente con metabólicos SIEMPRE al final", () => {
    for (const { macro: m, recipe } of genAll()) {
      const dna = dnaForFamily(m.family)!;
      for (const ph of recipe.phases) for (const s of ph.sessions) {
        let seenMetabolico = false;
        for (let i = 0; i < s.exercises.length; i++) {
          const ex = s.exercises[i]!;
          if (isMetabolico(dna, ex)) { seenMetabolico = true; continue; }
          expect(seenMetabolico, `${m.id}/${ph.phaseKey}: no-metabólico después de metabólico`).toBe(false);
          if (i > 0 && !isMetabolico(dna, s.exercises[i - 1]!)) {
            const prev = loadsOf(s.exercises[i - 1]!);
            const cur = loadsOf(ex);
            const ok = prev.snc > cur.snc || (prev.snc === cur.snc && prev.complexity >= cur.complexity);
            expect(ok, `${m.id}/${ph.phaseKey}: orden neural roto en idx ${i}`).toBe(true);
          }
        }
      }
    }
  });
  it("presupuesto SNC: Σsnc por sesión ≤ sncBudget[rol]", () => {
    for (const { macro: m, recipe } of genAll()) {
      const dna = dnaForFamily(m.family)!;
      for (const ph of recipe.phases) {
        const role = phaseRole(m.phaseProfile.find((p) => p.key === ph.phaseKey)!);
        for (const s of ph.sessions) {
          const sum = s.exercises.reduce((acc, ex) => acc + loadsOf(ex).snc, 0);
          expect(sum, `${m.id}/${ph.phaseKey}`).toBeLessThanOrEqual(dna.sncBudget[role]);
        }
      }
    }
  });
  it("sin base repetida dentro de la sesión (probe lineal del relleno)", () => {
    for (const { macro: m, recipe } of genAll()) {
      for (const ph of recipe.phases) for (const s of ph.sessions) {
        const bases: string[] = [];
        for (const ex of s.exercises) {
          if (isComplexId(ex.movementId)) continue; // los eslabones de cx pueden tocar bases de otros slots
          bases.push(getMovement(ex.movementId)!.baseId);
        }
        expect(new Set(bases).size, `${m.id}/${ph.phaseKey}`).toBe(bases.length);
      }
    }
  });
  it("recorte por presupuesto: DNA sintética que excede recorta SOLO desde optionalFrom", () => {
    const synthetic: SchoolDNA = {
      family: "Ruso",
      character: "fixture sintética para el mecanismo de recorte",
      repertoire: {
        olimpico: [{ id: "cargada-envion", weight: 1 }],
        rodilla: [{ id: "sentadilla", weight: 1 }],
        bisagra: [{ id: "peso-muerto-rumano", weight: 1 }],
      },
      forbidden: [],
      archetypes: { base: [{ key: "X", slots: ["olimpico", "rodilla", "bisagra"], optionalFrom: 2 }] },
      sessionsPerDay: 1,
      tecnicosMax: 2,
      // c&j(10) + sentadilla(7) + rdl(4) = 21 > 17 → recorta la bisagra (optional), queda 17
      sncBudget: { base: 17, fuerza: 17, intensidad: 17, peaking: 17, descarga: 17 },
      dosage: { mainBias: "mid", setsBias: 0, singlesPhases: [] },
      sources: ["fixture"],
    };
    // una sola fase (rol base) — la fixture sólo declara arquetipos base
    const m = { ...macro("ruso-5d"), id: "fixture-macro", phaseProfile: [macro("ruso-5d").phaseProfile[0]!] };
    const recipe = generateRecipe(synthetic, m)!;
    const s0 = recipe.phases[0]!.sessions[0]!;
    expect(s0.exercises.length).toBe(2);
    expect(s0.exercises.map((e) => getMovement(e.movementId)!.baseId)).toEqual(["cargada-envion", "sentadilla"]);
  });
  it("singlesPhases: los clásicos van a 1 rep (búlgaro en todas las fases)", () => {
    const m = macro("bulgaro-6d");
    const recipe = generateRecipe(dnaForFamily("Búlgaro")!, m)!;
    for (const ph of recipe.phases) for (const s of ph.sessions)
      for (const ex of s.exercises)
        if (isTecnico(ex)) expect(ex.reps).toBe(1);
  });
  it("sessionNotes de la escuela se estampan (ucraniano EMOM en olímpicos)", () => {
    const m = macro("ucraniano-3d");
    const recipe = generateRecipe(dnaForFamily("Ucraniano")!, m)!;
    const conNota = recipe.phases.flatMap((p) => p.sessions).flatMap((s) => s.exercises).filter((e) => e.notes?.includes("EMOM"));
    expect(conNota.length).toBeGreaterThan(0);
  });
});

import { MOVEMENT_BASES } from "../data/movements";
const MOVEMENT_BASES_BY_ID = new Map(MOVEMENT_BASES.map((b) => [b.id, b]));

// usado por los tests de arriba sin depender del generador completo
void phaseForWeek;
