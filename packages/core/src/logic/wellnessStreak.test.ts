import { describe, it, expect } from "vitest";
import { wellnessStreak, coachStreakRisk } from "./wellnessStreak";
import type { DayLog, MonitorSeries } from "../types";

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

  it("frescura: último check-in a EXACTAMENTE 2 días de today → sí avisa (no null)", () => {
    const logs = ["25", "26", "27"].map((d) => D(`2026-06-${d}`, { sueno: 2 }));
    expect(wellnessStreak(logs, "2026-06-29")).toEqual({ item: "sueno", days: 3, severity: "warn", alsoStreaking: [] });
  });

  it("líder por LARGO de racha, no por prioridad: fatiga 4 días gana a dolor 3 días", () => {
    const logs = [
      D("2026-06-26", { fatiga: 5 }),
      D("2026-06-27", { fatiga: 5, dolor: 5 }),
      D("2026-06-28", { fatiga: 5, dolor: 5 }),
      D("2026-06-29", { fatiga: 5, dolor: 5 }),
    ];
    expect(wellnessStreak(logs, "2026-06-29")).toEqual({ item: "fatiga", days: 4, severity: "alert", alsoStreaking: ["dolor"] });
  });
});

const seriesWith = (acute: number[], recovery: number[]): MonitorSeries => ({
  weeks: acute.length, acute, recovery,
  hrv: [], hrvBase: 0, rhr: [], rhrBase: 0, wellness: [],
} as unknown as MonitorSeries);

describe("coachStreakRisk", () => {
  it("sin racha de check-in → null (la carga sola la cubre el semáforo)", () => {
    const logs = ["27","28","29"].map((d) => D(`2026-06-${d}`, {})); // todos neutros
    expect(coachStreakRisk(logs, seriesWith([100,100,200,260],[60,60,60,60]), "2026-06-29")).toBeNull();
  });

  it("racha sin carga → CoachRisk con loadNote null", () => {
    const logs = ["27","28","29"].map((d) => D(`2026-06-${d}`, { sueno: 1 }));
    const r = coachStreakRisk(logs, undefined, "2026-06-29");
    expect(r).toMatchObject({ item: "sueno", days: 3, severity: "warn", acwrSustained: false, readinessBand: null, loadNote: null });
  });

  it("racha + ACWR sostenido > 1.3 dos semanas → loadNote 'sobrecarga'", () => {
    const logs = ["27","28","29"].map((d) => D(`2026-06-${d}`, { sueno: 1 }));
    // acute con 2 últimas semanas muy por encima de la base crónica → ACWR > 1.3 sostenido
    const r = coachStreakRisk(logs, seriesWith([100,100,260,280],[85,85,85,85]), "2026-06-29");
    expect(r?.acwrSustained).toBe(true);
    expect(r?.loadNote).toBe("sobrecarga");
  });
});
