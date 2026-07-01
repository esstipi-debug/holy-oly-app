import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useOutletContext } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { seriesState, type CellState, type DayLogInput, type DayLogView, type MePlanView, type MonitorSeries } from "@holy-oly/core";
import { meClient, type MeClient } from "../../data/meClient";
import type { CheckinVariant } from "./prefs";
import { Titular } from "./hoy/Titular";
import { EstadoTip } from "./hoy/EstadoTip";
import { AtencionBlock } from "./hoy/AtencionBlock";
import { CaminoCard } from "./hoy/CaminoCard";
import { SemanaCard } from "./hoy/SemanaCard";
import { CicloCarousel } from "./ciclo/CicloCarousel";
import { CrearCicloSheet } from "./crear/CrearCicloSheet";
import { CheckIn } from "./CheckIn";
import { Check } from "./primitives";
import type { AtletaOutletCtx } from "./AthleteShell";
import { useAuthMaybe } from "../../auth/AuthContext";
import { API_ENABLED } from "../../data/apiConfig";
import { Loading } from "../../ui/Loading";
import { OnboardingCard } from "../../onboarding/OnboardingCard";
import { onboardingKey } from "../../onboarding/onboardingSeen";
import { ATLETA_STEPS, ONBOARDING_TITLE_ATLETA } from "../../onboarding/steps";

type Load = "loading" | "ready" | "error";

/**
 * The athlete Home. Normally rendered inside `AthleteShell`'s Outlet for the logged-in athlete,
 * but the coach "ver como atleta" toggle reuses it standalone: it injects an id-scoped `client`,
 * renders with no Outlet context, and sets `preview` (drops the navigation-only SemanaCard, since
 * the entreno route isn't reachable from the coach drill-down).
 */
