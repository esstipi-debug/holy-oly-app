import { describe, it, expect } from "vitest";
import type { MacroRecipe, PhaseRole, PrescribedExercise, RM } from "../types";
import { ALL_RECIPES, recipeFor } from "./recipesAll";
import { MACRO_RECIPES } from "./recipes";
import { MACROCYCLES } from "./macrocycles";
import { COMPLEXES } from "./complexes";
import { SCHOOL_DNA, dnaForFamily } from "./schools";
import { phaseRole } from "../logic/recipeGen";
import { getMovement } from "../logic/movements";
import { isComplexId, getComplex } from "../logic/complexes";
import { instantiatePrescription, buildSessionViews } from "../logic/prescription";
import { PrescribedExerciseSchema, SessionViewsSchema } from "../schemas";

const CLASSIC_BASES = new Set(["arranque", "cargada", "envion", "cargada-envion"]);
const macro = (id: string) => MACROCYCLES.find((m) => m.id === id)!;
const recipe = (id: string): MacroRecipe => ALL_RECIPES.find((r) => r.macroId === id)!;

function baseIdOf(ex: PrescribedExercise): string[] {
  if (isComplexId(ex.movementId)) {
    const cx = getComplex(ex.movementId);
    return cx ? cx.links.map((l) => getMovement(l.movementId)!.baseId) : [];
  }
  const mv = getMovement(ex.movementId);
  return mv ? [mv.baseId] : [];
}

describe("ALL_RECIPES (D2/D4 — catálogo completo, curaduría manda)", () => {
  it("24/24 macros con receta", () => {
    expect(ALL_RECIPES.length).toBe(MACROCYCLES.length);
    for (const m of MACROCYCLES) expect(recipeFor(m.id), m.id).toBeDefined();
  });
  it("la receta curada del ruso-5d queda INTACTA (no la reemplaza la generada)", () => {
    expect(recipeFor("ruso-5d")).toBe(MACRO_RECIPES.find((r) => r.macroId === "ruso-5d"));
  });
  it("determinismo de import: dos lecturas del módulo dan el mismo objeto congelado", () => {
    expect(Object.isFrozen(ALL_RECIPES)).toBe(true);
  });
});

describe("huellas por escuela (D11 — lo distintivo se PRUEBA)", () => {
  it("búlgaro: sólo competencia + sentadillas; singles ≥90; jamás tirones/bisagras/accesorios/complejos", () => {
    const r = recipe("bulgaro-6d");
    for (const ph of r.phases) for (const s of ph.sessions) for (const ex of s.exercises) {
      expect(isComplexId(ex.movementId), "búlgaro sin complejos").toBe(false);
      const baseId = getMovement(ex.movementId)!.baseId;
      expect(["arranque", "cargada", "envion", "cargada-envion", "sentadilla", "sentadilla-frente"]).toContain(baseId);
      if (CLASSIC_BASES.has(baseId)) {
        expect(ex.reps).toBe(1);
        expect(ex.pct!).toBeGreaterThanOrEqual(90);
      }
    }
  });
  it("chino: el bloque metabólico cierra ≥80% de las sesiones", () => {
    const dna = dnaForFamily("Chino")!;
    const metabolicoIds = new Set((dna.repertoire.metabolico ?? []).map((x) => x.id));
    const r = recipe("chino-5d");
    const sessions = r.phases.flatMap((p) => p.sessions);
    const conMetabolico = sessions.filter((s) => {
      const last = s.exercises[s.exercises.length - 1];
      return last != null && metabolicoIds.has(last.movementId);
    });
    expect(conMetabolico.length / sessions.length).toBeGreaterThanOrEqual(0.8);
  });
  it("cubano: complejos presentes en las fases base/fuerza de TODOS sus macros", () => {
    for (const m of MACROCYCLES.filter((x) => x.family === "Cubano")) {
      const r = recipe(m.id);
      const basePhases = r.phases.filter((p) => {
        const fase = m.phaseProfile.find((f) => f.key === p.phaseKey)!;
        return ["base", "fuerza"].includes(phaseRole(fase));
      });
      const cx = basePhases.flatMap((p) => p.sessions).flatMap((s) => s.exercises).filter((e) => isComplexId(e.movementId));
      expect(cx.length, m.id).toBeGreaterThan(0);
    }
  });
  it("polaco: clásicos a ≤2 reps en fuerza/intensidad/peaking (series cortas siempre)", () => {
    for (const m of MACROCYCLES.filter((x) => x.family === "Polaco")) {
      const r = recipe(m.id);
      for (const ph of r.phases) {
        const fase = m.phaseProfile.find((f) => f.key === ph.phaseKey)!;
        if (phaseRole(fase) === "base") continue;
        for (const s of ph.sessions) for (const ex of s.exercises) {
          if (!isComplexId(ex.movementId) && CLASSIC_BASES.has(getMovement(ex.movementId)!.baseId))
            expect(ex.reps, `${m.id}/${ph.phaseKey}`).toBeLessThanOrEqual(2);
        }
      }
    }
  });
  it("colombiano: pierna en el 100% de las sesiones de base; en peaking las piernas van a cero", () => {
    const m = macro("colombiano-5d");
    const r = recipe("colombiano-5d");
    for (const ph of r.phases) {
      const fase = m.phaseProfile.find((f) => f.key === ph.phaseKey)!;
      const role = phaseRole(fase);
      for (const s of ph.sessions) {
        const rodillas = s.exercises.flatMap(baseIdOf).filter((b) => ["sentadilla", "sentadilla-frente", "sentadilla-overhead"].includes(b));
        if (role === "base") expect(rodillas.length, ph.phaseKey).toBeGreaterThan(0);
        if (role === "peaking") expect(rodillas.length, ph.phaseKey).toBe(0);
      }
    }
  });
  it("ucraniano: la nota EMOM viaja en los olímpicos", () => {
    const r = recipe("ucraniano-4d");
    const conNota = r.phases.flatMap((p) => p.sessions).flatMap((s) => s.exercises).filter((e) => e.notes?.includes("EMOM"));
    expect(conNota.length).toBeGreaterThan(0);
  });
});

