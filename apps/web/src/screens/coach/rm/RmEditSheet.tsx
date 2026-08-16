import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { PrCandidate, RM, RmLift } from "@holy-oly/core";
import { RM_LIFTS } from "@holy-oly/core";
import { BottomSheet } from "../../../ui/BottomSheet";
import { isoDateLabel } from "../../../ui/charts/planDates";
import { useMovementName } from "../../../i18n/useMovementLang";

/** Etiquetas de los 4 RM de la casa (ns coach). Hook para que sigan el idioma activo; lo reusan
 *  RmSection, PrilepinSection y ComplexAnalysis (centraliza lo que antes era el const RM_LABELS). */
export function useRmLabels(): Record<RmLift, string> {
  const { t } = useTranslation("coach");
  return {
    arranque: t("rmLiftArranque"),
    envion: t("rmLiftEnvion"),
    sentadilla: t("rmLiftSentadilla"),
    frente: t("rmLiftFrente"),
  };
}

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
  const { t } = useTranslation(["coach", "common"]);
  const mn = useMovementName();
  const RM_LABELS = useRmLabels();
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
    <BottomSheet open onClose={onClose} ariaLabel={mode.kind === "pr" ? t("rmSheetConfirmAria") : t("rmEditRms")}>
      <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 16 }}>
        {mode.kind === "pr" ? t("rmSheetTitle") : t("rmEditRms")}
      </div>
      {mode.kind === "pr" && (
        <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)", marginTop: 6 }}>
          {mn(mode.candidate.movementId)} · {t("rmLifted", { kg: mode.candidate.kg, when: mode.candidate.doneAt ? isoDateLabel(mode.candidate.doneAt) : t("compWeekLabel", { week: mode.candidate.week }) })}
          <br />{t("rmFinalNote")}
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
          {t("rmSaveError")}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button type="button" onClick={onClose}
          style={{ flex: 1, minHeight: 44, borderRadius: 10, border: "1px solid color-mix(in srgb,var(--wl-text) 15%,transparent)", background: "transparent", color: "var(--wl-text)", fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          {t("common:cancel")}
        </button>
        <button type="button" disabled={!canSave} onClick={() => void submit()}
          style={{ flex: 1, minHeight: 44, borderRadius: 10, border: 0, background: canSave ? "var(--wl-accent)" : "color-mix(in srgb,var(--wl-text) 12%,transparent)", color: canSave ? "var(--wl-bg)" : "var(--wl-muted)", fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 13, cursor: canSave ? "pointer" : "default" }}>
          {saving ? t("common:saving") : t("common:save")}
        </button>
      </div>
    </BottomSheet>
  );
}
