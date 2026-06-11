import { useEffect, useRef, useState } from "react";
import type { PrCandidate, RM, RmLift } from "@holy-oly/core";
import { RM_LIFTS } from "@holy-oly/core";
import { BottomSheet } from "../../../ui/BottomSheet";
import { isoDateLabel } from "../../../ui/charts/planDates";

export const RM_LABELS: Record<RmLift, string> = {
  arranque: "Arranque", envion: "Envión", sentadilla: "Sentadilla", frente: "Frente",
};

/** "manual": editar 1+ de los 4 · "pr": confirmar un candidato (un solo lift, kg precargado). */
export type RmSheetMode = { kind: "manual" } | { kind: "pr"; candidate: PrCandidate };

type Draft = Record<RmLift, string>;
const toDraft = (rms: RM): Draft => ({
  arranque: String(rms.arranque), envion: String(rms.envion), sentadilla: String(rms.sentadilla), frente: String(rms.frente),
});

const validKg = (s: string): boolean => { const n = Number(s); return Number.isFinite(n) && n > 0 && n <= 500; };

const inputStyle = {
  width: "100%", boxSizing: "border-box" as const, padding: "10px 12px", borderRadius: 10,
  border: "1px solid color-mix(in srgb,var(--wl-text) 18%,transparent)", background: "var(--wl-bg)",
  color: "var(--wl-text)", fontFamily: "var(--mono)", fontSize: 15,
};

/** Sheet de edición de RMs (SP5). El RM lo entra el coach con criterio — acá JAMÁS se
 *  auto-calcula un 1RM por reps (el helper del modo pr lo dice explícito). */
export function RmEditSheet({ open, mode, rms, onClose, onSave }: {
  open: boolean;
  mode: RmSheetMode;
  rms: RM;
  onClose: () => void;
  onSave: (updates: { lift: RmLift; kg: number }[], reason: "manual" | "pr") => Promise<void>;
}) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(rms));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  // Re-armar el borrador SOLO al abrir (false→true). Si `rms` cambia con el sheet abierto
  // (p.ej. un refetch del plan en el padre), NO pisar lo que el coach está tipeando.
  const wasOpen = useRef(false);
  // Ref (no estado) contra el doble-submit: dos clicks en el mismo tick ven `saving=false` ambos.
  const submittingRef = useRef(false);
  useEffect(() => {
    if (!open) { wasOpen.current = false; return; }
    if (wasOpen.current) return;
    wasOpen.current = true;
    const base = toDraft(rms);
    if (mode.kind === "pr") base[mode.candidate.lift] = String(mode.candidate.kg);
    setDraft(base);
    setSaveError(false);
  }, [open, mode, rms]);

  if (!open) return null;
  const lifts: readonly RmLift[] = mode.kind === "pr" ? [mode.candidate.lift] : RM_LIFTS;
  const updates = lifts
    .filter((l) => validKg(draft[l]) && Number(draft[l]) !== rms[l])
    .map((l) => ({ lift: l, kg: Number(draft[l]) }));
  // En modo pr, confirmar sin tocar el valor también vale (reconfirma honesto).
  const prSameKg = mode.kind === "pr" && lifts.every((l) => validKg(draft[l]));
  const canSave = !saving && lifts.every((l) => validKg(draft[l])) && (updates.length > 0 || prSameKg);

  async function submit(): Promise<void> {
    if (submittingRef.current) return;
    submittingRef.current = true;
    const reason = mode.kind === "pr" ? ("pr" as const) : ("manual" as const);
    const toSend = updates.length > 0 ? updates : lifts.map((l) => ({ lift: l, kg: Number(draft[l]) }));
    setSaving(true);
    setSaveError(false);
    try {
      await onSave(toSend, reason);
      onClose();
    } catch {
      setSaveError(true);
    } finally {
      submittingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <BottomSheet open onClose={onClose} ariaLabel={mode.kind === "pr" ? "Confirmar PR" : "Editar RMs"}>
      <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 16 }}>
        {mode.kind === "pr" ? "Confirmar PR → subir RM" : "Editar RMs"}
      </div>
      {mode.kind === "pr" && (
        <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)", marginTop: 6 }}>
          {mode.candidate.movementName} · levantó {mode.candidate.kg} kg · {mode.candidate.doneAt ? isoDateLabel(mode.candidate.doneAt) : `sem ${mode.candidate.week}`}
          <br />El RM final lo ponés vos (si lo hizo por reps, el 1RM es más).
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: mode.kind === "pr" ? "1fr" : "1fr 1fr", gap: 10, marginTop: 12 }}>
        {lifts.map((l) => (
          <label key={l} style={{ display: "grid", gap: 4, fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-muted)" }}>
            {RM_LABELS[l]}
            <input
              inputMode="decimal"
              aria-invalid={!validKg(draft[l])}
              value={draft[l]}
              onChange={(e) => setDraft((d) => ({ ...d, [l]: e.target.value }))}
              style={inputStyle}
            />
          </label>
        ))}
      </div>
      {saveError && (
        <div role="alert" style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--wl-danger)", marginTop: 10 }}>
          No se pudo guardar. Reintentá.
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button type="button" onClick={onClose}
          style={{ flex: 1, minHeight: 44, borderRadius: 10, border: "1px solid color-mix(in srgb,var(--wl-text) 15%,transparent)", background: "transparent", color: "var(--wl-text)", fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          Cancelar
        </button>
        <button type="button" disabled={!canSave} onClick={() => void submit()}
          style={{ flex: 1, minHeight: 44, borderRadius: 10, border: 0, background: canSave ? "var(--wl-accent)" : "color-mix(in srgb,var(--wl-text) 12%,transparent)", color: canSave ? "var(--wl-bg)" : "var(--wl-muted)", fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 13, cursor: canSave ? "pointer" : "default" }}>
          {saving ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </BottomSheet>
  );
}
