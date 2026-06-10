import { recoverySeries, type Atleta, type Competencia, type Medal, type MonitorSeries, type CycleShare, type CycleState, type RM, type DayLog } from "@holy-oly/core";

/** Bump when SEED_* shapes change so already-seeded browsers re-seed (M4a medals → v2; M4c macroIds + comps → v4; A-offline Kevin + plan/daylog seeds → v5). */
export const SEED_VERSION = 6; // bump → demo localStorage re-seeds (adds Mara's plan/prescription)

/** Clamp to an integer in [lo, hi] — keeps generated telemetry inside the domain's valid ranges. */
const clampInt = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, Math.round(v)));

export interface RosterMeta { metodo: string; }

export const SEED_ROSTER: Atleta[] = [
  { id: "mv", nombre: "Mara V.",  iniciales: "MV", nivel: "intermediate", sexo: "F", compite: true,  macroId: "ruso-5d" },
  { id: "ds", nombre: "Diego S.", iniciales: "DS", nivel: "intermediate", sexo: "M", compite: true,  macroId: "usa-intermedio" },
  { id: "lr", nombre: "Lucía R.", iniciales: "LR", nivel: "intermediate", sexo: "F", compite: true,  macroId: "coreano-5d" },
  { id: "sm", nombre: "Sofía M.", iniciales: "SM", nivel: "advanced",     sexo: "F",                 macroId: "bulgaro-6d" },
  { id: "tl", nombre: "Tomás L.", iniciales: "TL", nivel: "beginner",     sexo: "M" }, // NO series ni macro → no-data exemplar
  { id: "ap", nombre: "Ana P.",   iniciales: "AP", nivel: "intermediate", sexo: "F",                 macroId: "cubano-int-5d" },
  { id: "bg", nombre: "Bruno G.", iniciales: "BG", nivel: "intermediate", sexo: "M",                 macroId: "hibrido-5d" },
  { id: "cf", nombre: "Caro F.",  iniciales: "CF", nivel: "intermediate", sexo: "F",                 macroId: "colombiano-5d" },
  // Kevin — the offline ATHLETE demo "me" (LocalMeClient). Seeded with a year of data: a 52-week
  // monitor series, an active Ruso 5D plan (week ~12/16) and ~a year of check-ins. sexo M → barra 20.
  { id: "kv", nombre: "Kevin A.", iniciales: "KV", nivel: "intermediate", sexo: "M", compite: true,  macroId: "ruso-5d" },
];

// Mara's target competition (M4c seed). Others start with no comp → assigned from the sheet.
export const SEED_COMPS: Record<string, Competencia[]> = {
  mv: [{ name: "Nacional", week: 16 }],
  kv: [{ name: "Sudamericano", week: 16 }],
};

export const ROSTER_META: Record<string, RosterMeta> = {
  mv: { metodo: "Ruso 5D" },        ds: { metodo: "USA Intermedio" },
  lr: { metodo: "Coreano 5D" },     sm: { metodo: "Búlgaro 6D" },
  tl: { metodo: "Polaco 5D" },      ap: { metodo: "Cubano Int." },
  bg: { metodo: "Híbrido 5D" },     cf: { metodo: "Colombiano 5D" },
  kv: { metodo: "Ruso 5D" },
};

/**
 * Demo-only (T3) sales annotations — "por qué mirar a este". Each hint MATCHES the athlete's pinned
 * readiness cell (we annotate the seeded series, we don't re-steer them): ds/bg = alerta, mv/sm =
 * vigilar, cf/ap = ok, tl = sin datos, kv = el atleta demo. Shown by `DemoSalesStrip`, gated !API_ENABLED.
 */
export const ROSTER_HINTS: Record<string, string> = {
  ds: "Triage en rojo: HRV abajo y carga arriba. El caso donde frenás una lesión antes de que pase.",
  bg: "Sobre-alcance al final del bloque — otra alerta para leer fino antes de la próxima semana.",
  mv: "Rumbo al Nacional: mirá el macro-timeline y la recuperación en el taper.",
  sm: "Avanzada, algo cargada al cierre del bloque — para vigilar sin frenar.",
  cf: "Bloque sano, con contexto de ciclo (opt-in) — el diferenciador femenino.",
  ap: "Atleta consistente que cumple — el caso 'todo en verde'.",
  tl: "Sin datos aún — el estado vacío honesto (cuando registre HRV/carga aparece).",
  kv: "El atleta demo: un año de datos + Entreno guiado + pantalla de victoria.",
};