export function HomeScreen({ client = meClient, variant: variantProp, preview = false }: {
  client?: MeClient;
  variant?: CheckinVariant;
  preview?: boolean;
} = {}) {
  // Tolerate a missing Outlet (preview mode): useOutletContext returns null outside an <Outlet>.
  const { t } = useTranslation(["atleta", "domain"]);
  const ctx = useOutletContext<AtletaOutletCtx | null>();
  const variant: CheckinVariant = variantProp ?? ctx?.variant ?? "tap";
  const location = useLocation();
  const user = useAuthMaybe()?.user ?? null;
  const [plan, setPlan] = useState<MePlanView | null>(null);
  const [series, setSeries] = useState<MonitorSeries | undefined>(undefined);
  const [daylog, setDaylog] = useState<DayLogView | null>(null);
  const [load, setLoad] = useState<Load>("loading");
  const [checkinOpen, setCheckinOpen] = useState(() => Boolean((location.state as { openCheckin?: boolean } | null)?.openCheckin));
  const [crearOpen, setCrearOpen] = useState(false);

  useEffect(() => {
    let on = true;
    setLoad("loading");
    Promise.all([client.getMePlan(), client.getMeSeries(), client.getDayLog()])
      .then(([p, s, d]) => { if (on) { setPlan(p); setSeries(s); setDaylog(d); setLoad("ready"); } })
      .catch(() => { if (on) setLoad("error"); });
    return () => { on = false; };
  }, [client]);

  const onCheckinDone = useCallback(async (input: DayLogInput) => {
    await client.putDayLog(input);
    const fresh = await client.getDayLog();
    setDaylog(fresh);
  }, [client]);

  // Re-fetch tras crear el propio ciclo (self-coach): el plan recién creado enciende Hoy.
  const reload = useCallback(async () => {
    setLoad("loading");
    try {
      const [p, s, d] = await Promise.all([client.getMePlan(), client.getMeSeries(), client.getDayLog()]);
      setPlan(p); setSeries(s); setDaylog(d); setLoad("ready");
    } catch { setLoad("error"); }
  }, [client]);

  if (load === "loading") {
    return <Loading style={{ padding: 24, fontFamily: "var(--mono)" }} />;
  }
  if (load === "error" || !plan || !daylog) {
    return <div role="alert" style={{ padding: 24, color: "var(--wl-muted)", fontFamily: "var(--mono)" }}>{t("homeError")}</div>;
  }

  // Without an assigned plan there is no date anchor, so there is no honest "estado de hoy"
  // (never derive the current week from the series length). Show "none" until the coach assigns one.
  const titularState: CellState = plan.plan && series ? seriesState(series, plan.plan.currentWeek) : "none";
  const checkedIn = daylog.entry !== null;
  const firstName = plan.athlete.nombre.split(" ")[0] || plan.athlete.nombre;

  return (
    <>
      <div className="ho-greet">
        <div className="ho-greet__h">{t("homeGreet", { name: firstName })}</div>
        <div className="ho-greet__s">
          {plan.plan
            ? t("homePlanLine", {
                macro: plan.plan.macroId ? t(`domain:macro.${plan.plan.macroId}.name`) : plan.plan.macroName,
                week: plan.plan.currentWeek, total: plan.plan.totalWeeks,
                phase: plan.plan.macroId ? t(`domain:macro.${plan.plan.macroId}.phase.${plan.plan.currentPhaseKey}.name`) : plan.plan.currentPhase,
              })
            : t("homeNoPlan")}
        </div>
        {/* Empty-state con salida: sin plan → armá tu propio ciclo (self-coach) o vinculate con un
            coach (no en preview del coach). */}
        {!plan.plan && !preview && (
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
            <button type="button" className="wl-btn wl-btn--primary" onClick={() => setCrearOpen(true)}>Crear mi ciclo</button>
            <Link to="/atleta/cuenta" style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-accent)", textDecoration: "none" }}>
              o vinculate con tu coach en Cuenta ›
            </Link>
          </div>
        )}
      </div>

      <Titular state={titularState} />
      {/* Aviso de racha: "si esto sigue, va a pasar X". Aparece solo con racha activa (else null). */}
      <AtencionBlock headsUp={daylog.headsUp} />
      {/* Tip del día (parafraseado de divulgación científica), elegido por estado + ítem más flojo del
          check-in. Determinístico por fecha → varía día a día sin cambiar a cada render. */}
      <EstadoTip state={titularState} entry={daylog.entry} seed={Number(daylog.today.replaceAll("-", "")) || 0} />

      {checkedIn ? (
        <button className="ho-cta__done" onClick={() => setCheckinOpen(true)}>
          <span className="ho-cta__check"><Check size={16} /></span>
          <span style={{ flex: 1 }}>
            <b>{t("homeCheckinDoneTitle")}</b>
            <span>{t("homeCheckinDoneSub")}</span>
          </span>
        </button>
      ) : (
        <button className="wl-btn wl-btn--primary ho-cta" onClick={() => setCheckinOpen(true)}>{t("homeCheckinCta")}</button>
      )}

      {plan.plan && !preview && <SemanaCard week={plan.plan.currentWeek} client={client} />}
      <CaminoCard plan={plan.plan} client={client} sexo={plan.athlete.sexo} />
      {/* «Tu ciclo» en la portada — sólo si la atleta registró su ciclo (hideWhenEmpty: no naggea el opt-in). */}
      <CicloCarousel client={client} hideWhenEmpty />

      {checkinOpen && (
        <CheckIn variant={variant} initial={daylog.entry} lastWeight={series?.bodyweight?.at(-1)} onClose={() => setCheckinOpen(false)} onDone={onCheckinDone} />
      )}
      {API_ENABLED && user && !preview && (
        <OnboardingCard
          title={ONBOARDING_TITLE_ATLETA}
          steps={ATLETA_STEPS}
          storageKey={onboardingKey(user.id)}
        />
      )}
      {!preview && (
        <CrearCicloSheet open={crearOpen} onClose={() => setCrearOpen(false)} onCreated={reload} client={client} />
      )}
    </>
  );
}
