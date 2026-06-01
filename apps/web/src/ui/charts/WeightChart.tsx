import { type MonitorSeries } from "@holy-oly/core";
import { ChartCard, linePath } from "./chartkit";
import { STATUS } from "../status";

export function WeightChart({ series }: { series: MonitorSeries }) {
  const wt = series.bodyweight ?? [];
  const band = series.weightBand;
  const weeks = series.weeks;

  const H = 110, top = 10, bot = 94;
  const x = (w: number) => 12 + (weeks <= 1 ? 0 : (w - 1) / (weeks - 1)) * (300 - 24);

  const allVals = [
    ...wt,
    ...(band ? band : []),
  ].filter((v) => isFinite(v));
  const lo = allVals.length > 0 ? Math.min(...allVals) - 0.3 : 0;
  const hi = allVals.length > 0 ? Math.max(...allVals) + 0.3 : 1;
  const y = (v: number) => top + (1 - (v - lo) / (hi - lo)) * (bot - top);

  const lastWt = wt.at(-1);

  return (
    <ChartCard
      title="Peso vs categoría"
      sub="banda objetivo de categoría"
      chip={lastWt != null ? lastWt + " kg" : undefined}
    >
      <svg viewBox={`0 0 300 ${H}`} width="100%" height={H}>
        {band && (
          <rect
            x={12}
            y={y(band[1])}
            width={300 - 24}
            height={y(band[0]) - y(band[1])}
            style={{ fill: STATUS.ok, opacity: 0.13 } as React.CSSProperties}
          />
        )}
        {wt.length > 0 && (
          <path
            d={linePath(wt.map((v, i) => [x(i + 1), y(v)]))}
            style={{ fill: "none", stroke: "var(--wl-text)", strokeWidth: 2 } as React.CSSProperties}
            strokeLinejoin="round"
          />
        )}
        {wt.length > 0 && lastWt != null && (
          <circle
            cx={x(weeks)}
            cy={y(lastWt)}
            r={3.4}
            style={{ fill: STATUS.ok } as React.CSSProperties}
          />
        )}
      </svg>
    </ChartCard>
  );
}
