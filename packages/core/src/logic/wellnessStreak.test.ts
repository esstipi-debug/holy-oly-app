import { describe, it, expect } from "vitest";
import { wellnessStreak } from "./wellnessStreak";
import type { DayLog } from "../types";

/** Fixture: un check-in con todos los ítems neutros (3 = no malo), sobreescribiendo los que importan. */
const D = (date: string, o: Partial<DayLog>): DayLog => ({
  date, fatiga: 3, dolor: 3, estres: 3, humor: 3, motivacion: 3, sueno: 3, ...o,
});

describe("wellnessStreak", () => {
  it("3 días seguidos durmiendo mal → warn (item sueno, days 3)", () => {
    const logs = [D("2026-06-27", { sueno: 2 }), D("2026-06-28", { sueno: 1 }), D("2026-06-29", { sueno: 2 })];
    expect(wellnessStreak(logs, "2026-06-29")).toEqual({ item: "sueno", days: 3, severity: "warn", alsoStreaking: [] });
  });

  it("racha de 2 (con un día bueno antes) → null", () => {
    const logs = [D("2026-06-27", { sueno: 5 }), D("2026-06-28", { sueno: 2 }), D("2026-06-29", { sueno: 2 })];
    expect(wellnessStreak(logs, "2026-06-29")).toBeNull();
  });

  it("un hueco de fecha corta la racha → null", () => {
    const logs = [D("2026-06-25", { sueno: 2 }), D("2026-06-27", { sueno: 2 }), D("2026-06-28", { sueno: 2 })];
    expect(wellnessStreak(logs, "2026-06-28")).toBeNull();
  });

  it("5 días seguidos muy cansada → alert (item fatiga, days 5)", () => {
    const logs = ["25", "26", "27", "28", "29"].map((d) => D(`2026-06-${d}`, { fatiga: 5 }));
    expect(wellnessStreak(logs, "2026-06-29")).toEqual({ item: "fatiga", days: 5, severity: "alert", alsoStreaking: [] });
  });

  it("2 ítems en racha (sueño + estrés) → alert; líder por prioridad (sueño antes que estrés)", () => {
    const logs = ["27", "28", "29"].map((d) => D(`2026-06-${d}`, { sueno: 2, estres: 5 }));
    expect(wellnessStreak(logs, "2026-06-29")).toEqual({ item: "sueno", days: 3, severity: "alert", alsoStreaking: ["estres"] });
  });

  it("invierte highBad: estrés alto (5) 3 días → warn (item estres)", () => {
    const logs = ["27", "28", "29"].map((d) => D(`2026-06-${d}`, { estres: 5 }));
    expect(wellnessStreak(logs, "2026-06-29")).toEqual({ item: "estres", days: 3, severity: "warn", alsoStreaking: [] });
  });

  it("guarda de frescura: último check-in a >2 días de today → null", () => {
    const logs = ["25", "26", "27"].map((d) => D(`2026-06-${d}`, { sueno: 2 }));
    expect(wellnessStreak(logs, "2026-06-30")).toBeNull();
  });

  it("menos de 3 check-ins → null", () => {
    expect(wellnessStreak([D("2026-06-29", { sueno: 1 })], "2026-06-29")).toBeNull();
  });

  it("sin check-ins → null", () => {
    expect(wellnessStreak([], "2026-06-29")).toBeNull();
  });
});
