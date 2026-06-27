import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useRepository } from "../../data/RepositoryProvider";
import { getRosterRows, type RosterRow } from "./roster";
import { AtletasHero } from "./atletas/AtletasHero";
import { AtletaMiniCard } from "./atletas/AtletaMiniCard";
import { RmFaltanteBanner } from "./atletas/RmFaltanteBanner";
import { DemoSalesStrip } from "./atletas/DemoSalesStrip";
import { DemoTourCard } from "./atletas/DemoTourCard";
import { LeadCaptureButton } from "./LeadCaptureButton";
import { API_ENABLED } from "../../data/apiConfig";
import { resetDemoStorage } from "../../data/resetDemo";
import { RetryButton } from "../../ui/RetryButton";
import { Loading } from "../../ui/Loading";
import { useAuthMaybe } from "../../auth/AuthContext";
import { OnboardingCard } from "../../onboarding/OnboardingCard";
import { onboardingKey } from "../../onboarding/onboardingSeen";
import { COACH_STEPS, ONBOARDING_TITLE_COACH } from "../../onboarding/steps";
import { VerifyEmailBanner } from "../../ui/VerifyEmailBanner";

/** Plantel (coach) — layout "FUT": carta dorada del mejor readiness + grilla de mini-cards.
 *  El estado (semáforo) sale de los datos; el oro es identidad decorativa. */
export function Equipo() {
  const repo = useRepository();
  const navigate = useNavigate();
  const { t } = useTranslation("roster");
  const onResetDemo = (): void => {
    if (window.confirm(t("resetDemoConfirm"))) {
      resetDemoStorage(window.localStorage);
      window.location.reload();
    }
  };
  const auth = useAuthMaybe();
  const user = auth?.user ?? null;
  const [rows, setRows] = useState<RosterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  // Reintentar re-dispara el load() vía stamp (mantiene la cancelación del effect).
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let on = true;
    setLoading(true); setError(false);
    getRosterRows(repo)
      .then((r) => { if (on) { setRows(r); setLoading(false); } })
      .catch(() => { if (on) { setError(true); setLoading(false); } });
    return () => { on = false; };
  }, [repo, reload]);

  const onPick = (id: string) => navigate(`/coach/a/${id}`);
  const withData = rows.filter((r) => r.cell !== "none" && r.readiness != null);
  const hero = withData.length
    ? withData.reduce((b, r) => (r.readiness! > b.readiness! ? r : b), withData[0]!)
    : undefined;
  const rest = rows.filter((r) => r.id !== hero?.id);

  return (
    <div style={{ padding: "14px 18px 26px", color: "var(--wl-text)", minHeight: "100vh", maxWidth: 390, margin: "0 auto", background: "radial-gradient(130% 50% at 50% -5%, color-mix(in srgb, var(--wl-accent) 7%, var(--wl-bg)) 0%, var(--wl-bg) 55%)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
        <h1 style={{ margin: 0, fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 24, letterSpacing: -.4 }}>{t("title")}</h1>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)" }}>{t("countAthletes", { count: rows.length })}</span>
          <Link to="/coach/competencias" style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--wl-accent)", textDecoration: "none" }}>{t("linkComps")}</Link>
          {API_ENABLED && (
            <Link to="/coach/invitaciones" style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--wl-accent)", textDecoration: "none" }}>{t("linkInvites")}</Link>
          )}
          {!API_ENABLED && (
            <>
              <LeadCaptureButton variant="discreet" />
              <button type="button" onClick={onResetDemo}
                style={{ minHeight: 28, marginTop: 2, padding: "4px 10px", borderRadius: 8, border: "1px solid color-mix(in srgb,var(--wl-text) 16%,transparent)", background: "transparent", color: "var(--wl-muted)", fontFamily: "var(--mono)", fontSize: 10, cursor: "pointer" }}>
                {t("resetDemo")}
              </button>
            </>
          )}
        </div>
      </div>

      {/* W5: email sin verificar → el coach se entera acá, no recién al intentar confirmar un atleta. */}
      {API_ENABLED && user?.emailVerified === false && <VerifyEmailBanner />}

      {error ? (
        <div role="alert" style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-danger)", padding: "16px 0" }}>
          {t("loadError")}{" "}
          <RetryButton onClick={() => setReload((r) => r + 1)} />
        </div>
      ) : loading ? (
        <Loading style={{ fontFamily: "var(--mono)", fontSize: 11, padding: "16px 0" }}>{t("loading")}</Loading>
      ) : API_ENABLED && rows.length === 0 ? (
        // Coach nuevo (0 atletas): en vez de "EL PLANTEL" sobre un vacío, un próximo paso claro.
        <div style={{ marginTop: 26, textAlign: "center" }}>
          <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 18, color: "var(--wl-text)" }}>{t("emptyTitle")}</div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--wl-muted)", marginTop: 8, lineHeight: 1.5 }}>
            {t("emptyBody")}
          </div>
          <Link to="/coach/invitaciones" style={{ display: "inline-block", marginTop: 16, padding: "11px 18px", borderRadius: 12, background: "var(--wl-accent)", color: "var(--wl-bg)", fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 14, textDecoration: "none" }}>
            {t("emptyCta")}
          </Link>
        </div>
      ) : (
        <>
          {/* Alerta: atletas sin RM (sin RM no se puede prescribir). Lleva al drill-down a asignar macro. */}
          <RmFaltanteBanner rows={rows} onPick={onPick} />
          {!API_ENABLED && <DemoSalesStrip rows={rows} />}
          {hero && <AtletasHero row={hero} onPick={onPick} />}
          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "16px 0 11px" }}>
            <span style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 13, letterSpacing: 1, color: "var(--wl-muted)", textTransform: "uppercase" }}>{t("sectionRoster")}</span>
            <span style={{ flex: 1, height: 1, background: "rgba(255,255,255,.1)" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
            {rest.map((r) => <AtletaMiniCard key={r.id} row={r} onPick={onPick} />)}
          </div>
        </>
      )}
      {!API_ENABLED && <DemoTourCard />}
      {API_ENABLED && user && (
        <OnboardingCard
          title={ONBOARDING_TITLE_COACH}
          steps={COACH_STEPS}
          storageKey={onboardingKey(user.id)}
        />
      )}
    </div>
  );
}
