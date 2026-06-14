import { imrStateForWeekSafe, type Macrocycle, type MonitorSeries } from "@holy-oly/core";
import { useTranslation } from "react-i18next";
import { ChartCard, linePath, WeekTapZones } from "./chartkit";
import { STATUS } from "../status";

export function ImrFaseChart({ series, macro, onPointClick }: { series: MonitorSeries; macro: Macrocycle; onPointClick?: (week: number) => void }) {
  const { t } = useTranslation("charts");
  const imr = series.imr;
  const weeks = series.weeks;

  const H = 132, top = 10, bot = 116, lo = 60, hi = 104;
  const y = (v: number) => top + (1 - (v - lo) / (hi - lo)) * (bot - top);
  const x = (w: number) => 12 + (weeks <= 1 ? 0 : (w - 1) / (weeks - 1)) * (300 - 24);

  return (
    <ChartCard
      title={t("imr.title")}
      sub={t("imr.sub")}
      chip={Number.isFinite(imr.at(-1)) ? String(imr.at(-1)) : undefined}
      chipState={imr.at(-1) != null ? imrStateForWeekSafe(imr.at(-1)!, macro, weeks) : undefined}
      explain={{
        forma: t("imr.forma"),
        sirve: t("imr.sirve"),
        lectura: t("imr.lectura"),
      }}
    >
      <svg viewBox={`0 0 300 ${H}`} width="100%" height={H}>
        {/* Phase bands + separators */}
        {macro.phaseProfile.map((phase) => (
          <g key={phase.key}>
            <rect
              x={x(phase.weeks[0])}
              y={y(Math.min(hi, phase.imrPct[1] + 2))}
              width={x(phase.weeks[1]) - x(phase.weeks[0])}
              height={y(Math.max(lo, phase.imrPct[0] - 2)) - y(Math.min(hi, phase.imrPct[1] + 2))}
              style={{ fill: STATUS.ok, opacity: 0.16 } as React.CSSProperties}
            />
            <line
              x1={x(phase.weeks[1])} x2={x(phase.weeks[1])}
              y1={top} y2={bot}
              style={{ stroke: "var(--wl-muted)", opacity: 0.3 } as React.CSSProperties}
              strokeDasharray="2 2"
            />
          </g>
        ))}
        {/* IMR line */}
        <path
          d={linePath(imr.map((v, i) => [x(i + 1), y(v)]))}
          style={{ fill: "none", stroke: "var(--wl-text)", strokeWidth: 2 } as React.CSSProperties}
          strokeLinejoin="round"
        />
        {/* Per-week dots */}
        {imr.map((v, i) => (
          <circle
            key={i}
            cx={x(i + 1)}
            cy={y(v)}
            r={3}
            style={{ fill: STATUS[imrStateForWeekSafe(v, macro, i + 1)] } as React.CSSProperties}
          />
        ))}
        {onPointClick && <WeekTapZones weeks={weeks} x={x} top={top} bot={bot} onPick={onPointClick} />}
      </svg>
    </ChartCard>
  );
}
