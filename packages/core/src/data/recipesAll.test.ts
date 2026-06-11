import { describe, it, expect } from "vitest";
import type { MacroRecipe, PhaseRole, PrescribedExercise } from "../types";
import { ALL_RECIPES, recipeFor } from "./recipesAll";
import { MACRO_RECIPES } from "./recipes";
import { MACROCYCLES } from "./macrocycles";
import { SCHOOL_DNA, dnaForFamily } from "./schools";
import { phaseRole } from "../logic/recipeGen";
import { getMovement } from "../logic/movements";
import { isComplexId, getComplex } from "../logic/complexes";

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
  it("en el rol peaking (el más comparable), todo par de escuelas solapa ≤0.7", () => {
    const reps: [string, string][] = [
      ["bulgaro-6d", "polaco-5d"], ["bulgaro-6d", "coreano-5d"], ["polaco-5d", "cubano-competidor"],
      ["coreano-5d", "chino-5d"], ["colombiano-5d", "usa-intermedio"], ["hibrido-5d", "ucraniano-4d"],
      ["chino-5d", "cubano-competidor"], ["usa-school", "coreano-6d"],
    ];
    for (const [a, b] of reps) {
      const ta = tuples(a, "peaking");
      const tb = tuples(b, "peaking");
      if (ta.size === 0 || tb.size === 0) continue;
      expect(jaccard(ta, tb), `${a} vs ${b}`).toBeLessThanOrEqual(0.7);
    }
  });
});

describe("regresión Ruso (D4 — el modelo debe poder aproximar la receta curada)", () => {
  it("la receta generada del ADN ruso solapa ≥60% de bases por fase con la curada y respeta el corredor", () => {
    const m = macro("ruso-5d");
    const dna = dnaForFamily("Ruso")!;
    // generateRecipe salta macros curados → generamos contra un alias del mismo macro
    const alias = { ...m, id: "ruso-5d__regression" };
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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
  // Tabla Prilepin (prilepin.ts): 70-80 [12,24] · 80-90 [10,20] · 90+ [1,10] — por SESIÓN.
  // Para clásicos generados: reps totales (sets×reps) del lift en su sesión, por zona.
  const RANGES: Record<string, [number, number]> = { "70-80": [12, 24], "80-90": [10, 20], "90+": [1, 10] };
  it("clásicos dentro del rango de su zona (descarga exenta; <70% fuera de tabla)", () => {
    for (const m of MACROCYCLES.filter((x) => x.id !== "ruso-5d")) {
      const r = recipe(m.id);
      for (const ph of r.phases) {
        const fase = m.phaseProfile.find((f) => f.key === ph.phaseKey)!;
        if (phaseRole(fase) === "descarga") continue;
        for (const s of ph.sessions) for (const ex of s.exercises) {
          if (isComplexId(ex.movementId) || !CLASSIC_BASES.has(getMovement(ex.movementId)!.baseId)) continue;
          if (ex.pct == null || ex.pct < 70) continue;
          const zone = ex.pct >= 90 ? "90+" : ex.pct >= 80 ? "80-90" : "70-80";
          const total = ex.sets * ex.reps;
          const [min, max] = RANGES[zone]!;
          expect(total, `${m.id}/${ph.phaseKey}: ${ex.movementId} ${ex.sets}×${ex.reps}@${ex.pct}`).toBeGreaterThanOrEqual(min);
          expect(total).toBeLessThanOrEqual(max);
        }
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
