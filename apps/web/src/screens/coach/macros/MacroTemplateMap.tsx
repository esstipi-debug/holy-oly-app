import { useCallback, useMemo, useState } from "react";
import type { Macrocycle } from "@holy-oly/core";
import { ALL_RECIPES, instantiatePrescription, planHeat, phaseForWeek, programmableName } from "@holy-oly/core";
import { PlanHeatMap, HeatLegend, type HeatMapPos } from "../../../ui/charts/PlanHeatMap";
import { PlanDayDetail, type DayDetailExercise } from "../../../ui/charts/PlanDayDetail";
import { phaseColor } from "../../../ui/charts/phasePalette";

const EMPTY_COMPS: ReadonlyMap<number, { name: string; day?: number }> = new Map();

/**
 * «Adentro del plan»: el mapa de intensidad de la RECETA del macro, sin atleta — sólo %s y
 * volumen (los kg nacen recién al asignar, derivados de los RMs). Tap a un día → la sesión
 * con sus ejercicios. La misma pieza visual del calendario del atleta/coach (PlanHeatMap).
 */
export function MacroTemplateMap({ macro }: { macro: Macrocycle }) {
  const totalWeeks = macro.phaseProfile[macro.phaseProfile.length - 1]?.weeks[1] ?? 0;
  const rows = useMemo(() => instantiatePrescription([...ALL_RECIPES], macro, totalWeeks), [macro, totalWeeks]);
  const heat = useMemo(() => (rows.length > 0 ? planHeat(rows, totalWeeks) : null), [rows, totalWeeks]);
  const [sel, setSel] = useState<HeatMapPos | null>(null);
  // Identidades estables → el memo de PlanHeatMap sólo re-renderiza la grilla con cambios reales.
  // (Antes del early-return: las reglas de hooks exigen el mismo orden en cada render.)
  const phaseIdx = useCallback((w: number): number => {
    const p = phaseForWeek(macro, w);
    return p ? macro.phaseProfile.indexOf(p) : 0;
  }, [macro]);
  const selectDay = useCallback((w: number, d: number) => setSel({ week: w, day: d }), []);

  if (heat === null) {
    return (
      <p style={{ fontFamily: "var(--mono)", fontSize: 11, lineHeight: 1.6, color: "var(--wl-muted)", margin: 0 }}>
        Este programa aún no tiene el detalle sesión-por-sesión — guiate por el reparto de fases
        de arriba.
      </p>
    );
  }

  const selPhase = sel ? phaseForWeek(macro, sel.week) : null;
  const selCell = sel ? (heat[sel.week - 1]?.days[sel.day] ?? null) : null;
  const exercises: DayDetailExercise[] = sel
    ? rows
        .filter((r) => r.week === sel.week && r.sessionIdx === sel.day)
        .sort((a, b) => a.order - b.order)
        .map((r) => ({
          name: programmableName(r.movementId), // variante o complejo (con su notación)
          sets: r.sets, reps: r.reps,
          ...(r.pct != null ? { pct: r.pct } : {}),
        }))
    : [];

  return (
    <div>
      <HeatLegend />
      <div style={{ marginTop: 8 }}>
        <PlanHeatMap heat={heat} hoy={null} selected={sel} comps={EMPTY_COMPS}
          onSelectDay={selectDay} phaseIndexFor={phaseIdx} />
      </div>
      {sel && selPhase && (selCell === null ? (
        <PlanDayDetail title={`Semana ${sel.week} · día ${sel.day + 1}`} phaseName={selPhase.name}
          phaseTint={phaseColor(phaseIdx(sel.week))} focus={selPhase.focus} isRest exercises={[]} barKg={20} />
      ) : (
        <PlanDayDetail title={`Semana ${sel.week} · sesión ${sel.day + 1}`}
          sub={`${selCell.lifts} levant.${selCell.topPct != null ? ` · tope ${selCell.topPct}%` : ""}`}
          phaseName={selPhase.name} phaseTint={phaseColor(phaseIdx(sel.week))} focus={selPhase.focus}
          exercises={exercises} barKg={20} />
      ))}
      <div style={{ marginTop: 6, fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--wl-muted)" }}>
        {sel === null
          ? "Tocá un día para ver su sesión completa."
          : "Los kg aparecen al asignar — se derivan de los RMs del atleta."}
      </div>
    </div>
  );
}
