import { useState, useEffect, type CSSProperties, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useAuth } from "./AuthContext";
import type { Role } from "./authClient";
import { googleAuthEnabled, googleAuthStart } from "./authClient";
import { HolyOlyIcon } from "../ui/HolyOlyIcon";

const input: CSSProperties = {
  width: "100%", boxSizing: "border-box", marginTop: 6, padding: "10px 12px", borderRadius: 10,
  border: "1px solid color-mix(in srgb,var(--wl-text) 16%,transparent)", background: "var(--wl-surface)",
  color: "var(--wl-text)", fontFamily: "var(--wl-display)", fontSize: 14,
};
const label: CSSProperties = { fontFamily: "var(--mono)", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--wl-muted)", marginTop: 12, display: "block" };

export const MIN_PASSWORD = 8;

/**
 * Maps backend auth error codes (stable English) to localized, actionable copy. Takes the auth
 * `t` so the caller controls the active language; unknown/empty codes fall back to a generic line.
 */
export function authErrorMessage(t: TFunction<"auth">, err: unknown): string {
  const code = err instanceof Error ? err.message : "";
  switch (code) {
    case "weak password":
      return t("errors.weakPassword", { count: MIN_PASSWORD });
    case "email already registered":
      return t("errors.emailTaken");
    case "invalid credentials":
      return t("errors.invalidCredentials");
    case "invalid input":
      return t("errors.invalidInput");
    default:
      return code || t("errors.fallback");
  }
}

