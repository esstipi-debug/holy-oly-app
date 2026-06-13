import { describe, it, expect } from "vitest";
import { planHeat, maxLifts, type HeatRow } from "./planHeat";

const row = (week: number, sessionIdx: number, sets: number, reps: number, pct?: number): HeatRow =>
  ({ week, sessionIdx, sets, reps, pct });

describe("planHeat", () => {
  it("agrupa por día: topPct = máximo de los pct, lifts = Σ sets×reps", () => {
    const h = planHeat([row(1, 0, 5, 2, 80), row(1, 0, 4, 2, 85), row(1, 0, 5, 3)], 2);
    expect(h[0]!.days[0]).toEqual({ topPct: 85, lifts: 10 + 8 + 15 });
  });

  it("siempre devuelve totalWeeks semanas × 7 slots; semana sin filas = 7 null", () => {
    const h = planHeat([row(1, 0, 3, 3, 70)], 3);
    expect(h).toHaveLength(3);
    expect(h[1]!.days).toHaveLength(7);
    expect(h[1]!.days.every((d) => d === null)).toBe(true);
    expect(h[2]!.week).toBe(3);
  });

  it("día sin ningún pct → topPct ausente (sin-dato honesto, nunca 0)", () => {
    const h = planHeat([row(2, 1, 4, 6)], 2);
    expect(h[1]!.days[1]).toEqual({ lifts: 24 });
    expect(h[1]!.days[1]!.topPct).toBeUndefined();
  });

  it("ignora filas fuera de rango (week fuera del plan, sessionIdx fuera de 0..6)", () => {
    const h = planHeat([row(5, 0, 3, 3, 80), row(1, 7, 3, 3, 80), row(1, -1, 3, 3, 80)], 2);
    expect(h.every((w) => w.days.every((d) => d === null))).toBe(true);
  });

  it("días distintos no se mezclan (sesión i → día i)", () => {
    const h = planHeat([row(1, 0, 5, 2, 80), row(1, 2, 3, 5, 70)], 1);
    expect(h[0]!.days[0]).toEqual({ topPct: 80, lifts: 10 });
    expect(h[0]!.days[1]).toBeNull();
    expect(h[0]!.days[2]).toEqual({ topPct: 70, lifts: 15 });
  });

  it("totalWeeks 0 → []", () => {
    expect(planHeat([row(1, 0, 1, 1, 70)], 0)).toEqual([]);
  });
});

describe("maxLifts", () => {
  it("máximo de lifts entre todos los días; 0 con plan vacío", () => {
    const h = planHeat([row(1, 0, 5, 2, 80), row(2, 3, 10, 3, 70)], 2);
    expect(maxLifts(h)).toBe(30);
    expect(maxLifts(planHeat([], 2))).toBe(0);
  });
});

describe("planHeat day-aware (D8: dos turnos agregan en la celda del día)", () => {
  it("rows con day explícito caen en days[day-1]; AM+PM suman lifts y topPct = máx", () => {
    const rows = [
      { week: 1, sessionIdx: 0, sets: 5, reps: 2, pct: 90, day: 1 },  // AM
      { week: 1, sessionIdx: 1, sets: 4, reps: 1, pct: 95, day: 1 },  // PM, mismo día
      { week: 1, sessionIdx: 2, sets: 3, reps: 3, pct: 80, day: 2 },
    ];
    const heat = planHeat(rows, 1);
    expect(heat[0]!.days[0]).toEqual({ lifts: 14, topPct: 95 });
    expect(heat[0]!.days[1]).toEqual({ lifts: 9, topPct: 80 });
    expect(heat[0]!.days[2]).toBeNull();
  });
  it("sin day → legacy: days[sessionIdx] (cero regresión)", () => {
    const heat = planHeat([{ week: 1, sessionIdx: 3, sets: 2, reps: 2, pct: 70 }], 1);
    expect(heat[0]!.days[3]).toEqual({ lifts: 4, topPct: 70 });
  });
});
