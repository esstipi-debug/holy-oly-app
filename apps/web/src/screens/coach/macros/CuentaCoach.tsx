import { useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../../auth/AuthContext";
import { VerifyEmailBanner } from "../../../ui/VerifyEmailBanner";
import { LanguageToggle } from "../../../i18n/LanguageToggle";
import { MovementLangToggle } from "../../../i18n/MovementLangToggle";
import { useCoachCtx } from "./CoachShell";
import { COACH_SKINS } from "./coachPrefs";
import { usePwaInstall } from "../../../hooks/usePwaInstall";

const page: CSSProperties = {
  padding: "14px 13px 26px", color: "var(--wl-text)", background: "var(--wl-bg)",
  minHeight: "100vh", maxWidth: 390, margin: "0 auto",
};
const row: CSSProperties = {
  display: "block", textDecoration: "none", color: "var(--wl-text)", fontFamily: "var(--wl-display)",
  fontWeight: 600, fontSize: 15, padding: "14px 14px", borderRadius: 12, marginTop: 10,
  border: "1px solid color-mix(in srgb,var(--wl-text) 12%,transparent)", background: "var(--wl-surface)",
};
const card: CSSProperties = {
  padding: "14px 14px", borderRadius: 12, marginTop: 10,
  border: "1px solid color-mix(in srgb,var(--wl-text) 12%,transparent)", background: "var(--wl-surface)",
};
const label: CSSProperties = {
  fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-muted)",
  letterSpacing: ".06em", textTransform: "uppercase", marginTop: 18,
};

/** Cuenta real del coach (W5): identidad + verificación + clave (vía flujo reset) + Invitaciones +
 *  Suscripción + logout gateado (W3/W4). Todo lo de cuenta es 100% API → en modo demo
 *  (apiEnabled=false) sólo quedan el aviso de demo y los links legales. "Tus datos" del coach =
 *  contacto honesto (D6: endpoints de export/borrado del coach aún no existen — pendiente documentado). */
export function CuentaCoach() {
  const { apiEnabled, user, logout } = useAuth();
  const { t } = useTranslation(["account", "common"]);
  const { skin, setSkin } = useCoachCtx();
  const { canInstall, promptInstall } = usePwaInstall();
  const [logoutError, setLogoutError] = useState<string | null>(null);

  function onLogout(): void {
    setLogoutError(null);
    logout().catch(() => setLogoutError(t("logoutError")));
  }

  return (
    <div style={page}>
      <h1 style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 22, lineHeight: 1, margin: 0 }}>{t("title")}</h1>
      <div style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--wl-muted)", marginTop: 6 }}>
        {apiEnabled && user ? t("sessionRole", { role: user.role }) : t("demoMode")}
      </div>

      {apiEnabled && user && (
        <>
          <div style={label}>{t("yourAccount")}</div>
          <div style={card}>
            {/* /auth/me no expone el nombre del coach todavía — el email ES la identidad de la cuenta. */}
            <div style={{ fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 15, overflowWrap: "anywhere" }}>
              {user.email ?? t("noEmail")}
            </div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 11, marginTop: 6, color: user.emailVerified === false ? "var(--warn)" : "var(--ok)" }}>
              {user.emailVerified === false ? t("emailUnverified") : t("emailVerified")}
            </div>
          </div>
          {user.emailVerified === false && <VerifyEmailBanner />}

          <Link to="/login/forgot" style={row}>
            {t("changePassword")}
            <div style={{ fontFamily: "var(--mono)", fontSize: 10.5, fontWeight: 400, color: "var(--wl-muted)", marginTop: 4 }}>
              {t("changePasswordSub")}
            </div>
          </Link>
        </>
      )}

      {apiEnabled && <Link to="/coach/invitaciones" style={row}>{t("invitations")}</Link>}
      {apiEnabled && <Link to="/coach/suscripcion" style={row}>{t("subscription")}</Link>}

      {apiEnabled && (
        <>
          {/* D6: el coach todavía no tiene endpoints de export/borrado → contacto honesto, no botones falsos. */}
          <div style={label}>{t("yourData")}</div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)", marginTop: 8, lineHeight: 1.6 }}>
            {t("coachDataContact")}{" "}
            <a href="mailto:esstipi@gmail.com?subject=Mis%20datos%20(coach)" style={{ color: "var(--wl-accent)", fontWeight: 700 }}>
              esstipi@gmail.com
            </a>
          </div>

          <button
            type="button"
            onClick={onLogout}
            style={{ ...row, width: "100%", textAlign: "left", cursor: "pointer", color: "var(--wl-danger)", marginTop: 18 }}
          >
            {t("common:logout")}
          </button>
          {logoutError && (
            <div role="alert" style={{ marginTop: 8, fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-danger)" }}>
              {logoutError}
            </div>
          )}
        </>
      )}

      {canInstall && (
        <button type="button" onClick={() => void promptInstall()} style={{ ...row, width: "100%", textAlign: "left", cursor: "pointer" }}>
          {t("installApp")}
          <div style={{ fontFamily: "var(--mono)", fontSize: 10.5, fontWeight: 400, color: "var(--wl-muted)", marginTop: 4 }}>
            {t("installAppSub")}
          </div>
        </button>
      )}

      {/* Apariencia: el coach también elige skin (default legend). Pref local → no gateada por API. */}
      <div style={label}>{t("appearance")}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 8 }}>
        {COACH_SKINS.map((s) => {
          const on = skin === s.id;
          return (
            <button key={s.id} type="button" aria-label={t("skinAria", { nm: s.nm })} onClick={() => setSkin(s.id)}
              style={{
                display: "flex", flexDirection: "column", gap: 6, padding: 8, borderRadius: 12, cursor: "pointer",
                background: "var(--wl-surface)",
                border: on ? "2px solid var(--wl-accent)" : "1px solid color-mix(in srgb,var(--wl-text) 12%,transparent)",
              }}>
              <span aria-hidden="true" style={{ display: "flex", height: 26, borderRadius: 6, overflow: "hidden" }}>
                {s.sw.map((c, i) => <span key={i} style={{ flex: 1, background: c }} />)}
              </span>
              <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, lineHeight: 1.2, textAlign: "center", color: on ? "var(--wl-text)" : "var(--wl-muted)" }}>{s.nm}</span>
            </button>
          );
        })}
      </div>

      <div style={label}>{t("common:language")}</div>
      <LanguageToggle style={{ marginTop: 8 }} />

      <div style={label}>{t("common:movementNames")}</div>
      <MovementLangToggle style={{ marginTop: 8 }} />

      <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-muted)", marginTop: 16, lineHeight: 1.5 }}>
        <Link to="/privacidad" style={{ color: "inherit" }}>{t("legalPrivacy")}</Link>
        {" · "}
        <Link to="/terminos" style={{ color: "inherit" }}>{t("legalTerms")}</Link>
      </div>
    </div>
  );
}
