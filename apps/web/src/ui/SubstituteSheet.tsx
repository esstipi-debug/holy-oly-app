import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { simplerVariants, substitutesOf, getMovement, getBase } from "@holy-oly/core";
import { useMovementLang } from "../i18n/useMovementLang";
import { BottomSheet } from "./BottomSheet";

const item: CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  padding: "9px 12px",
  borderRadius: 10,
  marginTop: 6,
  border: "1px solid color-mix(in srgb,var(--wl-text) 12%,transparent)",
  background: "var(--wl-surface)",
  color: "var(--wl-text)",
  fontFamily: "var(--wl-display)",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
};

const grp: CSSProperties = {
  fontFamily: "var(--wl-display)",
  fontSize: 11,
  letterSpacing: ".12em",
  textTransform: "uppercase",
  color: "var(--wl-muted)",
  marginTop: 14,
};

const empty: CSSProperties = {
  fontFamily: "var(--wl-display)",
  fontSize: 12,
  color: "var(--wl-muted)",
  marginTop: 6,
};

/** SP1-guided movement swap: "bajar complejidad" (simpler variants of the same base) +
 *  "sustituir" (alternative movements). Shared by the coach editor and the athlete Entreno.
 *  Uses only --wl-* / --wl-display tokens so it renders correctly in both shells.
 *
 *  Self-close contract: calls `onPick(id)` then `onClose()` on selection — the sheet
 *  self-closes on pick; callers only handle the pick, they need not close it. */
export function SubstituteSheet({
  open,
  onClose,
  movementId,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  movementId: string;
  onPick: (id: string) => void;
}) {
  const { t } = useTranslation();
  const { resolved } = useMovementLang();
  const simpler = simplerVariants(movementId);
  const subs = substitutesOf(movementId);

  // The English nomenclature (`aliasEn`) lives on the base, reachable via the variant's baseId.
  const movName = (id: string): string => {
    const m = getMovement(id);
    if (resolved === "en") {
      return (m && getBase(m.baseId)?.aliasEn) ?? m?.name ?? id;
    }
    return m?.name ?? id;
  };

  const choose = (id: string): void => {
    onPick(id);
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={onClose} ariaLabel={t("substitute.title")}>
      <div
        style={{
          fontFamily: "var(--wl-display)",
          fontWeight: 800,
          fontSize: 18,
          color: "var(--wl-text)",
        }}
      >
        {t("substitute.title")}
      </div>
      <div
        style={{
          fontFamily: "var(--wl-display)",
          fontSize: 12,
          color: "var(--wl-muted)",
          marginTop: 2,
        }}
      >
        {t("substitute.current", { name: movName(movementId) })}
      </div>
      <div style={{ maxHeight: 380, overflowY: "auto" }}>
        <div style={grp}>{t("substitute.lowerComplexity")}</div>
        {simpler.length > 0 ? (
          simpler.map((m) => (
            <button
              key={m.id}
              type="button"
              style={item}
              onClick={() => choose(m.id)}
            >
              {movName(m.id)}
            </button>
          ))
        ) : (
          <div style={empty}>{t("substitute.noSimpler")}</div>
        )}
        <div style={grp}>{t("substitute.substituteWith")}</div>
        {subs.length > 0 ? (
          subs.map((m) => (
            <button
              key={m.id}
              type="button"
              style={item}
              onClick={() => choose(m.id)}
            >
              {movName(m.id)}
            </button>
          ))
        ) : (
          <div style={empty}>{t("substitute.noSubstitutes")}</div>
        )}
      </div>
    </BottomSheet>
  );
}
