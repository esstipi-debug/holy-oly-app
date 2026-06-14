import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { SegmentedTabs } from "../ui/SegmentedTabs";
import { useMovementLang } from "./useMovementLang";
import { MOVEMENT_LANGS, type MovementLang } from "./movementLang";

const SHORT: Record<MovementLang, string> = { auto: "Auto", es: "ES", en: "EN" };

/**
 * Toggle for the movement-name nomenclature language (Auto / ES / EN) — independent of the UI
 * language, so a Spanish-UI lifter can read "snatch / C&J" if they prefer. Reuses `SegmentedTabs`.
 */
export function MovementLangToggle({ style }: { style?: CSSProperties }) {
  const { t } = useTranslation();
  const { pref, setPref } = useMovementLang();
  const options = MOVEMENT_LANGS.map((l) => [l, SHORT[l]] as const);
  return (
    <SegmentedTabs ariaLabel={t("movementNames")} options={options} value={pref} onChange={setPref} style={style} />
  );
}
