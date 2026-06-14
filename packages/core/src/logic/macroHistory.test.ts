import { describe, it, expect } from "vitest";
import { adherencePct, macroName, macroHistoryView, planNeedsRm, buildMacroHistoryRows, stepDownRm } from "./macroHistory";
import { MACROCYCLES } from "../data/macrocycles";
import { sessionsPerWeekFor } from "./recipeGen";
import type { MacroHistoryRow, Plan, RM } from "../types";

const RMS: RM = { arranque: 78, envion: 98, sentadilla: 130, frente: 105 };
const plan = (rms: Partial<RM> = RMS): Plan => ({
  atletaId: "mv",
  macroId: "ruso-5d",
  startWeek: 1,
  startDate: "2026-03-29",
  rms: rms as RM,
  comps: [],
});

const row = (over: Partial<MacroHistoryRow>): MacroHistoryRow => ({
  macroId: "ruso-5d",
  ordinal: 1,
  startDate: "2025-01-06",
  endDate: "2025-04-27",
  weeks: 16,
  sessionsDone: 76,
  sessionsTotal: 80,
  ...over,
});

describe("adherencePct", () => {
  it("rounds sessions done over total to a whole percent", () => {
    expect(adherencePct(76, 80)).toBe(95);
    expect(adherencePct(56, 80)).toBe(70);
  });

  it("returns 0 when total is 0 (never divides by zero)", () => {
    expect(adherencePct(0, 0)).toBe(0);
  });
});

describe("macroName", () => {
  it("resolves the display name from the catalog", () => {
    const expected = MACROCYCLES.find((m) => m.id === "ruso-5d")!.name;
    expect(macroName("ruso-5d")).toBe(expected);
    expect(macroName("ruso-5d")).not.toBe("ruso-5d");
  });

  it("falls back to the id for an unknown macro (never invents a name)", () => {
    expect(macroName("inexistente-9d")).toBe("inexistente-9d");
  });
});

describe("macroHistoryView", () => {
  it("orders entries newest-first by ordinal and derives name + adherence", () => {
    const view = macroHistoryView([
      row({ ordinal: 1, sessionsDone: 56, sessionsTotal: 80 }),
      row({ ordinal: 3, sessionsDone: 76, sessionsTotal: 80 }),
      row({ ordinal: 2, sessionsDone: 72, sessionsTotal: 80 }),
    ]);
    expect(view.entries.map((e) => e.ordinal)).toEqual([3, 2, 1]);
    expect(view.entries[0]!.adherencePct).toBe(95);
    expect(view.entries[0]!.macroName).toBe(MACROCYCLES.find((m) => m.id === "ruso-5d")!.name);
    expect(view.cyclesDone).toBe(3);
  });

  it("computes the average adherence across cycles", () => {
    const view = macroHistoryView([
      row({ ordinal: 1, sessionsDone: 80, sessionsTotal: 80 }), // 100
      row({ ordinal: 2, sessionsDone: 72, sessionsTotal: 80 }), // 90
    ]);
    expect(view.avgAdherencePct).toBe(95);
  });

  it("is empty-safe (0 cycles, 0 average)", () => {
    const view = macroHistoryView([]);
    expect(view.entries).toEqual([]);
    expect(view.cyclesDone).toBe(0);
    expect(view.avgAdherencePct).toBe(0);
  });
});

describe("buildMacroHistoryRows", () => {
  const rusoWeeks = MACROCYCLES.find((m) => m.id === "ruso-5d")!.phaseProfile.at(-1)!.weeks[1];
  const rusoDpw = sessionsPerWeekFor(MACROCYCLES.find((m) => m.id === "ruso-5d")!);

  it("builds N cycles oldest-first (ordinal 1..N), newest ending at the anchor date", () => {
    const rows = buildMacroHistoryRows(
      [
        { macroId: "ruso-5d", adherencePct: 90 },
        { macroId: "ruso-5d", adherencePct: 95 },
        { macroId: "ruso-5d", adherencePct: 95 },
      ],
      "2026-03-22",
      7,
    );
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.ordinal)).toEqual([1, 2, 3]);
    expect(rows.at(-1)!.endDate).toBe("2026-03-22"); // newest ends at the anchor
  });

  it("derives sessionsTotal = weeks × days/week and sessionsDone from the adherence %", () => {
    const [row] = buildMacroHistoryRows([{ macroId: "ruso-5d", adherencePct: 95 }], "2026-03-22");
    expect(row!.weeks).toBe(rusoWeeks);
    expect(row!.sessionsTotal).toBe(rusoWeeks * rusoDpw);
    expect(row!.sessionsDone).toBe(Math.round(rusoWeeks * rusoDpw * 0.95));
    // round-trips back to the requested adherence
    expect(adherencePct(row!.sessionsDone, row!.sessionsTotal)).toBe(95);
  });

  it("places cycles back-to-back without overlap (gap between end and next start)", () => {
    const rows = buildMacroHistoryRows(
      [{ macroId: "ruso-5d", adherencePct: 80 }, { macroId: "ruso-5d", adherencePct: 80 }],
      "2026-03-22",
      7,
    );
    // older cycle (ordinal 1) ends strictly before the newer (ordinal 2) starts
    expect(rows[0]!.endDate < rows[1]!.startDate).toBe(true);
    // each cycle's start precedes its end
    for (const r of rows) expect(r.startDate < r.endDate).toBe(true);
  });

  it("passes rmEnd through per cycle", () => {
    const rmEnd: RM = { arranque: 78, envion: 98, sentadilla: 130, frente: 105 };
    const [row] = buildMacroHistoryRows([{ macroId: "ruso-5d", adherencePct: 95, rmEnd }], "2026-03-22");
    expect(row!.rmEnd).toEqual(rmEnd);
  });
});

describe("stepDownRm", () => {
  const top: RM = { arranque: 78, envion: 98, sentadilla: 130, frente: 105 };
  it("steps every lift down, with sentadilla at 1.5× (more absolute)", () => {
    expect(stepDownRm(top, 1, 4)).toEqual({ arranque: 74, envion: 94, sentadilla: 124, frente: 101 });
    expect(stepDownRm(top, 2, 4)).toEqual({ arranque: 70, envion: 90, sentadilla: 118, frente: 97 });
  });
  it("is identity at 0 steps", () => {
    expect(stepDownRm(top, 0, 4)).toEqual(top);
  });
});

describe("planNeedsRm", () => {
  it("flags a missing plan (no RM at all)", () => {
    expect(planNeedsRm(undefined)).toBe(true);
    expect(planNeedsRm(null)).toBe(true);
  });

  it("passes a plan with all four positive RMs", () => {
    expect(planNeedsRm(plan())).toBe(false);
  });

  it("flags a plan missing or zeroing any of the four lifts", () => {
    expect(planNeedsRm(plan({ arranque: 78, envion: 98, sentadilla: 130, frente: 0 }))).toBe(true);
    expect(planNeedsRm(plan({ arranque: 78, envion: 98, sentadilla: 130 }))).toBe(true);
  });
});
