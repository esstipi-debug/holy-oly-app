import { describe, it, expect } from "vitest";
import { readiness, readinessTrend } from "./readiness";
import type { MonitorSeries } from "../types";

describe("readiness (heurística recuperación + carga)", () => {
  it("recuperación buena + carga en banda → ~recuperación", () => {
    expect(readiness(84, 1.05)).toBe(84); // acwr en [0.8,1.3] → sin penalidad
  });
  it("penaliza carga fuera de banda (alta)", () => {
    expect(readiness(41, 1.62)).toBe(28); // over=0.32 → penalty=min(20,round(12.8))=13 → 41-13=28
  });
  it("penaliza carga fuera de banda (baja), con tope 20", () => {
    expect(readiness(80, 0.2)).toBe(60); // over=0.6 → round(24)=24 → cap 20 → 80-20=60
  });
  it("sin recuperación → undefined (sin-dato, nunca un número inventado)", () => {
    expect(readiness(undefined, 1.0)).toBeUndefined();
    expect(readiness(NaN, 1.0)).toBeUndefined();
  });
  it("recuperación sin carga → la recuperación sin penalizar", () => {
    expect(readiness(70, undefined)).toBe(70);
  });
  it("clamp 0..100", () => {
    expect(readiness(10, 2.5)).toBe(0); // 10 - 20 = -10 → 0
  });
});

describe("readinessTrend", () => {
  const base: MonitorSeries = {
    weeks: 5, acute: [60, 65, 70, 80, 95], hrv: [70, 70, 70, 70, 70], hrvBase: 70,
    rhr: [50, 50, 50, 50, 50], rhrBase: 50, imr: [70, 72, 74, 76, 78],
    wellness: [80, 80, 80, 80, 80], recovery: [85, 82, 80, 70, 60],
  };
  it("Δ readiness entre la última semana y ~3 atrás", () => {
    const t = readinessTrend(base);
    expect(typeof t).toBe("number");
    expect(t).toBeLessThan(0); // recuperación cae + carga sube → trend negativo
  });
  it("undefined con menos de 2 semanas", () => {
    expect(readinessTrend({ ...base, weeks: 1, acute: [60], recovery: [85], hrv: [70], rhr: [50], imr: [70], wellness: [80] })).toBeUndefined();
    expect(readinessTrend(undefined)).toBeUndefined();
  });
});
