import { useCallback, useEffect, useMemo, useState } from "react";
import type { Competencia, Macrocycle, SessionLog, SessionView, WeekHeat } from "@holy-oly/core";
import { phaseForWeek, barKgForSexo } from "@holy-oly/core";
import { planWeeks } from "./planRows";
import { dayDateLabel, dayOffsetInWeek, weekdayMonFirst } from "../../../ui/charts/planDates";
import { markFor } from "../sessions/sessionLog";
import { phaseColor } from "../../../ui/charts/phasePalette";
import { PlanHeatMap, HeatLegend, type HeatMapPos } from "../../../ui/charts/PlanHeatMap";
import { PlanDayDetail, type DayEstado, type DayDetailExercise } from "../../../ui/charts/PlanDayDetail";
import { SegmentedToggle } from "../../../ui/SegmentedToggle";
import { RetryButton } from "../../../ui/RetryButton";

/** Calendario del plan: header plegable + toggle Mapa ↔ Lista (decisión owner 2026-06-10).
 *  Mapa = heat map de intensidad (tono = % tope, opacidad = volumen) con desglose del día
 *  (fase + objetivo + ejercicios con kg y discos). Lista = las filas por semana de siempre
 *  (tocar una abre el WeekDetailSheet vía onWeekClick). Heat y semanas se cargan lazy.
 *  Eje del mapa: columna = offset dentro de la semana del MACRO (anclada al weekday del
 *  startDate) — HOY y la compe se colocan con dayOffsetInWeek, nunca por weekday absoluto. */
