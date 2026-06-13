import { describe, it, expect } from "vitest";
import type { CycleData } from "@holy-oly/core";
import { buildCycleView, phaseOfDay, phaseLabel } from "./cycleView";

const TODAY = "2026-06-12";
// Mara: regular, ciclo de 28, último período hace 20 días → día 20 = fase lútea.
const mara: CycleData = { share: "full", state: "regular", lastPeriodStart: "2026-05-23", cycleLengthDays: 28 };

describe("buildCycleView", () => {
  it("Mara (día 20/28) → día, fase lútea, segmentos que cubren el ciclo y próxima ventana", () => {
    const v = buildCycleView(mara, TODAY)!;
    expect(v).not.toBeNull();
    expect(v.lengthDays).toBe(28);
    expect(v.dayInCycle).toBe(20);
    expect(v.phaseToday).toBe("lutea");
    // 3 fases contiguas que cubren [0, 28)
    expect(v.segments.map((s) => s.phase)).toEqual(["menstruacion", "folicular", "lutea"]);
    expect(v.segments[0]!.startDay).toBe(0);
    expect(v.segments[v.segments.length - 1]!.endDay).toBe(28);
    for (let i = 1; i < v.segments.length; i++) {
      expect(v.segments[i]!.startDay).toBe(v.segments[i - 1]!.endDay); // sin huecos ni solapes
    }
    // próximo período = ciclo siguiente (20–24 jun), pre 15–19 jun
    expect(v.nextWindow?.periodStart).toBe("2026-06-20");
    expect(v.nextWindow?.periodEnd).toBe("2026-06-24");
  });

  it("no proyecta si el ciclo no es regular (precisión falsa) → null", () => {
    expect(buildCycleView({ ...mara, state: "unreliable" }, TODAY)).toBeNull();
    expect(buildCycleView({ ...mara, state: "amenorrhea" }, TODAY)).toBeNull();
  });

  it("sin fecha o sin duración registrada → null (sin-dato honesto)", () => {
    expect(buildCycleView({ share: "full", state: "regular" }, TODAY)).toBeNull();
    expect(buildCycleView({ share: "full", state: "regular", lastPeriodStart: "2026-05-23" }, TODAY)).toBeNull();
  });
});

describe("phaseOfDay", () => {
  it("clasifica menstruación / folicular / lútea por el día (consistente con el core)", () => {
    expect(phaseOfDay(2, 28)).toBe("menstruacion");
    expect(phaseOfDay(10, 28)).toBe("folicular");
    expect(phaseOfDay(20, 28)).toBe("lutea");
  });
});

describe("phaseLabel", () => {
  it("etiquetas es-CL", () => {
    expect(phaseLabel("menstruacion")).toMatch(/menstruaci/i);
    expect(phaseLabel("lutea")).toMatch(/lútea/i);
  });
});
