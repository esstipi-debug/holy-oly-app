import { type MonitorSeries } from "@holy-oly/core";
import { ChartCard, linePath } from "./chartkit";
import { STATUS } from "../status";

export function CompChart({ series }: { series: MonitorSeries }) {
  const comp = series.compliance ?? [];
  const rpe = series.rpe ?? [];
  const weeks = series.weeks;

  const H = 120, top = 10, bot = 104;
  const x = (w: number) => 12 + (weeks <= 1 ? 0 : (w - 1) / (weeks - 1)) * (300 - 24);
  const y = (v: number) => top + (1 - v / 100) * (bot - top);
  const yr = (v: number) => top + (1 - (v - 5) / 5) * (bot - top);
  const bw = ((300 - 24) / weeks) * 0.6;

  const lastComp = comp.at(-1);

  return (
    <ChartCard
      title="Cumplimiento"
      sub="% completado + RPE medio"
      chip={lastComp != null ? lastComp + "%" : undefined}
    >
      <svg viewBox={`0 0 300 ${H}`} width="100%" height={H}>
        {comp.map((v, i) => {
          const cx = x(i + 1);
          const cy = y(v);
          const fillColor = v >= 85 ? STATUS.ok : v >= 70 ? STATUS.warn : STATUS.alert;
          return (
            <rect
              key={i}
              x={cx - bw / 2}
              y={cy}
              width={bw}
              height={bot - cy}
              style={{ fill: fillColor, opacity: 0.8 } as React.CSSProperties}
            />
          );
        })}
        {rpe.length > 0 && (
          <path
            d={linePath(rpe.map((v, i) => [x(i + 1), yr(v)]))}
            style={{ fill: "none", stroke: "var(--wl-text)", opacity: 0.7 } as React.CSSProperties}
            strokeDasharray="3 2"
          />
        )}
      </svg>
    </ChartCard>
  );
}
