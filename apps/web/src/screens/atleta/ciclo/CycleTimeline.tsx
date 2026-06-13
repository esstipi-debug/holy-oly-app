import type { CSSProperties } from "react";
import type { CycleView } from "./cycleView";
import { PHASE_FILL, phaseLabel } from "./cycleView";
import { isoRangeLabel } from "../../../ui/charts/planDates";

const summary: CSSProperties = { fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)", marginTop: 12, lineHeight: 1.65 };
const strong: CSSProperties = { color: "var(--wl-text)", fontWeight: 700 };

/**
 * Línea de tiempo del ciclo: una banda de 28 días con las fases en paleta NEUTRA (menstruación ·
 * folicular · lútea), la marca de HOY encima, y la próxima ventana de período debajo. Presentacional.
 */
export function CycleTimeline({ view }: { view: CycleView }) {
  const { lengthDays, dayInCycle, phaseToday, segments, nextWindow } = view;
  const pct = (d: number): number => (d / lengthDays) * 100;
  const hoyPct = ((dayInCycle + 0.5) / lengthDays) * 100;
  return (
    <div>
      <div style={{ position: "relative", marginTop: 20 }}>
        <div style={{ position: "absolute", left: `${hoyPct}%`, top: -16, transform: "translateX(-50%)", textAlign: "center", pointerEvents: "none" }}>
          <div style={{ fontFamily: "var(--mono)", fontSize: 8.5, fontWeight: 700, color: "var(--wl-text)" }}>HOY</div>
          <div style={{ width: 0, height: 0, margin: "1px auto 0", borderLeft: "4px solid transparent", borderRight: "4px solid transparent", borderTop: "5px solid var(--wl-text)" }} />
        </div>
        <div style={{ position: "relative", display: "flex", height: 26, borderRadius: 6, overflow: "hidden" }}>
          {segments.map((s) => (
            <div key={s.phase} style={{ width: `${pct(s.endDay) - pct(s.startDay)}%`, background: PHASE_FILL[s.phase] }} />
          ))}
          <div style={{ position: "absolute", left: `${hoyPct}%`, top: 0, bottom: 0, width: 2, transform: "translateX(-50%)", background: "var(--wl-text)" }} />
        </div>
        <div style={{ display: "flex", marginTop: 4 }}>
          {segments.map((s) => (
            <div key={`l-${s.phase}`} style={{ width: `${pct(s.endDay) - pct(s.startDay)}%`, textAlign: "center", fontFamily: "var(--mono)", fontSize: 8, color: "var(--wl-muted)", whiteSpace: "nowrap", overflow: "hidden" }}>
              {phaseLabel(s.phase)}
            </div>
          ))}
        </div>
      </div>
      <div style={summary}>
        Día <span style={strong}>{dayInCycle + 1}</span> de {lengthDays} · fase <span style={strong}>{phaseLabel(phaseToday)}</span>
        {nextWindow && <><br />Tu próximo período: <span style={strong}>{isoRangeLabel(nextWindow.periodStart, nextWindow.periodEnd)}</span></>}
      </div>
    </div>
  );
}
