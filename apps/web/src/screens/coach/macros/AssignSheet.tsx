import { useState, type CSSProperties } from "react";
import type { Atleta, Macrocycle, Plan } from "@holy-oly/core";
import { anchorPlanToComp } from "@holy-oly/core";
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
  const [mode, setMode] = useState<"competencia" | "inicio">("competencia");
  const [atletaId, setAtletaId] = useState<string | null>(preselectAtletaId ?? null);
  const [startDate, setStartDate] = useState(today);
  const [compName, setCompName] = useState("");
  const [compDate, setCompDate] = useState("");
  const [rms, setRms] = useState<RmDraft>(EMPTY_RMS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalWeeks = macro.phaseProfile[macro.phaseProfile.length - 1]?.weeks[1] ?? 0;
  // La compe se cuadra con el PICO del macro; sin pico declarado, con la última semana.
  const anchorWeek = macro.peaks && macro.peakWeek != null ? macro.peakWeek : totalWeeks;
  const anchor = mode === "competencia" && compDate !== "" && totalWeeks > 0
    ? anchorPlanToComp(compDate, anchorWeek, totalWeeks, today)
    : null;

  const rmsValid = RM_FIELDS.every((f) => validKg(rms[f.key]));
  const compReady = compName.trim().length > 0 && anchor !== null && anchor.status !== "pasada";
  const canSubmit = atletaId != null && rmsValid && !busy && (mode === "inicio" || compReady);

  async function submit(): Promise<void> {
    if (!atletaId || (mode === "competencia" && anchor === null)) return;
    setError(null);
    setBusy(true);
    try {
      const planStart = mode === "competencia" ? anchor!.startDate : startDate;
      await onAssign(
        {
          atletaId, macroId: macro.id, startWeek: 1, startDate: planStart,
          rms: { arranque: Number(rms.arranque), envion: Number(rms.envion), sentadilla: Number(rms.sentadilla), frente: Number(rms.frente) },
          comps: [],
        },
        mode === "competencia" ? { name: compName.trim(), date: compDate, week: anchorWeek } : undefined,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo asignar");
    } finally {
      setBusy(false);
    }
  }

  const picoLabel = anchorWeek !== totalWeeks ? ` (pico del macro)` : "";

  return (
    <BottomSheet open={open} onClose={onClose} ariaLabel="Asignar plan">
      <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 18, color: "var(--wl-text)" }}>Asignar {macro.name}</div>

      <label style={label}>Atleta</label>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
        {rosterError ? (
          <div role="alert" style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-danger)" }}>
            No se pudo cargar tu plantel.{" "}
            {onRetryRoster && (
              <RetryButton onClick={onRetryRoster} />
            )}
          </div>
        ) : athletes.length === 0 ? (
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

      <label style={label}>Anclar por</label>
      <SegmentedToggle
        ariaLabel="Anclar por"
        options={[["competencia", "Competencia"], ["inicio", "Fecha de inicio"]] as const}
        value={mode}
        onChange={setMode}
        size="sm"
        style={{ marginTop: 6 }}
      />

      {mode === "competencia" ? (
        <>
          <label style={label} htmlFor="assign-comp-name">Competencia</label>
          <input id="assign-comp-name" aria-label="Nombre de la competencia" placeholder="Nacional, Sudamericano…"
            style={input} value={compName} onChange={(e) => setCompName(e.target.value)} />
          <label style={label} htmlFor="assign-comp-date">Fecha de la competencia</label>
          <input id="assign-comp-date" type="date" aria-label="Fecha de la competencia" style={input}
            value={compDate} onChange={(e) => setCompDate(e.target.value)} />

          {anchor && (
            <div role="status" style={{
              marginTop: 10, padding: "9px 11px", borderRadius: 10, background: "var(--wl-surface)",
              border: "1px solid color-mix(in srgb,var(--wl-text) 10%,transparent)",
              fontFamily: "var(--mono)", fontSize: 10.5, lineHeight: 1.6,
              color: anchor.status === "pasada" ? "var(--wl-danger)" : "var(--wl-muted)",
            }}>
              {anchor.status === "pasada" && <>Esa fecha ya pasó — elegí una futura.</>}
              {anchor.status === "completo" && (
                <>Arranca el lunes <b style={strong}>{anchor.startDate}</b> · macro completo · la compe cae en la <b style={strong}>semana {anchorWeek}</b>{picoLabel}.</>
              )}
              {anchor.status === "recortado" && (
                <>No alcanza el macro completo: hoy = <b style={strong}>semana {anchor.entryWeek}</b> de {totalWeeks} → entrás con <b style={strong}>{anchorWeek - anchor.entryWeek + 1} semana{anchorWeek - anchor.entryWeek + 1 === 1 ? "" : "s"}</b> hasta la compe (semana {anchorWeek}{picoLabel}) y te salteás la acumulación 1–{anchor.entryWeek - 1}.</>
              )}
              {anchor.status === "futuro" && (
                <>El plan arranca el lunes <b style={strong}>{anchor.startDate}</b> (en {anchor.daysToStart} días) · la compe cae en la <b style={strong}>semana {anchorWeek}</b>{picoLabel}.</>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <label style={label} htmlFor="assign-date">Fecha de inicio</label>
          <input id="assign-date" type="date" aria-label="Fecha de inicio" style={input} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </>
      )}

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

      {error && <div role="alert" style={{ marginTop: 10, color: "var(--wl-danger)", fontFamily: "var(--mono)", fontSize: 11 }}>{error}</div>}

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
