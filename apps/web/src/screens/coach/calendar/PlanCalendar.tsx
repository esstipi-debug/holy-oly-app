import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Competencia, Macrocycle, SessionLog, SessionView, WeekHeat } from "@holy-oly/core";
import { phaseForWeek, barKgForSexo, dateOfWeek } from "@holy-oly/core";
import { dayDateLabel, dayOffsetInWeek, weekdayMonFirst, isoRangeLabel } from "../../../ui/charts/planDates";
import { markFor } from "../sessions/sessionLog";
import { phaseColor } from "../../../ui/charts/phasePalette";
import { PlanHeatMap, HeatLegend, type HeatMapPos } from "../../../ui/charts/PlanHeatMap";
import { PlanDayDetail, type DayEstado, type DayDetailExercise } from "../../../ui/charts/PlanDayDetail";
import { useLocale } from "../../../i18n/useLocale";
import { RetryButton } from "../../../ui/RetryButton";
import { Loading } from "../../../ui/Loading";

const DAY_MS = 86_400_000;
/** Último día (ISO) de la semana `to` del macro = primer día de esa semana + 6. */
const isoPlusDays = (iso: string, days: number): string =>
  new Date(new Date(`${iso}T00:00:00Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10);

/** Calendario del plan, mapa-only (reemplaza el viejo toggle Mapa/Lista — la Lista se eliminó). El
 *  marco/título lo da la `Section "Calendario"` del PlanTab. Arriba, una **leyenda de fases** (nombre
 *  · semanas · fechas, con la fase de HOY marcada) recupera lo que daba la Lista. Abajo, el heat map
 *  estilo GitHub (rampa única) + el desglose del día (fase + objetivo + ejercicios con kg y discos).
 *  Eje del mapa: columna = offset dentro de la semana del MACRO (anclada al weekday del startDate) —
 *  HOY y la compe se colocan con dayOffsetInWeek, nunca por weekday absoluto. */
export function PlanCalendar({ macro, startDate, hoyWeek, comps, marks, perWeek, loadHeat, loadWeek, sexo, today }: {
  macro: Macrocycle; startDate: string; hoyWeek: number;
  comps: Competencia[]; marks: SessionLog; perWeek: number;
  loadHeat: () => Promise<WeekHeat[]>;
  loadWeek: (week: number) => Promise<SessionView[]>;
  sexo?: "M" | "F";
  today: string;
}) {
  const { lang } = useLocale();
  const { t } = useTranslation("coach");
  const [heat, setHeat] = useState<WeekHeat[] | null>(null);
  const [heatError, setHeatError] = useState(false);
  const [sel, setSel] = useState<HeatMapPos | null>(null);
  const [weekViews, setWeekViews] = useState<ReadonlyMap<number, SessionView[]>>(new Map());
  const [dayError, setDayError] = useState(false);

  const firstDow = weekdayMonFirst(startDate);
  const hoyPos = useMemo<HeatMapPos | null>(() => {
    const day = dayOffsetInWeek(startDate, hoyWeek, today);
    return day === null ? null : { week: hoyWeek, day };
  }, [startDate, hoyWeek, today]);

  useEffect(() => {
    if (heat !== null || heatError) return;
    let on = true;
    loadHeat()
      .then((h) => {
        if (!on) return;
        setHeat(h);
        setSel((s) => s ?? hoyPos ?? { week: hoyWeek, day: 0 });
      })
      .catch(() => { if (on) setHeatError(true); });
    return () => { on = false; };
  }, [heat, heatError, loadHeat, hoyPos, hoyWeek]);

  useEffect(() => {
    if (sel === null || weekViews.has(sel.week) || dayError) return;
    let on = true;
    const w = sel.week;
    loadWeek(w)
      .then((v) => { if (on) setWeekViews((m) => new Map(m).set(w, v)); })
      .catch(() => { if (on) setDayError(true); });
    return () => { on = false; };
  }, [sel, weekViews, dayError, loadWeek]);

  const compMap = useMemo(() => {
    const m = new Map<number, { name: string; day?: number }>();
    for (const c of comps) {
      const day = c.date ? dayOffsetInWeek(startDate, c.week, c.date) : null;
      m.set(c.week, day === null ? { name: c.name } : { name: c.name, day });
    }
    return m;
  }, [comps, startDate]);

  // Identidades estables → el memo de PlanHeatMap sólo re-renderiza la grilla con cambios reales.
  const phaseIndexFor = useCallback((w: number): number => {
    const p = phaseForWeek(macro, w);
    return p ? macro.phaseProfile.indexOf(p) : 0;
  }, [macro]);
  const selectDay = useCallback((w: number, d: number) => { setSel({ week: w, day: d }); setDayError(false); }, []);

  // Leyenda de fases (reemplazo de la Lista): por fase, color + nombre + rango de semanas + de fechas.
  const currentPhaseKey = phaseForWeek(macro, hoyWeek)?.key;

  // ── desglose del día seleccionado ──
  const selCell = sel && heat ? (heat[sel.week - 1]?.days[sel.day] ?? null) : null;
  const selComp = sel ? compMap.get(sel.week) : undefined;
  const isCompDay = sel !== null && selComp !== undefined && selComp.day === sel.day;
  const selPhase = sel ? phaseForWeek(macro, sel.week) : undefined;
  const selViews = sel ? weekViews.get(sel.week) : undefined;
  const selSession = sel && selViews ? selViews.find((s) => s.sessionIdx === sel.day) : undefined;
  const exercises: DayDetailExercise[] = selSession
    ? selSession.exercises.map((e) => ({
        name: e.movementName, sets: e.sets, reps: e.reps,
        ...(e.pct != null ? { pct: e.pct } : {}),
        ...(e.targetKg != null ? { kg: e.targetKg } : {}),
      }))
    : [];
  const estado: DayEstado | undefined = sel === null ? undefined : (() => {
    const m = markFor(marks, sel.week, sel.day);
    if (m === "done") return "done";
    if (m === "missed") return "missed";
    if (hoyPos !== null && sel.week === hoyPos.week && sel.day === hoyPos.day) return "today";
    return "pending";
  })();

  const panel = sel === null || selPhase == null ? null : (isCompDay || selCell === null)
    ? (
      <PlanDayDetail
        key={`${sel.week}-${sel.day}`}
        title={t("calDayTitle", { date: dayDateLabel(startDate, sel.week, sel.day), week: sel.week })}
        phaseName={selPhase.name} phaseTint={phaseColor(phaseIndexFor(sel.week))} focus={selPhase.focus}
        {...(isCompDay ? { compName: selComp!.name } : { isRest: true })}
        exercises={[]} barKg={barKgForSexo(sexo ?? "M")}
      />
    )
    : dayError ? (
      <div role="alert" style={{ marginTop: 10, fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--wl-muted)" }}>
        {t("calDayError")}{" "}
        <RetryButton onClick={() => setDayError(false)} fontSize={10.5} />
      </div>
    )
    : selSession === undefined && selViews === undefined ? (
      <Loading style={{ marginTop: 10, fontFamily: "var(--mono)", fontSize: 10.5 }}>{t("calDayLoading")}</Loading>
    )
    : (
      <PlanDayDetail
        key={`${sel.week}-${sel.day}`}
        title={t("calDayTitle", { date: dayDateLabel(startDate, sel.week, sel.day), week: sel.week })}
        sub={`${t("calSessionOfWeek", { n: sel.day + 1, total: perWeek })}${selCell.topPct != null ? ` · ${t("calTop", { pct: selCell.topPct })}` : ""} · ${t("calLifts", { count: selCell.lifts })}`}
        phaseName={selPhase.name} phaseTint={phaseColor(phaseIndexFor(sel.week))} focus={selPhase.focus}
        estado={estado} exercises={exercises} barKg={barKgForSexo(sexo ?? "M")}
      />
    );

  return (
    <div className="wl-viewfade" style={{ marginTop: 8 }}>
      {/* Leyenda de fases: el panorama del macro (lo que daba la Lista), nombre · semanas · fechas. */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
        {macro.phaseProfile.map((p, i) => {
          const current = p.key === currentPhaseKey;
          const range = isoRangeLabel(dateOfWeek(startDate, p.weeks[0]), isoPlusDays(dateOfWeek(startDate, p.weeks[1]), 6), lang);
          return (
            <div key={p.key} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", borderRadius: 8,
              background: "var(--wl-surface)",
              border: current ? `1px solid ${phaseColor(i)}` : "1px solid color-mix(in srgb,var(--wl-text) 8%,transparent)" }}>
              <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: 2, background: phaseColor(i), flex: "0 0 auto" }} />
              <span style={{ fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 11, color: "var(--wl-text)" }}>{p.name}</span>
              <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--wl-muted)" }}>{t("calPhaseRange", { from: p.weeks[0], to: p.weeks[1], range })}</span>
              {current && <span style={{ fontFamily: "var(--mono)", fontSize: 9, fontWeight: 700, color: "var(--wl-accent)" }}>{t("calToday")}</span>}
            </div>
          );
        })}
      </div>

      <HeatLegend singleRamp />
      <div style={{ marginTop: 8 }}>
        {heatError ? (
          <div role="alert" style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--wl-muted)" }}>
            {t("calMapError")}{" "}
            <RetryButton onClick={() => setHeatError(false)} fontSize={10.5} />
          </div>
        ) : heat === null ? (
          <Loading style={{ fontFamily: "var(--mono)", fontSize: 10.5 }}>{t("calMapLoading")}</Loading>
        ) : (
          <PlanHeatMap heat={heat} hoy={hoyPos} selected={sel} firstDow={firstDow} orientation="horizontal" singleRamp
            onSelectDay={selectDay} phaseIndexFor={phaseIndexFor} comps={compMap} />
        )}
      </div>
      {heat !== null && panel}
    </div>
  );
}
