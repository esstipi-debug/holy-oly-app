import type { CSSProperties } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { MACROCYCLES } from "@holy-oly/core";
import { MacroPeriodization } from "../../../ui/charts/MacroPeriodization";
import { LoadMeters } from "./LoadMeters";
import { levelLabel } from "./macroFilter";

const page: CSSProperties = {
  padding: "12px 14px 84px", color: "var(--wl-text)", background: "var(--wl-bg)",
  minHeight: "100vh", maxWidth: 390, margin: "0 auto",
};
const back: CSSProperties = {
  width: 34, height: 34, borderRadius: 10, border: "1px solid color-mix(in srgb,var(--wl-text) 15%,transparent)",
  background: "var(--wl-surface)", color: "var(--wl-text)", fontSize: 19, lineHeight: 1, cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
};
const titleStyle: CSSProperties = {
  fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 25, lineHeight: 1, textTransform: "uppercase",
  color: "var(--wl-text)", margin: "12px 0 0",
};
const tagsRow: CSSProperties = { display: "flex", gap: 8, margin: "11px 0 0", flexWrap: "wrap", alignItems: "center" };
const tagBase: CSSProperties = {
  fontFamily: "var(--mono)", fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", padding: "4px 9px", borderRadius: 99,
};
const famTag: CSSProperties = { ...tagBase, background: "color-mix(in srgb,var(--wl-accent) 16%,transparent)", color: "var(--wl-accent)" };
const lvTag: CSSProperties = { ...tagBase, border: "1px solid color-mix(in srgb,var(--wl-text) 16%,transparent)", color: "var(--wl-muted)" };
const pkTag: CSSProperties = { ...tagBase, background: "color-mix(in srgb,var(--wl-accent) 12%,transparent)", color: "var(--wl-accent)", fontWeight: 700 };
const descStyle: CSSProperties = { fontSize: 12.5, lineHeight: 1.55, color: "var(--wl-muted)", margin: "14px 0 0" };
const statsRow: CSSProperties = { display: "flex", gap: 9, margin: "16px 0 4px" };
const statBox: CSSProperties = { flex: 1, background: "var(--wl-surface)", borderRadius: "var(--wl-radius)", padding: "10px 8px", textAlign: "center" };
const statN: CSSProperties = { fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 18, color: "var(--wl-text)", display: "block" };
const statL: CSSProperties = { fontFamily: "var(--mono)", fontSize: 8.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--wl-muted)" };
const sec: CSSProperties = {
  fontFamily: "var(--wl-display)", fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase",
  color: "var(--wl-muted)", margin: "22px 0 10px",
};

export function MacroDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const macro = MACROCYCLES.find((m) => m.id === id);
  if (!macro) return <Navigate to="/coach/macros" replace />;

  return (
    <div style={page}>
      <button type="button" aria-label="volver" style={back} onClick={() => navigate("/coach/macros")}>‹</button>

      <h1 style={titleStyle}>{macro.name}</h1>
      <div style={tagsRow}>
        <span style={famTag}>{macro.family}</span>
        <span style={lvTag}>{levelLabel(macro.level)}</span>
        {macro.peaks && macro.peakWeek != null
          ? <span style={pkTag}>▲ pico sem {macro.peakWeek}</span>
          : <span style={lvTag}>sin pico</span>}
      </div>
      <p style={descStyle}>{macro.desc}</p>

      <div style={statsRow}>
        <div style={statBox}><b style={statN}>{macro.duration.replace(/\s*semanas?/i, "")}</b><span style={statL}>semanas</span></div>
        <div style={statBox}><b style={statN}>{macro.frequency.replace(/d\/sem/i, "")}</b><span style={statL}>días/sem</span></div>
        <div style={statBox}><b style={statN}>{macro.phaseProfile.length}</b><span style={statL}>fases</span></div>
      </div>

      <div style={sec}>Carga</div>
      <LoadMeters macro={macro} />

      <MacroPeriodization macro={macro} />

      <div style={sec}>Ideal para</div>
      <p style={{ fontSize: 12, lineHeight: 1.5, color: "var(--wl-text)", margin: 0 }}>{macro.bestFor}</p>
    </div>
  );
}
