import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useRepository } from "../../data/RepositoryProvider";
import { MACROCYCLES, rosterStatus, weekOfDate, dateOfWeek, isTaperWeek, defaultStartDate, sessionsPerWeek, type Atleta, type Competencia, type CycleContext, type Macrocycle, type Medal, type MonitorSeries, type SessionLog, type Plan } from "@holy-oly/core";
import { ROSTER_META } from "../../data/seeds";
import { AcwrChart } from "../../ui/charts/AcwrChart";
import { LoadChart } from "../../ui/charts/LoadChart";
import { RecoveryChart } from "../../ui/charts/RecoveryChart";
import { ImrFaseChart } from "../../ui/charts/ImrFaseChart";
import { WellnessChart } from "../../ui/charts/WellnessChart";
import { CompChart } from "../../ui/charts/CompChart";
import { WeightChart } from "../../ui/charts/WeightChart";
import { MacroTimeline } from "../../ui/charts/MacroTimeline";
import { Medal as MedalIcon } from "../../ui/Medal";
import { Badge } from "../../ui/Badge";
import { MedalSheet } from "./MedalSheet";
import { CompSheet } from "./CompSheet";
import { SessionAdherence } from "./sessions/SessionAdherence";
import { applyToggle } from "./sessions/sessionLog";
import { weekSignals } from "../../ui/charts/weekSignals";
import { WeekDetailSheet } from "../../ui/charts/WeekDetailSheet";
import { PlanCalendar } from "./calendar/PlanCalendar";
import { SessionsSection } from "./sessions/SessionsSection";
import { RmSection } from "./rm/RmSection";
import { AtletaPreview } from "./AtletaPreview";
import { HomeScreen } from "../atleta/HomeScreen";
import { LocalMeClient } from "../../data/LocalMeClient";
import { API_ENABLED } from "../../data/apiConfig";

