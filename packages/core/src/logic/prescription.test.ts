import { describe, it, expect } from "vitest";
import type { MacroRecipe, RM } from "../types";
import { MACROCYCLES } from "../data/macrocycles";
import { resolveTargetKg, sessionTemplateFor, instantiatePrescription, buildSessionViews, dayLayoutFor } from "./prescription";

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
  it("no pct → undefined; kgOverride → exact value", () => {
    // pct omitted → undefined even when rmRef is valid (no % to multiply)
    expect(resolveTargetKg({ movementId: "peso-muerto-rumano", sets: 3, reps: 8 }, RMS)).toBeUndefined();
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

describe("complejos en la prescripción (D6 — kg vs eslabón débil)", () => {
  const rms: RM = { arranque: 100, envion: 120, sentadilla: 150, frente: 130 };
  it("resolveTargetKg de cx.* = pct × min RM de los eslabones", () => {
    // cargada(envion 120) + frontal(frente 130) + 2t(envion 120) ⇒ débil 120 → 80% = 96
    expect(resolveTargetKg({ movementId: "cx.cargada+frontal+2t", sets: 4, reps: 3, pct: 80 }, rms)).toBe(96);
    // arranque+ohs: ambos arranque (100) → 70% = 70
    expect(resolveTargetKg({ movementId: "cx.arranque+ohs", sets: 3, reps: 3, pct: 70 }, rms)).toBe(70);
  });
  it("kgOverride sigue mandando sobre el % del complejo", () => {
    expect(resolveTargetKg({ movementId: "cx.arranque+ohs", sets: 3, reps: 3, pct: 70, kgOverride: 62 }, rms)).toBe(62);
  });
  it("cx desconocido → kg undefined y nombre = id (sin throw, sin-dato honesto)", () => {
    expect(resolveTargetKg({ movementId: "cx.nope", sets: 1, reps: 1, pct: 80 }, rms)).toBeUndefined();
    const views = buildSessionViews([{ movementId: "cx.nope", sets: 1, reps: 1, pct: 80, week: 1, sessionIdx: 0, order: 0 }], rms);
    expect(views[0]!.exercises[0]!.movementName).toBe("cx.nope");
  });
  it("buildSessionViews: nombre del complejo (con notación) + warmup con rampa del 1er eslabón", () => {
    const views = buildSessionViews(
      [{ movementId: "cx.cargada+frontal+2t", sets: 4, reps: 3, pct: 80, week: 1, sessionIdx: 0, order: 0 }],
      rms,
    );
    const ex = views[0]!.exercises[0]!;
    expect(ex.movementName).toBe("Cargada + Sent. frontal + Segundo tiempo (1+1+1)");
    expect(ex.targetKg).toBe(96);
    expect(ex.warmup && ex.warmup.length).toBeGreaterThan(0);
    // la rampa apunta al kg de trabajo del complejo (96), nunca lo alcanza, y abre con barra (1er mov)
    expect(ex.warmup![0]!.label).toBe("barra");
    for (const w of ex.warmup!) expect(w.kg).toBeLessThan(96);
  });
});

describe("accesorios por %×RM (sin RPE)", () => {
  it("un accesorio resuelve kg por %×RM de su referencia (sin RPE)", () => {
    const rms = { arranque: 92, envion: 116, sentadilla: 150, frente: 122 };
    expect(resolveTargetKg({ movementId: "peso-muerto-rumano", sets: 3, reps: 6, pct: 68 }, rms)).toBe(102);
    expect(resolveTargetKg({ movementId: "press-empuje", sets: 4, reps: 4, pct: 62 }, rms)).toBe(72);
  });
});

describe("dayLayoutFor (layout día/turno derivado de la receta — D8, no se persiste)", () => {
  it("ruso-5d (mono-diario): day = idx+1, sin turno", () => {
    const ruso = MACROCYCLES.find((m) => m.id === "ruso-5d")!;
    const layout = dayLayoutFor(ruso, 1)!;
    expect(layout).toHaveLength(5);
    expect(layout[0]).toEqual({ day: 1 });
    expect(layout[4]).toEqual({ day: 5 });
  });
  it("macro sin receta para la semana → null (sin-dato honesto)", () => {
    const ruso = MACROCYCLES.find((m) => m.id === "ruso-5d")!;
    expect(dayLayoutFor(ruso, 999)).toBeNull();
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
