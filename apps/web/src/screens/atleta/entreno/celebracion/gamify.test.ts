import { describe, it, expect } from "vitest";
import type { RecorridoSemana } from "@holy-oly/core";
import { xpForSession, cumulativeXp, levelInfo, weekStreak, highestTier } from "./gamify";

const wk = (week: number, hechas: number, totales: number, trabajoKg = 0): RecorridoSemana =>
  ({ week, sesionesHechas: hechas, sesionesTotales: totales, trabajoKg, calentamientoKg: 0 });

describe("xpForSession", () => {
  it("piso(trabajo/50) + 25 si completó", () => {
    expect(xpForSession(4000, true)).toBe(105); // 80 + 25
    expect(xpForSession(4000, false)).toBe(80);
  });
  it("blinda 0 / negativos / NaN", () => {
    expect(xpForSession(0, false)).toBe(0);
    expect(xpForSession(-100, true)).toBe(25);
    expect(xpForSession(NaN, false)).toBe(0);
  });
});

describe("cumulativeXp", () => {
  it("piso(Σ trabajoKg / 50)", () => {
    expect(cumulativeXp([wk(1, 3, 3, 5000), wk(2, 3, 3, 5000)])).toBe(200); // 10000/50
  });
  it("vacío → 0; ignora no-finitos", () => {
    expect(cumulativeXp([])).toBe(0);
    expect(cumulativeXp([wk(1, 1, 1, NaN)])).toBe(0);
  });
});

describe("levelInfo (curva triangular, subir L→L+1 cuesta 200·L)", () => {
  it("0 XP → Nivel 1, faltan 200 para 2", () => {
    expect(levelInfo(0)).toEqual({ level: 1, nextLevel: 2, xpToNext: 200 });
  });
  it("200 → Nivel 2; 600 → Nivel 3; 1200 → Nivel 4", () => {
    expect(levelInfo(200).level).toBe(2);
    expect(levelInfo(600).level).toBe(3);
    expect(levelInfo(1200).level).toBe(4);
  });
  it("250 → Nivel 2, faltan 350 para Nivel 3 (600-250)", () => {
    expect(levelInfo(250)).toEqual({ level: 2, nextLevel: 3, xpToNext: 350 });
  });
  it("blinda NaN/negativo → Nivel 1", () => {
    expect(levelInfo(NaN).level).toBe(1);
    expect(levelInfo(-50).level).toBe(1);
  });
});

describe("weekStreak (el descanso NO la rompe; faltar a una planificada SÍ)", () => {
  it("3 semanas seguidas cumplidas (actual incompleta no cuenta)", () => {
    const semanas = [wk(1, 3, 3), wk(2, 4, 4), wk(3, 5, 5), wk(4, 2, 5)];
    expect(weekStreak(semanas, 4)).toBe(3); // s1-3 ok, s4 (actual) incompleta → no cuenta
  });
  it("la semana actual cuenta si está completa", () => {
    expect(weekStreak([wk(1, 3, 3), wk(2, 3, 3)], 2)).toBe(2);
  });
  it("faltar a una planificada corta la racha", () => {
    const semanas = [wk(1, 3, 3), wk(2, 1, 4), wk(3, 5, 5)];
    expect(weekStreak(semanas, 4)).toBe(1); // s3 ok, s2 faltó → corta
  });
  it("una semana de descanso (0 planificadas) NO rompe la racha", () => {
    const semanas = [wk(1, 3, 3), wk(2, 0, 0), wk(3, 4, 4)];
    expect(weekStreak(semanas, 4)).toBe(2); // s3 + s1 (la 2 de descanso no rompe ni suma)
  });
  it("sin historial → 0", () => {
    expect(weekStreak([], 5)).toBe(0);
  });
});

describe("highestTier", () => {
  it("macro > semana > día", () => {
    expect(highestTier(false, false)).toBe("dia");
    expect(highestTier(true, false)).toBe("semana");
    expect(highestTier(true, true)).toBe("macro");
  });
});
