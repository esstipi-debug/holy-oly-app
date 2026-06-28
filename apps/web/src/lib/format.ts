import { PSEUDO_LANG } from "../i18n/config";

/**
 * Locale-aware formatting via the platform `Intl` APIs. Pure functions taking an explicit locale —
 * the replacement for the hardcoded `toLocaleString("es-CL")`, the `DOW`/`MES` arrays and the
 * `formatClp` helper. Bind these to the active language with `useFormat` (see ./useFormat).
 */

/** Map our locale codes to Intl-friendly BCP-47 tags. The QA pseudo-locale formats as English.
 *  `es-419` (neutral LatAm) groups with commas under Intl (1,234,567); the app's convention —
 *  and every catalog/test — is the Chilean dot grouping (1.234.567), so the neutral Spanish
 *  default formats as `es-CL`. es-AR/pt-BR already group with dots; en with commas. */
export function intlLocale(lang: string): string {
  if (lang === PSEUDO_LANG) return "en";
  if (lang === "es-419") return "es-CL";
  return lang;
}

/** Format a number with locale grouping/decimals. */
export function formatNumber(value: number, locale: string, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(intlLocale(locale), options).format(value);
}

/** Format a currency amount (e.g. CLP, USD) for the given locale. */
export function formatCurrency(
  value: number,
  locale: string,
  currency: string,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(intlLocale(locale), { style: "currency", currency, ...options }).format(value);
}

/** Format a date (Date, ISO string or epoch ms) for the given locale. */
export function formatDate(
  value: Date | string | number,
  locale: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(intlLocale(locale), options).format(date);
}