// Mara — real 12-week arrays from _mockup/coach.html; recovery precomputed.
// Derived current-week cell: warn (acwr 0.74 deload + recovery 77).
// M4b optional fields seeded only for Mara (showcase athlete); others stay as-is.
const MARA_BASE: Omit<MonitorSeries, "recovery"> = {
  weeks: 12,
  acute: [300, 320, 340, 300, 360, 380, 400, 320, 420, 700, 380, 340],
  hrv: [72, 71, 70, 73, 69, 70, 68, 72, 67, 62, 64, 69], hrvBase: 70,
  rhr: [49, 50, 50, 48, 51, 50, 52, 49, 53, 56, 54, 50], rhrBase: 50,
  imr: [66, 68, 70, 69, 76, 78, 80, 79, 86, 93, 88, 89],
  wellness: [82, 80, 78, 83, 74, 72, 70, 80, 66, 58, 62, 70],
  // M4b: compliance/rpe/bodyweight/weightBand/wellnessItems — coherent with week-10 overreach spike
  compliance: [95, 92, 98, 90, 94, 88, 96, 91, 85, 72, 90, 94],
  rpe: [7, 7, 8, 7, 8, 8, 9, 7, 9, 10, 8, 7],
  bodyweight: [81.2, 81.1, 80.9, 80.8, 80.9, 80.7, 80.6, 80.5, 80.6, 80.3, 80.4, 80.8],
  weightBand: [80, 81],
  wellnessItems: {
    Fatiga:     [2, 2, 3, 2, 3, 3, 4, 2, 4, 5, 3, 2],
    Dolor:      [1, 2, 2, 1, 2, 2, 3, 2, 3, 4, 2, 2],
    Estrés:     [2, 2, 2, 3, 3, 3, 3, 2, 4, 4, 3, 2],
    Humor:      [4, 4, 4, 4, 3, 3, 3, 4, 2, 1, 3, 4],
    Motivación: [5, 5, 4, 4, 4, 4, 3, 4, 3, 2, 4, 5],
    Sueño:      [4, 4, 4, 4, 3, 3, 3, 4, 2, 1, 3, 4],
  },
};

const withRec = (b: Omit<MonitorSeries, "recovery">): MonitorSeries =>
  ({ ...b, recovery: recoverySeries({ ...b, recovery: [] }) });

