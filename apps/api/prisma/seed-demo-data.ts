/**
 * Demo telemetry + plan fixtures for the API seed. Ported from apps/web/src/data/seeds.ts
 * so the local Postgres demo matches the offline LocalRepository showcase.
 */
import { recoverySeries, type Competencia, type DayLog, type Medal, type MonitorSeries, type RM } from "@holy-oly/core";

const clampInt = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, Math.round(v)));

const withRec = (b: Omit<MonitorSeries, "recovery">): MonitorSeries =>
  ({ ...b, recovery: recoverySeries({ ...b, recovery: [] }) });

const MARA_BASE: Omit<MonitorSeries, "recovery"> = {
  weeks: 12,
  acute: [300, 320, 340, 300, 360, 380, 400, 320, 420, 700, 380, 340],
  hrv: [72, 71, 70, 73, 69, 70, 68, 72, 67, 62, 64, 69], hrvBase: 70,
  rhr: [49, 50, 50, 48, 51, 50, 52, 49, 53, 56, 54, 50], rhrBase: 50,
  imr: [66, 68, 70, 69, 76, 78, 80, 79, 86, 93, 88, 89],
  wellness: [82, 80, 78, 83, 74, 72, 70, 80, 66, 58, 62, 70],
  compliance: [95, 92, 98, 90, 94, 88, 96, 91, 85, 72, 90, 94],
  rpe: [7, 7, 8, 7, 8, 8, 9, 7, 9, 10, 8, 7],
  bodyweight: [81.2, 81.1, 80.9, 80.8, 80.9, 80.7, 80.6, 80.5, 80.6, 80.3, 80.4, 80.8],
  weightBand: [80, 81],
  wellnessItems: {
    Fatiga: [2, 2, 3, 2, 3, 3, 4, 2, 4, 5, 3, 2],
    Dolor: [1, 2, 2, 1, 2, 2, 3, 2, 3, 4, 2, 2],
    Estrés: [2, 2, 2, 3, 3, 3, 3, 2, 4, 4, 3, 2],
    Humor: [4, 4, 4, 4, 3, 3, 3, 4, 2, 1, 3, 4],
    Motivación: [5, 5, 4, 4, 4, 4, 3, 4, 3, 2, 4, 5],
    Sueño: [4, 4, 4, 4, 3, 3, 3, 4, 2, 1, 3, 4],
  },
};

function genYearBase(): Omit<MonitorSeries, "recovery"> {
  const N = 52;
  const mk = (f: (i: number) => number): number[] => Array.from({ length: N }, (_, i) => f(i));
  const meso = (i: number): number => i % 13;
  const hard = (i: number): boolean => meso(i) >= 8 && meso(i) <= 10;
  const wave = (i: number): number => Math.cos(i / 2.5);
  const acute = mk((i) => clampInt(300 + i * 1.4 + (meso(i) < 11 ? meso(i) * 14 : -30), 240, 760));
  const hrv = mk((i) => clampInt(72 - (hard(i) ? 5 : 0) + 2 * wave(i), 58, 78));
  const rhr = mk((i) => clampInt(49 + (hard(i) ? 4 : 0) - 2 * wave(i), 46, 58));
  const imr = mk((i) => clampInt(64 + meso(i) * 2 + i / 12, 60, 95));
  const wellness = mk((i) => clampInt(82 - (hard(i) ? 10 : 0) + 3 * wave(i), 55, 92));
  const compliance = mk((i) => clampInt(94 - (hard(i) ? 6 : 0) + (meso(i) < 2 ? 2 : 0), 70, 100));
  const bodyweight = mk((i) => Math.round((80.5 + 0.4 * Math.sin(i / 6)) * 10) / 10);
  const item = (base: number, amp: number, invert = false): number[] =>
    mk((i) => clampInt(base + (hard(i) ? (invert ? -amp : amp) : 0) + (invert ? -1 : 1) * wave(i), 1, 5));
  return {
    weeks: N, acute, hrv, hrvBase: 71, rhr, rhrBase: 50, imr, wellness,
    compliance, bodyweight, weightBand: [80, 82],
    wellnessItems: {
      Fatiga: item(2, 2), Dolor: item(2, 1), Estrés: item(2, 1),
      Humor: item(4, 2, true), Motivación: item(4, 1, true), Sueño: item(4, 2, true),
    },
  };
}

