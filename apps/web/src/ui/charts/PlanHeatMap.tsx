import { memo } from "react";
import type { CycleMark, WeekHeat } from "@holy-oly/core";
import { maxLifts } from "@holy-oly/core";
import { phaseColor } from "./phasePalette";
import { heatCellColor, HEAT_STOPS } from "./heatPalette";
import { dayColumnHeads, dayColumnNames } from "./planDates";

const GOLD = "var(--gold, #e9b365)";
// Marca del ciclo: paleta NEUTRA derivada del texto (regla del rulebook — jamás la de estado).
const CYCLE_NEUTRAL = "color-mix(in srgb, var(--wl-text) 65%, transparent)";

export interface HeatMapPos { week: number; day: number }
export interface HeatMapComp { name: string; day?: number }

/**
 * Mapa de calor del plan: filas = semanas del macro, columnas = días de la semana del MACRO
 * (col i = día i; las semanas se anclan al weekday del startDate, así que los headers ROTAN
 * con `firstDow` — columna, fecha y marcadores comparten un solo eje). Encoding mixto: tono =
 * % tope del día, opacidad = volumen relativo. Presentacional puro. Compe con fecha = celda
 * dorada; sólo semana = etiqueta dorada. HOY = anillo blanco interior. Hit area de cada celda
 * = el pitch completo de la grilla (22px); el cuadrado visible mide 18 (compacto por diseño —
 * un target de 44px es inalcanzable en esta densidad; el panel de abajo corrige cualquier
 * mis-tap en un tap).
 * memo: la grilla (~112 celdas) sólo re-renderiza cuando cambian sus props — los callers
 * estabilizan onSelectDay/phaseIndexFor con useCallback para que el estado ajeno no la toque.
 */
export const PlanHeatMap = memo(function PlanHeatMap({ heat, hoy, selected, onSelectDay, phaseIndexFor, comps, firstDow = 0, cycleMarks }: {
  heat: WeekHeat[];
  hoy: HeatMapPos | null;
  selected: HeatMapPos | null;
  onSelectDay: (week: number, day: number) => void;
  /** Índice de la fase de la semana en macro.phaseProfile → color (phaseColor). */
  phaseIndexFor: (week: number) => number;
  comps: ReadonlyMap<number, HeatMapComp>;
  /** Weekday Lunes-first (0..6) del startDate del plan; 0 cuando no hay fecha ancla. */
  firstDow?: number;
  /** Ventanas proyectadas del ciclo, key "week-day" — SOLO la vista de la atleta la pasa. */
  cycleMarks?: ReadonlyMap<string, CycleMark>;
}) {
  const max = maxLifts(heat);
  const heads = dayColumnHeads(firstDow);
  const names = dayColumnNames(firstDow);
  const last = heat.length;
  const isMilestone = (w: number): boolean => w === 1 || w % 4 === 0 || w === last;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "36px repeat(7, 22px)", gap: 0, justifyContent: "center" }}>
      <span />
      {heads.map((d, i) => (
        <span key={`h${i}`} style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--wl-muted)", textAlign: "center", paddingBottom: 3 }}>{d}</span>
      ))}
      {heat.map((w) => {
        const comp = comps.get(w.week);
        const weekIsCompNoDay = comp != null && comp.day == null;
        return [
          <span key={`w${w.week}`} style={{
            fontFamily: "var(--mono)", fontSize: 9.5, lineHeight: "22px",
            color: weekIsCompNoDay ? GOLD : "var(--wl-muted)",
            borderLeft: `3px solid ${phaseColor(phaseIndexFor(w.week))}`, paddingLeft: 4,
            whiteSpace: "nowrap",
          }}>{isMilestone(w.week) ? `S${w.week}` : weekIsCompNoDay ? "🚩" : ""}</span>,
          ...w.days.map((d, day) => {
            const isComp = comp?.day === day;
            const isHoy = hoy != null && hoy.week === w.week && hoy.day === day;
            const isSel = selected != null && selected.week === w.week && selected.day === day;
            const cmark = cycleMarks?.get(`${w.week}-${day}`);
            const rings = [
              isSel ? "0 0 0 2px var(--wl-accent)" : "",
              isHoy ? "inset 0 0 0 1.5px rgba(255,255,255,.92)" : "",
            ].filter(Boolean).join(", ");
            const label = `Semana ${w.week} ${names[day]}`
              + (d ? "" : " · descanso") + (isHoy ? " · HOY" : "") + (isComp ? ` · competencia ${comp!.name}` : "")
              + (cmark === "periodo" ? " · período (proy.)" : cmark === "preperiodo" ? " · pre-período (proy.)" : "");
            return (
              <button key={`c${w.week}-${day}`} type="button" aria-label={label}
                onClick={() => onSelectDay(w.week, day)}
                style={{ position: "relative", width: 22, height: 22, padding: 2, margin: 0, border: 0, background: "transparent", cursor: "pointer", boxSizing: "border-box" }}>
                <span style={{
                  display: "block", width: 18, height: 18, borderRadius: 5, boxSizing: "border-box",
                  border: isComp ? `1.5px solid ${GOLD}` : "none",
                  background: isComp
                    ? "transparent"
                    : d
                      ? heatCellColor(d.topPct, d.lifts, max)
                      : "color-mix(in srgb, var(--wl-text) 5%, transparent)",
                  boxShadow: rings || undefined,
                }} />
                {cmark != null && (
                  <span aria-hidden style={{
                    position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: 0,
                    width: 5, height: 5, borderRadius: "50%", boxSizing: "border-box",
                    background: cmark === "periodo" ? CYCLE_NEUTRAL : "var(--wl-bg)",
                    border: `1.5px solid ${CYCLE_NEUTRAL}`,
                  }} />
                )}
              </button>
            );
          }),
        ];
      })}
    </div>
  );
});

/** Leyenda compacta del encoding mixto, derivada de HEAT_STOPS (una línea, envuelve si hace falta). */
export const HeatLegend = memo(function HeatLegend({ showCycle = false }: { showCycle?: boolean }) {
  const swStyle = (bg: string): React.CSSProperties => ({ width: 13, height: 9, borderRadius: 2, background: bg, display: "inline-block" });
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", fontFamily: "var(--mono)", fontSize: 9, color: "var(--wl-muted)" }}>
      {HEAT_STOPS.map(([, rgb], i) => <span key={`t${i}`} style={swStyle(`rgba(${rgb},1)`)} />)}
      <span>% tope</span>
      <span style={{ width: 6 }} />
      <span style={swStyle(`rgba(${HEAT_STOPS[2]![1]},.35)`)} />
      <span style={swStyle(`rgba(${HEAT_STOPS[2]![1]},1)`)} />
      <span>volumen</span>
      <span style={{ width: 6 }} />
      <span style={{ width: 11, height: 11, borderRadius: 3, border: `1.5px solid ${GOLD}`, display: "inline-block", boxSizing: "border-box" }} />
      <span>compe</span>
      {showCycle && (
        <>
          <span style={{ width: 6 }} />
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: CYCLE_NEUTRAL, display: "inline-block" }} />
          <span>período (proy.)</span>
          <span style={{ width: 5, height: 5, borderRadius: "50%", border: `1.5px solid ${CYCLE_NEUTRAL}`, boxSizing: "border-box", display: "inline-block" }} />
          <span>pre-período</span>
        </>
      )}
    </div>
  );
});
