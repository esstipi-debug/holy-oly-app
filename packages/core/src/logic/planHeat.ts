import type { PrescriptionRow, WeekHeat } from "../types";

/** Heat input: a prescription row's location + dose (movement/kg are irrelevant here).
 *  `day` = día del layout de la receta (1-7, Lunes-Domingo); sin day = session i (legacy). */
export type HeatRow = Pick<PrescriptionRow, "week" | "sessionIdx" | "sets" | "reps" | "pct"> & { day?: number };

const DAYS = 7;

/**
 * Per-day intensity/volume aggregate of a plan, for the calendar heat map.
 * Si la fila trae `day` (del layout de la receta), se usa ese día; sin day = session i (legacy,
 * byte-idéntico a v1). Dos turnos AM/PM del mismo día suman sus lifts y toman el topPct máximo.
 * Always returns `totalWeeks` rows × 7 slots; `null` = rest day.
 * `topPct` is absent when no row of the day carries a pct (honest no-data, never an invented 0).
 * Athlete-safe payload: percentages + lift counts only — no raw RM, no RPE.
 */
export function planHeat(rows: readonly HeatRow[], totalWeeks: number): WeekHeat[] {
  const weeks: WeekHeat[] = Array.from({ length: Math.max(0, totalWeeks) }, (_, i) => ({
    week: i + 1,
    days: Array.from({ length: DAYS }, () => null),
  }));
  for (const r of rows) {
    const dayIdx = (r.day ?? r.sessionIdx + 1) - 1;   // D8: sin day = legacy sesión i → día i
    if (r.week < 1 || r.week > totalWeeks || dayIdx < 0 || dayIdx >= DAYS) continue;
    const days = weeks[r.week - 1]!.days;
    const cur = days[dayIdx];
    const lifts = (cur?.lifts ?? 0) + r.sets * r.reps;
    const prevTop = cur?.topPct;
    const topPct = r.pct == null ? prevTop : prevTop == null ? r.pct : Math.max(prevTop, r.pct);
    days[dayIdx] = topPct == null ? { lifts } : { lifts, topPct };
  }
  return weeks;
}

/** Largest day volume across the plan — normalizes the heat map's alpha. 0 when empty. */
export function maxLifts(heat: readonly WeekHeat[]): number {
  let max = 0;
  for (const w of heat) for (const d of w.days) if (d && d.lifts > max) max = d.lifts;
  return max;
}
