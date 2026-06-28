import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { CycleData, CycleMark, MePlanView, SessionView, WeekHeat } from "@holy-oly/core";
import { barKgForSexo, cycleMarkFor, dateOfWeek, nextCycleWindow, CYCLE_PERIOD_DAYS, CYCLE_PRE_DAYS, CYCLE_HORIZON_CYCLES } from "@holy-oly/core";
import type { MeClient } from "../../data/meClient";
import { PlanHeatMap, HeatLegend, type HeatMapPos } from "../../ui/charts/PlanHeatMap";
import { PlanDayDetail, type DayDetailExercise } from "../../ui/charts/PlanDayDetail";
import { dayDateLabel, dayOffsetInWeek, isoRangeLabel, weekdayMonFirst } from "../../ui/charts/planDates";
import { phaseColor } from "../../ui/charts/phasePalette";
import { RetryButton } from "../../ui/RetryButton";
import { Loading } from "../../ui/Loading";

type PlanView = NonNullable<MePlanView["plan"]>;

const DAY = 86_400_000;
const ms = (iso: string): number => new Date(`${iso}T00:00:00Z`).getTime();
const isoAt = (base: string, plusDays: number): string => new Date(ms(base) + plusDays * DAY).toISOString().slice(0, 10);

/**
 * Mapa del plan del atleta — la misma pieza visual del coach (PlanHeatMap + PlanDayDetail),
 * alimentada por su propio cliente (`/me/heat` + `/me/sessions`): el kg llega derivado del
 * server, el RM nunca viaja, y jamás RPE. Sin marcas de adherencia (son del coach) en v1.
 * Se monta sólo con el sheet abierto → la carga es lazy y el estado se resetea al cerrar.
 * Sin `startDate` no hay verdad de fechas: ni anillo HOY ni títulos con fecha (honesto).
 */