describe("distintividad pareada (D11 — dos escuelas no se confunden)", () => {
  /** Tuplas (movementId, zona de pct) de la semana tipo de un rol — por VARIANTE, no por base:
   *  el vocabulario de la distinción son las variantes (la potencia cubana ≠ el arranque polaco). */
  function tuples(macroId: string, role: PhaseRole): Set<string> {
    const m = macro(macroId);
    const r = recipe(macroId);
    const out = new Set<string>();
    for (const ph of r.phases) {
      const fase = m.phaseProfile.find((f) => f.key === ph.phaseKey)!;
      if (phaseRole(fase) !== role) continue;
      for (const s of ph.sessions) for (const ex of s.exercises) {
        const zone = ex.pct == null ? "?" : ex.pct >= 90 ? "90+" : ex.pct >= 80 ? "80-90" : ex.pct >= 70 ? "70-80" : "<70";
        out.add(`${ex.movementId}@${zone}`);
      }
    }
    return out;
  }
  const jaccard = (a: Set<string>, b: Set<string>): number => {
    const inter = [...a].filter((x) => b.has(x)).length;
    const union = new Set([...a, ...b]).size;
    return union === 0 ? 0 : inter / union;
  };
  it("todo par de escuelas solapa ≤0.7 en su rol identitario", () => {
    // La identidad vive en base/fuerza; en peaking la especificidad del pico CONVERGE a las
    // escuelas a propósito (todos compiten los mismos dos lifts) — sólo el búlgaro se compara
    // ahí porque es el único rol que tiene.
    const reps: [string, string, PhaseRole][] = [
      ["bulgaro-6d", "polaco-5d", "peaking"], ["bulgaro-6d", "coreano-5d", "peaking"],
      ["polaco-5d", "cubano-competidor", "base"], ["coreano-5d", "chino-5d", "base"],
      ["colombiano-5d", "usa-intermedio", "base"], ["hibrido-5d", "ucraniano-4d", "fuerza"],
      ["chino-5d", "cubano-competidor", "base"], ["usa-school", "coreano-6d", "fuerza"],
    ];
    for (const [a, b, role] of reps) {
      const ta = tuples(a, role);
      const tb = tuples(b, role);
      expect(ta.size, `${a} sin fase de rol ${role}`).toBeGreaterThan(0);
      expect(tb.size, `${b} sin fase de rol ${role}`).toBeGreaterThan(0);
      expect(jaccard(ta, tb), `${a} vs ${b} (${role})`).toBeLessThanOrEqual(0.7);
    }
  });
});

describe("regresión Ruso (D4 — el modelo debe poder aproximar la receta curada)", () => {
  it("la receta generada del ADN ruso solapa ≥60% de bases por fase con la curada y respeta el corredor", () => {
    const m = macro("ruso-5d");
    const dna = dnaForFamily("Ruso")!;
    // generateRecipe salta macros curados → generamos contra un alias del mismo macro
    const alias = { ...m, id: "ruso-5d__regression" };
    const gen = generateRecipeForTest(dna, alias)!;
    const curated = MACRO_RECIPES.find((r) => r.macroId === "ruso-5d")!;
    for (const ph of curated.phases) {
      const curatedBases = new Set(ph.sessions.flatMap((s) => s.exercises).flatMap(baseIdOf));
      const genPhase = gen.phases.find((p) => p.phaseKey === ph.phaseKey)!;
      const genBases = new Set(genPhase.sessions.flatMap((s) => s.exercises).flatMap(baseIdOf));
      const inter = [...curatedBases].filter((b) => genBases.has(b)).length;
      expect(inter / curatedBases.size, ph.phaseKey).toBeGreaterThanOrEqual(0.6);
      const fase = m.phaseProfile.find((f) => f.key === ph.phaseKey)!;
      for (const s of genPhase.sessions) for (const ex of s.exercises) {
        if (!isComplexId(ex.movementId) && CLASSIC_BASES.has(getMovement(ex.movementId)!.baseId)) {
          expect(ex.pct!).toBeGreaterThanOrEqual(fase.imrPct[0]);
          expect(ex.pct!).toBeLessThanOrEqual(Math.min(fase.imrPct[1], 95));
        }
      }
    }
  });
});

