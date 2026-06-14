import { useState, type CSSProperties, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import type { Role } from "./authClient";
import { completeGoogleSignup } from "./authClient";
import { HolyOlyIcon } from "../ui/HolyOlyIcon";

const input: CSSProperties = {
  width: "100%", boxSizing: "border-box", marginTop: 6, padding: "10px 12px", borderRadius: 10,
  border: "1px solid color-mix(in srgb,var(--wl-text) 16%,transparent)", background: "var(--wl-surface)",
  color: "var(--wl-text)", fontFamily: "var(--wl-display)", fontSize: 14,
};
const label: CSSProperties = { fontFamily: "var(--mono)", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--wl-muted)", marginTop: 12, display: "block" };

export function GoogleCompleteScreen() {
  const { t } = useTranslation("auth");
  const navigate = useNavigate();
  const [role, setRole] = useState<Role>("coach");
  const [name, setName] = useState("");
  // Onboarding del atleta (2026-06-14): sexo (obligatorio) + peso corporal (opcional).
  const [sexo, setSexo] = useState<"M" | "F" | null>(null);
  const [weightKg, setWeightKg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState(false);

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    if (!accepted) {
      setError(t("mustAcceptTerms"));
      return;
    }
    if (role === "atleta" && !sexo) {
      setError(t("errors.sexRequired"));
      return;
    }
    setBusy(true);
    try {
      await completeGoogleSignup(role, name || undefined, accepted,
        role === "atleta" ? sexo ?? undefined : undefined,
        role === "atleta" && weightKg.trim() ? Number(weightKg) : undefined);
      // navigate (no window.location.replace): bajo el hash-routing del demo file:// la URL
      // absoluta "/" apuntaría al filesystem.
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.fallback"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--wl-bg)", display: "grid", placeItems: "center", padding: 16 }}>
      <form onSubmit={onSubmit} style={{ width: "100%", maxWidth: 360, background: "var(--wl-surface)", borderRadius: 18, padding: "22px 20px", border: "1px solid color-mix(in srgb,var(--wl-text) 8%,transparent)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <HolyOlyIcon size={72} />
          <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)", textAlign: "center" }}>
            {t("google.connected")}
          </div>
        </div>

        <label style={label}>{t("fields.roleLabel")}</label>
        <div role="group" aria-label={t("fields.roleGroupLabel")} style={{ display: "flex", gap: 8, marginTop: 6 }}>
          {(["coach", "atleta"] as const).map((r) => (
            <button type="button" key={r} onClick={() => setRole(r)}
              style={{ flex: 1, padding: "8px", borderRadius: 10, cursor: "pointer", fontFamily: "var(--wl-display)", fontWeight: 700,
                border: `1px solid ${role === r ? "var(--wl-accent)" : "color-mix(in srgb,var(--wl-text) 16%,transparent)"}`,
                background: role === r ? "color-mix(in srgb,var(--wl-accent) 16%,transparent)" : "transparent", color: "var(--wl-text)" }}>
              {r === "coach" ? t("fields.roleCoach") : t("fields.roleAtleta")}
            </button>
          ))}
        </div>

        <label style={label}>{t("fields.name")}</label>
        <input style={input} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("fields.namePlaceholder")} />

        {role === "atleta" && (
          <>
            <label style={label}>{t("fields.sexLabel")}</label>
            <div role="group" aria-label={t("fields.sexGroupLabel")} style={{ display: "flex", gap: 8, marginTop: 6 }}>
              {(["M", "F"] as const).map((s) => (
                <button type="button" key={s} onClick={() => setSexo(s)} aria-pressed={sexo === s}
                  style={{ flex: 1, padding: "8px", borderRadius: 10, cursor: "pointer", fontFamily: "var(--wl-display)", fontWeight: 700,
                    border: `1px solid ${sexo === s ? "var(--wl-accent)" : "color-mix(in srgb,var(--wl-text) 16%,transparent)"}`,
                    background: sexo === s ? "color-mix(in srgb,var(--wl-accent) 16%,transparent)" : "transparent", color: "var(--wl-text)" }}>
                  {s === "M" ? t("fields.sexMale") : t("fields.sexFemale")}
                </button>
              ))}
            </div>
            <label style={label} htmlFor="gc-weight">{t("fields.weight")}</label>
            <input id="gc-weight" style={input} type="number" inputMode="decimal" min={20} max={300} step={0.5}
              value={weightKg} onChange={(e) => setWeightKg(e.target.value)} placeholder={t("fields.weightPlaceholder")} />
          </>
        )}

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

        {error && <div role="alert" style={{ marginTop: 12, color: "var(--wl-danger)", fontFamily: "var(--mono)", fontSize: 11 }}>{error}</div>}

        <button type="submit" disabled={busy || !accepted} style={{ width: "100%", marginTop: 18, padding: 12, borderRadius: 12, border: 0, cursor: busy || !accepted ? "default" : "pointer",
          background: "var(--wl-accent)", color: "var(--wl-bg)", fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 15, opacity: busy || !accepted ? 0.6 : 1 }}>
          {busy ? "..." : t("google.complete")}
        </button>

        <Link to="/login" style={{ display: "block", marginTop: 12, textAlign: "center", fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)" }}>
          {t("common:backToLogin")}
        </Link>
      </form>
    </div>
  );
}
