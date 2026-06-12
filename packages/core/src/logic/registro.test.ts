import { describe, expect, it } from "vitest";
import { validateFechaEntreno, fechaConflict, weekRange, fueraDeSemana } from "./registro";

describe("validateFechaEntreno (D2: pasada libre, futuro jamás)", () => {
  it("hoy y cualquier pasada → ok; futura → futuro", () => {
    expect(validateFechaEntreno("2026-06-12", "2026-06-12")).toBe("ok");
    expect(validateFechaEntreno("2025-01-01", "2026-06-12")).toBe("ok");
    expect(validateFechaEntreno("2026-06-13", "2026-06-12")).toBe("futuro");
  });
});

describe("fechaConflict (D1: máx 1 entreno por fecha; excepción turnos del mismo día)", () => {
  const dayOf = (idx: number) => idx + 1; // layout legacy: sesión n = día n
  const regs = [{ week: 9, sessionIdx: 0, fecha: "2026-06-12" }];
  it("otra sesión con la misma fecha → conflicto identificado", () => {
    expect(fechaConflict(regs, 9, 1, "2026-06-12", dayOf)).toEqual(regs[0]);
  });
  it("editarse a sí misma jamás conflictúa (D12)", () => {
    expect(fechaConflict(regs, 9, 0, "2026-06-12", dayOf)).toBeNull();
  });
  it("fecha distinta → sin conflicto", () => {
    expect(fechaConflict(regs, 9, 1, "2026-06-11", dayOf)).toBeNull();
  });
  it("turnos AM/PM del mismo día de receta comparten fecha (D9)", () => {
    const dosTurnos = (idx: number) => (idx <= 1 ? 1 : idx); // sesiones 0 y 1 = día 1
    expect(fechaConflict(regs, 9, 1, "2026-06-12", dosTurnos)).toBeNull();
  });
  it("mismo día de receta pero OTRA semana → conflicto (la excepción es intra-semana)", () => {
    const dosTurnos = (idx: number) => (idx <= 1 ? 1 : idx);
    expect(fechaConflict(regs, 10, 1, "2026-06-12", dosTurnos)).toEqual(regs[0]);
  });
});

describe("weekRange/fueraDeSemana (D2: aviso suave, jamás bloqueo)", () => {
  it("semana w = [startDate+(w-1)*7, +6]", () => {
    expect(weekRange("2026-04-01", 1)).toEqual({ from: "2026-04-01", to: "2026-04-07" });
    expect(weekRange("2026-04-01", 9)).toEqual({ from: "2026-05-27", to: "2026-06-02" });
    expect(weekRange("2025-12-29", 1)).toEqual({ from: "2025-12-29", to: "2026-01-04" });
  });
  it("fecha degenerada → null/false, jamás NaN fabricando booleanos (lección Carnicero)", () => {
    expect(weekRange("garbage", 1)).toBeNull();
    expect(fueraDeSemana("2026-06-12", "garbage", 1)).toBe(false);
  });
  it("dentro/fuera del rango", () => {
    expect(fueraDeSemana("2026-04-03", "2026-04-01", 1)).toBe(false);
    expect(fueraDeSemana("2026-04-09", "2026-04-01", 1)).toBe(true);
  });
});
