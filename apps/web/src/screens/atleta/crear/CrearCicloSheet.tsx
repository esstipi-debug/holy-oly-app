import { useState, type CSSProperties } from "react";
import type { Macrocycle } from "@holy-oly/core";
import { MACROCYCLES, availableWeeksToComp, mondayOf } from "@holy-oly/core";
import { BottomSheet } from "../../../ui/BottomSheet";
import { SegmentedToggle } from "../../../ui/SegmentedToggle";
import { meClient as defaultClient, type MeClient } from "../../../data/meClient";

/**
 * Self-coach (atleta autoentrenado): el atleta arma su PROPIO ciclo sin coach. Elige escuela +
 * fecha (competencia o inicio) + sus 4 RMs; al confirmar, `meClient.createMyPlan` instancia el plan
 * y Hoy se enciende solo. Es superficie de INPUT de RM: jamás re-muestra el RM como lectura.
 * Espejo del `AssignSheet` del coach, pero sin selector de atleta (el atleta es "yo").
 */

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

// Catálogo agrupado por escuela (estático — MACROCYCLES es data de compile-time).
const BY_FAMILY: Array<[string, Macrocycle[]]> = (() => {
  const m = new Map<string, Macrocycle[]>();
  for (const mc of MACROCYCLES) { const a = m.get(mc.family) ?? []; a.push(mc); m.set(mc.family, a); }
  return [...m.entries()];
})();

