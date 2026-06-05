import { describe, it, expect } from "vitest";
import { warmupSets } from "./warmup";
import { warmupForExercise } from "./warmup";

describe("warmupSets", () => {
  it("día liviano · Arranque @62% (1er mov) · rm 92 · barra 15", () => {
    expect(warmupSets(62, 92, 15, true)).toEqual([
      { pct: 0, kg: 15, reps: 5, label: "barra" },
      { pct: 31, kg: 29, reps: 5, label: "rampa" },
      { pct: 43, kg: 40, reps: 3, label: "rampa" },
      { pct: 53, kg: 48, reps: 2, label: "rampa" },
    ]);
  });
  it("día medio · Envión @78% (no 1er mov) · rm 116 · sin barra", () => {
    expect(warmupSets(78, 116, 15, false)).toEqual([
      { pct: 39, kg: 45, reps: 5, label: "rampa" },
      { pct: 55, kg: 63, reps: 3, label: "rampa" },
      { pct: 66, kg: 77, reps: 2, label: "rampa" },
    ]);
  });
  it("día pesado · Sentadilla @90% (1er mov) · rm 150 · incluye single de aproximación", () => {
    expect(warmupSets(90, 150, 15, true)).toEqual([
      { pct: 0, kg: 15, reps: 5, label: "barra" },
      { pct: 45, kg: 68, reps: 5, label: "rampa" },
      { pct: 63, kg: 95, reps: 3, label: "rampa" },
      { pct: 77, kg: 115, reps: 2, label: "rampa" },
      { pct: 84, kg: 126, reps: 1, label: "rampa" },
    ]);
  });
  it("sin-dato → [] (workingPct<=0, rm<=0)", () => {
    expect(warmupSets(0, 100, 20, true)).toEqual([]);
    expect(warmupSets(80, 0, 20, true)).toEqual([]);
  });
  it("día muy liviano (<=55%) → un solo set de aproximación", () => {
    expect(warmupSets(50, 100, 20, false)).toEqual([
      { pct: 38, kg: 38, reps: 3, label: "rampa" },
    ]);
  });
});

const RMS = { arranque: 92, envion: 116, sentadilla: 150, frente: 130 };

describe("warmupForExercise", () => {
  it("lift principal 1er mov → rampa completa con barra", () => {
    const w = warmupForExercise({ movementId: "arranque", pct: 62, order: 0 }, RMS, 15);
    expect(w[0]).toEqual({ pct: 0, kg: 15, reps: 5, label: "barra" });
    expect(w.length).toBe(4);
  });
  it("accesorio (baseComplexity<=3) no-1er-mov → 1 feeler 0.6·W×5", () => {
    // press-empuje rmRef envion(116), @70% → 0.6·70=42% → round(0.42·116)=49
    const w = warmupForExercise({ movementId: "press-empuje", pct: 70, order: 2 }, RMS, 15);
    expect(w).toEqual([{ pct: 42, kg: 49, reps: 5, label: "rampa" }]);
  });
  it("OHS no-1er-mov → 2 feelers (0.5·W×5, 0.7·W×3)", () => {
    // sentadilla-overhead rmRef arranque(92), @80% → 0.5·80=40%→round(0.40·92)=37 ; 0.7·80=56%→round(0.56·92)=52
    const w = warmupForExercise({ movementId: "sentadilla-overhead", pct: 80, order: 3 }, RMS, 15);
    expect(w).toEqual([
      { pct: 40, kg: 37, reps: 5, label: "rampa" },
      { pct: 56, kg: 52, reps: 3, label: "rampa" },
    ]);
  });
  it("tirón no-1er-mov → rampa completa SIN barra", () => {
    const w = warmupForExercise({ movementId: "tiron-arranque", pct: 100, order: 1 }, RMS, 15);
    expect(w.some((s) => s.label === "barra")).toBe(false);
    expect(w.length).toBeGreaterThanOrEqual(3);
  });
  it("sin-dato → [] (sin pct)", () => {
    expect(warmupForExercise({ movementId: "arranque", pct: undefined, order: 0 }, RMS, 15)).toEqual([]);
  });
  it("movimiento desconocido → []", () => {
    expect(warmupForExercise({ movementId: "no-existe", pct: 80, order: 0 }, RMS, 15)).toEqual([]);
  });
});
