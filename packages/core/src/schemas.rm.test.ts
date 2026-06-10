import { describe, it, expect } from "vitest";
import { UpdateRmsInputSchema, RmUpdateSchema, PrCandidateSchema } from "./schemas";

describe("UpdateRmsInputSchema (input del coach, acotado)", () => {
  const ok = { updates: [{ lift: "arranque", kg: 92 }], reason: "manual" };

  it("acepta 1..4 updates con lifts válidos y kg en rango", () => {
    expect(UpdateRmsInputSchema.safeParse(ok).success).toBe(true);
    expect(UpdateRmsInputSchema.safeParse({
      updates: [
        { lift: "arranque", kg: 92 }, { lift: "envion", kg: 115 },
        { lift: "sentadilla", kg: 150 }, { lift: "frente", kg: 125 },
      ], reason: "pr",
    }).success).toBe(true);
  });

  it("rechaza 0 updates y más de 4", () => {
    expect(UpdateRmsInputSchema.safeParse({ updates: [], reason: "manual" }).success).toBe(false);
    const five = Array.from({ length: 5 }, () => ({ lift: "arranque", kg: 90 }));
    expect(UpdateRmsInputSchema.safeParse({ updates: five, reason: "manual" }).success).toBe(false);
  });

  it("rechaza kg fuera de rango (0, negativo, >500) y lift inválido", () => {
    expect(UpdateRmsInputSchema.safeParse({ updates: [{ lift: "arranque", kg: 0 }], reason: "manual" }).success).toBe(false);
    expect(UpdateRmsInputSchema.safeParse({ updates: [{ lift: "arranque", kg: -5 }], reason: "manual" }).success).toBe(false);
    expect(UpdateRmsInputSchema.safeParse({ updates: [{ lift: "arranque", kg: 501 }], reason: "manual" }).success).toBe(false);
    expect(UpdateRmsInputSchema.safeParse({ updates: [{ lift: "press-banca", kg: 90 }], reason: "manual" }).success).toBe(false);
  });

  it('rechaza reason "assign" (sólo lo escribe savePlan) y lifts duplicados', () => {
    expect(UpdateRmsInputSchema.safeParse({ updates: [{ lift: "arranque", kg: 90 }], reason: "assign" }).success).toBe(false);
    expect(UpdateRmsInputSchema.safeParse({
      updates: [{ lift: "arranque", kg: 90 }, { lift: "arranque", kg: 95 }], reason: "manual",
    }).success).toBe(false);
  });
});

describe("RmUpdateSchema / PrCandidateSchema (wire)", () => {
  it("valida una fila de historial", () => {
    expect(RmUpdateSchema.safeParse({ lift: "envion", kg: 110, setAt: "2026-06-10", reason: "pr" }).success).toBe(true);
    expect(RmUpdateSchema.safeParse({ lift: "envion", kg: 110, setAt: "hoy", reason: "pr" }).success).toBe(false);
  });
  it("valida un candidato a PR", () => {
    expect(PrCandidateSchema.safeParse({
      lift: "arranque", movementId: "arranque.potencia", movementName: "Arranque de potencia",
      kg: 95, week: 3, sessionIdx: 0,
    }).success).toBe(true);
  });
});
