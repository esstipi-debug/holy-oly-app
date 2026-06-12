import { describe, expect, it } from "vitest";
import { readinessModulation } from "./readinessModulation";
import { generateWeek } from "./prilepin";
import type { EngineInput, EngineWeek, ReadinessBand } from "../types";

/** Week real del motor con la banda pedida (caso canónico: intensificación a 3 semanas → trae 90+). */
const weekWith = (readiness: ReadinessBand | null): EngineWeek => {
  const input: EngineInput = {
    countdownWeeks: 3, weekIdx: 0, lift: "arranque", rmKg: 100, recentACWR: 1.1, readiness,
  };
  return generateWeek(input)!;
};

describe("readinessModulation — redacta lo que el motor YA aplicó (capa de rationale, no recálculo)", () => {
  it("verde → permitir lo planificado (allow, factor 1, sin mover singles)", () => {
    const m = readinessModulation(weekWith("green"));
    expect(m.band).toBe("green");
    expect(m.directive).toBe("allow");
    expect(m.factor).toBe(1);
    expect(m.moveHeavySingles).toBe(false);
    expect(m.headline).toMatch(/verde/i);
    expect(m.rationale).toMatch(/planificado/i);
  });

  it("ámbar → sostener (hold, factor 0.9), el rationale habla de sostener sin subir el tope", () => {
    const m = readinessModulation(weekWith("amber"));
    expect(m.band).toBe("amber");
    expect(m.directive).toBe("hold");
    expect(m.factor).toBe(0.9);
    expect(m.moveHeavySingles).toBe(false);
    expect(m.headline).toMatch(/ámbar/i);
    expect(m.rationale).toMatch(/sostenid/i);
  });

  it("roja con zona 90+ → recortar (cut, factor 0.75) + mover singles, no borrarlos", () => {
    const m = readinessModulation(weekWith("red"));
    expect(m.band).toBe("red");
    expect(m.directive).toBe("cut");
    expect(m.factor).toBe(0.75);
    expect(m.moveHeavySingles).toBe(true);
    expect(m.headline).toMatch(/roja/i);
    expect(m.rationale).toMatch(/recort/i);
    // Mover ≠ borrar: la guarda redacta "mover, NO borrar" (espejo de heavySinglesAdvisory).
    expect(m.rationale).toMatch(/mov[eé].*no.*borr/i);
  });

  it("roja SIN zona 90+ (acumulación) → cut pero sin la frase de singles", () => {
    const acc: EngineInput = {
      countdownWeeks: 8, weekIdx: 0, lift: "sentadilla", rmKg: 100, recentACWR: null, readiness: "red",
    };
    const m = readinessModulation(generateWeek(acc)!);
    expect(m.directive).toBe("cut");
    expect(m.factor).toBe(0.75);
    expect(m.moveHeavySingles).toBe(false);
  });

  it("sin readiness → none honesto (sin banda, sin factor, fallback de copy)", () => {
    const m = readinessModulation(weekWith(null));
    expect(m.band).toBeNull();
    expect(m.directive).toBe("none");
    expect(m.factor).toBeNull();
    expect(m.moveHeavySingles).toBe(false);
    expect(m.headline).toMatch(/sin se[ñn]al/i);
  });

  it("deriva SIEMPRE del week (única fuente): el factor del resultado == week.taper.readinessFactor", () => {
    for (const band of ["green", "amber", "red"] as const) {
      const w = weekWith(band);
      expect(readinessModulation(w).factor).toBe(w.taper.readinessFactor);
    }
  });

  it("regla intocable: cero RPE en el shape (D1)", () => {
    for (const band of ["green", "amber", "red", null] as const) {
      expect(JSON.stringify(readinessModulation(weekWith(band))).toLowerCase()).not.toContain("rpe");
    }
  });
});
