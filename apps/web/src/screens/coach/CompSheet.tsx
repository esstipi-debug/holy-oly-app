import { useState, type CSSProperties } from "react";
import type { Competencia } from "@holy-oly/core";
import { BottomSheet } from "../../ui/BottomSheet";

const input: CSSProperties = {
  width: "100%", boxSizing: "border-box", marginTop: 6, padding: "10px 12px", borderRadius: 10,
  border: "1px solid color-mix(in srgb,var(--wl-text) 16%,transparent)", background: "var(--wl-surface)",
  color: "var(--wl-text)", fontFamily: "var(--wl-display)", fontSize: 15,
};
const label: CSSProperties = {
  fontFamily: "var(--mono)", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase",
  color: "var(--wl-muted)", marginTop: 12, display: "block",
};

/** Coach assigns/removes the athlete's target competitions; writes reshape the macro timeline. */
export function CompSheet({
  open, onClose, comps, maxWeek, onAdd, onRemove,
}: {
  open: boolean;
  onClose: () => void;
  comps: Competencia[];
  maxWeek: number;
  onAdd: (name: string, week: number) => Promise<void>;
  onRemove: (index: number) => Promise<void>;
}) {
  const nextName = `COMP ${String.fromCharCode(65 + comps.length)}`;
  const [name, setName] = useState("");
  const [week, setWeek] = useState(maxWeek);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<void>): Promise<void> {
    setError(null);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  }

  const sorted = comps.map((c, i) => ({ c, i })).sort((a, b) => a.c.week - b.c.week);

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 18, color: "var(--wl-text)" }}>Competencias del atleta</div>

      <label style={label}>Asignadas</label>
      {sorted.length === 0 ? (
        <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)", marginTop: 6 }}>Sin competencias asignadas.</div>
      ) : (
        sorted.map(({ c, i }) => (
          <div key={`${c.week}-${c.name}-${i}`} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderTop: "1px solid color-mix(in srgb,var(--wl-text) 6%,transparent)" }}>
            <span style={{ flex: 1, fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 13, color: "var(--wl-text)" }}>🚩 {c.name} · sem {c.week}</span>
            <button type="button" aria-label="quitar" disabled={busy} onClick={() => void run(() => onRemove(i))}
              style={{ width: 26, height: 26, borderRadius: 8, border: "1px solid color-mix(in srgb,var(--wl-text) 16%,transparent)", background: "transparent", color: "var(--wl-muted)", cursor: busy ? "default" : "pointer" }}>✕</button>
          </div>
        ))
      )}

      <label style={label}>Agregar competencia</label>
      <input style={input} value={name} onChange={(e) => setName(e.target.value)} placeholder={nextName} />

      <div style={{ display: "flex", gap: 6, overflowX: "auto", marginTop: 8, paddingBottom: 4 }}>
        {Array.from({ length: maxWeek }, (_, k) => k + 1).map((w) => (
          <button key={w} type="button" onClick={() => setWeek(w)}
            style={{ flex: "0 0 auto", padding: "6px 10px", borderRadius: 8, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "var(--mono)", fontSize: 11,
              border: `1px solid ${week === w ? "var(--wl-accent)" : "color-mix(in srgb,var(--wl-text) 14%,transparent)"}`,
              background: week === w ? "color-mix(in srgb,var(--wl-accent) 16%,transparent)" : "transparent", color: "var(--wl-text)" }}>
            Sem {w}
          </button>
        ))}
      </div>

      {error && <div role="alert" style={{ marginTop: 10, color: "#ff3b46", fontFamily: "var(--mono)", fontSize: 11 }}>{error}</div>}

      <button type="button" disabled={busy} onClick={() => void run(async () => { await onAdd(name || nextName, week); setName(""); })}
        style={{ width: "100%", marginTop: 12, padding: 12, borderRadius: 12, border: 0, cursor: busy ? "default" : "pointer",
          background: "var(--wl-accent)", color: "var(--wl-bg)", fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 14, opacity: busy ? 0.6 : 1 }}>
        {busy ? "..." : "+ Agregar y reestructurar"}
      </button>
      <div style={{ marginTop: 10, fontFamily: "var(--mono)", fontSize: 10.5, lineHeight: 1.5, color: "var(--wl-muted)" }}>
        <b style={{ color: "var(--wl-text)" }}>Reestructura el macro:</b> la bajada de volumen se <b>adelanta</b> (1 competencia) o se <b>repite</b> (varias) para picar en cada fecha.
      </div>
      <button type="button" onClick={onClose}
        style={{ width: "100%", marginTop: 10, padding: 10, border: 0, background: "transparent", color: "var(--wl-muted)", fontFamily: "var(--mono)", fontSize: 12, cursor: "pointer" }}>
        Listo
      </button>
    </BottomSheet>
  );
}
