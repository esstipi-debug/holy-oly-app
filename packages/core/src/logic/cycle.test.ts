import { describe, it, expect } from "vitest";
import { cycleDayOf, cycleMarkFor, lutealNow, redactCycle } from "./cycle";

// start 2026-06-01, len 28 → período 1–5 jun · pre-período 24–28 jun · lútea desde día 14 (15 jun).
const START = "2026-06-01";
const LEN = 28;

describe("cycleDayOf", () => {
  it("día 0 el día de inicio; modular en ciclos siguientes", () => {
    expect(cycleDayOf(START, LEN, "2026-06-01")).toBe(0);
    expect(cycleDayOf(START, LEN, "2026-06-29")).toBe(0); // ciclo 2
    expect(cycleDayOf(START, LEN, "2026-07-01")).toBe(2);
  });
  it("antes del inicio → null (no proyectar al pasado)", () => {
    expect(cycleDayOf(START, LEN, "2026-05-31")).toBeNull();
  });
  it("horizonte: dentro de 3 ciclos sí, después null (proyección honesta)", () => {
    expect(cycleDayOf(START, LEN, "2026-08-23")).toBe(27); // día 83 = 3·28−1
    expect(cycleDayOf(START, LEN, "2026-08-24")).toBeNull(); // día 84 = 3·28
  });
  it("largo fuera de 21..45 → null", () => {
    expect(cycleDayOf(START, 20, "2026-06-01")).toBeNull();
    expect(cycleDayOf(START, 46, "2026-06-01")).toBeNull();
  });
  it("fecha degenerada → null (NaN jamás fabrica un booleano para el coach)", () => {
    expect(cycleDayOf("2026-99-99", LEN, "2026-06-10")).toBeNull();
    expect(cycleDayOf(START, LEN, "no-fecha")).toBeNull();
    expect(lutealNow("2026-99-99", LEN, "2026-06-10")).toBeNull();
  });
});

describe("cycleMarkFor", () => {
  it("período = días 0..4; el 5 ya no", () => {
    expect(cycleMarkFor(START, LEN, "2026-06-05")).toBe("periodo"); // día 4
    expect(cycleMarkFor(START, LEN, "2026-06-06")).toBeNull();      // día 5
  });
  it("pre-período = últimos 5 días (23..27 con len 28)", () => {
    expect(cycleMarkFor(START, LEN, "2026-06-23")).toBeNull();         // día 22
    expect(cycleMarkFor(START, LEN, "2026-06-24")).toBe("preperiodo"); // día 23
    expect(cycleMarkFor(START, LEN, "2026-06-28")).toBe("preperiodo"); // día 27
  });
});

describe("lutealNow", () => {
  it("lútea = últimos 14 días (límite exacto)", () => {
    expect(lutealNow(START, LEN, "2026-06-14")).toBe(false); // día 13
    expect(lutealNow(START, LEN, "2026-06-15")).toBe(true);  // día 14 = 28−14
  });
  it("sin proyección válida → null", () => {
    expect(lutealNow(START, LEN, "2026-05-01")).toBeNull();
  });
});

describe("redactCycle", () => {
  it("none → undefined; min → lúteo null; full → lúteo pasado tal cual", () => {
    expect(redactCycle("none", "regular", true)).toBeUndefined();
    expect(redactCycle("min", "regular", true)).toEqual({ share: "min", inLutealNow: null, health: "ok", reliable: true });
    expect(redactCycle("full", "regular", true)).toEqual({ share: "full", inLutealNow: true, health: "ok", reliable: true });
    expect(redactCycle("full", "regular", null)).toEqual({ share: "full", inLutealNow: null, health: "ok", reliable: true });
  });
  it("amenorrea → referral sobrio; unreliable → reliable false", () => {
    expect(redactCycle("min", "amenorrhea", null)).toEqual({ share: "min", inLutealNow: null, health: "referral", reliable: false });
    expect(redactCycle("full", "unreliable", null)).toEqual({ share: "full", inLutealNow: null, health: "ok", reliable: false });
  });
});
