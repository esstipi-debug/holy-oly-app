import { useTranslation } from "react-i18next";
import type { CycleView } from "./cycleView";
import { PHASE_FILL, phaseLabel } from "./cycleView";
import { isoRangeLabel } from "../../../ui/charts/planDates";

const SIZE = 150, CX = 75, CY = 75, R = 56, STROKE = 17;
const TAU = Math.PI * 2;
const angleOf = (day: number, len: number): number => (day / len) * TAU - Math.PI / 2;
const polar = (r: number, a: number): [number, number] => [CX + r * Math.cos(a), CY + r * Math.sin(a)];

function arc(a0: number, a1: number, r: number): string {
  const [x0, y0] = polar(r, a0);
  const [x1, y1] = polar(r, a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

/**
 * Anillo del ciclo: las fases como arcos en paleta NEUTRA alrededor de un reloj de `lengthDays`
 * días, HOY marcado sobre el anillo, día/fase al centro, próxima ventana debajo. `fill`/`stroke`
 * van por `style` (CSS) para que las var()/color-mix resuelvan en cualquier navegador.
 */
export function CycleRing({ view }: { view: CycleView }) {
  const { t } = useTranslation("atleta");
  const { lengthDays, dayInCycle, phaseToday, segments, nextWindow } = view;
  const [hx, hy] = polar(R, angleOf(dayInCycle + 0.5, lengthDays));
  return (
    <div>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width="100%" style={{ maxWidth: 196, display: "block", margin: "4px auto 0" }}
        role="img" aria-label={t("cringRingAria", { day: dayInCycle + 1, total: lengthDays, phase: phaseLabel(phaseToday) })}>
        {segments.map((s) => (
          <path key={s.phase} d={arc(angleOf(s.startDay, lengthDays), angleOf(s.endDay, lengthDays), R)}
            style={{ stroke: PHASE_FILL[s.phase], strokeWidth: STROKE, fill: "none" }} />
        ))}
        <circle cx={hx} cy={hy} r={6.5} style={{ fill: "var(--wl-bg)" }} />
        <circle cx={hx} cy={hy} r={4.5} style={{ fill: "var(--wl-text)" }} />
        <text x={CX} y={CY - 3} textAnchor="middle" style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 22, fill: "var(--wl-text)" }}>{dayInCycle + 1}</text>
        <text x={CX} y={CY + 11} textAnchor="middle" style={{ fontFamily: "var(--mono)", fontSize: 8.5, fill: "var(--wl-muted)" }}>{t("cringOf", { total: lengthDays })}</text>
        <text x={CX} y={CY + 25} textAnchor="middle" style={{ fontFamily: "var(--mono)", fontSize: 9, fontWeight: 700, fill: "var(--wl-text)" }}>{phaseLabel(phaseToday)}</text>
      </svg>
      {nextWindow && (
        <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)", marginTop: 6, textAlign: "center" }}>
          {t("cringNextPeriod")} <span style={{ color: "var(--wl-text)", fontWeight: 700 }}>{isoRangeLabel(nextWindow.periodStart, nextWindow.periodEnd)}</span>
        </div>
      )}
    </div>
  );
}
