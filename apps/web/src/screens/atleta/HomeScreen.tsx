import { useCallback, useEffect, useState } from "react";
import { seriesState, type CellState, type DayLogInput, type DayLogView, type MePlanView, type MonitorSeries } from "@holy-oly/core";
import * as me from "../../data/meClient";
import { Titular } from "./hoy/Titular";
import { ConstanciaCard } from "./hoy/ConstanciaCard";
import { CaminoCard } from "./hoy/CaminoCard";
import { CheckIn } from "./CheckIn";
import { Check } from "./primitives";
import { useAtletaCtx } from "./AthleteShell";

type Load = "loading" | "ready" | "error";

export function HomeScreen() {
  const { variant } = useAtletaCtx();
  const [plan, setPlan] = useState<MePlanView | null>(null);
  const [series, setSeries] = useState<MonitorSeries | undefined>(undefined);
  const [daylog, setDaylog] = useState<DayLogView | null>(null);
  const [load, setLoad] = useState<Load>("loading");
  const [checkinOpen, setCheckinOpen] = useState(false);

  useEffect(() => {
    let on = true;
    setLoad("loading");
    Promise.all([me.getMePlan(), me.getMeSeries(), me.getDayLog()])
      .then(([p, s, d]) => { if (on) { setPlan(p); setSeries(s); setDaylog(d); setLoad("ready"); } })
      .catch(() => { if (on) setLoad("error"); });
    return () => { on = false; };
  }, []);

  const onCheckinDone = useCallback(async (input: DayLogInput) => {
    await me.putDayLog(input);
    const fresh = await me.getDayLog();
    setDaylog(fresh);
  }, []);

  if (load === "loading") {
    return <div aria-busy="true" style={{ padding: 24, color: "var(--wl-muted)", fontFamily: "var(--ho-mono)" }}>Cargando…</div>;
  }
  if (load === "error" || !plan || !daylog) {
    return <div role="alert" style={{ padding: 24, color: "var(--wl-muted)", fontFamily: "var(--ho-mono)" }}>No se pudo cargar tu inicio. Probá de nuevo más tarde.</div>;
  }

  const currentWeek = plan.plan?.currentWeek ?? (series ? series.weeks : 1);
  const titularState: CellState = series ? seriesState(series, currentWeek) : "none";
  const checkedIn = daylog.entry !== null;
  const firstName = plan.athlete.nombre.split(" ")[0] || plan.athlete.nombre;

  return (
    <>
      <div className="ho-greet">
        <div className="ho-greet__h">Hola, {firstName}</div>
        <div className="ho-greet__s">
          {plan.plan
            ? `${plan.plan.macroName} · semana ${plan.plan.currentWeek} de ${plan.plan.totalWeeks} · ${plan.plan.currentPhase}`
            : "tu coach todavía no te asignó un plan"}
        </div>
      </div>

      <Titular state={titularState} />

      {checkedIn ? (
        <button className="ho-cta__done" onClick={() => setCheckinOpen(true)}>
          <span className="ho-cta__check"><Check size={16} /></span>
          <span style={{ flex: 1 }}>
            <b>Check-in de hoy, listo</b>
            <span>Gracias por registrarte · podés editarlo cuando quieras</span>
          </span>
        </button>
      ) : (
        <button className="wl-btn wl-btn--primary ho-cta" onClick={() => setCheckinOpen(true)}>Hacer check-in de hoy</button>
      )}

      <ConstanciaCard streak={daylog.streak} days={daylog.days} today={daylog.today} />
      <CaminoCard plan={plan.plan} />

      {checkinOpen && (
        <CheckIn variant={variant} initial={daylog.entry} onClose={() => setCheckinOpen(false)} onDone={onCheckinDone} />
      )}
    </>
  );
}
