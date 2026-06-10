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

/** Lunes (ISO) de la semana calendario de una fecha. */
export function mondayOf(date: string): string {
  const dow = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
  return toISO(ms(date) - dow * DAY);
}

export interface CompAnchor {
  /** Lunes calculado: la compe cae exactamente en la semana `anchorWeek` del macro. */
  startDate: string;
  /** Semana del macro en la que se entra HOY (1 si el plan aún no empieza). */
  entryWeek: number;
  /** Días que faltan para que el plan arranque (>0 sólo en "futuro"). */
  daysToStart: number;
  status: "completo" | "recortado" | "futuro" | "pasada";
}

/**
 * Ancla un macro a la fecha de competencia — el coach cuenta HACIA ATRÁS: el pico debe caer en
 * la semana de la compe. `anchorWeek` = semana del macro donde debe caer la compe (su `peakWeek`,
 * o la última si no declara pico). startDate = lunes tal que `weekOfDate(start, compDate) ===
 * anchorWeek`. Si hoy ya está dentro del rango, se entra a mitad del macro (`entryWeek`) y las
 * semanas 1..entryWeek−1 quedan en el pasado (acumulación salteada — honesto, sin comprimir).
 */
export function anchorPlanToComp(compDate: string, anchorWeek: number, totalWeeks: number, today: string): CompAnchor {
  const week = Math.max(1, Math.min(anchorWeek, totalWeeks));
  const startDate = toISO(ms(mondayOf(compDate)) - (week - 1) * 7 * DAY);
  if (ms(compDate) < ms(today)) return { startDate, entryWeek: 1, daysToStart: 0, status: "pasada" };
  if (ms(today) < ms(startDate)) {
    return { startDate, entryWeek: 1, daysToStart: Math.round((ms(startDate) - ms(today)) / DAY), status: "futuro" };
  }
  const entryWeek = weekOfDate(startDate, today, totalWeeks);
  return { startDate, entryWeek, daysToStart: 0, status: entryWeek > 1 ? "recortado" : "completo" };
}

/** Planned sessions per week, read from a macro's `frequency` (e.g. "5d/sem" → 5). 0 if none. */
export function sessionsPerWeek(frequency: string): number {
  const m = frequency.match(/\d+/);
  return m ? Number(m[0]) : 0;
}

/** Consecutive-day streak ending at the most recent logged day — counted only if that day is
 *  today or yesterday (else the streak is broken → 0). Dates are ISO YYYY-MM-DD. Rest days are
 *  not modeled in A1, so any calendar gap breaks the run. */
export function computeStreak(loggedDates: string[], today: string): number {
  if (loggedDates.length === 0) return 0;
  const set = new Set(loggedDates);
  const todayMs = ms(today);
  let cur: number;
  if (set.has(today)) cur = todayMs;
  else if (set.has(toISO(todayMs - DAY))) cur = todayMs - DAY;
  else return 0;
  let count = 0;
  while (set.has(toISO(cur))) {
    count++;
    cur -= DAY;
  }
  return count;
}

/** `weeks` Monday-first rows of 7 ISO dates, the last row containing `today`. Backs the heatmap. */
export function calendarWeeks(today: string, weeks: number): string[][] {
  const todayMs = ms(today);
  const dow = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7; // 0=Mon … 6=Sun
  const mondayMs = todayMs - dow * DAY;
  const rows: string[][] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const start = mondayMs - w * 7 * DAY;
    const row: string[] = [];
    for (let d = 0; d < 7; d++) row.push(toISO(start + d * DAY));
    rows.push(row);
  }
  return rows;
}
