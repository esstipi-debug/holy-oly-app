import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useRepository } from "../../data/RepositoryProvider";
import { MACROCYCLES, rosterStatus, weekOfDate, dateOfWeek, isTaperWeek, defaultStartDate, sessionsPerWeek, type Atleta, type Competencia, type CycleContext, type Macrocycle, type MonitorSeries, type SessionLog, type Plan } from "@holy-oly/core";
import { ROSTER_META } from "../../data/seeds";
import { Badge } from "../../ui/Badge";
import { BackButton } from "../../ui/BackButton";
import { SegmentedToggle } from "../../ui/SegmentedToggle";
import { RetryButton } from "../../ui/RetryButton";
import { Loading } from "../../ui/Loading";
import { CompSheet } from "./CompSheet";
import { applyToggle } from "./sessions/sessionLog";
import { weekSignals } from "../../ui/charts/weekSignals";
import { WeekDetailSheet } from "../../ui/charts/WeekDetailSheet";
import { AtletaPreview } from "./AtletaPreview";
import { HomeScreen } from "../atleta/HomeScreen";
import { LocalMeClient } from "../../data/LocalMeClient";
import { API_ENABLED } from "../../data/apiConfig";
import { ResumenTab } from "./drilldown/ResumenTab";
import { MonitorTab } from "./drilldown/MonitorTab";
import { PlanTab } from "./drilldown/PlanTab";
import { TABS, toTab, type TabKey } from "./drilldown/tabs";

export function Drilldown() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const repo = useRepository();
  // P1: la tab activa vive en `?tab=` (URL-as-state). Se deriva de la URL en cada render — sin estado
  // espejo — y se valida con toTab para que valores desconocidos caigan a Resumen sin romper.
  const [params, setParams] = useSearchParams();
  const tab = toTab(params.get("tab"));
  const setTab = (next: TabKey): void => {
    const p = new URLSearchParams(params);
    p.set("tab", next);
    setParams(p, { replace: true }); // replace: el back vuelve al roster, no cicla tabs
  };
  const [athlete, setAthlete] = useState<Atleta | undefined>();
  const [series, setSeries] = useState<MonitorSeries | undefined>();
  const [comps, setComps] = useState<Competencia[]>([]);
  const [plan, setPlan] = useState<Plan | undefined>();
  const [sessionLog, setSessionLog] = useState<SessionLog>([]);
  const [sessionError, setSessionError] = useState(false);
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
    Promise.all([repo.getAthlete(id), repo.getSeries(id), repo.getComps(id), repo.getSessionLog(id), repo.getPlan(id), repo.getCycleContext(id)])
      .then(([a, s, c, sl, pl, cy]) => {
        if (!on) return;
        setAthlete(a); setSeries(s); setComps(c); setSessionLog(sl); setPlan(pl); setCycleCtx(cy); setLoaded(true);
      })
      .catch(() => { if (on) { setError(true); setLoaded(true); } });
    return () => { on = false; };
  }, [repo, id, reload]);

  if (!loaded) return <Loading style={{ padding: 24 }}>Cargando…</Loading>;
  if (error) {
    return (
      <div role="alert" style={{ padding: 24, color: "var(--wl-text)" }}>
        No se pudo cargar el atleta.{" "}
        <RetryButton onClick={() => setReload((r) => r + 1)} fontSize={12} />
      </div>
    );
  }
  if (!athlete) return <div style={{ padding: 24, color: "var(--wl-text)" }}>Atleta no encontrado.</div>;

  const macro: Macrocycle | undefined = athlete.macroId ? MACROCYCLES.find((m) => m.id === athlete.macroId) : undefined;
  const metodo = ROSTER_META[athlete.id]?.metodo ?? "";
  const cell = rosterStatus(series);
  const estadoLabel = cell === "alert" ? "Alerta" : cell === "warn" ? "Vigilar" : cell === "ok" ? "OK" : "Sin datos";

  const maxWeek = macro?.phaseProfile.at(-1)?.weeks[1] ?? 16;
  // Effective plan start date: real one once M5 sets it; until then anchor today to the current
  // series week so macro weeks map to real calendar dates (and competitions can be picked by date).
  const today = new Date().toISOString().slice(0, 10);
  // Real plan anchor once assigned (M5); else derive so today maps to the current series week.
  const startDate = plan?.startDate ?? defaultStartDate(today, series?.weeks ?? 1);
  const hoyWeek = weekOfDate(startDate, today, maxWeek);
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
      <BackButton ariaLabel="Volver a Atletas" onClick={() => navigate("/coach")} style={{ marginBottom: 5 }} />
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
        <SegmentedToggle
          ariaLabel="Ver como"
          options={[["coach", "Coach"], ["atleta", "Atleta"]] as const}
          value={asAthlete ? "atleta" : "coach"}
          onChange={(v) => setAsAthlete(v === "atleta")}
          size="lg"
          style={{ marginTop: 12 }}
        />
      )}

      {asAthlete ? (
        <div style={{ marginTop: 14 }}>
          {/* Full athlete Home (greeting · estado · constancia · camino), then the money-shot
              prescription with discs. Both read the same id-scoped client → the coach's edit shows. */}
          <HomeScreen client={previewClient} variant="tap" preview />
          <AtletaPreview athleteId={id} week={hoyWeek} sexo={athlete.sexo} client={previewClient} />
        </div>
      ) : (
        <>
          {/* Tira de tabs sticky: el header (identidad) scrollea, las tabs se fijan. Fondo opaco +
              hairline para que el contenido no traspase; zIndex 10 < BottomNav (20). */}
          <div style={{ position: "sticky", top: 0, zIndex: 10, margin: "12px -13px 0", padding: "8px 13px", background: "var(--wl-bg)", borderBottom: "1px solid color-mix(in srgb,var(--wl-text) 8%,transparent)" }}>
            <SegmentedToggle ariaLabel="Sección del atleta" options={TABS} value={tab} onChange={setTab} size="lg" />
          </div>

          <div className="wl-viewfade" style={{ marginTop: 14 }}>
            {tab === "resumen" && (
              <ResumenTab athleteId={id} macro={macro} seriesWeeks={series?.weeks} comps={comps} cycleCtx={cycleCtx} />
            )}
            {tab === "monitor" && (
              <MonitorTab series={series} macro={macro} onPointClick={setSelectedWeek} />
            )}
            {tab === "plan" && (
              <PlanTab
                athleteId={id}
                macro={macro}
                plan={plan}
                maxWeek={maxWeek}
                startDate={startDate}
                hoyWeek={hoyWeek}
                perWeek={perWeek}
                comps={comps}
                sessionLog={sessionLog}
                sessionError={sessionError}
                today={today}
                sexo={athlete.sexo}
                loadHeat={loadHeat}
                loadWeek={loadWeek}
                onWeekClick={setSelectedWeek}
                onToggle={(w, i) => void onToggleSession(w, i)}
                onRmsChange={onRmsChange}
                rmsStamp={rmsStamp}
              />
            )}
          </div>
        </>
      )}

      {/* Palmarés/medallas DESACTIVADAS por el owner (2026-06-12). Medal.tsx + MedalSheet.tsx y la
          capa de datos (getMedals/addMedal, seeds) quedan vivas para reactivar. */}

      {/* Overlays cross-cutting: se abren desde Monitor (charts) Y Plan (calendario), así que viven
          en el shell, fuera del switch de tabs y del switch asAthlete. */}
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
