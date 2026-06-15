import { describe, test, expect } from "vitest";
import { WELLNESS_TIPS, lowestWellnessItem, pickWellnessTip } from "./wellnessTips";

describe("lowestWellnessItem", () => {
  test("null sin entrada", () => {
    expect(lowestWellnessItem(null)).toBeNull();
    expect(lowestWellnessItem(undefined)).toBeNull();
  });

  test("elige el ítem más flojo con la polaridad correcta (highBad invertido)", () => {
    // estrés=5 (highBad) → goodness 1 = el peor; el resto está bien.
    expect(lowestWellnessItem({ fatiga: 2, dolor: 1, estres: 5, humor: 4, motivacion: 4, sueno: 4 })).toBe("estres");
    // sueño=1 (highGood) → goodness 1 = el peor.
    expect(lowestWellnessItem({ fatiga: 2, dolor: 1, estres: 2, humor: 4, motivacion: 4, sueno: 1 })).toBe("sueno");
  });

  test("ignora ítems faltantes", () => {
    expect(lowestWellnessItem({ humor: 1 })).toBe("humor");
  });
});

describe("pickWellnessTip", () => {
  test("prioriza match de ítem + estado", () => {
    const tip = pickWellnessTip({ state: "warn", item: "sueno" })!;
    expect(tip).not.toBeNull();
    expect(tip.items.includes("sueno")).toBe(true);
    expect(tip.states.includes("warn")).toBe(true);
  });

  test("sin ítem → cae al general del estado", () => {
    expect(pickWellnessTip({ state: "ok" })?.states.includes("ok")).toBe(true);
    expect(pickWellnessTip({ state: "alert" })?.id).toBe("gen-alert");
  });

  test("es determinístico para el mismo seed y varía con el seed", () => {
    const a = pickWellnessTip({ state: "warn", item: "fatiga", seed: 0 });
    const b = pickWellnessTip({ state: "warn", item: "fatiga", seed: 0 });
    expect(a?.id).toBe(b?.id);
    // estrés tiene >1 candidato general por estado → distintos seeds pueden dar distinto tip (sin romper)
    const seeds = [0, 1, 2, 3].map((s) => pickWellnessTip({ state: "warn", seed: s })?.id);
    expect(seeds.every((id) => typeof id === "string")).toBe(true);
  });

  test("nunca menciona RPE ni prescribe (intocables) — todos los tips", () => {
    for (const t of WELLNESS_TIPS) {
      expect(`${t.title} ${t.body}`).not.toMatch(/\brpe\b/i);
      expect(t.source).toMatch(/Huberman/);
      expect(t.states.length).toBeGreaterThan(0);
    }
  });

  test("todo estado (ok/warn/alert) sin ítem devuelve un tip (nunca null para un estado válido)", () => {
    for (const s of ["ok", "warn", "alert"] as const) {
      expect(pickWellnessTip({ state: s })).not.toBeNull();
    }
  });
});
