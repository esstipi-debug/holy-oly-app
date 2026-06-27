import { useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import type { Atleta, Macrocycle, Plan } from "@holy-oly/core";
import { availableWeeksToComp, mondayOf } from "@holy-oly/core";
import { BottomSheet } from "../../../ui/BottomSheet";
import { RetryButton } from "../../../ui/RetryButton";
import { SegmentedToggle } from "../../../ui/SegmentedToggle";

const label: CSSProperties = {
  fontFamily: "var(--mono)", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase",
  color: "var(--wl-muted)", marginTop: 14, display: "block",
};
const input: CSSProperties = {
  width: "100%", boxSizing: "border-box", marginTop: 6, padding: "10px 12px", borderRadius: 10,
  border: "1px solid color-mix(in srgb,var(--wl-text) 16%,transparent)", background: "var(--wl-surface)",
  color: "var(--wl-text)", fontFamily: "var(--wl-display)", fontSize: 15,
};
const strong: CSSProperties = { color: "var(--wl-text)", fontWeight: 700 };

const RM_FIELDS = [
  { key: "arranque", labelKey: "rmLiftArranque" },
  { key: "envion", labelKey: "rmLiftEnvion" },
  { key: "sentadilla", labelKey: "rmLiftSentadilla" },
  { key: "frente", labelKey: "rmLiftFrente" },
] as const;
type RmKey = (typeof RM_FIELDS)[number]["key"];
type RmDraft = Record<RmKey, string>;

const EMPTY_RMS: RmDraft = { arranque: "", envion: "", sentadilla: "", frente: "" };
const validKg = (s: string): boolean => { const n = Number(s); return Number.isFinite(n) && n > 0 && n <= 500; };

const todayISO = (): string => new Date().toISOString().slice(0, 10);

/** La competencia que la asignación por-compe crea junto al plan. */
export interface AssignComp { name: string; date: string; week: number }

/**
 * Coach asigna este macro a un atleta. Ancla por COMPETENCIA (default — el coach cuenta hacia
 * atrás: el pico del macro cae en la semana de la compe; si no alcanza completo, se entra en la
 * semana X salteando acumulación) o por fecha de inicio (hacia adelante, el modo clásico).
 */
export function AssignSheet({
  open, onClose, macro, athletes, onAssign, today = todayISO(), rosterError = false, onRetryRoster, preselectAtletaId,
}: {
  open: boolean;
  onClose: () => void;
  macro: Macrocycle;
  athletes: Atleta[];
  onAssign: (plan: Plan, comp?: AssignComp) => Promise<void>;
  /** Inyectable para tests deterministas; default = hoy real. */
  today?: string;
  /** D5: el dueño no pudo cargar el roster → mostrar error + retry, jamás "sin atletas". */
  rosterError?: boolean;
  onRetryRoster?: () => void;
  /** Atleta del que vino el coach (drill-down → "Asignar macro"): arranca pre-seleccionado para no
   *  re-elegirlo de la lista (y no asignarle a otro por error). El coach puede cambiarlo igual. */
  preselectAtletaId?: string;
}) {
  const { t } = useTranslation(["macros", "coach", "common"]);
  const [mode, setMode] = useState<"competencia" | "inicio">("competencia");
  const [atletaId, setAtletaId] = useState<string | null>(preselectAtletaId ?? null);
  const [startDate, setStartDate] = useState(today);
  const [compName, setCompName] = useState("");
  const [compDate, setCompDate] = useState("");
  const [rms, setRms] = useState<RmDraft>(EMPTY_RMS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAllAthletes, setShowAllAthletes] = useState(false);

  // Vino desde un atleta (drill-down → "Asignar macro"): se muestra SOLO ese, no el plantel entero
  // (con un "cambiar" por si el coach se equivocó de atleta). Sin preselect → la lista completa.
  const preselected = preselectAtletaId ? athletes.find((a) => a.id === preselectAtletaId) : undefined;
  const visibleAthletes = preselected && !showAllAthletes ? [preselected] : athletes;

  // Anclaje ADAPTATIVO: el plan arranca HOY (lunes) y la escuela se comprime/expande para que el pico
  // caiga en la fecha. Semanas disponibles = de hoy a la compe (core.availableWeeksToComp). El motor
  // (buildAdaptivePlan en el backend) reescala el phaseProfile propio de la escuela a estas semanas.
  const planStartMonday = mondayOf(today);
  const compPast = compDate !== "" && compDate < today;
  const availWeeks = mode === "competencia" && compDate !== "" && !compPast ? availableWeeksToComp(planStartMonday, compDate) : 0;

  const rmsValid = RM_FIELDS.every((f) => validKg(rms[f.key]));
  const compReady = compName.trim().length > 0 && compDate !== "" && !compPast;
  const canSubmit = atletaId != null && rmsValid && !busy && (mode === "inicio" || compReady);

  async function submit(): Promise<void> {
    if (!atletaId || (mode === "competencia" && !compReady)) return;
    setError(null);
    setBusy(true);
    try {
      const planStart = mode === "competencia" ? planStartMonday : startDate;
      await onAssign(
        {
          atletaId, macroId: macro.id, startWeek: 1, startDate: planStart,
          rms: { arranque: Number(rms.arranque), envion: Number(rms.envion), sentadilla: Number(rms.sentadilla), frente: Number(rms.frente) },
          comps: [],
        },
        mode === "competencia" ? { name: compName.trim(), date: compDate, week: availWeeks } : undefined,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : t("asAssignError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} ariaLabel={t("asAssignPlan")}>
      <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 18, color: "var(--wl-text)" }}>{t("asTitle", { name: macro.name })}</div>

      <label style={label}>{t("asAthlete")}</label>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
        {rosterError ? (
          <div role="alert" style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-danger)" }}>
            {t("asRosterError")}{" "}
            {onRetryRoster && (
              <RetryButton onClick={onRetryRoster} />
            )}
          </div>
        ) : athletes.length === 0 ? (
          <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)" }}>{t("asNoAthletes")}</div>
        ) : (
          <>
            {visibleAthletes.map((a) => {
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
            })}
            {/* Vino desde un atleta → se ve sólo ese; "cambiar" revela el plantel por si se equivocó. */}
            {preselected && !showAllAthletes && athletes.length > 1 && (
              <button type="button" onClick={() => setShowAllAthletes(true)}
                style={{ textAlign: "left", padding: "4px 2px", border: 0, background: "transparent",
                  color: "var(--wl-accent)", fontFamily: "var(--mono)", fontSize: 11, cursor: "pointer" }}>
                {t("asChangeAthlete")}
              </button>
            )}
          </>
        )}
      </div>

      <label style={label}>{t("asAnchorBy")}</label>
      <SegmentedToggle
        ariaLabel={t("asAnchorBy")}
        options={[["competencia", t("asCompLabel")], ["inicio", t("asStartDate")]] as const}
        value={mode}
        onChange={setMode}
        size="sm"
        style={{ marginTop: 6 }}
      />

      {mode === "competencia" ? (
        <>
          <label style={label} htmlFor="assign-comp-name">{t("asCompLabel")}</label>
          <input id="assign-comp-name" aria-label={t("asCompNameAria")} placeholder={t("asCompPlaceholder")}
            style={input} value={compName} onChange={(e) => setCompName(e.target.value)} />
          <label style={label} htmlFor="assign-comp-date">{t("asCompDate")}</label>
          <input id="assign-comp-date" type="date" aria-label={t("asCompDate")} style={input}
            value={compDate} onChange={(e) => setCompDate(e.target.value)} />

          {compDate !== "" && (
            <div role="status" style={{
              marginTop: 10, padding: "9px 11px", borderRadius: 10, background: "var(--wl-surface)",
              border: "1px solid color-mix(in srgb,var(--wl-text) 10%,transparent)",
              fontFamily: "var(--mono)", fontSize: 10.5, lineHeight: 1.6,
              color: compPast ? "var(--wl-danger)" : "var(--wl-muted)",
            }}>
              {compPast ? (
                <>{t("asDatePast")}</>
              ) : (
                <>{t("asStartMondayPre")} <b style={strong}>{planStartMonday}</b> · <b style={strong}>{t("asWeeksToComp", { weeks: availWeeks })}</b> · {t("asAdjustNote")}</>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <label style={label} htmlFor="assign-date">{t("asStartDate")}</label>
          <input id="assign-date" type="date" aria-label={t("asStartDate")} style={input} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </>
      )}

      <label style={label}>{t("asRmsLabel")}</label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 6 }}>
        {RM_FIELDS.map((f) => {
          const fieldLabel = t(`coach:${f.labelKey}`);
          return (
            <div key={f.key}>
              <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--wl-muted)", marginBottom: 3 }}>{fieldLabel}</div>
              <input type="number" inputMode="numeric" aria-label={fieldLabel} style={{ ...input, marginTop: 0 }}
                value={rms[f.key]} onChange={(e) => setRms((r) => ({ ...r, [f.key]: e.target.value }))} />
            </div>
          );
        })}
      </div>

      {error && <div role="alert" style={{ marginTop: 10, color: "var(--wl-danger)", fontFamily: "var(--mono)", fontSize: 11 }}>{error}</div>}

      <button type="button" disabled={!canSubmit} onClick={() => void submit()}
        style={{ width: "100%", marginTop: 16, padding: 13, borderRadius: 12, border: 0, cursor: canSubmit ? "pointer" : "default",
          background: "var(--wl-accent)", color: "var(--wl-bg)", fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 15, opacity: canSubmit ? 1 : 0.45 }}>
        {busy ? t("asAssigning") : t("asAssignPlan")}
      </button>
      <button type="button" onClick={onClose}
        style={{ width: "100%", marginTop: 8, padding: 10, border: 0, background: "transparent", color: "var(--wl-muted)", fontFamily: "var(--mono)", fontSize: 12, cursor: "pointer" }}>
        {t("common:cancel")}
      </button>
    </BottomSheet>
  );
}
