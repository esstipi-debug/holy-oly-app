/**
 * Calendar ↔ macro-week conversion. The catalog macrocycle is date-less (weeks 1..N); an
 * athlete's PLAN carries a real `startDate`, so a competition can be picked by date and placed
 * on the right week. All dates are ISO `YYYY-MM-DD`, parsed as UTC midnight so the day-diff is
 * timezone-stable. Pure and deterministic — callers pass "today" in.
 */

const DAY = 86_400_000;
const ms = (iso: string): number => new Date(`${iso}T00:00:00Z`).getTime();
const toISO = (millis: number): string => new Date(millis).toISOString().slice(0, 10);

/** 1-based macro week a calendar date falls on, clamped to [1, totalWeeks]. */
export function weekOfDate(startDate: string, date: string, totalWeeks: number): number {
  const days = Math.floor((ms(date) - ms(startDate)) / DAY);
  const week = Math.floor(days / 7) + 1;
  return Math.max(1, Math.min(totalWeeks, week));
}

/** ISO date of a macro week's first day. */
export function dateOfWeek(startDate: string, week: number): string {
  return toISO(ms(startDate) + (week - 1) * 7 * DAY);
}

/** Start date that anchors `today` to `currentWeek` (today − (currentWeek−1) weeks). */
export function defaultStartDate(today: string, currentWeek: number): string {
  return toISO(ms(today) - (currentWeek - 1) * 7 * DAY);
}

/** Planned sessions per week, read from a macro's `frequency` (e.g. "5d/sem" → 5). 0 if none. */
export function sessionsPerWeek(frequency: string): number {
  const m = frequency.match(/\d+/);
  return m ? Number(m[0]) : 0;
}
