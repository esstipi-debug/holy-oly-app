import { useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { getMovement, resolveTargetKg, PrescribedExercisesSchema, type PrescribedExercise, type PrescribedExerciseView, type RM } from "@holy-oly/core";
import { BottomSheet } from "../../../ui/BottomSheet";
import { MovementPicker } from "./MovementPicker";
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
  // Selector unificado: "add" agrega una fila; un número cambia el movimiento de esa fila (cualquiera
  // de la librería). Antes el ⇄ sólo ofrecía sustitutos → no se podía cambiar a cualquier movimiento.
  const [pickerFor, setPickerFor] = useState<number | "add" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation(["coach", "common"]);

  const patch = (i: number, p: Partial<Draft>): void => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...p } : r)));
  const remove = (i: number): void => setRows((rs) => rs.filter((_, idx) => idx !== i));
  const move = (i: number, d: -1 | 1): void => setRows((rs) => {
    const j = i + d; if (j < 0 || j >= rs.length) return rs;
    const next = [...rs]; [next[i], next[j]] = [next[j]!, next[i]!]; return next;
  });

  async function save(): Promise<void> {
    const exercises = rows.map((r) => ({ movementId: r.movementId, sets: r.sets, reps: r.reps, pct: r.pct, kgOverride: r.kgOverride }));
    const parsed = PrescribedExercisesSchema.safeParse(exercises);
    if (!parsed.success) { setError(t("seValidationError")); return; }
    setBusy(true); setError(null);
    try {
      await onSave(parsed.data);
      onClose();
    } catch (e) { setError(e instanceof Error ? e.message : t("common:errorSave")); }
    finally { setBusy(false); }
  }

  return (
    <BottomSheet open={open} onClose={onClose} ariaLabel={t("seAria")}>
      <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 18, color: "var(--wl-text)" }}>{t("seTitle", { week, day: sessionIdx + 1 })}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
        {rows.map((r, i) => {
          // kg en vivo desde el % (override > %×RM, complejo por eslabón débil). Sin RM → no se muestra.
          const ex = { movementId: r.movementId, sets: r.sets, reps: r.reps, pct: r.pct, kgOverride: r.kgOverride };
          const effKg = rms ? resolveTargetKg(ex, rms) : undefined;
          const derivedKg = rms ? resolveTargetKg({ ...ex, kgOverride: undefined }, rms) : undefined;
          return (
            <div key={i} style={{ background: "var(--wl-surface)", borderRadius: 10, padding: "8px 10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ flex: 1, fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 14, color: "var(--wl-text)" }}>{r.movementName}</span>
                <button type="button" style={mini} aria-label={t("seSwap", { name: r.movementName })} onClick={() => setPickerFor(i)}>⇄</button>
                <button type="button" style={mini} aria-label={t("seUp", { name: r.movementName })} onClick={() => move(i, -1)}>↑</button>
                <button type="button" style={mini} aria-label={t("seDown", { name: r.movementName })} onClick={() => move(i, 1)}>↓</button>
                <button type="button" style={{ ...mini, color: "var(--wl-danger)" }} aria-label={t("seRemove", { name: r.movementName })} onClick={() => remove(i)}>✕</button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, flexWrap: "wrap", fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)" }}>
                <input style={num} type="number" min={1} aria-label={t("seSets", { name: r.movementName })} value={r.sets} onChange={(e) => patch(i, { sets: Number(e.target.value) })} />×
                <input style={num} type="number" min={1} aria-label={t("seReps", { name: r.movementName })} value={r.reps} onChange={(e) => patch(i, { reps: Number(e.target.value) })} />
                {r.pct != null && <>@<input style={num} type="number" aria-label={t("sePct", { name: r.movementName })} value={r.pct} onChange={(e) => patch(i, { pct: Number(e.target.value) })} />%</>}
                {/* Peso derivado del % (lo que el atleta carga). "(fijo)" cuando hay override manual. */}
                {r.pct != null && rms && (
                  <span aria-label={t("seWeight", { name: r.movementName })} style={{ fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", color: r.kgOverride != null ? "var(--wl-accent)" : "var(--wl-text)" }}>
                    = {effKg != null ? `${effKg} kg` : "—"}{r.kgOverride != null ? t("seFixed") : ""}
                  </span>
                )}
                <input style={{ ...num, width: 64 }} type="number" placeholder={derivedKg != null ? `${derivedKg}` : "kg"} aria-label={t("seKg", { name: r.movementName })} value={r.kgOverride ?? ""} onChange={(e) => patch(i, { kgOverride: e.target.value ? Number(e.target.value) : undefined })} />
              </div>
              <ComplexAnalysis movementId={r.movementId} rms={rms} />
            </div>
          );
        })}
      </div>
      <button type="button" onClick={() => setPickerFor("add")}
        style={{ width: "100%", marginTop: 10, padding: 10, borderRadius: 10, border: "1px dashed color-mix(in srgb,var(--wl-text) 24%,transparent)", background: "transparent", color: "var(--wl-muted)", fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{t("seAddExercise")}</button>
      {error && <div role="alert" style={{ marginTop: 8, color: "var(--wl-danger)", fontFamily: "var(--mono)", fontSize: 11 }}>{error}</div>}
      <button type="button" disabled={busy} onClick={() => void save()}
        style={{ width: "100%", marginTop: 12, padding: 13, borderRadius: 12, border: 0, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1, background: "var(--wl-accent)", color: "var(--wl-bg)", fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 15 }}>
        {busy ? t("common:saving") : t("seSave")}
      </button>
      {/* Un solo selector para AGREGAR y para CAMBIAR (cualquier movimiento de la librería). */}
      <MovementPicker
        open={pickerFor !== null}
        onClose={() => setPickerFor(null)}
        onPick={(id) => setRows((rs) => (pickerFor === "add" ? [...rs, toDraft(id)] : rs.map((r, j) => (j === pickerFor ? swapMovement(r, id) : r))))}
      />
    </BottomSheet>
  );
}
