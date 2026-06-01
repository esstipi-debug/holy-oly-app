import { acwr, acwrStateSafe, type MonitorSeries } from "@holy-oly/core";
import { STATUS } from "../status";
import { ChartCard, linePath } from "./chartkit";

export function AcwrChart({ series }: { series: MonitorSeries }) {
  const a = acwr(series.acute);
  const weeks = series.weeks;

  const W = 300, H = 128, top = 10, bot = H - 16;
  const lo = 0.5, hi = 1.7;
  const y = (v: number) => top + (1 - (v - lo) / (hi - lo)) * (bot - top);
  const x = (w: number) => 12 + (weeks <= 1 ? 0 : (w - 1) / (weeks - 1)) * (W - 24);

  return (
    <ChartCard
      title="ACWR"
      sub="banda segura 0,8–1,3 · el atleta no ve este número"
      chip={a.at(-1) != null ? a.at(-1)!.toFixed(2) : undefined}
      chipState={acwrStateSafe(a.at(-1) ?? NaN)}
    >
      <svg viewBox="0 0 300 128" width="100%" height={128}>
        {/* safe corridor */}
        <rect
          x={12}
          y={y(1.3)}
          width={W - 24}
          height={y(0.8) - y(1.3)}
          style={{ fill: STATUS.ok, opacity: 0.13 } as React.CSSProperties}
        />
        {/* warn threshold at 1.3 */}
        <line
          x1={12}
          x2={W - 12}
          y1={y(1.3)}
          y2={y(1.3)}
          style={{ stroke: STATUS.warn, opacity: 0.5 } as React.CSSProperties}
          strokeDasharray="3 2"
        />
        {/* alert threshold at 1.5 */}
        <line
          x1={12}
          x2={W - 12}
          y1={y(1.5)}
          y2={y(1.5)}
          style={{ stroke: STATUS.alert, opacity: 0.5 } as React.CSSProperties}
          strokeDasharray="3 2"
        />
        {/* ACWR line */}
        <path
          d={linePath(a.map((v, i) => [x(i + 1), y(v)]))}
          style={{ fill: "none", stroke: "var(--wl-text)", strokeWidth: 2 } as React.CSSProperties}
          strokeLinejoin="round"
        />
        {/* one dot per week */}
        {a.map((v, i) => (
          <circle
            key={i}
            cx={x(i + 1)}
            cy={y(v)}
            r={3}
            style={{ fill: STATUS[acwrStateSafe(v ?? NaN)] } as React.CSSProperties}
          />
        ))}
      </svg>
    </ChartCard>
  );
}
