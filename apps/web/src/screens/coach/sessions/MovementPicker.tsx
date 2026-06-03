import { useState, type CSSProperties } from "react";
import { searchMovements, MOVEMENTS } from "@holy-oly/core";
import { BottomSheet } from "../../../ui/BottomSheet";

const item: CSSProperties = {
  display: "block", width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: 10, marginTop: 6,
  border: "1px solid color-mix(in srgb,var(--wl-text) 12%,transparent)", background: "var(--wl-surface)",
  color: "var(--wl-text)", fontFamily: "var(--wl-display)", fontWeight: 600, fontSize: 14, cursor: "pointer",
};

/** SP1-powered movement selector. Empty query → the canonical lifts; otherwise bilingual search. */
export function MovementPicker({ open, onClose, onPick }: {
  open: boolean; onClose: () => void; onPick: (movementId: string) => void;
}) {
  const [q, setQ] = useState("");
  const results = q.trim() ? searchMovements(q).slice(0, 30) : MOVEMENTS.filter((m) => m.id === m.baseId).slice(0, 30);
  return (
    <BottomSheet open={open} onClose={onClose}>
      <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 18, color: "var(--wl-text)" }}>Elegí un movimiento</div>
      <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar movimiento…"
        aria-label="Buscar movimiento"
        style={{ width: "100%", boxSizing: "border-box", marginTop: 10, padding: "10px 12px", borderRadius: 10,
          border: "1px solid color-mix(in srgb,var(--wl-text) 16%,transparent)", background: "var(--wl-bg)", color: "var(--wl-text)",
          fontFamily: "var(--wl-display)", fontSize: 15 }} />
      <div style={{ marginTop: 8, maxHeight: 360, overflowY: "auto" }}>
        {results.map((m) => (
          <button key={m.id} type="button" style={item} onClick={() => { onPick(m.id); onClose(); }}>{m.name}</button>
        ))}
        {results.length === 0 && <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)", marginTop: 10 }}>Sin resultados.</div>}
        {q.trim() && results.length >= 30 && (
          <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)", marginTop: 10 }}>Mostrando 30 — refiná la búsqueda para ver más.</div>
        )}
      </div>
    </BottomSheet>
  );
}
