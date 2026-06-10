import { useCallback, useEffect, useRef, useState } from "react";
import type { CycleData, CycleShare, CycleState } from "@holy-oly/core";
import { CYCLE_LEN_MAX, CYCLE_LEN_MIN, CYCLE_HORIZON_CYCLES } from "@holy-oly/core";
import { meClient, type MeClient } from "../../data/meClient";

const SHARE_OPTS: Array<[CycleShare, string, string]> = [
  ["none", "Nada", "El coach no ve nada del ciclo."],
  ["min", "Mínimo", "El coach sólo sabe que registrás (fiabilidad y salud) — sin detalle."],
  ["full", "Contexto", "Además ve si HOY estás en ventana lútea. Nunca fecha, fase ni síntomas."],
];
const STATE_OPTS: Array<[CycleState, string]> = [
  ["regular", "Regular"],
  ["unreliable", "Irregular"],
  ["amenorrhea", "Sin período"],
];

const validLen = (s: string): boolean => {
  if (s === "") return true; // opcional
  const n = Number(s);
  return Number.isInteger(n) && n >= CYCLE_LEN_MIN && n <= CYCLE_LEN_MAX;
};

/** ¿La fecha guardada quedó a más del horizonte de proyección (3 ciclos)? NaN → false (sin nota). */
const pastHorizon = (startIso: string, lenDays: number): boolean => {
  const days = (Date.now() - new Date(`${startIso}T00:00:00Z`).getTime()) / 86_400_000;
  return Number.isFinite(days) && days >= CYCLE_HORIZON_CYCLES * lenDays;
};

/** Sección «Ciclo» de Cuenta (slice ciclo-visible). Opt-in POR ELECCIÓN — existe para toda
 *  cuenta de atleta, sin asumir género. El registro es de la atleta; compartir es hacia el
 *  coach y SIEMPRE redactado (el copy de cada nivel dice exactamente qué ve). Paleta neutra. */
