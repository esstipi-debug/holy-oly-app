import type { Competencia, Competition } from "../types";
import { weekOfDate } from "./schedule";

/**
 * Competencias compartidas (slice 2026-06-14) — lógica PURA de la sincronización pico ↔ Competencia.
 * El acople de un atleta como "pico" alimenta el peaking existente (countdown / peakWeek /
 * PhaseTrack) escribiendo la fila `Competencia` por-atleta que ya consume todo el sistema. Esto NO
 * cambia el peaking: sólo lo dispara desde la compe maestra. El rol "paso" no produce fila (no
 * ancla nada). Determinístico (UTC midnight); el caller pasa "today" cuando lo necesita.
 */

const DAY = 86_400_000;
const ms = (iso: string): number => new Date(`${iso}T00:00:00Z`).getTime();

/**
 * Fila `Competencia` por-atleta para un acople "pico". `null` cuando el atleta todavía no tiene el
 * plan anclado (sin `startDate`) o el macro no tiene semanas: no se puede ubicar la semana, así que
 * el acople queda sin anclar hasta que se asigne/ancle el macro.
 */
export function competenciaForPico(
  competition: Pick<Competition, "name" | "date">,
  startDate: string | undefined,
  totalWeeks: number,
): Competencia | null {
  if (!startDate || totalWeeks <= 0) return null;
  return {
    name: competition.name,
    week: weekOfDate(startDate, competition.date, totalWeeks),
    date: competition.date,
  };
}

/**
 * Semanas enteras (hacia arriba) entre `today` y `date`, para el countdown de la lista. Negativo
 * si la compe ya pasó, 0 el mismo día. Determinístico (UTC midnight).
 */
export function weeksUntil(today: string, date: string): number {
  return Math.ceil((ms(date) - ms(today)) / (7 * DAY));
}
