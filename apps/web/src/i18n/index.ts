import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ICU from "i18next-icu";
import LanguageDetector from "i18next-browser-languagedetector";
import resourcesToBackend from "i18next-resources-to-backend";
import {
  DEFAULT_LANG,
  PSEUDO_LANG,
  SUPPORTED_LANGS,
  STORAGE_KEY,
  normalizeLang,
  htmlLangFor,
} from "./config";
import { pseudoize } from "./pseudo";

/**
 * Single i18next instance for the whole web app.
 *
 * - ICU MessageFormat (plurals `plural{}`, gender `select{}`, `<Trans>` components).
 * - Lazy per-language/namespace loading via dynamic `import()` (Vite-native; survives the
 *   single-file build, where chunks are inlined).
 * - Browser-language detection mapped onto our codes, persisted to localStorage (`ho:lang`).
 * - `en-XA` pseudo-locale post-processor for QA (accent + pad + bracket; see ./pseudo).
 *
 * Fallback: es-AR → es-419 (so the voseo catalog only stores the keys that differ); en-XA → en;
 * everything else → es-419 (the neutral global default).
 */

// Cached pseudo-mode flag, refreshed on language change — avoids a per-`t()` string compare in
// production. Uses the *requested* language: en-XA has an empty catalog by design, so
// resolvedLanguage falls through to "en"; only i18n.language reflects the pseudo mode.
let pseudoActive = false;
const pseudoPostProcessor = {
  type: "postProcessor" as const,
  name: "pseudo",
  process(value: string): string {
    return pseudoActive ? pseudoize(value) : value;
  },
};

void i18n
  .use(ICU)
  .use(LanguageDetector)
  .use(
    resourcesToBackend(async (lng: string, ns: string) => {
      try {
        return (await import(`./locales/${lng}/${ns}.json`)).default;
      } catch {
        // en-XA (no catalog by design) and any not-yet-created namespace fall back cleanly.
        return {};
      }
    }),
  )
  .use(pseudoPostProcessor)
  .use(initReactI18next)
  .init({
    fallbackLng: {
      "es-AR": ["es-419"],
      "en-XA": ["en"],
      default: [DEFAULT_LANG],
    },
    supportedLngs: [...SUPPORTED_LANGS],
    nonExplicitSupportedLngs: false,
    load: "currentOnly",
    ns: ["common"],
    defaultNS: "common",
    postProcess: ["pseudo"],
    interpolation: { escapeValue: false }, // React already escapes; double-escaping mangles ICU
    detection: {
      // `?lng=en-XA` activates the QA pseudo-locale; `?lng=en` / `?lng=es-419` force a language.
      order: ["querystring", "localStorage", "navigator"],
      lookupQuerystring: "lng",
      lookupLocalStorage: STORAGE_KEY,
      caches: ["localStorage"],
      // Never persist the pseudo-locale (QA only) or i18next's internal test mode.
      excludeCacheFor: ["cimode", PSEUDO_LANG],
      convertDetectedLanguage: (lng: string) => normalizeLang(lng) ?? DEFAULT_LANG,
    },
    react: { useSuspense: true },
  });

const refreshPseudoFlag = (): void => {
  pseudoActive = i18n.language?.toLowerCase() === PSEUDO_LANG.toLowerCase();
};
i18n.on("languageChanged", refreshPseudoFlag);
i18n.on("initialized", refreshPseudoFlag);

// Keep <html lang> in sync so screen readers and the browser honor the active language.
if (typeof document !== "undefined") {
  const syncHtmlLang = (): void => {
    document.documentElement.lang = htmlLangFor(i18n.resolvedLanguage ?? DEFAULT_LANG);
  };
  i18n.on("languageChanged", syncHtmlLang);
  i18n.on("initialized", syncHtmlLang);
}

export default i18n;