// Kevin — a deterministic full YEAR (52 weeks) of plausible telemetry: four ~13-week mesocycles
// (8-week build → peak → deload), progressive chronic load, HRV/RHR/wellness dipping on the hard
// weeks. No RNG/Date → reproducible. Drives the coach drill-down's year-long charts; the athlete
// Titular reads the current plan week off it.
function genYearBase(): Omit<MonitorSeries, "recovery"> {
  const N = 52;
  const mk = (f: (i: number) => number): number[] => Array.from({ length: N }, (_, i) => f(i));
  const meso = (i: number): number => i % 13;                 // 0..12; deload at 11-12
  const hard = (i: number): boolean => meso(i) >= 8 && meso(i) <= 10; // peak-load weeks
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

// Each of the 5 authored series below is plausible athlete telemetry steered to a
// chosen DERIVED current-week cell (verified by rosterStatus, pinned in Task 27).
// The lever for the cell is the LAST week: recovery from hrv[11]/rhr[11]/wellness[11],
// acwr from acute[8..11] / mean(acute[8..11]). imr tracks the fatigue story but is not
// part of the roster-cell derivation.
export const SEED_SERIES: Record<string, MonitorSeries> = {
  mv: withRec(MARA_BASE),
  kv: withRec(genYearBase()), // Kevin — a full year (52 weeks)

  // Diego — steady build, then a late crash week (HRV down, RHR up, wellness low) →
  // last-week recovery 66 < 70. acwr ~1.0 (ok), but recovery alert dominates → alert.
  ds: withRec({
    weeks: 12,
    acute: [330, 350, 360, 340, 370, 390, 360, 380, 400, 420, 440, 430],
    hrv: [70, 71, 69, 72, 68, 70, 71, 69, 67, 65, 63, 60], hrvBase: 70,
    rhr: [50, 49, 51, 50, 52, 50, 49, 51, 53, 54, 55, 57], rhrBase: 50,
    imr: [70, 72, 73, 71, 76, 78, 75, 77, 82, 86, 90, 91],
    wellness: [80, 82, 78, 81, 75, 77, 79, 76, 70, 66, 62, 58],
  }),

  // Lucía — textbook steady progression, well recovered throughout. last-week acwr 1.02
  // (ok band) and recovery 87 (ok) → ok.
  lr: withRec({
    weeks: 12,
    acute: [300, 310, 320, 330, 340, 350, 360, 350, 360, 370, 365, 375],
    hrv: [71, 72, 73, 72, 74, 73, 72, 74, 73, 75, 74, 76], hrvBase: 70,
    rhr: [49, 48, 49, 48, 47, 48, 49, 47, 48, 47, 48, 46], rhrBase: 50,
    imr: [68, 70, 71, 72, 74, 75, 76, 75, 77, 79, 78, 80],
    wellness: [80, 82, 81, 83, 84, 82, 83, 85, 84, 86, 85, 87],
  }),

  // Sofía — advanced, high chronic load, slightly run-down at the end. last-week recovery
  // 74 (warn band) with acwr 1.02 (ok) → warn (the recovery axis, no alert anywhere).
  sm: withRec({
    weeks: 12,
    acute: [360, 380, 400, 390, 410, 420, 400, 420, 430, 440, 435, 445],
    hrv: [69, 70, 68, 71, 69, 70, 68, 70, 69, 68, 67, 66], hrvBase: 70,
    rhr: [50, 49, 51, 49, 50, 49, 51, 50, 51, 52, 52, 53], rhrBase: 50,
    imr: [75, 77, 80, 78, 82, 84, 80, 84, 86, 88, 87, 89],
    wellness: [78, 80, 76, 79, 77, 78, 75, 77, 74, 73, 72, 71],
  }),

  // Ana — moderate, consistent block; recovers well. last-week acwr 1.02 (ok) and
  // recovery 85 (ok) → ok.
  ap: withRec({
    weeks: 12,
    acute: [280, 290, 300, 310, 320, 330, 340, 330, 340, 350, 345, 355],
    hrv: [70, 71, 72, 71, 73, 72, 71, 73, 72, 74, 73, 75], hrvBase: 70,
    rhr: [50, 49, 50, 49, 48, 49, 50, 48, 49, 48, 49, 47], rhrBase: 50,
    imr: [66, 68, 70, 71, 73, 74, 76, 75, 77, 79, 78, 80],
    wellness: [78, 80, 79, 81, 82, 80, 81, 83, 82, 84, 83, 85],
  }),

  // Bruno — overreaching: climbing load with a hard final-week crash (HRV down, RHR up,
  // wellness low) → last-week recovery 65 < 70 → alert (acwr 1.04 ok, recovery dominates).
  bg: withRec({
    weeks: 12,
    acute: [320, 340, 350, 360, 380, 400, 420, 400, 430, 450, 460, 470],
    hrv: [71, 70, 69, 71, 68, 67, 66, 69, 65, 63, 62, 59], hrvBase: 70,
    rhr: [49, 50, 51, 50, 52, 53, 54, 51, 55, 56, 57, 58], rhrBase: 50,
    imr: [72, 74, 75, 76, 80, 83, 86, 80, 88, 91, 93, 95],
    wellness: [81, 79, 78, 80, 74, 72, 70, 77, 68, 64, 61, 57],
  }),

  // Caro — moderate steady block, well recovered. last-week acwr 1.02 (ok) and
  // recovery 86 (ok) → ok.
  cf: withRec({
    weeks: 12,
    acute: [290, 300, 310, 300, 320, 330, 340, 330, 345, 355, 350, 360],
    hrv: [72, 71, 72, 73, 72, 73, 72, 74, 73, 74, 75, 76], hrvBase: 70,
    rhr: [49, 50, 49, 48, 49, 48, 49, 47, 48, 47, 46, 47], rhrBase: 50,
    imr: [67, 69, 70, 69, 72, 73, 74, 73, 76, 78, 77, 79],
    wellness: [79, 80, 81, 82, 80, 82, 83, 84, 83, 85, 84, 86],
  }),

  // tl: intentionally ABSENT → getSeries("tl") === undefined (no-data exemplar).
};

const cycleDaysAgo = (n: number): string => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
export const SEED_CYCLE: Record<string, { share: CycleShare; state: CycleState; lastPeriodStart?: string; cycleLengthDays?: number }> = {
  // Día ~20 de un ciclo de 28 → en ventana lútea hoy y con pre-período proyectado cerca (demo visible).
  mv: { share: "full", state: "regular", lastPeriodStart: cycleDaysAgo(20), cycleLengthDays: 28 },
  // Kevin = la identidad atleta del demo standalone (LocalMeClient) → su overlay también se ve.
  kv: { share: "full", state: "regular", lastPeriodStart: cycleDaysAgo(20), cycleLengthDays: 28 },
  // Default elsewhere is share "min"/state "regular" (LocalRepository fills the gap).
};

export const SEED_MEDALS: Record<string, Medal[]> = {
  mv: [
    { comp: "Nacional Absoluto", date: "2026-03", cat: "−81", medal: "oro", sn: 92, cj: 116, place: "1º" },
    { comp: "Apertura Regional", date: "2025-11", cat: "−81", medal: "plata", sn: 88, cj: 110, place: "2º" },
  ],
  kv: [
    { comp: "Metropolitano", date: "2026-02", cat: "−89", medal: "oro", sn: 96, cj: 120, place: "1º" },
    { comp: "Apertura", date: "2025-09", cat: "−89", medal: "bronce", sn: 90, cj: 114, place: "3º" },
  ],
};

/**
 * Athletes seeded with an assigned plan (and, paired with it, a year of check-ins) — the offline
 * ATHLETE demo. `LocalRepository.init` builds the Plan (startDate anchored so `currentWeek` lands
 * mid-macro) and instantiates its prescription, exactly as the coach's `savePlan` would.
 */
export const SEED_PLAN_INPUTS: Record<string, { macroId: string; currentWeek: number; rms: RM; comps: Competencia[] }> = {
  kv: {
    macroId: "ruso-5d",
    currentWeek: 12, // of 16 → mid-plan: an active Camino + a real session to train today
    rms: { arranque: 98, envion: 122, sentadilla: 165, frente: 132 },
    comps: [{ name: "Sudamericano", week: 16 }],
  },
  // Mara — the featured first card. So "ver como atleta" lands the money shot (discs) on her too,
  // not only Kevin. macroId matches her roster (ruso-5d, the only macro with a MACRO_RECIPES recipe
  // → the only one that instantiates a prescription); currentWeek 12 aligns with her 12wk of series;
  // comp matches SEED_COMPS.mv (Nacional/16). Female RMs + sexo "F" → the 15 kg bar in the discs.
  mv: {
    macroId: "ruso-5d",
    currentWeek: 12,
    rms: { arranque: 78, envion: 98, sentadilla: 130, frente: 105 },
    comps: [{ name: "Nacional", week: 16 }],
  },
};

/**
 * A deterministic ~year of daily check-ins ending `today`: mostly-daily with sparse older gaps,
 * at least the last 45 days continuous so the streak reads as a committed athlete. Built at seed time
 * (init) so the dates are always relative to the real today. Pure given `today`.
 */
export function makeDayLogYear(today: string, span = 364): DayLog[] {
  const DAY = 86_400_000;
  const t0 = new Date(`${today}T00:00:00Z`).getTime();
  const out: DayLog[] = [];
  for (let d = span; d >= 0; d--) {
    const recent = d <= 45;                 // keep the recent stretch unbroken (streak)
    if (!recent && d % 9 === 4) continue;   // sparse older gaps
    const date = new Date(t0 - d * DAY).toISOString().slice(0, 10);
    const wob = Math.cos(d / 5);            // gentle -1..1 wobble
    const dip = d % 28 < 5;                 // a recurring rough patch (deload/overreach feel)
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
