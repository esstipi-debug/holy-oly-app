import { useCallback, useEffect, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { CycleData, CycleShare, CycleState } from "@holy-oly/core";
import { CYCLE_LEN_MAX, CYCLE_LEN_MIN, CYCLE_HORIZON_CYCLES } from "@holy-oly/core";
import { meClient, type MeClient } from "../../data/meClient";
import { RetryButton } from "../../ui/RetryButton";
import { SegmentedTabs } from "../../ui/SegmentedTabs";
import { Loading } from "../../ui/Loading";

const SHARE_VALUES: CycleShare[] = ["none", "min", "full"];
const STATE_VALUES: CycleState[] = ["regular", "unreliable", "amenorrhea"];

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

/** Sección «Ciclo» de Cuenta (slice ciclo-visible + PR-L2). Opt-in POR ELECCIÓN: el módulo arranca
 *  INVISIBLE (sólo un gate de activación con consentimiento informado) y nunca se asume por género.
 *  Recién tras consentir aparece el registro. Compartir con el coach es aparte y SIEMPRE redactado.
 *  Paleta neutra (jamás semáforo verde/amarillo/rojo del estado del ciclo). */
export function CicloSection({ client = meClient }: { client?: MeClient }) {
  const { t } = useTranslation(["atleta", "common"]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  // Female-only (owner 2026-06-14): un hombre JAMÁS ve la sección del ciclo. null = aún cargando.
  const [sexo, setSexo] = useState<"M" | "F" | null>(null);
  const [consented, setConsented] = useState(false);
  const [share, setShare] = useState<CycleShare>("none");
  const [state, setState] = useState<CycleState>("regular");
  const [start, setStart] = useState("");
  const [len, setLen] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [saved, setSaved] = useState(false);
  // Gate de activación (PR-L2): reconocimiento informado + estado de la activación / revocación.
  const [ack, setAck] = useState(false);
  const [activating, setActivating] = useState(false);
  const [activateError, setActivateError] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState(false);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(async () => {
    try {
      const c = await client.getMeCycle();
      if (!mountedRef.current) return;
      setSexo(c.sexo);
      setConsented(c.consented);
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

  // El ciclo es female-only: mientras carga (sexo=null) o si no es femenina, la sección no existe
  // para la atleta — un hombre nunca ve siquiera el gate de activación (owner 2026-06-14).
  if (sexo !== "F") return null;

  const canSave = !saving && validLen(len);

  async function activate(): Promise<void> {
    if (!ack || activating) return;
    setActivating(true);
    setActivateError(false);
    try {
      // Opt-in con defaults (share "none" → nada se comparte aún); recién después configura.
      await client.putMeCycle({ share, state }, true);
      if (!mountedRef.current) return;
      await load();
    } catch {
      if (mountedRef.current) setActivateError(true);
    } finally {
      if (mountedRef.current) setActivating(false);
    }
  }

  async function revoke(): Promise<void> {
    if (revoking) return;
    setRevoking(true);
    setRevokeError(false);
    try {
      await client.deleteMeCycle();
      if (!mountedRef.current) return;
      setAck(false);
      setShare("none");
      setState("regular");
      setStart("");
      setLen("");
      await load();
    } catch {
      if (mountedRef.current) { setRevokeError(true); setRevoking(false); }
    }
  }

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
    width: "100%", boxSizing: "border-box" as const, padding: "10px 12px", borderRadius: "var(--wl-radius)",
    border: "1px solid color-mix(in srgb,var(--wl-text) 16%,transparent)", background: "var(--wl-bg)",
    color: "var(--wl-text)", fontFamily: "var(--mono)", fontSize: 14,
  };
  const noteStyle = { fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--wl-muted)", lineHeight: 1.5, marginTop: 6 };

  const shareLabel: Record<CycleShare, string> = {
    none: t("cicShareNoneLabel"),
    min: t("cicShareMinLabel"),
    full: t("cicShareFullLabel"),
  };
  const shareDesc: Record<CycleShare, string> = {
    none: t("cicShareNoneDesc"),
    min: t("cicShareMinDesc"),
    full: t("cicShareFullDesc"),
  };
  const stateLabel: Record<CycleState, string> = {
    regular: t("cicStateRegular"),
    unreliable: t("cicStateUnreliable"),
    amenorrhea: t("cicStateAmenorrhea"),
  };
  const SHARE_OPTS = SHARE_VALUES.map((v) => [v, shareLabel[v]] as const);
  const STATE_OPTS = STATE_VALUES.map((v) => [v, stateLabel[v]] as const);

  return (
    <div className="ho-acct__group">
      <div className="ho-acct__label">{t("cicSectionLabel")}</div>
      <div className="ho-card">
        {loading ? (
          <Loading style={noteStyle}>{t("common:loading")}</Loading>
        ) : loadError ? (
          <div role="alert" style={{ ...noteStyle, color: "var(--wl-danger)" }}>
            {t("cicLoadError")}{" "}
            <RetryButton onClick={() => { setLoading(true); void load(); }} fontSize={10.5} />
          </div>
        ) : !consented ? (
          // ── Gate de activación (PR-L2): el módulo no existe para la atleta hasta que opta. ──
          <>
            <div className="ho-acct__rowsub">
              {t("cicGateIntro")}
            </div>
            <label style={{ ...noteStyle, display: "flex", gap: 8, alignItems: "flex-start", marginTop: 12, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={ack}
                onChange={(e) => setAck(e.target.checked)}
                style={{ marginTop: 1, accentColor: "var(--wl-text)", flex: "0 0 auto" }}
              />
              <span>
                <Trans
                  t={t}
                  i18nKey="cicAckLabel"
                  components={{ privacy: <Link to="/privacidad" style={{ color: "inherit" }} /> }}
                />
              </span>
            </label>
            {activateError && (
              <div role="alert" style={{ ...noteStyle, color: "var(--wl-danger)" }}>{t("cicActivateError")}</div>
            )}
            <button type="button" className="wl-btn wl-btn--primary" style={{ width: "100%", marginTop: 12 }}
              disabled={!ack || activating} onClick={() => void activate()}>
              {activating ? t("cicActivating") : t("cicActivate")}
            </button>
          </>
        ) : (
          // ── Registro (tras consentir): compartir + estado + fechas + revocar. ──
          <>
            <div className="ho-acct__rowsub">
              {t("cicRegistryIntro")}
            </div>

            <div style={{ marginTop: 10, fontFamily: "var(--mono)", fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--wl-muted)" }}>{t("cicShareHeading")}</div>
            <SegmentedTabs
              ariaLabel={t("cicShareHeading")}
              options={SHARE_OPTS}
              value={share}
              onChange={(v) => { setShare(v); setSaved(false); }}
              style={{ marginTop: 6 }}
            />
            <div style={noteStyle}>{shareDesc[share]}</div>

            <div style={{ marginTop: 12, fontFamily: "var(--mono)", fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--wl-muted)" }}>{t("cicStateHeading")}</div>
            <SegmentedTabs
              ariaLabel={t("cicStateHeading")}
              options={STATE_OPTS}
              value={state}
              onChange={(v) => { setState(v); setSaved(false); }}
              style={{ marginTop: 6 }}
            />
            {state === "unreliable" && (
              <div style={noteStyle}>{t("cicStateUnreliableNote")}</div>
            )}
            {state === "amenorrhea" && (
              <div style={noteStyle}>{t("cicStateAmenorrheaNote")}</div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
              <label style={{ display: "grid", gap: 4, fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-muted)" }}>
                {t("cicStartLabel")}
                <input type="date" value={start} onChange={(e) => { setStart(e.target.value); setSaved(false); }} style={inputStyle} />
              </label>
              <label style={{ display: "grid", gap: 4, fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-muted)" }}>
                {t("cicLenLabel", { min: CYCLE_LEN_MIN, max: CYCLE_LEN_MAX })}
                <input type="text" inputMode="numeric" value={len}
                  aria-invalid={!validLen(len) || undefined}
                  aria-describedby={!validLen(len) ? "ciclo-len-error" : undefined}
                  onChange={(e) => { setLen(e.target.value); setSaved(false); }} style={inputStyle} />
                {!validLen(len) && (
                  <span id="ciclo-len-error" role="alert" style={{ fontSize: 10, color: "var(--wl-danger)", fontFamily: "var(--mono)" }}>
                    {t("cicLenError", { min: CYCLE_LEN_MIN, max: CYCLE_LEN_MAX })}
                  </span>
                )}
              </label>
            </div>
            {state === "regular" && start !== "" && len !== "" && validLen(len) && pastHorizon(start, Number(len)) && (
              <div style={noteStyle}>
                {t("cicHorizonNote", { count: CYCLE_HORIZON_CYCLES })}
              </div>
            )}

            {saveError && (
              <div role="alert" style={{ ...noteStyle, color: "var(--wl-danger)" }}>{t("cicSaveError")}</div>
            )}
            <button type="button" className="wl-btn wl-btn--primary" style={{ width: "100%", marginTop: 12 }}
              disabled={!canSave} onClick={() => void save()}>
              {saving ? t("common:saving") : saved ? t("cicSaved") : t("common:save")}
            </button>

            <button type="button" className="wl-btn wl-btn--ghost" style={{ width: "100%", marginTop: 10 }}
              disabled={revoking} onClick={() => void revoke()}>
              {revoking ? t("cicRevoking") : t("cicRevoke")}
            </button>
            {revokeError && (
              <div role="alert" style={{ ...noteStyle, color: "var(--wl-danger)" }}>{t("cicRevokeError")}</div>
            )}
            <div style={noteStyle}>{t("cicRevokeNote")}</div>
          </>
        )}
      </div>
    </div>
  );
}