export function PlanCalendar({ macro, weeks, startDate, hoyWeek, comps, marks, perWeek, onWeekClick, loadHeat, loadWeek, sexo, today }: {
  macro: Macrocycle; weeks: number; startDate: string; hoyWeek: number;
  comps: Competencia[]; marks: SessionLog; perWeek: number;
  onWeekClick: (week: number) => void;
  loadHeat: () => Promise<WeekHeat[]>;
  loadWeek: (week: number) => Promise<SessionView[]>;
  sexo?: "M" | "F";
  today: string;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"mapa" | "lista">("mapa");
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
    if (!open || view !== "mapa" || heat !== null || heatError) return;
    let on = true;
    loadHeat()
      .then((h) => {
        if (!on) return;
        setHeat(h);
        setSel((s) => s ?? hoyPos ?? { week: hoyWeek, day: 0 });
      })
      .catch(() => { if (on) setHeatError(true); });
    return () => { on = false; };
  }, [open, view, heat, heatError, loadHeat, hoyPos, hoyWeek]);

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

  const rows = useMemo(
    () => (open && view === "lista" ? planWeeks(macro, weeks, startDate, hoyWeek, comps, marks, perWeek) : []),
    [open, view, macro, weeks, startDate, hoyWeek, comps, marks, perWeek],
  );

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
        title={`${dayDateLabel(startDate, sel.week, sel.day)} · S${sel.week}`}
        phaseName={selPhase.name} phaseTint={phaseColor(phaseIndexFor(sel.week))} focus={selPhase.focus}
        {...(isCompDay ? { compName: selComp!.name } : { isRest: true })}
        exercises={[]} barKg={barKgForSexo(sexo ?? "M")}
      />
    )
    : dayError ? (
      <div role="alert" style={{ marginTop: 10, fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--wl-muted)" }}>
        No se pudo cargar el día.{" "}
        <RetryButton onClick={() => setDayError(false)} fontSize={10.5} />
      </div>
    )
    : selSession === undefined && selViews === undefined ? (
      <div role="status" aria-busy="true" style={{ marginTop: 10, fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--wl-muted)" }}>Cargando día…</div>
    )
    : (
      <PlanDayDetail
        key={`${sel.week}-${sel.day}`}
        title={`${dayDateLabel(startDate, sel.week, sel.day)} · S${sel.week}`}
        sub={`Sesión ${sel.day + 1} de ${perWeek}${selCell.topPct != null ? ` · tope ${selCell.topPct}%` : ""} · ${selCell.lifts} levant.`}
        phaseName={selPhase.name} phaseTint={phaseColor(phaseIndexFor(sel.week))} focus={selPhase.focus}
        estado={estado} exercises={exercises} barKg={barKgForSexo(sexo ?? "M")}
      />
    );

  return (
    <div style={{ marginTop: 16 }}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="plan-cal-body"
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
          background: "var(--wl-surface)", border: "1px solid color-mix(in srgb,var(--wl-text) 8%,transparent)",
          borderRadius: 12, padding: "10px 12px", cursor: "pointer", color: "var(--wl-text)" }}>
        <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
          <span style={{ fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 13.5 }}>📅 Calendario del plan</span>
          <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--wl-muted)" }}>{weeks} semanas · HOY sem {hoyWeek}</span>
        </span>
        <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--wl-muted)" }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div id="plan-cal-body">
          <SegmentedToggle
            ariaLabel="Vista del calendario"
            options={[["mapa", "Mapa"], ["lista", "Lista"]] as const}
            value={view}
            onChange={setView}
            size="sm"
            style={{ marginTop: 8 }}
          />

          {view === "mapa" && (
            <div className="wl-viewfade" style={{ marginTop: 8 }}>
              <HeatLegend />
              <div style={{ marginTop: 8 }}>
                {heatError ? (
                  <div role="alert" style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--wl-muted)" }}>
                    No se pudo cargar el mapa.{" "}
                    <RetryButton onClick={() => setHeatError(false)} fontSize={10.5} />
                  </div>
                ) : heat === null ? (
                  <div role="status" aria-busy="true" style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--wl-muted)" }}>Cargando mapa…</div>
                ) : (
                  <PlanHeatMap heat={heat} hoy={hoyPos} selected={sel} firstDow={firstDow} orientation="horizontal"
                    onSelectDay={selectDay} phaseIndexFor={phaseIndexFor} comps={compMap} />
                )}
              </div>
              {heat !== null && panel}
            </div>
          )}

          {view === "lista" && (
            <div className="wl-viewfade" style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 8 }}>
              {rows.map((r) => (
                <button key={r.week} type="button" onClick={() => onWeekClick(r.week)}
                  aria-label={`Semana ${r.week} · ${r.range}${r.comp ? ` · 🚩 ${r.comp}` : ""} · ${r.done} de ${r.perWeek} sesiones`}
                  style={{
                    display: "flex", alignItems: "center", gap: 8, textAlign: "left", cursor: "pointer",
                    padding: "8px 10px", borderRadius: 10, color: "var(--wl-text)",
                    background: r.isToday ? "color-mix(in srgb,var(--wl-accent) 12%,transparent)" : "var(--wl-surface)",
                    border: r.isToday
                      ? "1px solid color-mix(in srgb,var(--wl-accent) 55%,transparent)"
                      : "1px solid color-mix(in srgb,var(--wl-text) 8%,transparent)",
                  }}>
                  <span style={{ width: 52, flexShrink: 0 }}>
                    <span style={{ display: "block", fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 12.5 }}>Sem {r.week}</span>
                    <span style={{ display: "block", fontFamily: "var(--mono)", fontSize: 9, color: "var(--wl-muted)" }}>{r.range}</span>
                  </span>
                  <span style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontFamily: "var(--mono)", fontSize: 10, fontWeight: 700, color: "#0b0b11",
                      background: phaseColor(r.phaseIndex), borderRadius: 5, padding: "2px 7px",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 120 }}>{r.phaseName}</span>
                    {r.isToday && <span style={{ fontFamily: "var(--mono)", fontSize: 9, fontWeight: 700, color: "var(--wl-accent)" }}>HOY</span>}
                    {r.comp && <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>🚩 {r.comp}</span>}
                    {!r.comp && r.isTaper && <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--wl-muted)" }}>taper</span>}
                  </span>
                  <span style={{ flexShrink: 0, fontFamily: "var(--mono)", fontSize: 10.5,
                    color: r.perWeek > 0 && r.done >= r.perWeek ? "var(--ok)" : "var(--wl-muted)" }}>
                    {r.perWeek > 0 ? `${r.done}/${r.perWeek}` : "—"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
