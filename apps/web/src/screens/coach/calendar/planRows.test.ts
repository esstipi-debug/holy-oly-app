import { describe, it, expect } from "vitest";
import { planWeeks, weekRangeLabel } from "./planRows";
import { MACROCYCLES } from "@holy-oly/core";
import type { Competencia, SessionLog } from "@holy-oly/core";

const macro = MACROCYCLES.find((m) => m.id === "coreano-5d")!; // 12 sem · 3 fases
const start = "2026-03-02"; // lunes

describe("weekRangeLabel", () => {
  it("rango dentro del mismo mes", () => {
    expect(weekRangeLabel(start, 1)).toBe("2–8 mar");
  });
  it("rango que cruza de mes", () => {
    expect(weekRangeLabel(start, 5)).toBe("30 mar–5 abr");
  });
});

describe("planWeeks", () => {
  it("una fila por semana, con HOY, comp, fase y adherencia", () => {
    const comps: Competencia[] = [{ name: "Nacional", week: 9, date: "2026-04-27" }];
    const marks: SessionLog = [
      { week: 2, idx: 0, status: "done" },
      { week: 2, idx: 1, status: "done" },
      { week: 2, idx: 2, status: "missed" },
    ];
    const rows = planWeeks(macro, 12, start, 4, comps, marks, 5);
    expect(rows.length).toBe(12);
    expect(rows[0]!.week).toBe(1);
    expect(rows[3]!.isToday).toBe(true);      // hoyWeek = 4
    expect(rows[0]!.isToday).toBe(false);
    expect(rows[8]!.comp).toBe("Nacional");    // semana 9
    expect(rows[0]!.comp).toBeUndefined();
    expect(rows[1]!.done).toBe(2);             // semana 2: 2 ✓
    expect(rows[0]!.phaseName).toBe("Cimentación");
    expect(rows[0]!.phaseIndex).toBe(0);
    expect(rows[4]!.phaseName).toBe("Transformación"); // semana 5
    expect(rows[4]!.phaseIndex).toBe(1);
    expect(rows[8]!.phaseName).toBe("Realización");    // semana 9
    expect(rows[8]!.phaseIndex).toBe(2);
  });
  it("taper marca la comp + las 2 semanas previas", () => {
    const comps: Competencia[] = [{ name: "X", week: 9 }];
    const rows = planWeeks(macro, 12, start, 1, comps, [], 5);
    expect(rows[8]!.isTaper).toBe(true);  // 9 (comp)
    expect(rows[7]!.isTaper).toBe(true);  // 8
    expect(rows[6]!.isTaper).toBe(true);  // 7
    expect(rows[5]!.isTaper).toBe(false); // 6
  });
});
