import { useEffect, useMemo, useState } from "react";
import type { MePlanView, SessionView, WeekHeat } from "@holy-oly/core";
import { barKgForSexo } from "@holy-oly/core";
import type { MeClient } from "../../data/meClient";
import { PlanHeatMap, HeatLegend, type HeatMapPos } from "../../ui/charts/PlanHeatMap";
import { PlanDayDetail, type DayDetailExercise } from "../../ui/charts/PlanDayDetail";
import { dayDateLabel, dayOffsetInWeek, weekdayMonFirst } from "../../ui/charts/planDates";
import { phaseColor } from "../../ui/charts/phasePalette";

type PlanView = NonNullable<MePlanView["plan"]>;

/**
 * Mapa del plan del atleta — la misma pieza visual del coach (PlanHeatMap + PlanDayDetail),
 * alimentada por su propio cliente (`/me/heat` + `/me/sessions`): el kg llega derivado del
 * server, el RM nunca viaja, y jamás RPE. Sin marcas de adherencia (son del coach) en v1.
 * Se monta sólo con el sheet abierto → la carga es lazy y el estado se resetea al cerrar.
 * Sin `startDate` no hay verdad de fechas: ni anillo HOY ni títulos con fecha (honesto).
 */
export function PlanMapSection({ plan, client, sexo }: { plan: PlanView; client: MeClient; sexo?: "M" | "F" }) {
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const [heat, setHeat] = useState<WeekHeat[] | null>(null);
  const [heatError, setHeatError] = useState(false);
  const [sel, setSel] = useState<HeatMapPos | null>(null);
  const [weekViews, setWeekViews] = useState<ReadonlyMap<number, SessionView[]>>(new Map());
  const [dayError, setDayError] = useState(false);

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

  const phaseIdx = (w: number): number => plan.phases.findIndex((p) => w >= p.from && w <= p.to);

  const selPhase = sel ? plan.phases[phaseIdx(sel.week)] : undefined;
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
    : `Semana ${sel.week} · día ${sel.day + 1}`;
  // Denominador honesto: las sesiones reales de la semana cargada; el heat sólo estima mientras carga.
  const heatCount = sel && heat ? (heat[sel.week - 1]?.days.filter((d) => d !== null).length ?? 0) : 0;
  const den = selViews && selViews.length > 0 ? selViews.length : heatCount;
  const barKg = barKgForSexo(sexo ?? "M");

  const retryLink = (onClick: () => void) => (
    <button type="button" onClick={onClick}
      style={{ background: "none", border: "none", color: "var(--wl-accent)", cursor: "pointer", fontFamily: "var(--ho-mono, var(--mono))", fontSize: 11, padding: 0, textDecoration: "underline" }}>
      Reintentar
    </button>
  );

  const panel = sel === null || selPhase === undefined ? null : selCell === null
    ? (
      <PlanDayDetail title={title} phaseName={selPhase.name} phaseTint={phaseColor(phaseIdx(sel.week))}
        focus={selPhase.focus} isRest exercises={[]} barKg={barKg} />
    )
    : dayError ? (
      <div role="alert" style={{ marginTop: 10, fontFamily: "var(--ho-mono, var(--mono))", fontSize: 11, color: "var(--wl-muted)" }}>
        No se pudo cargar el día. {retryLink(() => setDayError(false))}
      </div>
    )
    : selViews === undefined ? (
      <div role="status" aria-busy="true" style={{ marginTop: 10, fontFamily: "var(--ho-mono, var(--mono))", fontSize: 11, color: "var(--wl-muted)" }}>Cargando día…</div>
    )
    : (
      <PlanDayDetail title={title}
        sub={`Sesión ${sel.day + 1}${den > 0 ? ` de ${den}` : ""}${selCell.topPct != null ? ` · tope ${selCell.topPct}%` : ""}`}
        phaseName={selPhase.name} phaseTint={phaseColor(phaseIdx(sel.week))} focus={selPhase.focus}
        exercises={exercises} barKg={barKg} />
    );

  return (
    <div style={{ marginTop: 16 }}>
      <div className="ho-plan__periodlabel">Mapa del plan · intensidad por día</div>
      <div style={{ marginTop: 6 }}><HeatLegend /></div>
      <div style={{ marginTop: 8 }}>
        {heatError ? (
          <div role="alert" style={{ fontFamily: "var(--ho-mono, var(--mono))", fontSize: 11, color: "var(--wl-muted)" }}>
            No se pudo cargar el mapa. {retryLink(() => setHeatError(false))}
          </div>
        ) : heat === null ? (
          <div role="status" aria-busy="true" style={{ fontFamily: "var(--ho-mono, var(--mono))", fontSize: 11, color: "var(--wl-muted)" }}>Cargando mapa…</div>
        ) : (
          <PlanHeatMap heat={heat} hoy={hoyPos} selected={sel} firstDow={firstDow}
            onSelectDay={(w, d) => { setSel({ week: w, day: d }); setDayError(false); }}
            phaseIndexFor={phaseIdx} comps={comps} />
        )}
      </div>
      {heat !== null && panel}
    </div>
  );
}
