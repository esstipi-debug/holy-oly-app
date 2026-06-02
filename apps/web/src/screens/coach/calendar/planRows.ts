import {
  dateOfWeek, isTaperWeek, phaseForWeek,
  type Competencia, type Macrocycle, type SessionLog,
} from "@holy-oly/core";
import { weekDone } from "../sessions/sessionLog";

export interface PlanWeekRow {
  week: number;
  range: string;       // "2–8 jun"
  phaseName: string;
  phaseIndex: number;  // índice en macro.phaseProfile → color (phaseColor)
  done: number;        // sesiones marcadas ✓ esa semana
  perWeek: number;
  isToday: boolean;
  isTaper: boolean;
  comp?: string;       // nombre de la comp si cae en esta semana
}

const DAY = 86_400_000;
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const ms = (iso: string): number => new Date(`${iso}T00:00:00Z`).getTime();

/** Rango de fechas de una semana del macro: "2–8 jun" (mismo mes) o "29 may–4 jun" (cruza mes). */
export function weekRangeLabel(startDate: string, week: number): string {
  const a = new Date(ms(dateOfWeek(startDate, week)));
  const b = new Date(ms(dateOfWeek(startDate, week)) + 6 * DAY);
  const da = a.getUTCDate(), ma = a.getUTCMonth();
  const db = b.getUTCDate(), mb = b.getUTCMonth();
  return ma === mb ? `${da}–${db} ${MES[mb]!}` : `${da} ${MES[ma]!}–${db} ${MES[mb]!}`;
}

/** Filas del calendario del plan, una por semana (1..weeks). Pura y determinista. */
export function planWeeks(
  macro: Macrocycle,
  weeks: number,
  startDate: string,
  hoyWeek: number,
  comps: Competencia[],
  marks: SessionLog,
  perWeek: number,
): PlanWeekRow[] {
  return Array.from({ length: weeks }, (_, i) => {
    const week = i + 1;
    const phase = phaseForWeek(macro, week);
    return {
      week,
      range: weekRangeLabel(startDate, week),
      phaseName: phase?.name ?? "—",
      phaseIndex: phase ? macro.phaseProfile.indexOf(phase) : -1,
      done: weekDone(marks, week),
      perWeek,
      isToday: week === hoyWeek,
      isTaper: isTaperWeek(week, comps),
      comp: comps.find((c) => c.week === week)?.name,
    };
  });
}
