import { describe, it, expect } from "vitest";
import { recoverySeries, type MonitorSeries } from "@holy-oly/core";
import { seriesToRows, rowsToSeries } from "./mapping";

// Mirror the seeds' `withRec`: recovery is the core-computed result.
function withRec(b: Omit<MonitorSeries, "recovery">): MonitorSeries {
  return { ...b, recovery: recoverySeries({ ...b, recovery: [] }) };
}

const full = withRec({
  weeks: 3,
  acute: [300, 320, 340],
  hrv: [72, 71, 70], hrvBase: 70,
  rhr: [49, 50, 50], rhrBase: 50,
  imr: [66, 68, 70],
  wellness: [82, 80, 78],
  compliance: [95, 92, 98],
  rpe: [7, 7, 8],
  bodyweight: [81.2, 81.1, 80.9],
  weightBand: [80, 81],
  wellnessItems: { Fatiga: [2, 2, 3], Sueño: [4, 4, 4] },
});

const minimal = withRec({
  weeks: 3,
  acute: [330, 350, 360],
  hrv: [70, 71, 69], hrvBase: 70,
  rhr: [50, 49, 51], rhrBase: 50,
  imr: [70, 72, 73],
  wellness: [80, 82, 78],
});

describe("MonitorSeries <-> relational rows", () => {
  it("round-trips a fully-instrumented series (incl. weightBand + wellnessItems)", () => {
    const { weeks, items } = seriesToRows(full);
    expect(weeks).toHaveLength(3);
    expect(items).toHaveLength(6); // 2 items x 3 weeks
    expect(rowsToSeries(weeks, items, full.weightBand)).toEqual(full);
  });

  it("round-trips a minimal series (no optional fields, no items)", () => {
    const { weeks, items } = seriesToRows(minimal);
    expect(items).toHaveLength(0);
    expect(rowsToSeries(weeks, items)).toEqual(minimal);
  });

  it("recovery is computed by core on write, never trusted from input", () => {
    const tampered: MonitorSeries = { ...minimal, recovery: [0, 0, 0] };
    const { weeks } = seriesToRows(tampered);
    expect(weeks.map((w) => w.recovery)).toEqual(recoverySeries(tampered));
    expect(weeks.map((w) => w.recovery)).not.toEqual([0, 0, 0]);
  });

  it("rowsToSeries is order-independent (sorts by week)", () => {
    const { weeks, items } = seriesToRows(full);
    expect(rowsToSeries([...weeks].reverse(), [...items].reverse(), full.weightBand)).toEqual(full);
  });
});
