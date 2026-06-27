import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { VinculoEstado } from "@holy-oly/core";
import { useAuth } from "../../auth/AuthContext";
import * as vc from "../../data/vinculoClient";
import { exportMe, deleteMyAccount } from "../../data/meClient";
import { useAtletaCtx } from "./AthleteShell";
import { CicloSection } from "./CicloSection";
import { useTranslation } from "react-i18next";
import { RetryButton } from "../../ui/RetryButton";
import { SegmentedTabs } from "../../ui/SegmentedTabs";
import { LanguageToggle } from "../../i18n/LanguageToggle";
import { MovementLangToggle } from "../../i18n/MovementLangToggle";

const HO_SKINS: Array<{ id: string; nm: string; sw: [string, string, string] }> = [
  { id: "neon", nm: "Neon PR", sw: ["#07070f", "#c8ff2d", "#1fe7ff"] },
  { id: "neonlight", nm: "Neon Bloom", sw: ["#fdeef6", "#ff2e9a", "#8a5cff"] },
  { id: "bloomnight", nm: "Neon Bloom · Noche", sw: ["#150a16", "#ff3ba6", "#a06bff"] },
  { id: "plates", nm: "Plates", sw: ["#15171a", "#e23b2e", "#2274d4"] },
  { id: "premium", nm: "Premium", sw: ["#0d1016", "#e9b365", "#37d6b8"] },
  { id: "chalk", nm: "Chalk", sw: ["#e7e3d8", "#ff5400", "#2b59ff"] },
];

/** Estado real del vínculo (W5/D7): en API consulta GET /me/vinculo y rinde 3 ramas
 *  (activo / pendiente / sin vínculo → form). En demo no hay vínculo real → card estática. */
function VincularSection() {
  const { apiEnabled } = useAuth();
  const { t } = useTranslation(["account", "common"]);
  const [code, setCode] = useState("");
  const [estado, setEstado] = useState<VinculoEstado | null>(null);
  const [coachNombre, setCoachNombre] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [fetchFailed, setFetchFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!apiEnabled) return;
    let on = true;
    setLoaded(false);
    setFetchFailed(false);
    vc.getMyVinculo()
      .then((v) => {
        if (!on) return;
        if (v) { setEstado(v.estado); setCoachNombre(v.coachNombre); }
        setLoaded(true);
      })
      .catch(() => {
        // D5: error ≠ "sin vínculo" — rama propia con Reintentar; el form sólo con null confirmado.
        if (on) { setFetchFailed(true); setLoaded(true); }
      });
    return () => { on = false; };
  }, [apiEnabled, reload]);

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await vc.acceptCode(code.trim().toUpperCase());
      setEstado(r.estado);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("sendError"));
    } finally {
      setBusy(false);
    }
  }

  if (!apiEnabled) {
    return (
      <div className="ho-acct__group">
        <div className="ho-acct__label">{t("myCoach")}</div>
        <div className="ho-card">
          <b style={{ fontFamily: "var(--wl-display)" }}>
            <span aria-hidden="true" style={{ display: "inline-block", width: 8, height: 8, borderRadius: 999, background: "var(--ok)", marginRight: 7 }} />
            {t("linkedDemo")}
          </b>
          <div className="ho-acct__rowsub" style={{ marginTop: 4 }}>{t("linkedDemoSub")}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="ho-acct__group">
      <div className="ho-acct__label">{t("myCoach")}</div>
      {!loaded ? (
        <div className="ho-card"><div className="ho-acct__rowsub">{t("common:loading")}</div></div>
      ) : fetchFailed ? (
        <div className="ho-card">
          <div role="alert" style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-danger)" }}>
            {t("linkLoadError")}{" "}
            <RetryButton onClick={() => setReload((r) => r + 1)} />
          </div>
        </div>
      ) : estado === "activo" ? (
        <div className="ho-card">
          <b style={{ fontFamily: "var(--wl-display)" }}>
            <span aria-hidden="true" style={{ display: "inline-block", width: 8, height: 8, borderRadius: 999, background: "var(--ok)", marginRight: 7 }} />
            {t("coachIs", { name: coachNombre })}
          </b>
          <div className="ho-acct__rowsub" style={{ marginTop: 4 }}>{t("linkActiveSub")}</div>
        </div>
      ) : estado === "pendiente" ? (
        <div className="ho-card">
          <b style={{ fontFamily: "var(--wl-display)" }}>{t("requestSent")}</b>
          <div className="ho-acct__rowsub" style={{ marginTop: 4 }}>{t("requestSentSub")}</div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="ho-card">
          <div className="ho-acct__rowsub" style={{ marginBottom: 10 }}>{t("enterCode")}</div>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={t("codePlaceholder")}
            aria-label={t("codeLabel")}
            style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: "var(--wl-radius)", border: "1px solid color-mix(in srgb,var(--wl-text) 16%,transparent)", background: "var(--wl-bg)", color: "var(--wl-text)", fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 18, letterSpacing: ".18em", textAlign: "center" }}
          />
          {error && <div role="alert" style={{ color: "var(--wl-danger)", fontFamily: "var(--mono)", fontSize: 11, marginTop: 10 }}>{error}</div>}
          <button type="submit" className="wl-btn wl-btn--primary" style={{ width: "100%", marginTop: 12 }} disabled={busy || !code.trim()}>
            {busy ? "..." : t("sendRequest")}
          </button>
        </form>
      )}
    </div>
  );
}

