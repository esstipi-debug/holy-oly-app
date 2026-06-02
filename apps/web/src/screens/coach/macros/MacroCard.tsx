import type { CSSProperties } from "react";
import type { Macrocycle } from "@holy-oly/core";
import { LoadMeters } from "./LoadMeters";
import { focusTag, levelLabel } from "./macroFilter";

const card: CSSProperties = {
  position: "relative", textAlign: "left", cursor: "pointer", width: "100%",
  background: "var(--wl-surface)", border: "1px solid color-mix(in srgb,var(--wl-text) 8%,transparent)",
  borderRadius: "var(--wl-radius)", padding: "13px 12px 14px", overflow: "hidden", color: "var(--wl-text)",
};
const title: CSSProperties = {
  fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 14, lineHeight: 1.08,
  textTransform: "uppercase", color: "var(--wl-text)", margin: "0 0 7px", paddingRight: 22,
};
const desc: CSSProperties = {
  fontSize: 10, lineHeight: 1.4, color: "var(--wl-muted)", margin: "0 0 10px",
  display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
};
const meta: CSSProperties = {
  display: "flex", gap: 12, fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-muted)", marginBottom: 11,
};
const pk: CSSProperties = {
  position: "absolute", top: 10, right: 9, fontFamily: "var(--mono)", fontSize: 8, fontWeight: 700,
  color: "var(--wl-accent)", border: "1px solid color-mix(in srgb,var(--wl-accent) 45%,transparent)",
  borderRadius: 5, padding: "2px 5px",
};
const tag: CSSProperties = {
  fontFamily: "var(--mono)", fontStyle: "italic", fontSize: 10, color: "var(--wl-muted)", margin: "10px 0 9px",
};
const best: CSSProperties = { fontSize: 10, lineHeight: 1.35, color: "var(--wl-muted)" };

/** One catalog card for a macrocycle (ports the mockup's `mcard`). Whole card is the open affordance. */
export function MacroCard({ macro, onOpen }: { macro: Macrocycle; onOpen: (id: string) => void }) {
  return (
    <button type="button" style={card} onClick={() => onOpen(macro.id)}>
      {macro.peaks && macro.peakWeek != null && <span style={pk}>▲ S{macro.peakWeek}</span>}
      <h3 style={title}>{macro.name}</h3>
      <p style={desc}>{macro.desc}</p>
      <div style={meta}>
        <span>{macro.duration}</span>
        <span>{macro.frequency}</span>
      </div>
      <LoadMeters macro={macro} />
      <div style={tag}>"{macro.family} · {focusTag(macro)}"</div>
      <div style={best}><b style={{ color: "var(--wl-text)" }}>Nivel</b> <span style={{ color: "var(--wl-accent)" }}>{levelLabel(macro.level)}</span></div>
    </button>
  );
}
