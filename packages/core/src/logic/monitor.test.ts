import { describe, it, expect } from "vitest";
import {
  acwrState, chronic, acwr, imrBandState,
  recoveryScore, recoverySeries, recoveryState,
  acwrStateSafe, rosterStatus, seriesState,
  imrBandForWeek, imrStateForWeek,
} from "./monitor";
import type { CellState } from "./monitor";
import type { MonitorSeries } from "../types";
import { MACROCYCLES } from "../data/macrocycles";

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

describe("no-data state", () => {
  it("acwrStateSafe: finite → acwrState; NaN / Infinity / 0/0 → none", () => {
    expect(acwrStateSafe(1.0)).toBe("ok");
    expect(acwrStateSafe(1.6)).toBe("alert");
    expect(acwrStateSafe(NaN)).toBe("none");
    expect(acwrStateSafe(Infinity)).toBe("none");
    expect(acwrStateSafe(0 / 0)).toBe("none");
  });
  it("recoveryState: non-finite recovery → none (never green) — the recovery twin of the NaN trap", () => {
    expect(recoveryState(NaN)).toBe("none");
    expect(recoveryState(Infinity)).toBe("none");
    expect(recoveryState(64)).toBe("alert"); // finite still works
  });
  it("rosterStatus: undefined / zero-week → none, else worse-of(acwr,recovery) of the LAST week", () => {
    expect(rosterStatus(undefined)).toBe("none");
    expect(rosterStatus({ ...MARA, weeks: 0, acute: [], recovery: [] })).toBe("none");
    // Mara week-12 is a deload trough: acwr 0.739 (<0.8 → "warn") and rec 77 (<80 → "warn")
    // → worse-of = "warn". (NOT "~1.0"; the last week is a taper, not the week-10 spike.)
    const mara = { ...MARA, recovery: recoverySeries(MARA) };
    expect(rosterStatus(mara)).toBe("warn");
  });
  it("seriesState: none when missing / out of range / recovery hole; else worse-of(acwr, recovery)", () => {
    const mara = { ...MARA, recovery: recoverySeries(MARA) };
    expect(seriesState(undefined, 1)).toBe("none");
    expect(seriesState(mara, 99)).toBe("none"); // week out of range
    expect(seriesState(mara, 10)).toBe("alert"); // week 10: recovery 67 → alert dominates
    const holed = { ...mara, recovery: mara.recovery.slice(0, 5) };
    expect(seriesState(holed, 8)).toBe("none"); // recovery[7] is undefined → none
  });
});

describe("imr-to-fase adapter", () => {
  const ruso = MACROCYCLES.find((m) => m.id === "ruso-5d")!;
  it("imrBandForWeek returns the phase's imrPct (falls back to last phase out of range)", () => {
    expect(imrBandForWeek(ruso, 1)).toEqual([65, 72]);   // hipertrofia
    expect(imrBandForWeek(ruso, 14)).toEqual([92, 102]); // peaking
    expect(imrBandForWeek(ruso, 99)).toEqual([92, 102]); // out of range -> last phase, NOT none
  });
  it("imrStateForWeek = imrBandState over the phase band (Estado, never none)", () => {
    expect(imrStateForWeek(70, ruso, 1)).toBe("ok");    // in [65,72]±2
    expect(imrStateForWeek(80, ruso, 1)).toBe("warn");  // above band+2
    expect(imrStateForWeek(95, ruso, 14)).toBe("ok");   // in [92,102]±2
  });
  it("imrStateForWeek ±2 boundary: band[1]+2 is still ok, +3 is warn (week-1 band [65,72])", () => {
    expect(imrStateForWeek(74, ruso, 1)).toBe("ok");    // exactly band[1]+2 → not >, ok
    expect(imrStateForWeek(75, ruso, 1)).toBe("warn");  // band[1]+3 → warn
    expect(imrStateForWeek(63, ruso, 1)).toBe("ok");    // exactly band[0]-2 → not <, ok
    expect(imrStateForWeek(62, ruso, 1)).toBe("warn");  // band[0]-3 → warn
  });
});
