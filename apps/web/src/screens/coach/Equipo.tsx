import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useRepository } from "../../data/RepositoryProvider";
import { getRosterRows, type RosterRow } from "./roster";
import { AtletasHero } from "./atletas/AtletasHero";
import { AtletaMiniCard } from "./atletas/AtletaMiniCard";
import { DemoSalesStrip } from "./atletas/DemoSalesStrip";
import { DemoTourCard } from "./atletas/DemoTourCard";
import { LeadCaptureButton } from "./LeadCaptureButton";
import { API_ENABLED } from "../../data/apiConfig";
import { resetDemoStorage } from "../../data/resetDemo";
import { useAuthMaybe } from "../../auth/AuthContext";
import { OnboardingCard } from "../../onboarding/OnboardingCard";
import { onboardingKey } from "../../onboarding/onboardingSeen";
import { COACH_STEPS, ONBOARDING_TITLE_COACH } from "../../onboarding/steps";

function onResetDemo(): void {
  if (window.confirm("¿Reiniciar el demo al estado inicial? Se borran los cambios de esta sesión (pesos, registros, recorrido).")) {
    resetDemoStorage(window.localStorage);
    window.location.reload();
  }
}

/** Plantel (coach) — layout "FUT": carta dorada del mejor readiness + grilla de mini-cards.
 *  El estado (semáforo) sale de los datos; el oro es identidad decorativa. */
export function Equipo() {
  const repo = useRepository();
  const navigate = useNavigate();
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
    <div style={{ padding: "14px 18px 26px", color: "var(--wl-text)", minHeight: "100vh", maxWidth: 390, margin: "0 auto", background: "radial-gradient(130% 50% at 50% -5%, #1A1813 0%, #0A0B0E 55%)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
        <h1 style={{ margin: 0, fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 24, letterSpacing: -.4 }}>Plantel</h1>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)" }}>{rows.length} ATLETAS</span>
          {API_ENABLED && (
            <Link to="/coach/invitaciones" style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--wl-accent)", textDecoration: "none" }}>Invitaciones ›</Link>
          )}
          {!API_ENABLED && (
            <>
              <LeadCaptureButton variant="discreet" />
              <button type="button" onClick={onResetDemo}
                style={{ minHeight: 28, marginTop: 2, padding: "4px 10px", borderRadius: 8, border: "1px solid color-mix(in srgb,var(--wl-text) 16%,transparent)", background: "transparent", color: "var(--wl-muted)", fontFamily: "var(--mono)", fontSize: 10, cursor: "pointer" }}>
                ↻ Reiniciar demo
              </button>
            </>
          )}
        </div>
      </div>

      {error ? (
        <div role="alert" style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-danger)", padding: "16px 0" }}>
          No se pudo cargar el plantel.{" "}
          <button type="button" onClick={() => setReload((r) => r + 1)}
            style={{ border: 0, background: "transparent", color: "var(--wl-accent)", fontFamily: "var(--mono)", fontSize: 11, cursor: "pointer", textDecoration: "underline", padding: 0 }}>
            Reintentar
          </button>
        </div>
      ) : loading ? (
        <div aria-busy="true" style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)", padding: "16px 0" }}>Cargando plantel…</div>
      ) : (
        <>
          {!API_ENABLED && <DemoSalesStrip rows={rows} />}
          {hero && <AtletasHero row={hero} onPick={onPick} />}
          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "16px 0 11px" }}>
            <span style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 13, letterSpacing: 1, color: "var(--wl-muted)", textTransform: "uppercase" }}>El plantel</span>
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
