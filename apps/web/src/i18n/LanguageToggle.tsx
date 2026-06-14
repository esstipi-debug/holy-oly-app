import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { SegmentedTabs } from "../ui/SegmentedTabs";
import { useLocale } from "./useLocale";
import { TOGGLE_LANGS, type Lang } from "./config";

const SHORT: Record<Lang, string> = { "es-419": "ES", "es-AR": "AR", en: "EN" };

/**
 * Global language switch (ES / EN). Bound to the app-wide locale — persists the choice and updates
 * <html lang>. Reuses the shared `SegmentedTabs` primitive so it inherits the `.ho-seg` styling.
 * es-AR (auto-detected for AR browsers) highlights "ES" in this 2-option toggle; exposing it
 * explicitly is a later refinement.
 */
export function LanguageToggle({ style }: { style?: CSSProperties }) {
  const { t } = useTranslation();
  const { lang, setLang } = useLocale();
  const options = TOGGLE_LANGS.map((l) => [l, SHORT[l]] as const);
  const value: Lang = TOGGLE_LANGS.includes(lang) ? lang : "es-419";
  return (
    <SegmentedTabs ariaLabel={t("language")} options={options} value={value} onChange={setLang} style={style} />
  );
}