export function PlanMapSection({ plan, client, sexo }: { plan: PlanView; client: MeClient; sexo?: "M" | "F" }) {
  const { t } = useTranslation(["atleta", "domain"]);
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const [heat, setHeat] = useState<WeekHeat[] | null>(null);
  const [heatError, setHeatError] = useState(false);
  const [sel, setSel] = useState<HeatMapPos | null>(null);
  const [weekViews, setWeekViews] = useState<ReadonlyMap<number, SessionView[]>>(new Map());
  const [dayError, setDayError] = useState(false);
  // SU registro del ciclo (slice ciclo-visible): el overlay es de ELLA, independiente del share.
  // Falla en silencio (sin overlay) — el registro tiene su propio error en Cuenta.
  const [cycle, setCycle] = useState<CycleData | null>(null);
  useEffect(() => {
    // El overlay del ciclo es female-only (owner 2026-06-14): para un hombre ni se carga ni se proyecta.
    if (sexo !== "F") return;
    let on = true;
    client.getMeCycle().then((c) => { if (on) setCycle(c); }, () => {});
    return () => { on = false; };
  }, [client, sexo]);

  const firstDow = plan.startDate ? weekdayMonFirst(plan.startDate) : 0;
  const hoyPos = useMemo<HeatMapPos | null>(() => {
    if (!plan.startDate) return null;
    const day = dayOffsetInWeek(plan.startDate, plan.currentWeek, today);
    return day === null ? null : { week: plan.currentWeek, day };
  }, [plan.startDate, plan.currentWeek, today]);

  useEffect(() => {
    if (heat !== null || heatError) return;
    let on = true;
    client.getMeHeat()
      .then((h) => {
        if (!on) return;
        setHeat(h);
        setSel((s) => s ?? hoyPos);
      })
      .catch(() => { if (on) setHeatError(true); });
    return () => { on = false; };
  }, [heat, heatError, client, hoyPos]);

  useEffect(() => {
    if (sel === null || weekViews.has(sel.week) || dayError) return;
    let on = true;
    const w = sel.week;
    client.getMeSessions(w)
      .then((v) => { if (on) setWeekViews((m) => new Map(m).set(w, v)); })
      .catch(() => { if (on) setDayError(true); });
    return () => { on = false; };
  }, [sel, weekViews, dayError, client]);

  const comps = useMemo(() => {
    // El wire del atleta no trae fecha de la comp → se marca la semana (etiqueta dorada).
    const m = new Map<number, { name: string }>();
    for (const c of plan.comps) m.set(c.week, { name: c.name });
    return m;
  }, [plan.comps]);

  // Identidades estables → el memo de PlanHeatMap sólo re-renderiza la grilla con cambios reales.
  const phaseIdx = useCallback((w: number): number => plan.phases.findIndex((p) => w >= p.from && w <= p.to), [plan.phases]);
  const selectDay = useCallback((w: number, d: number) => { setSel({ week: w, day: d }); setDayError(false); }, []);

  // Proyección elegible SOLO con ciclo regular + datos + fechas del plan (sin startDate no hay verdad).
  const cycleStart = cycle?.state === "regular" ? cycle.lastPeriodStart : undefined;
  const cycleLen = cycle?.state === "regular" ? cycle.cycleLengthDays : undefined;
  // La próxima ventana es de SU ciclo (no del plan): no exige startDate; null fuera de horizonte.
  const nextWindow = useMemo(
    () => (cycleStart != null && cycleLen != null ? nextCycleWindow(cycleStart, cycleLen, today) : null),
    [cycleStart, cycleLen, today],
  );
  const cycleMarks = useMemo<ReadonlyMap<string, CycleMark> | undefined>(() => {
    if (cycleStart == null || cycleLen == null || plan.startDate == null || heat == null) return undefined;
    const m = new Map<string, CycleMark>();
    for (const w of heat) {
      const weekStart = dateOfWeek(plan.startDate, w.week);
      for (let d = 0; d < 7; d++) {
        const mark = cycleMarkFor(cycleStart, cycleLen, isoAt(weekStart, d));
        if (mark) m.set(`${w.week}-${d}`, mark);
      }
    }
    return m.size > 0 ? m : undefined;
  }, [cycleStart, cycleLen, plan.startDate, heat]);

  // Colisión: la semana de mayor volumen del plan ∩ una ventana proyectada → una línea honesta.
  const collision = useMemo<{ week: number; kind: CycleMark } | null>(() => {
    if (cycleMarks == null || heat == null) return null;
    let bw = 0, bv = -1;
    for (const w of heat) {
      const v = w.days.reduce((a, d) => a + (d?.lifts ?? 0), 0);
      if (v > bv) { bv = v; bw = w.week; }
    }
    if (bv <= 0) return null;
    for (let d = 0; d < 7; d++) {
      const k = cycleMarks.get(`${bw}-${d}`);
      if (k) return { week: bw, kind: k };
    }
    return null;
  }, [cycleMarks, heat]);

  const selPhase = sel ? plan.phases[phaseIdx(sel.week)] : undefined;
  // Proyección del dominio por id estable (macroId + phase.key). El catálogo ya no se hornea en el
  // wire del plan: el nombre/foco salen del ns `domain` localizado. Fallback al texto del wire (ES)
  // sólo si faltara el macroId (lenidad de fixtures; buildMePlanView siempre lo setea).
  const phaseNm = (p: PlanView["phases"][number]): string =>
    plan.macroId ? t(`domain:macro.${plan.macroId}.phase.${p.key}.name`) : p.name;
  const phaseFc = (p: PlanView["phases"][number]): string =>
    plan.macroId ? t(`domain:macro.${plan.macroId}.phase.${p.key}.focus`) : p.focus;
  const selCell = sel && heat ? (heat[sel.week - 1]?.days[sel.day] ?? null) : null;
  const selViews = sel ? weekViews.get(sel.week) : undefined;
  const selSession = sel && selViews ? selViews.find((s) => s.sessionIdx === sel.day) : undefined;
  const exercises: DayDetailExercise[] = selSession
    ? selSession.exercises.map((e) => ({
        name: e.movementName, sets: e.sets, reps: e.reps,
        ...(e.pct != null ? { pct: e.pct } : {}),
        ...(e.targetKg != null ? { kg: e.targetKg } : {}),
      }))
    : [];
  const title = sel === null ? "" : plan.startDate
    ? `${dayDateLabel(plan.startDate, sel.week, sel.day)} · S${sel.week}`
    : t("pmapTitleFallback", { week: sel.week, day: sel.day + 1 });
  // Contexto del día seleccionado cuando cae en ventana proyectada (sólo superficie de la atleta).
  const selMark = sel != null && cycleStart != null && cycleLen != null && plan.startDate != null
    ? cycleMarkFor(cycleStart, cycleLen, isoAt(dateOfWeek(plan.startDate, sel.week), sel.day))
    : null;
  const contextLine = selMark === "periodo"
    ? t("pmapContextPeriodo")
    : selMark === "preperiodo"
      ? t("pmapContextPreperiodo")
      : undefined;
  // Denominador honesto: las sesiones reales de la semana cargada; el heat sólo estima mientras carga.
  const heatCount = sel && heat ? (heat[sel.week - 1]?.days.filter((d) => d !== null).length ?? 0) : 0;
  const den = selViews && selViews.length > 0 ? selViews.length : heatCount;
  const barKg = barKgForSexo(sexo ?? "M");

  const retryLink = (onClick: () => void) => <RetryButton onClick={onClick} />;

  const panel = sel === null || selPhase === undefined ? null : selCell === null
    ? (
      <PlanDayDetail key={`${sel.week}-${sel.day}`} title={title} phaseName={phaseNm(selPhase)} phaseTint={phaseColor(phaseIdx(sel.week))}
        focus={phaseFc(selPhase)} isRest exercises={[]} barKg={barKg} {...(contextLine != null ? { contextLine } : {})} />
    )
    : dayError ? (
      <div role="alert" style={{ marginTop: 10, fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)" }}>
        {t("pmapDayError")} {retryLink(() => setDayError(false))}
      </div>
    )
    : selViews === undefined ? (
      <Loading style={{ marginTop: 10, fontFamily: "var(--mono)", fontSize: 11 }}>{t("pmapLoadingDay")}</Loading>
    )
    : (
      <PlanDayDetail key={`${sel.week}-${sel.day}`} title={title}
        sub={t("pmapDaySub", {
          n: sel.day + 1,
          hasDen: den > 0 ? "yes" : "no", den,
          hasTop: selCell.topPct != null ? "yes" : "no", top: selCell.topPct ?? 0,
        })}
        phaseName={phaseNm(selPhase)} phaseTint={phaseColor(phaseIdx(sel.week))} focus={phaseFc(selPhase)}
        exercises={exercises} barKg={barKg} {...(contextLine != null ? { contextLine } : {})} />
    );

  return (
    <div style={{ marginTop: 16 }}>
      <div className="ho-plan__periodlabel">{t("pmapHeader")}</div>
      <div style={{ marginTop: 6 }}><HeatLegend showCycle={cycleMarks != null} /></div>
      {cycleMarks != null && cycleLen != null && (
        // HR-2: el cómo-se-forma de la proyección, visible junto a la señal (no sólo el qué).
        <div style={{ marginTop: 4, fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--wl-muted)", lineHeight: 1.5 }}>
          {t("pmapProjectionExplain", { len: cycleLen, periodDays: CYCLE_PERIOD_DAYS, preDays: CYCLE_PRE_DAYS, horizon: CYCLE_HORIZON_CYCLES })}
        </div>
      )}
      {nextWindow != null && (
        // La línea que el mapa solo no cuenta: aunque HOY no tenga marca, la ventana que viene.
        <div role="status" style={{ marginTop: 4, fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-muted)", lineHeight: 1.5 }}>
          {t("pmapNextWindow", {
            pre: isoRangeLabel(nextWindow.preStart, nextWindow.preEnd),
            period: isoRangeLabel(nextWindow.periodStart, nextWindow.periodEnd),
          })}
        </div>
      )}
      <div style={{ marginTop: 8 }}>
        {heatError ? (
          <div role="alert" style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)" }}>
            {t("pmapMapError")} {retryLink(() => setHeatError(false))}
          </div>
        ) : heat === null ? (
          <Loading style={{ fontFamily: "var(--mono)", fontSize: 11 }}>{t("pmapLoadingMap")}</Loading>
        ) : (
          <PlanHeatMap heat={heat} hoy={hoyPos} selected={sel} firstDow={firstDow} orientation="horizontal"
            onSelectDay={selectDay} phaseIndexFor={phaseIdx} comps={comps}
            {...(cycleMarks != null ? { cycleMarks } : {})} />
        )}
      </div>
      {collision != null && (
        <div role="status" style={{ marginTop: 8, fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-muted)", lineHeight: 1.5 }}>
          {t("pmapCollision", { week: collision.week, kind: collision.kind })}
        </div>
      )}
      {heat !== null && panel}
    </div>
  );
}
