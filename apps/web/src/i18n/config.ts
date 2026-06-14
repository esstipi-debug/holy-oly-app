/**
 * i18n locale config — the single source of truth for which languages exist, the default,
 * and how a raw BCP-47 tag (navigator / stored choice) maps to one of our supported codes.
 *
 * Decision (owner-signed): `es-419` (neutral "tú") is the global default; `es-AR` (voseo) is a
 * variant overlay that inherits es-419 via fallback; `en` is full. `en-XA` is the QA pseudo-locale.
 */

/** User-facing locales. es-AR is auto-detected for AR browsers (not yet a toggle option). */
export type Lang = "es-419" | "es-AR" | "en";

/** QA-only pseudo-locale: accents + pads English to surface un-extracted strings and overflow. */
export const PSEUDO_LANG = "en-XA";

export type LangOrPseudo = Lang | typeof PSEUDO_LANG;

/** Global default + ultimate fallback. */
export const DEFAULT_LANG: Lang = "es-419";

/** Locales offered in the language toggle. es-AR rides on detection; en-XA is dev/QA only. */
export const TOGGLE_LANGS: readonly Lang[] = ["es-419", "en"];

/** Everything i18next is allowed to resolve to. */
export const SUPPORTED_LANGS: readonly LangOrPseudo[] = ["es-419", "es-AR", "en", PSEUDO_LANG];

/** Human labels for the toggle. */
export const LANG_LABELS: Record<Lang, string> = {
  "es-419": "Español",
  "es-AR": "Español (vos)",
  en: "English",
};

/** localStorage key for the persisted language choice (supersedes the legal-only "ho:legalLang"). */
export const STORAGE_KEY = "ho:lang";

/**
 * Map any raw language tag to a supported code, or `null` if we don't support it. Used by the
 * browser-language detector (`convertDetectedLanguage`) and to validate any stored value.
 */
export function normalizeLang(raw?: string | null): LangOrPseudo | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (!v) return null;
  if (v === "en-xa") return PSEUDO_LANG; // QA pseudo-locale — check before the generic "en"
  if (v === "es-419") return "es-419";
  if (v.startsWith("es-ar")) return "es-AR"; // Rioplatense voseo
  if (v.startsWith("es")) return "es-419"; // any other Spanish → neutral default
  if (v.startsWith("en")) return "en";
  return null;
}

/** BCP-47 value for the <html lang> attribute. The pseudo-locale presents as plain English. */
export function htmlLangFor(lng: string): string {
  if (lng === PSEUDO_LANG) return "en";
  return (SUPPORTED_LANGS as readonly string[]).includes(lng) ? lng : DEFAULT_LANG;
}
