import { dateOfWeek } from "@holy-oly/core";

const DAY = 86_400_000;
const DOW = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const ms = (iso: string): number => new Date(`${iso}T00:00:00Z`).getTime();

/** Día Lunes-first (0..6) de una fecha ISO. */
export function weekdayMonFirst(iso: string): number {
  return (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7;
}

/** "Jue 11 jun" — etiqueta del día `day` (offset 0..6) de una semana del macro anclada a `startDate`. */
export function dayDateLabel(startDate: string, week: number, day: number): string {
  const d = new Date(ms(dateOfWeek(startDate, week)) + day * DAY);
  return `${DOW[(d.getUTCDay() + 6) % 7]} ${d.getUTCDate()} ${MES[d.getUTCMonth()]!}`;
}

/** "8 jun" — etiqueta corta de una fecha ISO suelta (procedencia de PRs, etc.). */
export function isoDateLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${d.getUTCDate()} ${MES[d.getUTCMonth()]!}`;
}

const DOW_SHORT = ["L", "M", "X", "J", "V", "S", "D"];

/** Offset 0..6 de una fecha dentro de la semana `week` del macro; null si cae fuera de ella.
 *  ESTE es el eje del mapa: columna = offset (no weekday absoluto) — las semanas del macro
 *  están ancladas al weekday del startDate, no al lunes. */
export function dayOffsetInWeek(startDate: string, week: number, date: string): number | null {
  const off = Math.floor((ms(date) - ms(dateOfWeek(startDate, week))) / DAY);
  return off >= 0 && off <= 6 ? off : null;
}

/** Headers de columna (L/M/X/…) rotados: col 0 = weekday del startDate. */
export function dayColumnHeads(firstDow: number): string[] {
  return Array.from({ length: 7 }, (_, i) => DOW_SHORT[(((firstDow + i) % 7) + 7) % 7]!);
}

/** Nombres de columna (Lun/Mar/…) rotados, para aria-labels y títulos. */
export function dayColumnNames(firstDow: number): string[] {
  return Array.from({ length: 7 }, (_, i) => DOW[(((firstDow + i) % 7) + 7) % 7]!);
}