/** Monitor series per athlete. `tl` intentionally absent (no-data exemplar). */
export const DEMO_SERIES: Record<string, MonitorSeries> = {
  mv: withRec(MARA_BASE),
  kv: withRec(genYearBase()),
  ds: withRec({
    weeks: 12,
    acute: [330, 350, 360, 340, 370, 390, 360, 380, 400, 420, 440, 430],
    hrv: [70, 71, 69, 72, 68, 70, 71, 69, 67, 65, 63, 60], hrvBase: 70,
    rhr: [50, 49, 51, 50, 52, 50, 49, 51, 53, 54, 55, 57], rhrBase: 50,
    imr: [70, 72, 73, 71, 76, 78, 75, 77, 82, 86, 90, 91],
    wellness: [80, 82, 78, 81, 75, 77, 79, 76, 70, 66, 62, 58],
  }),
  lr: withRec({
    weeks: 12,
    acute: [300, 310, 320, 330, 340, 350, 360, 350, 360, 370, 365, 375],
    hrv: [71, 72, 73, 72, 74, 73, 72, 74, 73, 75, 74, 76], hrvBase: 70,
    rhr: [49, 48, 49, 48, 47, 48, 49, 47, 48, 47, 48, 46], rhrBase: 50,
    imr: [68, 70, 71, 72, 74, 75, 76, 75, 77, 79, 78, 80],
    wellness: [80, 82, 81, 83, 84, 82, 83, 85, 84, 86, 85, 87],
  }),
  sm: withRec({
    weeks: 12,
    acute: [360, 380, 400, 390, 410, 420, 400, 420, 430, 440, 435, 445],
    hrv: [69, 70, 68, 71, 69, 70, 68, 70, 69, 68, 67, 66], hrvBase: 70,
    rhr: [50, 49, 51, 49, 50, 49, 51, 50, 51, 52, 52, 53], rhrBase: 50,
    imr: [75, 77, 80, 78, 82, 84, 80, 84, 86, 88, 87, 89],
    wellness: [78, 80, 76, 79, 77, 78, 75, 77, 74, 73, 72, 71],
  }),
  ap: withRec({
    weeks: 12,
    acute: [280, 290, 300, 310, 320, 330, 340, 330, 340, 350, 345, 355],
    hrv: [70, 71, 72, 71, 73, 72, 71, 73, 72, 74, 73, 75], hrvBase: 70,
    rhr: [50, 49, 50, 49, 48, 49, 50, 48, 49, 48, 49, 47], rhrBase: 50,
    imr: [66, 68, 70, 71, 73, 74, 76, 75, 77, 79, 78, 80],
    wellness: [78, 80, 79, 81, 82, 80, 81, 83, 82, 84, 83, 85],
  }),
  bg: withRec({
    weeks: 12,
    acute: [320, 340, 350, 360, 380, 400, 420, 400, 430, 450, 460, 470],
    hrv: [71, 70, 69, 71, 68, 67, 66, 69, 65, 63, 62, 59], hrvBase: 70,
    rhr: [49, 50, 51, 50, 52, 53, 54, 51, 55, 56, 57, 58], rhrBase: 50,
    imr: [72, 74, 75, 76, 80, 83, 86, 80, 88, 91, 93, 95],
    wellness: [81, 79, 78, 80, 74, 72, 70, 77, 68, 64, 61, 57],
  }),
  cf: withRec({
    weeks: 12,
    acute: [290, 300, 310, 300, 320, 330, 340, 330, 345, 355, 350, 360],
    hrv: [72, 71, 72, 73, 72, 73, 72, 74, 73, 74, 75, 76], hrvBase: 70,
    rhr: [49, 50, 49, 48, 49, 48, 49, 47, 48, 47, 46, 47], rhrBase: 50,
    imr: [67, 69, 70, 69, 72, 73, 74, 73, 76, 78, 77, 79],
    wellness: [79, 80, 81, 82, 80, 82, 83, 84, 83, 85, 84, 86],
  }),
};

export const DEMO_MEDALS: Record<string, Medal[]> = {
  mv: [
    { comp: "Nacional Absoluto", date: "2026-03", cat: "−81", medal: "oro", sn: 92, cj: 116, place: "1º" },
    { comp: "Apertura Regional", date: "2025-11", cat: "−81", medal: "plata", sn: 88, cj: 110, place: "2º" },
  ],
  kv: [
    { comp: "Metropolitano", date: "2026-02", cat: "−89", medal: "oro", sn: 96, cj: 120, place: "1º" },
    { comp: "Apertura", date: "2025-09", cat: "−89", medal: "bronce", sn: 90, cj: 114, place: "3º" },
  ],
};

