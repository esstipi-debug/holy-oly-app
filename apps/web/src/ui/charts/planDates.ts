import { dateOfWeek } from "@holy-oly/core";
import { DEFAULT_LANG } from "../../i18n/config";
import { formatDate } from "../../lib/format";

const DAY = 86_400_000;
const ms = (iso: string): number => new Date(`${iso}T00:00:00Z`).getTime();

/**
 * Etiquetas de fecha localizadas. El MES se formatea vía `Intl` (lib/format) → respeta el locale
 * activo sin arrays es-CL hardcodeadas. El día de la semana (prefijo de `dayDateLabel`) y los
 * headers de columna usan la convención propia de la app por idioma (incluida la «X» del miércoles
 * en español, que `Intl` no produce). Todas las funciones aceptan un `locale` opcional; por defecto
 * el idioma global (`es-419`), de modo que los callers existentes compilan sin cambios.
 */

/** Día de la semana (Lunes-first, índice 0..6) por idioma — convención de la app, no `Intl`. */
const DOW_BY_LOCALE: Record<string, readonly string[]> = {
  es: ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"],
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
};
/** Headers de una letra (Lunes-first) por idioma — «X» = miércoles en español. */
const DOW_SHORT_BY_LOCALE: Record<string, readonly string[]> = {
  es: ["L", "M", "X", "J", "V", "S", "D"],
  en: ["M", "T", "W", "T", "F", "S", "S"],
};

/** Colapsa el locale al eje de los nombres de día (es / en). */
function dowLang(locale: string): "es" | "en" {
  return locale.toLowerCase().startsWith("en") && locale.toLowerCase() !== "en-xa" ? "en" : "es";
}
const dowNames = (locale: string): readonly string[] => DOW_BY_LOCALE[dowLang(locale)]!;
const dowShort = (locale: string): readonly string[] => DOW_SHORT_BY_LOCALE[dowLang(locale)]!;

/** "11 jun" (día + mes) localizado vía Intl, sin año. */
function dayMonth(d: Date, locale: string): string {
  return formatDate(d, locale, { day: "numeric", month: "short", timeZone: "UTC" });
}

/** Día Lunes-first (0..6) de una fecha ISO. */
export function weekdayMonFirst(iso: string): number {
  return (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7;
}

/** "Jue 11 jun" — etiqueta del día `day` (offset 0..6) de una semana del macro anclada a `startDate`. */
export function dayDateLabel(startDate: string, week: number, day: number, locale: string = DEFAULT_LANG): string {
  const d = new Date(ms(dateOfWeek(startDate, week)) + day * DAY);
  return `${dowNames(locale)[(d.getUTCDay() + 6) % 7]} ${dayMonth(d, locale)}`;
}

/** "8 jun" — etiqueta corta de una fecha ISO suelta (procedencia de PRs, etc.). */
export function isoDateLabel(iso: string, locale: string = DEFAULT_LANG): string {
  return dayMonth(new Date(`${iso}T00:00:00Z`), locale);
}

/** "13–17 jun" (mismo mes) o "29 jun – 3 jul" — rango corto localizado entre dos ISO. */
export function isoRangeLabel(a: string, b: string, locale: string = DEFAULT_LANG): string {
  const da = new Date(`${a}T00:00:00Z`);
  const db = new Date(`${b}T00:00:00Z`);
  return da.getUTCMonth() === db.getUTCMonth() && da.getUTCFullYear() === db.getUTCFullYear()
    ? `${da.getUTCDate()}–${isoDateLabel(b, locale)}`
    : `${isoDateLabel(a, locale)} – ${isoDateLabel(b, locale)}`;
}

/** Offset 0..6 de una fecha dentro de la semana `week` del macro; null si cae fuera de ella.
 *  ESTE es el eje del mapa: columna = offset (no weekday absoluto) — las semanas del macro
 *  están ancladas al weekday del startDate, no al lunes. */
export function dayOffsetInWeek(startDate: string, week: number, date: string): number | null {
  const off = Math.floor((ms(date) - ms(dateOfWeek(startDate, week))) / DAY);
  return off >= 0 && off <= 6 ? off : null;
}

/** Headers de columna (L/M/X/…) rotados: col 0 = weekday del startDate. */
export function dayColumnHeads(firstDow: number, locale: string = DEFAULT_LANG): string[] {
  const short = dowShort(locale);
  return Array.from({ length: 7 }, (_, i) => short[(((firstDow + i) % 7) + 7) % 7]!);
}

/** Nombres de columna (Lun/Mar/…) rotados, para aria-labels y títulos. */
export function dayColumnNames(firstDow: number, locale: string = DEFAULT_LANG): string[] {
  const names = dowNames(locale);
  return Array.from({ length: 7 }, (_, i) => names[(((firstDow + i) % 7) + 7) % 7]!);
}
