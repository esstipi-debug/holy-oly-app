import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import type { SchoolDNA } from "@holy-oly/core";
import { useMovementName } from "../../../i18n/useMovementLang";
import { signatureGroups, excludedNames, intensitySignature } from "./composition";

const intensityBox: CSSProperties = {
  display: "flex", flexDirection: "column", gap: 3, background: "var(--wl-surface)", borderRadius: "var(--wl-radius)",
  padding: "10px 12px", borderLeft: "3px solid var(--wl-accent)",
};
const kicker: CSSProperties = {
  fontFamily: "var(--mono)", fontSize: 8.5, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--wl-accent)",
};
const intensityText: CSSProperties = { fontFamily: "var(--mono)", fontSize: 11.5, lineHeight: 1.45, color: "var(--wl-text)" };
const groupLabel: CSSProperties = {
  fontFamily: "var(--mono)", fontSize: 9, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--wl-muted)", marginBottom: 6,
};
const chipWrap: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 6 };
const chip: CSSProperties = {
  fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 12, color: "var(--wl-accent)",
  background: "color-mix(in srgb,var(--wl-accent) 14%,transparent)", borderRadius: 8, padding: "5px 10px",
};
const exNote: CSSProperties = { fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--wl-muted)", margin: "-2px 0 6px" };
const exChip: CSSProperties = {
  fontFamily: "var(--wl-display)", fontWeight: 600, fontSize: 11.5, color: "var(--wl-muted)", textDecoration: "line-through",
  border: "1px dashed color-mix(in srgb,var(--wl-text) 22%,transparent)", borderRadius: 8, padding: "4px 9px",
};

/**
 * «Composición» del macro para el coach curioso: el sello de intensidad de la escuela, sus
 * movimientos firma agrupados por patrón, y —cuando la escuela los excluye a propósito— lo que
 * DEJA FUERA (el rasgo más distintivo de un sistema como el búlgaro). Presentacional puro; los
 * datos salen del ADN de la escuela (packages/core/data/schools.ts) vía `composition.ts`.
 */
export function MacroComposition({ dna }: { dna: SchoolDNA }) {
  const { t } = useTranslation("macros");
  const mn = useMovementName();
  const groups = signatureGroups(dna, mn);
  const excluded = excludedNames(dna, mn);

  return (
    <div>
      <div style={intensityBox}>
        <span style={kicker}>{t("mcompSeal")}</span>
        <span style={intensityText}>{intensitySignature(dna)}</span>
      </div>

      <div style={{ marginTop: 13, display: "flex", flexDirection: "column", gap: 11 }}>
        {groups.map((g) => (
          <div key={g.slot}>
            <div style={groupLabel}>{g.label}</div>
            <div style={chipWrap}>
              {g.names.map((n, i) => <span key={`${g.slot}-${i}`} style={chip}>{n}</span>)}
            </div>
          </div>
        ))}
      </div>

      {excluded.length > 0 && (
        <div style={{ marginTop: 15 }}>
          <div style={groupLabel}>{t("mcompExcludes")}</div>
          <div style={exNote}>{t("mcompExcludesNote")}</div>
          <div style={chipWrap}>
            {excluded.map((n, i) => <span key={`ex-${i}`} style={exChip}>{n}</span>)}
          </div>
        </div>
      )}
    </div>
  );
}
