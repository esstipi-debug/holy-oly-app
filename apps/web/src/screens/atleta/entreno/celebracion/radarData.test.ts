import { describe, test, expect } from "vitest";
import type { DayLog, MonitorSeries } from "@holy-oly/core";
import { buildWellnessRadar } from "./radarData";

const entry = (over: Partial<DayLog> = {}): DayLog => ({
  date: "2026-06-10", fatiga: 3, dolor: 1, estres: 2, humor: 4, motivacion: 4, sueno: 4, ...over,
});

describe("buildWellnessRadar", () => {
  test("sin entrada de hoy → null (empty-state honesto)", () => {
    expect(buildWellnessRadar(null, undefined)).toBeNull();
  });

  test("con entrada → 6 ejes etiquetados, normalizados 0..1 con polaridad de bien/mal", () => {
    const r = buildWellnessRadar(entry(), undefined)!;
    expect(r).not.toBeNull();
    expect(r.labels).toEqual(["Fatiga", "Dolor", "Estrés", "Humor", "Motivación", "Sueño"]);
    expect(r.today).toHaveLength(6);
    // dolor=1 (highBad) → goodness 5 → 1.0 (mejor); humor=4 (highGood) → goodness 4 → 0.75
    expect(r.today[1]).toBeCloseTo(1, 5);
    expect(r.today[3]).toBeCloseTo(0.75, 5);
    // todos en [0,1]
    expect(r.today.every((v) => v >= 0 && v <= 1)).toBe(true);
    // sin serie → avg = today (no inventa promedio)
    expect(r.avg).toEqual(r.today);
  });

  test("con ítems semanales del monitor → avg sale del promedio por ítem (por field o label)", () => {
    const series = { wellnessItems: { fatiga: [5, 5, 5], humor: [2, 2, 2] } } as unknown as MonitorSeries;
    const r = buildWellnessRadar(entry({ fatiga: 1, humor: 5 }), series)!;
    // fatiga avg raw=5 (highBad) → goodness 1 → 0.0 (peor)
    expect(r.avg[0]).toBeCloseTo(0, 5);
    // humor avg raw=2 (highGood) → goodness 2 → 0.25
    expect(r.avg[3]).toBeCloseTo(0.25, 5);
    // hoy: fatiga=1 → 1.0 ; humor=5 → 1.0 (hoy mejor que el promedio)
    expect(r.today[0]).toBeCloseTo(1, 5);
    expect(r.today[3]).toBeCloseTo(1, 5);
  });
});
