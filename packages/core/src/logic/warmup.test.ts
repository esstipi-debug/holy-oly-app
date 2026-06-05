import { describe, it, expect } from "vitest";
import { warmupSets } from "./warmup";

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