export function CrearCicloSheet({
  open, onClose, onCreated, client = defaultClient, today = todayISO(),
}: {
  open: boolean;
  onClose: () => void;
  /** Tras crear el plan: el caller re-fetchea (getMePlan) para encender Hoy. */
  onCreated: () => void | Promise<void>;
  /** Inyectable para el preview del coach / tests; default = cliente del módulo. */
  client?: MeClient;
  /** Inyectable para tests deterministas; default = hoy real. */
  today?: string;
}) {
  const [macroId, setMacroId] = useState<string | null>(null);
  const [mode, setMode] = useState<"competencia" | "inicio">("competencia");
  const [startDate, setStartDate] = useState(today);
  const [compName, setCompName] = useState("");
  const [compDate, setCompDate] = useState("");
  const [rms, setRms] = useState<RmDraft>(EMPTY_RMS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startMonday = mondayOf(today);
  const compPast = compDate !== "" && compDate < today;
  const availWeeks = mode === "competencia" && compDate !== "" && !compPast ? availableWeeksToComp(startMonday, compDate) : 0;
  const rmsValid = RM_FIELDS.every((f) => validKg(rms[f.key]));
  const compReady = compName.trim().length > 0 && compDate !== "" && !compPast;
  const canSubmit = macroId != null && rmsValid && !busy && (mode === "inicio" || compReady);

  async function submit(): Promise<void> {
    if (!macroId || !rmsValid || (mode === "competencia" && !compReady)) return;
    setError(null);
    setBusy(true);
    try {
      await client.createMyPlan({
        macroId,
        rms: { arranque: Number(rms.arranque), envion: Number(rms.envion), sentadilla: Number(rms.sentadilla), frente: Number(rms.frente) },
        ...(mode === "competencia" ? { comp: { name: compName.trim(), date: compDate } } : { startDate }),
      });
      setRms(EMPTY_RMS); // RM input-only: no dejar el RM tipeado a la vista tras crear.
      await onCreated();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear el ciclo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} ariaLabel="Crear mi ciclo">
      <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 18, color: "var(--wl-text)" }}>Crear mi ciclo</div>
      <p style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)", margin: "6px 0 0", lineHeight: 1.5 }}>
        Elegí la escuela y la fecha; armamos tu macrociclo para que piques a tiempo.
      </p>

      <label style={label}>Escuela</label>
      <div role="radiogroup" aria-label="Escuela" style={{ marginTop: 6, maxHeight: 260, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
        {BY_FAMILY.map(([family, macros]) => (
          <div key={family}>
            <div style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--wl-muted)", margin: "2px 0 4px" }}>{family}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {macros.map((m) => {
                const on = m.id === macroId;
                return (
                  <button key={m.id} type="button" role="radio" aria-checked={on} aria-label={m.name} onClick={() => setMacroId(m.id)}
                    style={{
                      textAlign: "left", padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                      color: "var(--wl-text)", background: on ? "color-mix(in srgb,var(--wl-accent) 14%,transparent)" : "transparent",
                      borderLeft: `3px solid ${m.color}`,
                      border: `1px solid ${on ? "var(--wl-accent)" : "color-mix(in srgb,var(--wl-text) 14%,transparent)"}`,
                      borderLeftWidth: 3, borderLeftColor: m.color,
                    }}>
                    <div style={{ fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 14 }}>{m.name}</div>
                    <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-muted)", marginTop: 2 }}>{m.frequency} · {m.duration}</div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
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
          <label style={label} htmlFor="crear-comp-name">Competencia</label>
          <input id="crear-comp-name" aria-label="Nombre de la competencia" placeholder="Nacional, Sudamericano…"
            style={input} value={compName} onChange={(e) => setCompName(e.target.value)} />
          <label style={label} htmlFor="crear-comp-date">Fecha de la competencia</label>
          <input id="crear-comp-date" type="date" aria-label="Fecha de la competencia" style={input}
            value={compDate} onChange={(e) => setCompDate(e.target.value)} />
          {compDate !== "" && (
            <div role="status" style={{
              marginTop: 10, padding: "9px 11px", borderRadius: 10, background: "var(--wl-surface)",
              border: "1px solid color-mix(in srgb,var(--wl-text) 10%,transparent)",
              fontFamily: "var(--mono)", fontSize: 10.5, lineHeight: 1.6,
              color: compPast ? "var(--wl-danger)" : "var(--wl-muted)",
            }}>
              {compPast ? (
                <>Esa fecha ya pasó — elegí una futura.</>
              ) : (
                <>Arranca el lunes <b style={strong}>{startMonday}</b> · <b style={strong}>{availWeeks} semana{availWeeks === 1 ? "" : "s"}</b> hasta la compe · la escuela se ajusta para picar en la fecha.</>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <label style={label} htmlFor="crear-start-date">Fecha de inicio</label>
          <input id="crear-start-date" type="date" aria-label="Fecha de inicio" style={input} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </>
      )}

      <label style={label}>Tus RMs (kg)</label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 6 }}>
        {RM_FIELDS.map((f) => (
          <div key={f.key}>
            <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--wl-muted)", marginBottom: 3 }}>{f.label}</div>
            <input type="number" inputMode="numeric" aria-label={f.label} style={{ ...input, marginTop: 0 }}
              value={rms[f.key]} onChange={(e) => setRms((r) => ({ ...r, [f.key]: e.target.value }))} />
          </div>
        ))}
      </div>

      <p style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-muted)", margin: "12px 0 0", lineHeight: 1.6 }}>
        Vos elegís y te auto-prescribís la carga. Empezá conservador y ajustá según cómo respondés;
        si entrenás con un coach, vinculate y dejá que él te arme el plan.
      </p>

      {error && <div role="alert" style={{ marginTop: 10, color: "var(--wl-danger)", fontFamily: "var(--mono)", fontSize: 11 }}>{error}</div>}

      <button type="button" disabled={!canSubmit} onClick={() => void submit()}
        style={{ width: "100%", marginTop: 16, padding: 13, borderRadius: 12, border: 0, cursor: canSubmit ? "pointer" : "default",
          background: "var(--wl-accent)", color: "var(--wl-bg)", fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 15, opacity: canSubmit ? 1 : 0.45 }}>
        {busy ? "Creando…" : "Crear ciclo"}
      </button>
      <button type="button" onClick={onClose}
        style={{ width: "100%", marginTop: 8, padding: 10, border: 0, background: "transparent", color: "var(--wl-muted)", fontFamily: "var(--mono)", fontSize: 12, cursor: "pointer" }}>
        Cancelar
      </button>
    </BottomSheet>
  );
}