export const DEMO_PLAN_INPUTS: Record<string, { macroId: string; currentWeek: number; rms: RM; comps: Competencia[] }> = {
  mv: {
    macroId: "ruso-5d",
    currentWeek: 12,
    rms: { arranque: 78, envion: 98, sentadilla: 130, frente: 105 },
    comps: [{ name: "Nacional", week: 16 }],
  },
  kv: {
    macroId: "bulgaro-6d",   // bi-diario AM/PM visible en demo (spec 2026-06-12 D6)
    currentWeek: 8,          // bulgaro-6d = 12 sem en total; semana 8 = mid-plan
    rms: { arranque: 98, envion: 122, sentadilla: 165, frente: 132 },
    comps: [{ name: "Sudamericano", week: 12 }],
  },
  // Slice macro-history: el resto del plantel del coach1 también arranca con plan + RM + prescripción
  // (antes quedaban sin info en el drill-down). Sus macros del roster coinciden con ROSTER_META.
  ds: {
    macroId: "usa-intermedio",
    currentWeek: 10,
    rms: { arranque: 84, envion: 108, sentadilla: 150, frente: 120 },
    comps: [{ name: "Panamericano", week: 16 }],
  },
  lr: {
    macroId: "coreano-5d",
    currentWeek: 7,
    rms: { arranque: 62, envion: 80, sentadilla: 108, frente: 86 },
    comps: [{ name: "Regional", week: 12 }],
  },
  sm: {
    macroId: "bulgaro-6d",
    currentWeek: 9,
    rms: { arranque: 84, envion: 106, sentadilla: 148, frente: 118 },
    comps: [{ name: "Nacional", week: 12 }],
  },
  ap: {
    macroId: "cubano-int-5d",
    currentWeek: 6,
    rms: { arranque: 60, envion: 78, sentadilla: 104, frente: 84 },
    comps: [{ name: "Apertura", week: 12 }],
  },
};

/**
 * Historial de macrociclos cerrados por atleta (slice macro-history): cuántos ciclos completó y a
 * qué adherencia. El promedio ≈ el número "redondo" pedido (Mara 95% · Diego 70% · etc.). `rmStep`
 * = el paso de la curva de RM entre ciclos. Consumido por `seedAthleteHistory`.
 */
export const DEMO_HISTORY_CFG: Record<string, { adherences: number[]; rmStep: number }> = {
  mv: { adherences: [94, 95, 96], rmStep: 4 },              // 3 ciclos · ~95%
  ds: { adherences: [68, 70, 70, 71, 71], rmStep: 3 },      // 5 ciclos · ~70%
  lr: { adherences: [86, 88, 89, 89], rmStep: 3 },          // 4 ciclos · ~88%
  sm: { adherences: [80, 82, 82, 83, 82, 83], rmStep: 3 },  // 6 ciclos · ~82%
  ap: { adherences: [90, 92], rmStep: 3 },                  // 2 ciclos · ~91%
  kv: { adherences: [84, 86, 87, 87], rmStep: 4 },          // 4 ciclos · ~86%
};

export function makeDayLogYear(today: string, span = 364): DayLog[] {
  const DAY = 86_400_000;
  const t0 = new Date(`${today}T00:00:00Z`).getTime();
  const out: DayLog[] = [];
  for (let d = span; d >= 0; d--) {
    const recent = d <= 45;
    if (!recent && d % 9 === 4) continue;
    const date = new Date(t0 - d * DAY).toISOString().slice(0, 10);
    const wob = Math.cos(d / 5);
    const dip = d % 28 < 5;
    out.push({
      date,
      fatiga: clampInt(2 + (dip ? 1 : 0) + wob, 1, 5),
      dolor: clampInt(2 + (d % 40 < 4 ? 1 : 0), 1, 5),
      estres: clampInt(2 - wob, 1, 5),
      humor: clampInt(4 - (dip ? 1 : 0) - wob, 1, 5),
      motivacion: clampInt(4 + wob, 1, 5),
      sueno: clampInt(4 - (dip ? 1 : 0), 1, 5),
      weight: Math.round((80.5 + 0.4 * Math.sin(d / 12)) * 10) / 10,
    });
  }
  return out;
}

/** Coach Demo roster (5). Coach Ana roster (4). Tomás stays no-series on coach Ana. */
export const COACH1_ATHLETE_IDS = ["mv", "ds", "lr", "sm", "ap"] as const;
export const COACH2_ATHLETE_IDS = ["bg", "cf", "kv", "tl"] as const;
