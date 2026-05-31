import { describe, it, expect } from "vitest";
import { volumeCurve, isTaperWeek } from "./restructure";

const flat = () => 100; // volumen base constante para aislar el taper

describe("restructure", () => {
  it("1 competencia: adelanta la bajada de volumen a las ~3 semanas previas", () => {
    const v = volumeCurve(16, [{ week: 12, name: "A" }], flat);
    expect(v[11]).toBe(26); // sem 12 (semana de comp)
    expect(v[10]).toBe(26); // sem 11
    expect(v[9]).toBe(40);  // sem 10
    expect(v[8]).toBe(56);  // sem 9
    expect(v[7]).toBe(100); // sem 8 (fuera del taper)
    expect(v[15]).toBe(55); // sem 16 post-competencia (ligero)
  });
  it("varias competencias: repite la bajada antes de cada una", () => {
    const v = volumeCurve(16, [{ week: 12, name: "A" }, { week: 16, name: "B" }], flat);
    expect(v[11]).toBe(26); // taper A
    expect(v[15]).toBe(26); // taper B
    expect(v[7]).toBe(100);
  });
  it("isTaperWeek marca las 2 semanas previas + la de la competencia", () => {
    const comps = [{ week: 12, name: "A" }];
    expect(isTaperWeek(12, comps)).toBe(true);
    expect(isTaperWeek(10, comps)).toBe(true);
    expect(isTaperWeek(9, comps)).toBe(false);
  });
});
