import { describe, it, expect } from "vitest";
import type { MacroRecipe, RM } from "../types";
import { MACROCYCLES } from "../data/macrocycles";
import { resolveTargetKg, sessionTemplateFor, instantiatePrescription, buildSessionViews } from "./prescription";

const RMS: RM = { arranque: 80, envion: 100, sentadilla: 140, frente: 110 };
const ruso = MACROCYCLES.find((m) => m.id === "ruso-5d")!;

describe("resolveTargetKg", () => {
  it("derives pct × RM of the movement's reference, rounded to 1kg", () => {
    expect(resolveTargetKg({ movementId: "arranque", sets: 5, reps: 3, pct: 70 }, RMS)).toBe(56); // 70% of 80
    expect(resolveTargetKg({ movementId: "sentadilla", sets: 5, reps: 5, pct: 80 }, RMS)).toBe(112); // 80% of 140
    expect(resolveTargetKg({ movementId: "tiron-arranque", sets: 4, reps: 3, pct: 105 }, RMS)).toBe(84); // 105% of 80
  });
  it("kgOverride beats pct", () => {
    expect(resolveTargetKg({ movementId: "arranque", sets: 1, reps: 1, pct: 70, kgOverride: 62.5 }, RMS)).toBe(62.5);
  });
  it("rmRef 'none' (accessory) without override → undefined (use rpe/kg)", () => {
    expect(resolveTargetKg({ movementId: "peso-muerto-rumano", sets: 3, reps: 8, rpe: 7 }, RMS)).toBeUndefined();
    expect(resolveTargetKg({ movementId: "peso-muerto-rumano", sets: 3, reps: 8, kgOverride: 90 }, RMS)).toBe(90);
  });
});

describe("instantiatePrescription (Ruso 5D)", () => {
  it("produces rows for every week × session of the macro", () => {
    const rows = instantiatePrescription(MACRO_RECIPES_FIXTURE, ruso, 16);
    // Fixture: hipertrofia has 2 sessions (3 exercises total: 2+1), fuerza-basica/fuerza-potencia/peaking
    // each have 1 session (1 exercise). ruso-5d phase weeks: 1-4/5-8/9-12/13-16 (4 weeks each).
    // Rows: hipertrofia 4wk×3ex=12, fuerza-basica 4wk×1ex=4, fuerza-potencia 4wk×1ex=4, peaking 4wk×1ex=4 → 24.
    expect(rows.length).toBe(24);
    expect(rows.every((r) => r.week >= 1 && r.week <= 16)).toBe(true);
    const w1 = rows.filter((r) => r.week === 1);
    expect(new Set(w1.map((r) => r.sessionIdx)).size).toBe(2); // fixture: 2 sessions in the hipertrofia phase
    expect(w1.find((r) => r.sessionIdx === 0 && r.order === 0)!.movementId).toBe("arranque");
  });
  it("a macro with no recipe → []", () => {
    expect(instantiatePrescription([], ruso, 16)).toEqual([]);
  });
});

describe("buildSessionViews", () => {
  it("groups week rows into sessions with movementName + derived targetKg", () => {
    const rows = instantiatePrescription(MACRO_RECIPES_FIXTURE, ruso, 16).filter((r) => r.week === 1);
    const views = buildSessionViews(rows, RMS);
    expect(views.length).toBe(2);
    const s0 = views.find((v) => v.sessionIdx === 0)!;
    expect(s0.exercises[0]!.movementName).toContain("Arranque");
    expect(s0.exercises[0]!.targetKg).toBe(54); // arranque 68% of 80 = 54.4 → 54
  });
});

// minimal fixture so the test doesn't depend on the full curated recipe
const MACRO_RECIPES_FIXTURE: MacroRecipe[] = [{
  macroId: "ruso-5d",
  phases: [
    { phaseKey: "hipertrofia", sessions: [
      { exercises: [{ movementId: "arranque", sets: 5, reps: 3, pct: 68 }, { movementId: "sentadilla", sets: 5, reps: 5, pct: 70 }] },
      { exercises: [{ movementId: "cargada-envion", sets: 5, reps: 2, pct: 68 }] },
    ] },
    { phaseKey: "fuerza-basica", sessions: [{ exercises: [{ movementId: "arranque", sets: 5, reps: 2, pct: 78 }] }] },
    { phaseKey: "fuerza-potencia", sessions: [{ exercises: [{ movementId: "arranque", sets: 6, reps: 1, pct: 88 }] }] },
    { phaseKey: "peaking", sessions: [{ exercises: [{ movementId: "arranque", sets: 5, reps: 1, pct: 93 }] }] },
  ],
}];
