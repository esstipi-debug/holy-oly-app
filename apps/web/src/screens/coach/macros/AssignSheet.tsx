import { useState, type CSSProperties } from "react";
import type { Atleta, Macrocycle, Plan } from "@holy-oly/core";
import { BottomSheet } from "../../../ui/BottomSheet";

const label: CSSProperties = {
  fontFamily: "var(--mono)", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase",
  color: "var(--wl-muted)", marginTop: 14, display: "block",
};
const input: CSSProperties = {
  width: "100%", boxSizing: "border-box", marginTop: 6, padding: "10px 12px", borderRadius: 10,
  border: "1px solid color-mix(in srgb,var(--wl-text) 16%,transparent)", background: "var(--wl-surface)",
  color: "var(--wl-text)", fontFamily: "var(--wl-display)", fontSize: 15,
};

const RM_FIELDS = [
  { key: "arranque", label: "Arranque" },
  { key: "envion", label: "Envión" },
  { key: "sentadilla", label: "Sentadilla" },
  { key: "frente", label: "Frente" },
] as const;
type RmKey = (typeof RM_FIELDS)[number]["key"];
type RmDraft = Record<RmKey, string>;

const EMPTY_RMS: RmDraft = { arranque: "", envion: "", sentadilla: "", frente: "" };
const validKg = (s: string): boolean => { const n = Number(s); return Number.isFinite(n) && n > 0 && n <= 500; };

const todayISO = (): string => new Date().toISOString().slice(0, 10);

/** Coach assigns this macrocycle to one of their athletes: pick athlete + start date + RMs → savePlan. */
export function AssignSheet({
  open, onClose, macro, athletes, onAssign,
}: {
  open: boolean;
  onClose: () => void;
  macro: Macrocycle;
  athletes: Atleta[];
  onAssign: (plan: Plan) => Promise<void>;
}) {
  const [atletaId, setAtletaId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(todayISO);
  const [rms, setRms] = useState<RmDraft>(EMPTY_RMS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rmsValid = RM_FIELDS.every((f) => validKg(rms[f.key]));
  const canSubmit = atletaId != null && rmsValid && !busy;

  async function submit(): Promise<void> {
    if (!atletaId) return;
    setError(null);
    setBusy(true);
    try {
      await onAssign({
        atletaId, macroId: macro.id, startWeek: 1, startDate,
        rms: { arranque: Number(rms.arranque), envion: Number(rms.envion), sentadilla: Number(rms.sentadilla), frente: Number(rms.frente) },
        comps: [],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo asignar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 18, color: "var(--wl-text)" }}>Asignar {macro.name}</div>

      <label style={label}>Atleta</label>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
        {athletes.length === 0 ? (
          <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)" }}>No tenés atletas vinculados.</div>
        ) : (
          athletes.map((a) => {
            const on = a.id === atletaId;
            return (
              <button key={a.id} type="button" aria-label={a.nombre} onClick={() => setAtletaId(a.id)}
                style={{
                  textAlign: "left", padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                  fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 14,
                  color: on ? "var(--wl-bg)" : "var(--wl-text)",
                  background: on ? "var(--wl-accent)" : "transparent",
                  border: `1px solid ${on ? "var(--wl-accent)" : "color-mix(in srgb,var(--wl-text) 14%,transparent)"}`,
                }}>
                {a.nombre} <span style={{ fontFamily: "var(--mono)", fontSize: 10, opacity: 0.7 }}>· {a.iniciales}</span>
              </button>
            );
          })
        )}
      </div>

      <label style={label} htmlFor="assign-date">Fecha de inicio</label>
      <input id="assign-date" type="date" aria-label="Fecha de inicio" style={input} value={startDate} onChange={(e) => setStartDate(e.target.value)} />

      <label style={label}>RMs (kg)</label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 6 }}>
        {RM_FIELDS.map((f) => (
          <div key={f.key}>
            <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--wl-muted)", marginBottom: 3 }}>{f.label}</div>
            <input type="number" inputMode="numeric" aria-label={f.label} style={{ ...input, marginTop: 0 }}
              value={rms[f.key]} onChange={(e) => setRms((r) => ({ ...r, [f.key]: e.target.value }))} />
          </div>
        ))}
      </div>

      {error && <div role="alert" style={{ marginTop: 10, color: "#ff3b46", fontFamily: "var(--mono)", fontSize: 11 }}>{error}</div>}

      <button type="button" disabled={!canSubmit} onClick={() => void submit()}
        style={{ width: "100%", marginTop: 16, padding: 13, borderRadius: 12, border: 0, cursor: canSubmit ? "pointer" : "default",
          background: "var(--wl-accent)", color: "var(--wl-bg)", fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 15, opacity: canSubmit ? 1 : 0.45 }}>
        {busy ? "Asignando…" : "Asignar plan"}
      </button>
      <button type="button" onClick={onClose}
        style={{ width: "100%", marginTop: 8, padding: 10, border: 0, background: "transparent", color: "var(--wl-muted)", fontFamily: "var(--mono)", fontSize: 12, cursor: "pointer" }}>
        Cancelar
      </button>
    </BottomSheet>
  );
}
