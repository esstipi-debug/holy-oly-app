import { describe, it, expect } from "vitest";
import type { Competencia, MonitorSeries } from "../types";
import { buildPrilepinInput, prilepinPreviewWeek } from "./prilepinPlan";

const RMS = { arranque: 80, envion: 100, sentadilla: 140, frente: 110 } as const;

/** Serie mínima con ACWR neutro (acute plano → chronic = acute → ratio 1). La recuperación la
 *  RECOMPUTA core de hrv/rhr/wellness (no del array `recovery`), así que para bajarla movemos
 *  esos tres (hrv bajo + wellness bajo → readiness red). Por defecto: recuperación alta. */
function flatSeries(weeks: number, over: { hrv?: number; rhr?: number; wellness?: number } = {}): MonitorSeries {
  const hrv = over.hrv ?? 60, rhr = over.rhr ?? 50, wellness = over.wellness ?? 80;
  return {
    weeks,
    acute: Array<number>(weeks).fill(100),
    hrv: Array<number>(weeks).fill(hrv), hrvBase: 60,
    rhr: Array<number>(weeks).fill(rhr), rhrBase: 50,
    imr: Array<number>(weeks).fill(80),
    wellness: Array<number>(weeks).fill(wellness),
    recovery: Array<number>(weeks).fill(90),
  };
}

describe("buildPrilepinInput — EngineInput desde datos reales del atleta", () => {
  it("con competencia: countdownWeeks = semana-macro de la compe, weekIdx = semana pedida − 1", () => {
    // Compe en la semana 12 del macro; pedimos la semana 10 → countdown 12, weekIdx 9.
    const comps: Competencia[] = [{ name: "Nacional", week: 12, date: "2026-06-24" }];
    const input = buildPrilepinInput({
      lift: "arranque", rms: RMS, requestedWeek: 10, totalWeeks: 12, comps, series: undefined,
    });
    expect(input).not.toBeNull();
    expect(input!.countdownWeeks).toBe(12);
    expect(input!.weekIdx).toBe(9);
    expect(input!.rmKg).toBe(80);
    expect(input!.recentACWR).toBeNull(); // sin serie → sin ACWR (jamás inventar)
    expect(input!.waveWeek).toBeUndefined();
  });

  it("elige la PRÓXIMA compe (la primera en/después de la semana pedida) como ancla del countdown", () => {
    const comps: Competencia[] = [
      { name: "Pasada", week: 4, date: "2026-04-01" },
      { name: "Próxima", week: 12, date: "2026-06-24" },
    ];
    // Pedimos la semana 6: la compe de la sem 4 ya pasó → ancla a la de la sem 12.
    const input = buildPrilepinInput({ lift: "envion", rms: RMS, requestedWeek: 6, totalWeeks: 16, comps, series: undefined });
    expect(input!.countdownWeeks).toBe(12);
    expect(input!.weekIdx).toBe(5);
  });

  it("sin competencia futura: modo ola (waveWeek = semana pedida, countdownWeeks null)", () => {
    const input = buildPrilepinInput({ lift: "sentadilla", rms: RMS, requestedWeek: 3, totalWeeks: 16, comps: [], series: undefined });
    expect(input!.countdownWeeks).toBeNull();
    expect(input!.waveWeek).toBe(3);
    expect(input!.weekIdx).toBeUndefined();
  });

  it("deriva recentACWR + readiness de la ÚLTIMA semana de la serie", () => {
    // acute plano → ACWR 1.0 (en banda); recovery 90 → readiness green.
    const input = buildPrilepinInput({ lift: "arranque", rms: RMS, requestedWeek: 2, totalWeeks: 16, comps: [], series: flatSeries(6) });
    expect(input!.recentACWR).toBeCloseTo(1, 5);
    expect(input!.readiness).toBe("green");
  });

  it("readiness baja cuando la recuperación reciente es baja (red <70)", () => {
    // hrv 45 (<base 60) + wellness 40 → recoveryScore ~57 → readiness red.
    const input = buildPrilepinInput({ lift: "arranque", rms: RMS, requestedWeek: 2, totalWeeks: 16, comps: [], series: flatSeries(6, { hrv: 45, wellness: 40 }) });
    expect(input!.readiness).toBe("red");
  });

  it("sin RM del lift (0/ausente) → null honesto (jamás un week fabricado sobre RM inventado)", () => {
    const noRm = { ...RMS, arranque: 0 };
    expect(buildPrilepinInput({ lift: "arranque", rms: noRm, requestedWeek: 1, totalWeeks: 16, comps: [], series: undefined })).toBeNull();
  });

  it("semana pedida fuera de [1, totalWeeks] → null", () => {
    expect(buildPrilepinInput({ lift: "arranque", rms: RMS, requestedWeek: 0, totalWeeks: 16, comps: [], series: undefined })).toBeNull();
    expect(buildPrilepinInput({ lift: "arranque", rms: RMS, requestedWeek: 17, totalWeeks: 16, comps: [], series: undefined })).toBeNull();
  });

  it("una compe en una semana ANTERIOR a la pedida y ninguna después → ola (no countdown negativo)", () => {
    const comps: Competencia[] = [{ name: "Ya fue", week: 4, date: "2026-04-01" }];
    const input = buildPrilepinInput({ lift: "arranque", rms: RMS, requestedWeek: 8, totalWeeks: 16, comps, series: undefined });
    expect(input!.countdownWeeks).toBeNull();
    expect(input!.waveWeek).toBe(8);
  });

  it("compe en una semana MÁS ALLÁ del largo del macro: countdown honesto (la semana pedida sigue lejos del pico)", () => {
    // Caso de los seeds demo (ruso-5d 12 sem, compe en la 'semana 16' del catálogo): la última
    // semana del macro (12) queda en weekIdx 11 de un countdown de 16 → todavía accumulation, no
    // comp_week. El mapper refleja el dato sin fabricar (preview funcional, no fidelidad perfecta).
    const comps: Competencia[] = [{ name: "Lejana", week: 16 }];
    const input = buildPrilepinInput({ lift: "arranque", rms: RMS, requestedWeek: 12, totalWeeks: 12, comps, series: undefined });
    expect(input!.countdownWeeks).toBe(16);
    expect(input!.weekIdx).toBe(11);
    const week = prilepinPreviewWeek({ lift: "arranque", rms: RMS, requestedWeek: 12, totalWeeks: 12, comps, series: undefined });
    expect(week!.phase).toBe("accumulation"); // 12 < 16 → aún acumulación, jamás un comp_week inventado
  });
});