export function CicloSection({ client = meClient }: { client?: MeClient }) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [share, setShare] = useState<CycleShare>("none");
  const [state, setState] = useState<CycleState>("regular");
  const [start, setStart] = useState("");
  const [len, setLen] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [saved, setSaved] = useState(false);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(async () => {
    try {
      const c = await client.getMeCycle();
      if (!mountedRef.current) return;
      setShare(c.share);
      setState(c.state);
      setStart(c.lastPeriodStart ?? "");
      setLen(c.cycleLengthDays != null ? String(c.cycleLengthDays) : "");
      setLoadError(false);
    } catch {
      if (mountedRef.current) setLoadError(true);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [client]);
  useEffect(() => { void load(); }, [load]);

  const canSave = !saving && validLen(len);

  async function save(): Promise<void> {
    if (!canSave) return;
    setSaving(true);
    setSaveError(false);
    setSaved(false);
    try {
      const data: CycleData = {
        share, state,
        ...(start !== "" ? { lastPeriodStart: start } : {}),
        ...(len !== "" ? { cycleLengthDays: Number(len) } : {}),
      };
      await client.putMeCycle(data);
      if (!mountedRef.current) return;
      setSaved(true);
    } catch {
      if (mountedRef.current) setSaveError(true);
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }

  const inputStyle = {
    width: "100%", boxSizing: "border-box" as const, padding: "10px 12px", borderRadius: 10,
    border: "1px solid color-mix(in srgb,var(--wl-text) 16%,transparent)", background: "var(--wl-bg)",
    color: "var(--wl-text)", fontFamily: "var(--ho-mono, var(--mono))", fontSize: 14,
  };
  const noteStyle = { fontFamily: "var(--ho-mono, var(--mono))", fontSize: 10.5, color: "var(--wl-muted)", lineHeight: 1.5, marginTop: 6 };

  return (
    <div className="ho-acct__group">
      <div className="ho-acct__label">Ciclo · registro opcional</div>
      <div className="ho-card">
        <div className="ho-acct__rowsub">
          Tu ciclo es tuyo. Registrarlo proyecta sus ventanas sobre TU calendario del plan;
          compartir con tu coach es aparte y siempre va redactado.
        </div>
        {loading ? (
          <div role="status" aria-busy="true" style={noteStyle}>Cargando…</div>
        ) : loadError ? (
          <div role="alert" style={{ ...noteStyle, color: "#ff3b46" }}>
            No se pudo cargar tu registro.{" "}
            <button type="button" onClick={() => { setLoading(true); void load(); }}
              style={{ border: 0, background: "transparent", color: "var(--wl-accent)", fontFamily: "var(--ho-mono, var(--mono))", fontSize: 10.5, cursor: "pointer", textDecoration: "underline", padding: 0 }}>
              Reintentar
            </button>
          </div>
        ) : (
          <>
            <div style={{ marginTop: 10, fontFamily: "var(--ho-mono, var(--mono))", fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--wl-muted)" }}>Compartir con el coach</div>
            <div className="ho-seg" style={{ marginTop: 6 }}>
              {SHARE_OPTS.map(([v, label]) => (
                <button key={v} type="button" aria-pressed={share === v} className={share === v ? "on" : ""} onClick={() => { setShare(v); setSaved(false); }}>{label}</button>
              ))}
            </div>
            <div style={noteStyle}>{SHARE_OPTS.find(([v]) => v === share)![2]}</div>

            <div style={{ marginTop: 12, fontFamily: "var(--ho-mono, var(--mono))", fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--wl-muted)" }}>Mi ciclo</div>
            <div className="ho-seg" style={{ marginTop: 6 }}>
              {STATE_OPTS.map(([v, label]) => (
                <button key={v} type="button" aria-pressed={state === v} className={state === v ? "on" : ""} onClick={() => { setState(v); setSaved(false); }}>{label}</button>
              ))}
            </div>
            {state === "unreliable" && (
              <div style={noteStyle}>Con ciclo irregular no proyectamos ventanas (sería precisión falsa). El registro igual aporta contexto.</div>
            )}
            {state === "amenorrhea" && (
              <div style={noteStyle}>Sin período hace meses: conviene conversarlo con un profesional de la salud. No es un logro deportivo.</div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
              <label style={{ display: "grid", gap: 4, fontFamily: "var(--ho-mono, var(--mono))", fontSize: 10, color: "var(--wl-muted)" }}>
                Inicio del último período
                <input type="date" value={start} onChange={(e) => { setStart(e.target.value); setSaved(false); }} style={inputStyle} />
              </label>
              <label style={{ display: "grid", gap: 4, fontFamily: "var(--ho-mono, var(--mono))", fontSize: 10, color: "var(--wl-muted)" }}>
                Duración típica (días, {CYCLE_LEN_MIN}–{CYCLE_LEN_MAX})
                <input type="text" inputMode="numeric" value={len}
                  aria-invalid={!validLen(len) || undefined}
                  aria-describedby={!validLen(len) ? "ciclo-len-error" : undefined}
                  onChange={(e) => { setLen(e.target.value); setSaved(false); }} style={inputStyle} />
                {!validLen(len) && (
                  <span id="ciclo-len-error" role="alert" style={{ fontSize: 10, color: "#ff3b46", fontFamily: "var(--ho-mono, var(--mono))" }}>
                    Debe ser un entero entre {CYCLE_LEN_MIN} y {CYCLE_LEN_MAX}.
                  </span>
                )}
              </label>
            </div>
            {state === "regular" && start !== "" && len !== "" && validLen(len) && pastHorizon(start, Number(len)) && (
              <div style={noteStyle}>
                Tu fecha de inicio tiene más de {CYCLE_HORIZON_CYCLES} ciclos — actualizala para que la
                proyección vuelva a tu calendario.
              </div>
            )}

            {saveError && (
              <div role="alert" style={{ ...noteStyle, color: "#ff3b46" }}>No se pudo guardar. Reintentá.</div>
            )}
            <button type="button" className="wl-btn wl-btn--primary" style={{ width: "100%", marginTop: 12 }}
              disabled={!canSave} onClick={() => void save()}>
              {saving ? "Guardando…" : saved ? "Guardado ✓" : "Guardar"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
