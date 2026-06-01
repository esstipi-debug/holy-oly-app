import { recoverySeries, type Atleta, type Medal, type MonitorSeries, type CycleShare, type CycleState } from "@holy-oly/core";

/** Bump when SEED_* shapes change so already-seeded browsers re-seed (e.g. M4a added medals → v2). */
export const SEED_VERSION = 3;

export interface RosterMeta { metodo: string; }

export const SEED_ROSTER: Atleta[] = [
  { id: "mv", nombre: "Mara V.",  iniciales: "MV", nivel: "intermediate", compite: true,  macroId: "ruso-5d" },
  { id: "ds", nombre: "Diego S.", iniciales: "DS", nivel: "intermediate", compite: true },
  { id: "lr", nombre: "Lucía R.", iniciales: "LR", nivel: "intermediate", compite: true },
  { id: "sm", nombre: "Sofía M.", iniciales: "SM", nivel: "advanced" },
  { id: "tl", nombre: "Tomás L.", iniciales: "TL", nivel: "beginner" }, // NO series → no-data exemplar
  { id: "ap", nombre: "Ana P.",   iniciales: "AP", nivel: "intermediate" },
  { id: "bg", nombre: "Bruno G.", iniciales: "BG", nivel: "intermediate" },
  { id: "cf", nombre: "Caro F.",  iniciales: "CF", nivel: "intermediate" },
];

export const ROSTER_META: Record<string, RosterMeta> = {
  mv: { metodo: "Ruso 5D" },        ds: { metodo: "USA Intermedio" },
  lr: { metodo: "Coreano 5D" },     sm: { metodo: "Búlgaro 6D" },
  tl: { metodo: "Polaco 5D" },      ap: { metodo: "Cubano Int." },
  bg: { metodo: "Híbrido 5D" },     cf: { metodo: "Colombiano 5D" },
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

// Each of the 5 authored series below is plausible athlete telemetry steered to a
// chosen DERIVED current-week cell (verified by rosterStatus, pinned in Task 27).
// The lever for the cell is the LAST week: recovery from hrv[11]/rhr[11]/wellness[11],
// acwr from acute[8..11] / mean(acute[8..11]). imr tracks the fatigue story but is not
// part of the roster-cell derivation.
export const SEED_SERIES: Record<string, MonitorSeries> = {
  mv: withRec(MARA_BASE),

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

export const SEED_CYCLE: Record<string, { share: CycleShare; state: CycleState }> = {
  mv: { share: "full", state: "regular" },
  // Default elsewhere is share "min"/state "regular" (LocalRepository fills the gap).
};

export const SEED_MEDALS: Record<string, Medal[]> = {
  mv: [
    { comp: "Nacional Absoluto", date: "2026-03", cat: "−81", medal: "oro", sn: 92, cj: 116, place: "1º" },
    { comp: "Apertura Regional", date: "2025-11", cat: "−81", medal: "plata", sn: 88, cj: 110, place: "2º" },
  ],
};
