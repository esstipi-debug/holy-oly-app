import { useCallback } from "react";
import { useLocale } from "../i18n/useLocale";
import { formatNumber, formatCurrency, formatDate } from "./format";

/**
 * Locale-aware formatters bound to the active app language. Use this instead of `toLocaleString`,
 * the `DOW`/`MES` arrays or `formatClp` so numbers, dates and currency follow the user's locale.
 */
export function useFormat(): {
  number: (value: number, options?: Intl.NumberFormatOptions) => string;
  currency: (value: number, currency: string, options?: Intl.NumberFormatOptions) => string;
  date: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
} {
  const { lang } = useLocale();
  const number = useCallback(
    (value: number, options?: Intl.NumberFormatOptions) => formatNumber(value, lang, options),
    [lang],
  );
  const currency = useCallback(
    (value: number, currency: string, options?: Intl.NumberFormatOptions) =>
      formatCurrency(value, lang, currency, options),
    [lang],
  );
  const date = useCallback(
    (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => formatDate(value, lang, options),
    [lang],
  );
  return { number, currency, date };
}