export function AuthScreen() {
  const { t } = useTranslation("auth");
  const { login, signup, user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [googleEnabled, setGoogleEnabled] = useState(false);
  useEffect(() => { void googleAuthEnabled().then(setGoogleEnabled); }, []);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("coach");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [website, setWebsite] = useState("");
  const [accepted, setAccepted] = useState(false);
  const googleError = searchParams.get("error") === "google";
  // Tras un reset exitoso ResetPasswordScreen navega acá con state.resetOk.
  const resetOk = Boolean((location.state as { resetOk?: boolean } | null)?.resetOk);

  function onGoogle(): void {
    setError(null);
    if (mode === "signup") {
      // PR-L1: parity with the password path — no OAuth signup without legal acceptance.
      if (!accepted) {
        setError(t("mustAcceptTerms"));
        return;
      }
      googleAuthStart({ intent: "signup", role, name: name || undefined, accept: true });
    } else {
      googleAuthStart({ intent: "login" });
    }
  }

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    // Instant, styled feedback for the most common signup mistake (too-short password) before
    // hitting the server. The API enforces the same floor as the real security boundary.
    if (mode === "signup" && password.length < MIN_PASSWORD) {
      setError(t("errors.shortPassword", { count: MIN_PASSWORD }));
      return;
    }
    if (mode === "signup" && !accepted) {
      setError(t("mustAcceptTerms"));
      return;
    }
    setBusy(true);
    try {
      if (mode === "login") await login(email, password);
      else await signup(email, password, role, name || undefined, website, accepted);
      navigate("/", { replace: true });
    } catch (err) {
      setError(authErrorMessage(t, err));
    } finally {
      setBusy(false);
    }
  }

  // Sesión ya activa → el form de login no aplica; RoleLanding despacha por rol.
  if (user && !loading) return <Navigate to="/" replace />;

  return (
    <div style={{ minHeight: "100vh", background: "var(--wl-bg)", display: "grid", placeItems: "center", padding: 16 }}>
      <form onSubmit={onSubmit} style={{ width: "100%", maxWidth: 360, background: "var(--wl-surface)", borderRadius: 18, padding: "22px 20px", border: "1px solid color-mix(in srgb,var(--wl-text) 8%,transparent)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <HolyOlyIcon size={88} />
          <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)" }}>
            {mode === "login" ? t("login.subtitle") : t("signup.subtitle")}
          </div>
        </div>

        {mode === "signup" && (
          <>
            <label style={label}>{t("fields.roleLabel")}</label>
            <div role="group" aria-label={t("fields.roleGroupLabel")} style={{ display: "flex", gap: 8, marginTop: 6 }}>
              {(["coach", "atleta"] as const).map((r) => (
                <button type="button" key={r} onClick={() => setRole(r)} aria-pressed={role === r}
                  style={{ flex: 1, padding: "8px", borderRadius: 10, cursor: "pointer", fontFamily: "var(--wl-display)", fontWeight: 700,
                    border: `1px solid ${role === r ? "var(--wl-accent)" : "color-mix(in srgb,var(--wl-text) 16%,transparent)"}`,
                    background: role === r ? "color-mix(in srgb,var(--wl-accent) 16%,transparent)" : "transparent", color: "var(--wl-text)" }}>
                  {r === "coach" ? t("fields.roleCoach") : t("fields.roleAtleta")}
                </button>
              ))}
            </div>
            <label style={label} htmlFor="auth-name">{t("fields.name")}</label>
            <input id="auth-name" style={input} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("fields.namePlaceholder")} />
          </>
        )}

        <label style={label} htmlFor="auth-email">{t("fields.email")}</label>
        <input id="auth-email" style={input} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("fields.emailPlaceholder")} />
        <label style={label} htmlFor="auth-password">{t("fields.password")}</label>
        <input id="auth-password" style={input} type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={mode === "signup" ? MIN_PASSWORD : undefined} aria-describedby={mode === "signup" ? "auth-password-hint" : undefined} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        {mode === "signup" && (
          <div id="auth-password-hint" style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-muted)", marginTop: 6 }}>
            {t("fields.passwordHint", { count: MIN_PASSWORD })}
          </div>
        )}

        {mode === "signup" && (
          <input
            tabIndex={-1}
            autoComplete="off"
            aria-hidden
            name="website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            style={{ position: "absolute", left: -9999, width: 1, height: 1, opacity: 0 }}
          />
        )}

        {mode === "login" && (
          <Link to="/login/forgot" style={{ display: "block", marginTop: 10, fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)" }}>
            {t("login.forgotLink")}
          </Link>
        )}

        {mode === "login" && resetOk && (
          <div role="status" style={{ marginTop: 12, color: "var(--ok)", fontFamily: "var(--mono)", fontSize: 11 }}>
            {t("login.resetOk")}
          </div>
        )}

        {googleError && (
          <div role="alert" style={{ marginTop: 12, color: "var(--wl-danger)", fontFamily: "var(--mono)", fontSize: 11 }}>
            {t("login.googleFailed")}
          </div>
        )}

        {error && <div role="alert" style={{ marginTop: 12, color: "var(--wl-danger)", fontFamily: "var(--mono)", fontSize: 11 }}>{error}</div>}

        {mode === "signup" && (
          <label style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 16, fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)", lineHeight: 1.5, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              style={{ marginTop: 2, accentColor: "var(--wl-accent)", flex: "0 0 auto" }}
            />
            <span>
              <Trans
                t={t}
                i18nKey="acceptTerms"
                components={{ 0: <Link to="/terminos" />, 1: <Link to="/privacidad" /> }}
              />
            </span>
          </label>
        )}

        {googleEnabled && (
          <>
            <button type="button" onClick={onGoogle} disabled={mode === "signup" && !accepted}
              style={{ width: "100%", marginTop: 14, padding: 12, borderRadius: 12, cursor: mode === "signup" && !accepted ? "default" : "pointer",
              border: "1px solid color-mix(in srgb,var(--wl-text) 16%,transparent)", background: "transparent", color: "var(--wl-text)",
              fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 14, opacity: mode === "signup" && !accepted ? 0.5 : 1 }}>
              {t("google.continue")}
            </button>
            <div style={{ marginTop: 14, fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-muted)", textAlign: "center" }}>{t("google.separator")}</div>
          </>
        )}

        <button type="submit" disabled={busy || (mode === "signup" && !accepted)} style={{ width: "100%", marginTop: googleEnabled ? 14 : 18, padding: 12, borderRadius: 12, border: 0, cursor: busy || (mode === "signup" && !accepted) ? "default" : "pointer",
          background: "var(--wl-accent)", color: "var(--wl-bg)", fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 15, opacity: busy || (mode === "signup" && !accepted) ? 0.6 : 1 }}>
          {busy ? "..." : mode === "login" ? t("login.submit") : t("signup.submit")}
        </button>

        <button type="button" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(null); }}
          style={{ width: "100%", marginTop: 10, padding: 8, border: 0, background: "transparent", color: "var(--wl-muted)", fontFamily: "var(--mono)", fontSize: 12, cursor: "pointer" }}>
          {mode === "login" ? t("login.switchToSignup") : t("signup.switchToLogin")}
        </button>
      </form>
    </div>
  );
}
