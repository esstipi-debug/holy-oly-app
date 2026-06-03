import { describe, it, expect } from "vitest";
import { WELLNESS_ITEMS, goodness, wellnessScore } from "./wellness";
import type { WellnessAnswers } from "../types";

const ALL_GOOD: WellnessAnswers = { fatiga: 1, dolor: 1, estres: 1, humor: 5, motivacion: 5, sueno: 5 };
const ALL_BAD: WellnessAnswers = { fatiga: 5, dolor: 5, estres: 5, humor: 1, motivacion: 1, sueno: 1 };

describe("WELLNESS_ITEMS", () => {
  it("are the 6 canonical items with the expected polarity", () => {
    expect(WELLNESS_ITEMS.map((i) => i.field)).toEqual(["fatiga", "dolor", "estres", "humor", "motivacion", "sueno"]);
    const highBad = Object.fromEntries(WELLNESS_ITEMS.map((i) => [i.field, i.highBad]));
    expect(highBad).toEqual({ fatiga: true, dolor: true, estres: true, humor: false, motivacion: false, sueno: false });
    // labels match the existing MonitorSeries.wellnessItems keys (for the future rollup)
    expect(WELLNESS_ITEMS.map((i) => i.label)).toEqual(["Fatiga", "Dolor", "Estrés", "Humor", "Motivación", "Sueño"]);
  });
});

describe("goodness", () => {
  it("inverts highBad items (5 fatiga = a bad day = goodness 1)", () => {
    expect(goodness(5, true)).toBe(1);
    expect(goodness(1, true)).toBe(5);
  });
  it("passes through non-highBad items (5 humor = a good day = goodness 5)", () => {
    expect(goodness(5, false)).toBe(5);
    expect(goodness(1, false)).toBe(1);
  });
});

describe("wellnessScore", () => {
  it("all-good → 100", () => expect(wellnessScore(ALL_GOOD)).toBe(100));
  it("all-bad → 0", () => expect(wellnessScore(ALL_BAD)).toBe(0));
  it("neutral (all 3) → 50", () => {
    expect(wellnessScore({ fatiga: 3, dolor: 3, estres: 3, humor: 3, motivacion: 3, sueno: 3 })).toBe(50);
  });
  it("averages only the answered items, ignoring missing/NaN", () => {
    expect(wellnessScore({ humor: 5 } as Partial<WellnessAnswers> as WellnessAnswers)).toBe(100);
    expect(wellnessScore({} as WellnessAnswers)).toBe(0);
  });
});
