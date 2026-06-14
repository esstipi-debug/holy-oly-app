import { useState, type CSSProperties } from "react";
import type { CompetitionInput } from "@holy-oly/core";
import { BottomSheet } from "../../../ui/BottomSheet";

const input: CSSProperties = {
  width: "100%", boxSizing: "border-box", marginTop: 6, padding: "10px 12px", borderRadius: 10,
  border: "1px solid color-mix(in srgb,var(--wl-text) 16%,transparent)", background: "var(--wl-surface)",
  color: "var(--wl-text)", fontFamily: "var(--wl-display)", fontSize: 15,
};
const label: CSSProperties = {
  fontFamily: "var(--mono)", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase",
  color: "var(--wl-muted)", marginTop: 12, display: "block",
};

/** Crear/editar una competencia (slice 2026-06-14). `initial` presente ⇒ modo edición. El padre
 *  lo monta sólo cuando abre (key/condicional) para que el estado arranque fresco. */
export function CompetitionFormSheet({ open, onClose, initial, onSubmit }: {
  open: boolean;
  onClose: () => void;
  initial?: CompetitionInput;
  onSubmit: (input: CompetitionInput) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [date, setDate] = useState(initial?.date ?? "");
  const [place, setPlace] = useState(initial?.place ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = name.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(date);

  async function save(): Promise<void> {
    if (!canSave) { setError("Poné un nombre y una fecha."); return; }
    setError(null); setBusy(true);
    try {
      await onSubmit({ name: name.trim(), date, place: place.trim() || undefined });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} ariaLabel={initial ? "Editar competencia" : "Nueva competencia"}>
      <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 18, color: "var(--wl-text)" }}>
        {initial ? "Editar competencia" : "Nueva competencia"}
      </div>

      <label style={label} htmlFor="comp-name">Nombre</label>
      <input id="comp-name" style={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nacional Absoluto" />

      <label style={label} htmlFor="comp-date">Fecha</label>
      <input id="comp-date" type="date" aria-label="Fecha de la competencia" style={input} value={date} onChange={(e) => setDate(e.target.value)} />

      <label style={label} htmlFor="comp-place">Lugar (opcional)</label>
      <input id="comp-place" style={input} value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Santiago" />

      {error && <div role="alert" style={{ marginTop: 10, color: "var(--wl-danger)", fontFamily: "var(--mono)", fontSize: 11 }}>{error}</div>}

      <button type="button" disabled={busy || !canSave} onClick={() => void save()}
        style={{ width: "100%", marginTop: 14, padding: 12, borderRadius: 12, border: 0, cursor: busy || !canSave ? "default" : "pointer",
          background: "var(--wl-accent)", color: "var(--wl-bg)", fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 14, opacity: busy || !canSave ? 0.6 : 1 }}>
        {busy ? "..." : initial ? "Guardar cambios" : "Crear competencia"}
      </button>
      <button type="button" onClick={onClose}
        style={{ width: "100%", marginTop: 10, padding: 10, border: 0, background: "transparent", color: "var(--wl-muted)", fontFamily: "var(--mono)", fontSize: 12, cursor: "pointer" }}>
        Cancelar
      </button>
    </BottomSheet>
  );
}
