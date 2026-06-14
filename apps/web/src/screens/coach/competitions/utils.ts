import { weeksUntil } from "@holy-oly/core";

/** Fecha de hoy en ISO YYYY-MM-DD (UTC). */
export const today = (): string => new Date().toISOString().slice(0, 10);

/** Etiqueta de countdown para una competencia: "finalizada" si ya pasó, "esta semana" si cae
 *  dentro de los próximos 7 días, o "faltan N sem". */
export function countdownLabel(date: string): string {
  const t = today();
  if (date < t) return "finalizada";
  const w = weeksUntil(t, date);
  return w <= 1 ? "esta semana" : `faltan ${w} sem`;
}