describe("prilepinPreviewWeek — EngineWeek completo o null", () => {
  it("genera el week del motor: la semana de la compe (weekIdx = n−1) es comp_week", () => {
    const comps: Competencia[] = [{ name: "Nacional", week: 12, date: "2026-06-24" }];
    const week = prilepinPreviewWeek({ lift: "arranque", rms: RMS, requestedWeek: 12, totalWeeks: 12, comps, series: undefined });
    expect(week).not.toBeNull();
    expect(week!.phase).toBe("comp_week");
    expect(week!.label).toBe("Semana de competencia");
    // Coach ve pct/zonas; ningún set supera el tope prescribible 95%.
    expect(week!.sets.length).toBeGreaterThan(0);
    for (const s of week!.sets) expect(s.pct).toBeLessThanOrEqual(95);
  });

  it("la semana de acumulación temprana de un countdown largo es accumulation", () => {
    const comps: Competencia[] = [{ name: "Lejos", week: 12, date: "2026-06-24" }];
    const week = prilepinPreviewWeek({ lift: "arranque", rms: RMS, requestedWeek: 1, totalWeeks: 12, comps, series: undefined });
    expect(week!.phase).toBe("accumulation");
  });

  it("sin RM suficiente → null (el endpoint lo traducirá a 'sin datos')", () => {
    const noRm = { ...RMS, frente: 0 };
    expect(prilepinPreviewWeek({ lift: "frente", rms: noRm, requestedWeek: 1, totalWeeks: 16, comps: [], series: undefined })).toBeNull();
  });

  it("el shape devuelto no contiene ninguna key rpe (guarda de regresión)", () => {
    const week = prilepinPreviewWeek({ lift: "arranque", rms: RMS, requestedWeek: 2, totalWeeks: 16, comps: [], series: flatSeries(4) });
    expect(JSON.stringify(week).toLowerCase()).not.toContain("rpe");
  });
});
