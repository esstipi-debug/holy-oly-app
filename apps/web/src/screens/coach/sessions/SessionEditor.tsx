import { useState, type CSSProperties } from "react";
import { getMovement, PrescribedExercisesSchema, type PrescribedExercise, type PrescribedExerciseView, type RM } from "@holy-oly/core";
import { BottomSheet } from "../../../ui/BottomSheet";
import { MovementPicker } from "./MovementPicker";
import { SubstituteSheet } from "../../../ui/SubstituteSheet";
import { ComplexAnalysis } from "./ComplexAnalysis";

interface Draft { movementId: string; movementName: string; sets: number; reps: number; pct?: number; kgOverride?: number; }

const num: CSSProperties = {
  width: 52, boxSizing: "border-box", padding: "6px 8px", borderRadius: 8, textAlign: "center",
  border: "1px solid color-mix(in srgb,var(--wl-text) 16%,transparent)", background: "var(--wl-bg)", color: "var(--wl-text)",
  fontFamily: "var(--wl-display)", fontSize: 14,
};
const mini: CSSProperties = {
  border: 0, background: "transparent", color: "var(--wl-muted)", cursor: "pointer", fontFamily: "var(--mono)", fontSize: 13, padding: 4,
};

function toDraft(id: string): Draft {
  const mv = getMovement(id);
  const usesPct = !!mv && mv.rmRef !== "none";
  return { movementId: id, movementName: mv?.name ?? id, sets: 3, reps: 3, ...(usesPct ? { pct: 70 } : {}) };
}

function swapMovement(d: Draft, id: string): Draft {
  const mv = getMovement(id);
  const usesPct = !!mv && mv.rmRef !== "none";
  return {
    ...d,
    movementId: id,
    movementName: mv?.name ?? id,
    kgOverride: undefined,
    pct: usesPct ? (d.pct ?? 70) : undefined,
  };
}

export function SessionEditor({ open, week, sessionIdx, exercises, rms, onClose, onSave }: {
  open: boolean; week: number; sessionIdx: number; exercises: PrescribedExerciseView[]; rms?: RM;
  onClose: () => void; onSave: (exercises: PrescribedExercise[]) => Promise<void> | void;
}) {
  const [rows, setRows] = useState<Draft[]>(() =>
    exercises.map((e) => ({ movementId: e.movementId, movementName: e.movementName, sets: e.sets, reps: e.reps, pct: e.pct, kgOverride: e.kgOverride })));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [subFor, setSubFor] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patch = (i: number, p: Partial<Draft>): void => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...p } : r)));
  const remove = (i: number): void => setRows((rs) => rs.filter((_, idx) => idx !== i));
  const move = (i: number, d: -1 | 1): void => setRows((rs) => {
    const j = i + d; if (j < 0 || j >= rs.length) return rs;
    const next = [...rs]; [next[i], next[j]] = [next[j]!, next[i]!]; return next;
  });

  async function save(): Promise<void> {
    const exercises = rows.map((r) => ({ movementId: r.movementId, sets: r.sets, reps: r.reps, pct: r.pct, kgOverride: r.kgOverride }));
    const parsed = PrescribedExercisesSchema.safeParse(exercises);
    if (!parsed.success) { setError("Revisá los valores: sets y reps ≥ 1, % entre 1–120."); return; }
    setBusy(true); setError(null);
    try {
      await onSave(parsed.data);
      onClose();
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar"); }
    finally { setBusy(false); }
  }

  return (
    <BottomSheet open={open} onClose={onClose} ariaLabel="Editar sesión">
      <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 18, color: "var(--wl-text)" }}>Sesión · sem {week} · día {sessionIdx + 1}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
        {rows.map((r, i) => (
          <div key={i} style={{ background: "var(--wl-surface)", borderRadius: 10, padding: "8px 10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ flex: 1, fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 14, color: "var(--wl-text)" }}>{r.movementName}</span>
              <button type="button" style={mini} aria-label={`cambiar ${r.movementName}`} onClick={() => setSubFor(i)}>⇄</button>
              <button type="button" style={mini} aria-label={`subir ${r.movementName}`} onClick={() => move(i, -1)}>↑</button>
              <button type="button" style={mini} aria-label={`bajar ${r.movementName}`} onClick={() => move(i, 1)}>↓</button>
              <button type="button" style={{ ...mini, color: "var(--wl-danger)" }} aria-label={`Quitar ${r.movementName}`} onClick={() => remove(i)}>✕</button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)" }}>
              <input style={num} type="number" min={1} aria-label={`sets de ${r.movementName}`} value={r.sets} onChange={(e) => patch(i, { sets: Number(e.target.value) })} />×
              <input style={num} type="number" min={1} aria-label={`reps de ${r.movementName}`} value={r.reps} onChange={(e) => patch(i, { reps: Number(e.target.value) })} />
              {r.pct != null && <>@<input style={num} type="number" aria-label={`% de ${r.movementName}`} value={r.pct} onChange={(e) => patch(i, { pct: Number(e.target.value) })} />%</>}
              <input style={{ ...num, width: 64 }} type="number" placeholder="kg" aria-label={`kg de ${r.movementName}`} value={r.kgOverride ?? ""} onChange={(e) => patch(i, { kgOverride: e.target.value ? Number(e.target.value) : undefined })} />
            </div>
            <ComplexAnalysis movementId={r.movementId} rms={rms} />
          </div>
        ))}
      </div>
      <button type="button" onClick={() => setPickerOpen(true)}
        style={{ width: "100%", marginTop: 10, padding: 10, borderRadius: 10, border: "1px dashed color-mix(in srgb,var(--wl-text) 24%,transparent)", background: "transparent", color: "var(--wl-muted)", fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>+ Agregar ejercicio</button>
      {error && <div role="alert" style={{ marginTop: 8, color: "var(--wl-danger)", fontFamily: "var(--mono)", fontSize: 11 }}>{error}</div>}
      <button type="button" disabled={busy} onClick={() => void save()}
        style={{ width: "100%", marginTop: 12, padding: 13, borderRadius: 12, border: 0, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1, background: "var(--wl-accent)", color: "var(--wl-bg)", fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 15 }}>
        {busy ? "Guardando…" : "Guardar sesión"}
      </button>
      <MovementPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onPick={(id) => setRows((rs) => [...rs, toDraft(id)])} />
      {subFor !== null && rows[subFor] && (
        <SubstituteSheet
          open
          movementId={rows[subFor]!.movementId}
          onClose={() => setSubFor(null)}
          onPick={(id) => setRows((rs) => rs.map((r, j) => (j === subFor ? swapMovement(r, id) : r)))}
        />
      )}
    </BottomSheet>
  );
}