export function Drilldown() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const repo = useRepository();
  const [athlete, setAthlete] = useState<Atleta | undefined>();
  const [series, setSeries] = useState<MonitorSeries | undefined>();
  const [medals, setMedals] = useState<Medal[]>([]);
  const [comps, setComps] = useState<Competencia[]>([]);
  const [plan, setPlan] = useState<Plan | undefined>();
  const [sessionLog, setSessionLog] = useState<SessionLog>([]);
  const [sessionError, setSessionError] = useState(false);
  const [medalOpen, setMedalOpen] = useState(false);
  const [compOpen, setCompOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  // Reintentar re-dispara el load vía stamp (mantiene la cancelación del effect).
  const [reload, setReload] = useState(0);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  // P1 demo-only "ver como atleta": swap the coach body for the athlete's own view of THIS athlete.
  const [asAthlete, setAsAthlete] = useState(false);
  // Id-scoped athlete client for the preview — reads the SAME localStorage the coach just wrote,
  // so a freshly edited plan/weight lands when the toggle remounts the athlete view.
  const previewClient = useMemo(() => new LocalMeClient(id), [id]);
  // Identidad estable para los efectos lazy del calendario-mapa (no re-agendar por cada render).
  const loadHeat = useCallback(() => repo.getPlanHeat(id), [repo, id]);
  const loadWeek = useCallback((w: number) => repo.getPrescriptionWeek(id, w), [repo, id]);
  // SP5: tras subir un RM, remontar las secciones que cachean kg derivado (mapa + sesiones).
  const [rmsStamp, setRmsStamp] = useState(0);
  const onRmsChange = useCallback(() => {
    setRmsStamp((s) => s + 1); // primero: las secciones remontadas refetchean su kg pase lo que pase
    // Best-effort: si este refetch falla queda el plan anterior (la próxima carga lo corrige).
    void repo.getPlan(id).then((p) => { if (p) setPlan(p); }, () => {});
  }, [repo, id]);

  // Ciclo redactado del atleta (slice ciclo-visible): {share, lúteo-hoy, salud, fiable} — jamás fase/fecha.
  const [cycleCtx, setCycleCtx] = useState<CycleContext | undefined>(undefined);

  useEffect(() => {
    let on = true;
    setLoaded(false); setError(false); setAsAthlete(false); // reset on athlete change (incl. the athlete-view toggle)
    Promise.all([repo.getAthlete(id), repo.getSeries(id), repo.getMedals(id), repo.getComps(id), repo.getSessionLog(id), repo.getPlan(id), repo.getCycleContext(id)])
      .then(([a, s, m, c, sl, pl, cy]) => {
        if (!on) return;
        setAthlete(a); setSeries(s); setMedals(m); setComps(c); setSessionLog(sl); setPlan(pl); setCycleCtx(cy); setLoaded(true);
      })
      .catch(() => { if (on) { setError(true); setLoaded(true); } });
    return () => { on = false; };
  }, [repo, id, reload]);

  if (!loaded) return <div aria-busy="true" style={{ padding: 24, color: "var(--wl-muted)" }}>Cargando…</div>;
  if (error) {
    return (
      <div role="alert" style={{ padding: 24, color: "var(--wl-text)" }}>
        No se pudo cargar el atleta.{" "}
        <button type="button" onClick={() => setReload((r) => r + 1)}
          style={{ border: 0, background: "transparent", color: "var(--wl-accent)", fontFamily: "var(--mono)", fontSize: 12, cursor: "pointer", textDecoration: "underline", padding: 0 }}>
          Reintentar
        </button>
      </div>
    );
  }
  if (!athlete) return <div style={{ padding: 24, color: "var(--wl-text)" }}>Atleta no encontrado.</div>;

  const macro: Macrocycle | undefined = athlete.macroId ? MACROCYCLES.find((m) => m.id === athlete.macroId) : undefined;
  const metodo = ROSTER_META[athlete.id]?.metodo ?? "";
  const cell = rosterStatus(series);
  const estadoLabel = cell === "alert" ? "Alerta" : cell === "warn" ? "Vigilar" : cell === "ok" ? "OK" : "Sin datos";
  const counts = { oro: 0, plata: 0, bronce: 0 } as Record<Medal["medal"], number>;
  for (const m of medals) counts[m.medal]++;

  const maxWeek = macro?.phaseProfile.at(-1)?.weeks[1] ?? 16;
  // Effective plan start date: real one once M5 sets it; until then anchor today to the current
  // series week so macro weeks map to real calendar dates (and competitions can be picked by date).
  const today = new Date().toISOString().slice(0, 10);
  // Real plan anchor once assigned (M5); else derive so today maps to the current series week.
  const startDate = plan?.startDate ?? defaultStartDate(today, series?.weeks ?? 1);
  const hoyWeek = weekOfDate(startDate, today, maxWeek);
  async function onAddMedal(m: Medal): Promise<void> {
    await repo.addMedal(id, m);
    setMedals(await repo.getMedals(id));
  }
  async function onAddComp(name: string, date: string): Promise<void> {
    const week = weekOfDate(startDate, date, maxWeek);
    await repo.setComps(id, [...comps, { name, week, date }]);
    setComps(await repo.getComps(id));
  }
  async function onRemoveComp(i: number): Promise<void> {
    await repo.setComps(id, comps.filter((_, idx) => idx !== i));
    setComps(await repo.getComps(id));
  }
  const perWeek = macro ? sessionsPerWeek(macro.frequency) : 0;
  async function onToggleSession(week: number, idx: number): Promise<void> {
    const next = applyToggle(sessionLog, week, idx);
    setSessionLog(next); // optimistic
    setSessionError(false);
    try {
      await repo.setSessionLog(id, next);
    } catch {
      setSessionError(true);
      setSessionLog(await repo.getSessionLog(id)); // revert to the persisted truth
    }
  }
  const compLabel = (c: Competencia): string => c.date ?? `sem ${c.week}`;
  const compSummary =
    comps.length === 0
      ? "Sin competencia asignada"
      : comps.length === 1
        ? `${comps[0]!.name} · ${compLabel(comps[0]!)}`
        : `${comps.length} competencias · ${[...comps].sort((a, b) => a.week - b.week).map(compLabel).join(", ")}`;

  return (
    <div style={{ padding: "14px 13px 26px", color: "var(--wl-text)", background: "var(--wl-bg)", minHeight: "100vh", maxWidth: 390, margin: "0 auto", position: "relative" }}>
      <button type="button" aria-label="Volver a Atletas" onClick={() => navigate("/coach")}
        style={{ width: 34, height: 34, borderRadius: 10, border: "1px solid color-mix(in srgb,var(--wl-text) 15%,transparent)", background: "var(--wl-surface)", color: "var(--wl-text)", fontSize: 19, lineHeight: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, marginBottom: 10 }}>‹</button>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div>
          <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 22, lineHeight: 1 }}>{athlete.nombre}</div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--wl-muted)", marginTop: 6 }}>
            {metodo}{macro ? ` · ${macro.duration}` : ""}
          </div>
        </div>
        {cell === "none"
          ? <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-muted)", border: "1px solid color-mix(in srgb,var(--wl-text) 16%,transparent)", padding: "3px 8px", borderRadius: 99 }}>{estadoLabel}</span>
          : <Badge tone={cell}>{estadoLabel}</Badge>}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, padding: "10px 12px", borderRadius: 12, background: "var(--wl-surface)", border: "1px solid color-mix(in srgb,var(--wl-text) 8%,transparent)" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--wl-muted)" }}>Competencia{comps.length > 1 ? "s" : ""} objetivo</div>
          <div style={{ fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 13, color: "var(--wl-text)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{compSummary}</div>
        </div>
        <button type="button" onClick={() => setCompOpen(true)}
          style={{ flex: "0 0 auto", padding: "7px 14px", borderRadius: 10, border: 0, background: "var(--wl-accent)", color: "var(--wl-bg)", fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Asignar</button>
      </div>

      {!API_ENABLED && (
        <div role="group" aria-label="Ver como" style={{ display: "flex", gap: 0, marginTop: 12, width: "fit-content", background: "var(--wl-surface)", borderRadius: 10, padding: 3, border: "1px solid color-mix(in srgb,var(--wl-text) 8%,transparent)" }}>
          {([["coach", "Coach"], ["atleta", "Atleta"]] as const).map(([key, label]) => {
            const active = (key === "atleta") === asAthlete;
            return (
              <button key={key} type="button" aria-pressed={active} onClick={() => setAsAthlete(key === "atleta")}
                style={{ minHeight: 44, padding: "0 18px", borderRadius: 8, border: 0, cursor: "pointer", fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 13, letterSpacing: ".02em", background: active ? "var(--wl-accent)" : "transparent", color: active ? "var(--wl-bg)" : "var(--wl-muted)" }}>
                {label}
              </button>
            );
          })}
        </div>
      )}

      {asAthlete && (
        <div style={{ marginTop: 14 }}>
          {/* Full athlete Home (greeting · estado · constancia · camino), then the money-shot
              prescription with discs. Both read the same id-scoped client → the coach's edit shows. */}
          <HomeScreen client={previewClient} variant="tap" preview />
          <AtletaPreview athleteId={id} week={hoyWeek} sexo={athlete.sexo} client={previewClient} />
        </div>
      )}

      {!asAthlete && (<>
      {series ? (
        <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
          {macro && <MacroTimeline macro={macro} hoy={series.weeks} comps={comps} />}
          <AcwrChart series={series} onPointClick={setSelectedWeek} />
          <LoadChart series={series} onPointClick={setSelectedWeek} />
          <RecoveryChart series={series} onPointClick={setSelectedWeek} />
          {macro && <ImrFaseChart series={series} macro={macro} onPointClick={setSelectedWeek} />}
          {series.wellness.length > 0 && <WellnessChart series={series} onPointClick={setSelectedWeek} />}
          {series.compliance && series.compliance.length > 0 && <CompChart series={series} onPointClick={setSelectedWeek} />}
          {series.bodyweight && series.bodyweight.length > 0 && <WeightChart series={series} onPointClick={setSelectedWeek} />}
        </div>
      ) : (
        <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)", margin: "16px 0" }}>
          Este atleta aún sin datos de monitoreo. Cuando registre HRV/FC/carga, aparecerán acá.
        </div>
      )}

      {cycleCtx && (
        // Contrato redactado, paleta NEUTRA (jamás la del semáforo — el ciclo no es señal del estado).
        <div style={{ marginTop: 10, fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-muted)" }}>
          Ciclo · {cycleCtx.share === "full"
            ? `compartido — contexto lúteo hoy: ${cycleCtx.inLutealNow == null ? "—" : cycleCtx.inLutealNow ? "sí" : "no"}`
            : "compartido (mínimo)"}
          {cycleCtx.health === "referral" ? " · derivación sugerida" : ""}
          {!cycleCtx.reliable && cycleCtx.health !== "referral" ? " · registro irregular" : ""}
        </div>
      )}

      {macro && (
        <PlanCalendar
          key={`cal-${rmsStamp}`}
          macro={macro}
          weeks={maxWeek}
          startDate={startDate}
          hoyWeek={hoyWeek}
          comps={comps}
          marks={sessionLog}
          perWeek={perWeek}
          onWeekClick={setSelectedWeek}
          loadHeat={loadHeat}
          loadWeek={loadWeek}
          sexo={athlete.sexo}
          today={today}
        />
      )}

      {macro && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
            <div style={{ fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 13.5 }}>Planificación · sesiones</div>
            <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--wl-muted)" }}>tocá: · → ✓ → ✗</span>
          </div>
          {sessionError && <div role="alert" style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--wl-danger)", marginTop: 6 }}>No se pudo guardar la sesión. Reintentá.</div>}
          <div style={{ marginTop: 8 }}>
            <SessionAdherence marks={sessionLog} weeks={maxWeek} perWeek={perWeek} onToggle={(w, i) => void onToggleSession(w, i)} />
          </div>
        </div>
      )}

      <SessionsSection key={`ses-${rmsStamp}`} athleteId={athlete.id} hoyWeek={hoyWeek} totalWeeks={maxWeek} />

      {plan && <RmSection athleteId={id} plan={plan} today={today} onRmsChange={onRmsChange} />}

      <div style={{ marginTop: 16, fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 13.5 }}>Palmarés · competencias</div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", margin: "8px 0" }}>
        {(["oro", "plata", "bronce"] as const).map((k) => (
          <span key={k} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <MedalIcon metal={k} size={22} />
            <b style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{counts[k]}</b>
          </span>
        ))}
      </div>
      {medals.length === 0 ? (
        <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-muted)" }}>Sin medallas registradas.</div>
      ) : (
        medals.map((m, i) => (
          <div key={`${m.date}-${m.comp}-${m.medal}-${i}`} style={{ display: "flex", gap: 10, alignItems: "center", padding: "6px 0", borderTop: "1px solid color-mix(in srgb,var(--wl-text) 6%,transparent)" }}>
            <MedalIcon metal={m.medal} size={26} />
            <div>
              <div style={{ fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 12 }}>{m.comp}</div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--wl-muted)" }}>{m.date} · {m.cat} · Arr {m.sn} · Env {m.cj} · Total {m.sn + m.cj}</div>
            </div>
          </div>
        ))
      )}
      {athlete.compite && (
        <button type="button" onClick={() => setMedalOpen(true)}
          style={{ marginTop: 12, padding: "8px 14px", borderRadius: 10, border: "1px solid color-mix(in srgb,var(--wl-accent) 50%,transparent)", background: "color-mix(in srgb,var(--wl-accent) 12%,transparent)", color: "var(--wl-text)", fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>+ Añadir medalla</button>
      )}
      </>)}

      <MedalSheet open={medalOpen} onClose={() => setMedalOpen(false)} onSubmit={onAddMedal} />
      <CompSheet open={compOpen} onClose={() => setCompOpen(false)} comps={comps} startDate={startDate} totalWeeks={maxWeek} onAdd={onAddComp} onRemove={onRemoveComp} />
      {selectedWeek != null && (
        <WeekDetailSheet
          open
          onClose={() => setSelectedWeek(null)}
          week={selectedWeek}
          dateISO={dateOfWeek(startDate, selectedWeek)}
          isTaper={isTaperWeek(selectedWeek, comps)}
          signals={weekSignals(series, macro, selectedWeek)}
          perWeek={perWeek}
          marks={sessionLog}
          onToggle={(w, i) => void onToggleSession(w, i)}
        />
      )}
    </div>
  );
}