/** "Tus datos" (W5/D6): las promesas de Privacidad se cumplen — export y borrado contra los
 *  endpoints reales (GET /me/export · DELETE /me/account). 100% API: en demo NO se muestra. */
function TusDatosSection() {
  const { logout } = useAuth();
  const { t } = useTranslation(["account", "common"]);
  const navigate = useNavigate();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function onExport(): Promise<void> {
    setExporting(true);
    setExportError(null);
    try {
      const data = await exportMe();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "holy-oly-export.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setExportError(t("exportError"));
    } finally {
      setExporting(false);
    }
  }

  async function onDelete(): Promise<void> {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteMyAccount();
      // El server ya mató la sesión (clearCookie); el logout local sólo limpia el estado del front.
      await logout().catch(() => undefined);
      navigate("/login");
    } catch {
      setDeleteError(t("deleteError"));
      setDeleting(false);
    }
  }

  return (
    <div className="ho-acct__group">
      <div className="ho-acct__label">{t("yourData")}</div>
      <div className="ho-card">
        <div className="ho-acct__rowsub" style={{ marginBottom: 10 }}>{t("dataIntro")}</div>
        <button type="button" className="wl-btn wl-btn--ghost" style={{ width: "100%" }} disabled={exporting} onClick={() => void onExport()}>
          {exporting ? t("exporting") : t("exportData")}
        </button>
        {exportError && <div role="alert" style={{ color: "var(--wl-danger)", fontFamily: "var(--mono)", fontSize: 11, marginTop: 8 }}>{exportError}</div>}

        {!confirming ? (
          <button type="button" className="wl-btn wl-btn--ghost" style={{ width: "100%", marginTop: 10, color: "var(--wl-danger)" }} onClick={() => setConfirming(true)}>
            {t("deleteAccount")}
          </button>
        ) : (
          <div style={{ marginTop: 10 }}>
            <div role="alert" style={{ color: "var(--wl-danger)", fontFamily: "var(--mono)", fontSize: 11, lineHeight: 1.5 }}>
              {t("deleteConfirm")}
            </div>
            <button
              type="button"
              className="wl-btn"
              style={{ width: "100%", marginTop: 8, background: "var(--wl-danger)", color: "var(--wl-bg)", border: 0 }}
              disabled={deleting}
              onClick={() => void onDelete()}
            >
              {deleting ? t("deleting") : t("deleteConfirmBtn")}
            </button>
            <button type="button" className="wl-btn wl-btn--ghost" style={{ width: "100%", marginTop: 8 }} disabled={deleting} onClick={() => setConfirming(false)}>
              {t("common:cancel")}
            </button>
            {deleteError && <div role="alert" style={{ color: "var(--wl-danger)", fontFamily: "var(--mono)", fontSize: 11, marginTop: 8 }}>{deleteError}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

export function CuentaMin() {
  const { apiEnabled, user, logout } = useAuth();
  const { skin, setSkin, variant, setVariant } = useAtletaCtx();
  const { t } = useTranslation(["account", "common"]);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  function onLogout(): void {
    setLogoutError(null);
    logout().catch(() => setLogoutError(t("logoutError")));
  }
  return (
    <>
      <div className="ho-greet"><div className="ho-greet__h">{t("title")}</div><div className="ho-greet__s">{t("subtitle")}</div></div>

      {apiEnabled && user && (
        <div className="ho-acct__group">
          <div className="ho-acct__label">{t("yourAccount")}</div>
          <div className="ho-card">
            {/* /auth/me no expone el nombre de la atleta todavía — el email ES la identidad de la cuenta. */}
            <b style={{ fontFamily: "var(--wl-display)", overflowWrap: "anywhere" }}>{user.email ?? t("noEmail")}</b>
            <div className="ho-acct__rowsub" style={{ marginTop: 4 }}>{t("sessionAtleta")}</div>
          </div>
        </div>
      )}

      <VincularSection />

      <div className="ho-acct__group">
        <div className="ho-acct__label">{t("checkin")}</div>
        <SegmentedTabs
          ariaLabel={t("checkin")}
          options={[["tap", t("checkinTap")], ["dial", t("checkinDial")]] as const}
          value={variant}
          onChange={setVariant}
        />
      </div>

      <div className="ho-acct__group">
        <div className="ho-acct__label">{t("appearance")}</div>
        <div className="ho-skins">
          {HO_SKINS.map((s) => (
            <button key={s.id} className={"ho-skin" + (skin === s.id ? " on" : "")} onClick={() => setSkin(s.id)} aria-label={t("skinAria", { nm: s.nm })}>
              <div className="ho-skin__sw">{s.sw.map((c, i) => <i key={i} style={{ background: c }} />)}</div>
              <div className="ho-skin__nm">{s.nm}</div>
            </button>
          ))}
        </div>
      </div>

      <CicloSection />

      {apiEnabled && <TusDatosSection />}

      {apiEnabled && (
        <div className="ho-acct__group">
          <button type="button" onClick={onLogout} className="wl-btn wl-btn--ghost" style={{ width: "100%", color: "var(--wl-danger)" }}>{t("common:logout")}</button>
          {logoutError && (
            <div role="alert" style={{ marginTop: 8, fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-danger)" }}>{logoutError}</div>
          )}
        </div>
      )}

      <div className="ho-acct__group" style={{ marginTop: 18 }}>
        <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-muted)", letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 8 }}>
          {t("common:language")}
        </div>
        <LanguageToggle />
      </div>

      <div className="ho-acct__group" style={{ marginTop: 12 }}>
        <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-muted)", letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 8 }}>
          {t("common:movementNames")}
        </div>
        <MovementLangToggle />
      </div>

      <div style={{ textAlign: "center", fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-muted)", margin: "22px 0 4px", lineHeight: 1.5 }}>
        <Link to="/privacidad" style={{ color: "inherit" }}>{t("legalPrivacy")}</Link>
        {" · "}
        <Link to="/terminos" style={{ color: "inherit" }}>{t("legalTerms")}</Link>
      </div>
      <div style={{ textAlign: "center", fontFamily: "var(--mono)", fontSize: 9, color: "var(--wl-muted)", margin: "0 0 4px", letterSpacing: ".04em" }}>
        HOLY OLY · smart training · zero burnout
      </div>
    </>
  );
}