describe("auditoría Prilepin (la tabla del motor vigila al generador)", () => {
  // Tabla Prilepin de la casa — la unidad es POR SESIÓN Y ZONA (§2 motor, enmienda Carnicero):
  // las reps totales de TODOS los clásicos de una sesión en una zona viven en [min, max].
  const RANGES: Record<string, [number, number]> = { "70-80": [12, 24], "80-90": [10, 20], "90+": [1, 10] };
  it("clásicos: reps totales por sesión y zona dentro del rango (descarga exenta; <70% fuera de tabla)", () => {
    for (const m of MACROCYCLES.filter((x) => x.id !== "ruso-5d")) {
      const r = recipe(m.id);
      for (const ph of r.phases) {
        const fase = m.phaseProfile.find((f) => f.key === ph.phaseKey)!;
        if (phaseRole(fase) === "descarga") continue;
        for (const s of ph.sessions) {
          const perZone = new Map<string, number>();
          for (const ex of s.exercises) {
            if (isComplexId(ex.movementId) || !CLASSIC_BASES.has(getMovement(ex.movementId)!.baseId)) continue;
            if (ex.pct == null || ex.pct < 70) continue;
            const zone = ex.pct >= 90 ? "90+" : ex.pct >= 80 ? "80-90" : "70-80";
            perZone.set(zone, (perZone.get(zone) ?? 0) + ex.sets * ex.reps);
          }
          for (const [zone, total] of perZone) {
            const [min, max] = RANGES[zone]!;
            expect(total, `${m.id}/${ph.phaseKey}: zona ${zone}`).toBeGreaterThanOrEqual(min);
            expect(total, `${m.id}/${ph.phaseKey}: zona ${zone}`).toBeLessThanOrEqual(max);
          }
        }
      }
    }
  });
});

describe("ambos lifts de competencia, cada semana (HIGH-1 Carnicero — garantía estructural)", () => {
  it("toda fase no-descarga entrena arranque-pattern Y envión-pattern (como base o eslabón)", () => {
    for (const m of MACROCYCLES.filter((x) => x.id !== "ruso-5d")) {
      const r = recipe(m.id);
      for (const ph of r.phases) {
        const fase = m.phaseProfile.find((f) => f.key === ph.phaseKey)!;
        if (phaseRole(fase) === "descarga") continue;
        const bases = ph.sessions.flatMap((s) => s.exercises).flatMap(baseIdOf);
        const hasArranque = bases.includes("arranque");
        const hasEnvion = bases.some((b) => ["cargada", "envion", "cargada-envion"].includes(b));
        expect(hasArranque, `${m.id}/${ph.phaseKey}: sin arranque-pattern`).toBe(true);
        expect(hasEnvion, `${m.id}/${ph.phaseKey}: sin envión-pattern`).toBe(true);
      }
    }
  });
  it("variedad intra-fase: el slot olímpico usa ≥2 variantes cuando hay ≥2 picks", () => {
    for (const m of MACROCYCLES.filter((x) => x.id !== "ruso-5d")) {
      const r = recipe(m.id);
      for (const ph of r.phases) {
        const oliPicks = ph.sessions.flatMap((s) => s.exercises).filter((ex) => {
          if (isComplexId(ex.movementId)) return false;
          const baseId = getMovement(ex.movementId)!.baseId;
          return CLASSIC_BASES.has(baseId) || baseId === "snatch-balance";
        });
        if (oliPicks.length < 2) continue;
        const distinct = new Set(oliPicks.map((ex) => ex.movementId));
        expect(distinct.size, `${m.id}/${ph.phaseKey}: semana monótona (${[...distinct][0]})`).toBeGreaterThanOrEqual(2);
      }
    }
  });
});

