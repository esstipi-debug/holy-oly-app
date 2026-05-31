import { describe, it, expect } from "vitest";
import {
  acwrState, chronic, acwr, imrBandState,
  recoveryScore, recoverySeries, recoveryState,
} from "./monitor";
import type { MonitorSeries } from "../types";

// Mara — real arrays from _mockup/coach.html (the seed's reference athlete)
const MARA: MonitorSeries = {
  weeks: 12,
  acute: [300, 320, 340, 300, 360, 380, 400, 320, 420, 700, 380, 340],
  hrv: [72, 71, 70, 73, 69, 70, 68, 72, 67, 62, 64, 69], hrvBase: 70,
  rhr: [49, 50, 50, 48, 51, 50, 52, 49, 53, 56, 54, 50], rhrBase: 50,
  imr: [66, 68, 70, 69, 76, 78, 80, 79, 86, 93, 88, 89],
  wellness: [82, 80, 78, 83, 74, 72, 70, 80, 66, 58, 62, 70],
  recovery: [],
};

describe("monitor", () => {
  it("acwrState: banda segura 0.8–1.3", () => {
    expect(acwrState(1.0)).toBe("ok");
    expect(acwrState(1.4)).toBe("warn");
    expect(acwrState(0.7)).toBe("warn");
    expect(acwrState(1.6)).toBe("alert");
  });
  it("chronic = media móvil de 4 semanas", () => {
    expect(chronic([100, 100, 100, 100])).toEqual([100, 100, 100, 100]);
    expect(chronic([400, 0, 0, 0])[0]).toBe(400);
    expect(chronic([400, 0, 0, 0])[3]).toBe(100);
  });
  it("acwr = aguda / crónica", () => {
    expect(acwr([100, 100, 100, 200])[3]).toBeCloseTo(200 / 125);
  });
  it("imrBandState: warn fuera de la banda esperada (±2)", () => {
    expect(imrBandState(80, [75, 82])).toBe("ok");
    expect(imrBandState(90, [75, 82])).toBe("warn");
    expect(imrBandState(70, [75, 82])).toBe("warn");
  });
});

describe("recovery", () => {
  it("recoveryState: cutoff 70 alert / 80 warn / else ok (matches risk-zone rec<70)", () => {
    expect(recoveryState(64)).toBe("alert");
    expect(recoveryState(76)).toBe("warn");
    expect(recoveryState(88)).toBe("ok");
    expect(recoveryState(70)).toBe("warn"); // boundary: not <70
    expect(recoveryState(80)).toBe("ok");   // boundary: not <80
  });
  it("recoveryScore is clamped to 0..100", () => {
    expect(recoveryScore(0, 70, 120, 50, 0)).toBeGreaterThanOrEqual(0);
    expect(recoveryScore(200, 70, 30, 50, 100)).toBeLessThanOrEqual(100);
  });
  it("recoveryScore: degenerate base (0) → NaN → recoveryState none, never a false 100", () => {
    expect(Number.isFinite(recoveryScore(72, 0, 49, 50, 82))).toBe(false); // hrvBase 0
    expect(Number.isFinite(recoveryScore(72, 70, 0, 50, 82))).toBe(false); // rhr 0
    expect(recoveryState(recoveryScore(72, 0, 49, 50, 82))).toBe("none");
  });
  it("recoverySeries: deterministic per-week output; week-10 spike is the alert minimum", () => {
    const rec = recoverySeries(MARA);
    expect(rec).toHaveLength(12);
    // Full expected output of the placeholder formula (computed, not hand-set):
    expect(rec).toEqual([82, 81, 79, 83, 77, 78, 75, 81, 73, 67, 70, 77]);
    expect(Math.min(...rec)).toBe(rec[9]);   // week 10 is the series minimum
    expect(rec[9]!).toBeLessThan(70);        // → recoveryState(rec[9]) === "alert"
    expect(recoveryState(rec[9]!)).toBe("alert");
  });
});
