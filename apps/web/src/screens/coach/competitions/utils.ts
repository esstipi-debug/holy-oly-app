import { weeksUntil } from "@holy-oly/core";

/** Fecha de hoy en ISO YYYY-MM-DD (UTC). */
export const today = (): string => new Date().toISOString().slice(0, 10);

/** Traductor mínimo que `countdownLabel` necesita (evita acoplar utils a la firma completa de i18next). */
export type CountdownT = (key: string, opts?: Record<string, unknown>) => string;

/** Etiqueta de countdown para una competencia, traducida vía `t` (ns coach): "finalizada" si ya
 *  pasó, "esta semana" si cae dentro de los próximos 7 días, o "faltan N sem". */
export function countdownLabel(date: string, t: CountdownT): string {
  const tt = today();
  if (date < tt) return t("countdownPast");
  const w = weeksUntil(tt, date);
  return w <= 1 ? t("countdownThisWeek") : t("countdownWeeks", { weeks: w });
}
