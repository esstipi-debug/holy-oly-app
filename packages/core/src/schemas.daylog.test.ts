import { describe, it, expect } from "vitest";
import { DayLogInputSchema, DayLogViewSchema, MePlanViewSchema } from "./schemas";

describe("DayLogInputSchema", () => {
  it("accepts 6 items 1-5 + optional weight", () => {
    expect(DayLogInputSchema.safeParse({ fatiga: 2, dolor: 1, estres: 3, humor: 4, motivacion: 5, sueno: 4, weight: 80.8 }).success).toBe(true);
    expect(DayLogInputSchema.safeParse({ fatiga: 2, dolor: 1, estres: 3, humor: 4, motivacion: 5, sueno: 4 }).success).toBe(true);
  });
  it("rejects out-of-range or non-integer values", () => {
    expect(DayLogInputSchema.safeParse({ fatiga: 0, dolor: 1, estres: 3, humor: 4, motivacion: 5, sueno: 4 }).success).toBe(false);
    expect(DayLogInputSchema.safeParse({ fatiga: 6, dolor: 1, estres: 3, humor: 4, motivacion: 5, sueno: 4 }).success).toBe(false);
    expect(DayLogInputSchema.safeParse({ fatiga: 2.5, dolor: 1, estres: 3, humor: 4, motivacion: 5, sueno: 4 }).success).toBe(false);
    expect(DayLogInputSchema.safeParse({ fatiga: 2, dolor: 1, estres: 3, humor: 4, motivacion: 5, sueno: 4, weight: -1 }).success).toBe(false);
  });
});

describe("DayLogViewSchema", () => {
  it("accepts a null entry with streak + days + today", () => {
    expect(DayLogViewSchema.safeParse({ entry: null, streak: 0, days: [], today: "2026-06-03" }).success).toBe(true);
  });
  it("validates the days[] element format", () => {
    const base = { entry: null, streak: 0, today: "2026-06-03" };
    expect(DayLogViewSchema.safeParse({ ...base, days: ["2026-06-03", "2026-06-02"] }).success).toBe(true);
    expect(DayLogViewSchema.safeParse({ ...base, days: ["not-a-date"] }).success).toBe(false);
  });
});

describe("MePlanViewSchema", () => {
  it("accepts a null plan", () => {
    expect(MePlanViewSchema.safeParse({ athlete: { nombre: "Mara", iniciales: "MV", sexo: "F" }, plan: null }).success).toBe(true);
  });
});