describe("sanidad de dosis (HIGH-2/HIGH-3 Carnicero — kg que un humano levanta)", () => {
  it("sentadillas: pct ≥95 ⇒ 1 rep; ≥90 ⇒ ≤2 reps (jamás dobles al 96%+)", () => {
    for (const m of MACROCYCLES.filter((x) => x.id !== "ruso-5d")) {
      const r = recipe(m.id);
      for (const ph of r.phases) for (const s of ph.sessions) for (const ex of s.exercises) {
        if (isComplexId(ex.movementId)) continue;
        const baseId = getMovement(ex.movementId)!.baseId;
        if (!["sentadilla", "sentadilla-frente", "sentadilla-overhead"].includes(baseId)) continue;
        if (ex.pct == null) continue;
        if (ex.pct >= 95) expect(ex.reps, `${m.id}/${ph.phaseKey}: ${ex.movementId} @${ex.pct}`).toBe(1);
        else if (ex.pct >= 90) expect(ex.reps, `${m.id}/${ph.phaseKey}: ${ex.movementId} @${ex.pct}`).toBeLessThanOrEqual(2);
      }
    }
  });
  it("accesorios con % propio de su base, no del slot (press militar ≤45, sots ≤35, jerk-dip 90–105, remos ≤50, GM ≤40)", () => {
    const CAPS: Record<string, [number, number]> = {
      "press-hombros": [25, 45], "sots-press": [20, 35], "jerk-dip": [90, 105],
      "remo-menton": [20, 35], "remo": [35, 50], "buenos-dias": [20, 40],
    };
    for (const m of MACROCYCLES.filter((x) => x.id !== "ruso-5d")) {
      const r = recipe(m.id);
      for (const ph of r.phases) for (const s of ph.sessions) for (const ex of s.exercises) {
        if (isComplexId(ex.movementId) || ex.pct == null) continue;
        const cap = CAPS[getMovement(ex.movementId)!.baseId];
        if (!cap) continue;
        expect(ex.pct, `${m.id}/${ph.phaseKey}: ${ex.movementId}`).toBeGreaterThanOrEqual(cap[0]);
        expect(ex.pct, `${m.id}/${ph.phaseKey}: ${ex.movementId}`).toBeLessThanOrEqual(cap[1]);
      }
    }
  });
  it("notas de escuela jamás sobre trabajo pesado (EMOM sólo bajo 85%)", () => {
    for (const m of MACROCYCLES.filter((x) => x.family === "Ucraniano")) {
      const r = recipe(m.id);
      for (const ph of r.phases) for (const s of ph.sessions) for (const ex of s.exercises)
        if (ex.notes?.includes("EMOM")) expect(ex.pct!, `${m.id}/${ph.phaseKey}`).toBeLessThan(85);
    }
  });
});

describe("contrato receta ↔ schema de lectura (regresión: complejos con '+' rompían la prescripción)", () => {
  // Bug 2026-06-14 (atleta "pipo", cubano-int-5d): la sem 1 trae cx.arranque-colgado+arranque y
  // cx.tiron-cargada+cargada. El '+' no estaba en MovementIdSchema → SessionViewsSchema.parse reventaba
  // dentro de HttpRepository (el server serializa el 200 bien; el CLIENTE rechazaba la respuesta) →
  // "No se pudieron cargar las sesiones" en el Plan del coach Y /me/sessions del atleta (sin acceso).
  // Los tests de integración de la API no pasan por HttpRepository, así que el mismatch quedó latente.
  const RMS: RM = { arranque: 70, envion: 95, sentadilla: 120, frente: 110 };

  it("PrescribedExerciseSchema acepta TODOS los ids de complejo del catálogo (el '+' es válido)", () => {
    for (const c of COMPLEXES) {
      expect(() => PrescribedExerciseSchema.parse({ movementId: c.id, sets: 5, reps: 1, pct: 70 }), c.id).not.toThrow();
    }
  });

  it("toda semana de TODO macro pasa SessionViewsSchema (lo que el cliente valida sobre el 200 del server)", () => {
    for (const m of MACROCYCLES) {
      const totalWeeks = m.phaseProfile[m.phaseProfile.length - 1]!.weeks[1];
      const rows = instantiatePrescription(ALL_RECIPES, m, totalWeeks);
      for (let week = 1; week <= totalWeeks; week++) {
        const views = buildSessionViews(rows.filter((r) => r.week === week), RMS, 20);
        // el server (Fastify, sin response schema) serializa con JSON.stringify; el cliente parsea ESO.
        const wire = JSON.parse(JSON.stringify(views));
        expect(() => SessionViewsSchema.parse(wire), `${m.id} sem ${week}`).not.toThrow();
      }
    }
  });
});

describe("snapshot (D2 — el artefacto auditable commiteado)", () => {
  it("ALL_RECIPES es estable byte a byte", async () => {
    await expect(JSON.stringify(ALL_RECIPES, null, 1)).toMatchFileSnapshot("__snapshots__/recipes-gen.snap");
  });
});

// import tardío para no ensuciar el header: el alias de regresión necesita el generador directo
import { generateRecipe as generateRecipeForTest } from "../logic/recipeGen";
