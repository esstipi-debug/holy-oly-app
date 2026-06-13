import type { CSSProperties } from "react";
import type { SetRow } from "./WorkSetsSection";

function chipStyle(done: boolean): CSSProperties {
  return {
    fontFamily: "var(--mono)", cursor: "pointer", minWidth: 56, minHeight: 46, borderRadius: 12, border: 0, padding: "4px 9px",
    background: done ? "color-mix(in srgb, var(--wl-accent) 16%, transparent)" : "color-mix(in srgb, var(--wl-text) 5%, transparent)",
    boxShadow: done ? "inset 0 0 0 1px color-mix(in srgb, var(--wl-accent) 55%, transparent)" : "inset 0 0 0 1px color-mix(in srgb, var(--wl-text) 10%, transparent)",
    color: done ? "var(--wl-accent)" : "var(--wl-muted)",
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
  };
}

/**
 * Series como chips tocables — la interacción central de la dirección «Pulse» del handoff, sobre
 * nuestros tokens (acento, jamás los colores del prototipo). Tap = marcar/desmarcar la serie. Las
 * series nacen hechas al target (adherencia por defecto); editar kg/reps vive aparte en «ajustar».
 */
export function SetChips({ series, onToggle }: { series: SetRow[]; onToggle: (i: number) => void }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 8 }}>
      {series.map((s, i) => (
        <button key={i} type="button" aria-pressed={s.done}
          aria-label={`serie ${i + 1} · ${s.done ? "hecha" : "no hecha"}`}
          onClick={() => onToggle(i)} style={chipStyle(s.done)}>
          <span style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.1 }}>{s.kg != null ? s.kg : "—"}<span style={{ fontSize: 9 }}> kg</span></span>
          <span style={{ fontSize: 9, opacity: 0.85 }}>× {s.reps ?? "—"}</span>
        </button>
      ))}
    </div>
  );
}
