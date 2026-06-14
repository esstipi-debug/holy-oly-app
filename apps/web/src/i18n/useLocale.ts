import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { TOGGLE_LANGS, DEFAULT_LANG, PSEUDO_LANG, normalizeLang, type Lang } from "./config";

/**
 * Global language state for the whole app — the replacement for the legal-only `useLegalLocale`.
 * Reading the active language, switching it (the detector persists the choice to localStorage and
 * the i18n instance reflects it on <html lang>), and the list of user-selectable locales.
 */
export function useLocale(): {
  lang: Lang;
  setLang: (l: Lang) => void;
  languages: readonly Lang[];
} {
  const { i18n } = useTranslation();
  const raw = i18n.resolvedLanguage ?? i18n.language ?? DEFAULT_LANG;
  const normalized = normalizeLang(raw);
  // Pseudo-locale (or anything unrecognized) presents as the default in the UI selector.
  const lang: Lang = normalized && normalized !== PSEUDO_LANG ? normalized : DEFAULT_LANG;
  const setLang = useCallback(
    (l: Lang): void => {
      void i18n.changeLanguage(l);
    },
    [i18n],
  );
  return { lang, setLang, languages: TOGGLE_LANGS };
}

/** Collapse the active locale onto the 2-way axis the legal prose is authored in (es / en). */
export function useLegalLang(): "es" | "en" {
  const { lang } = useLocale();
  return lang === "en" ? "en" : "es";
}
