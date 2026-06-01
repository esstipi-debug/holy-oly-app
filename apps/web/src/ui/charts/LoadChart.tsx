import { chronic, type MonitorSeries } from "@holy-oly/core";
import { ChartCard, linePath, weekLabels } from "./chartkit";

export function LoadChart({ series }: { series: MonitorSeries }) {
  const weeks = series.weeks;
  const acute = series.acute;
  const ch = chronic(acute);

  const W = 300, H = 120, top = 10, bot = 104;
  const mx = Math.max(...acute, 1) * 1.1;
  const y = (v: number) => top + (1 - v / mx) * (bot - top);
  const x = (w: number) => 12 + (weeks <= 1 ? 0 : (w - 1) / (weeks - 1)) * (W - 24);
  const bw = ((W - 24) / weeks) * 0.6;
  const maxAcute = Math.max(...acute);

  return (
    <ChartCard
      title="Carga aguda vs crónica"
      sub="barras = semanal · línea = crónica (4 sem)"
      chip={acute.at(-1) != null ? String(acute.at(-1)) : undefined}
    >
      <svg viewBox="0 0 300 120" width="100%" height={H}>
        {acute.map((v, i) => (
          <rect
            key={i}
            x={x(i + 1) - bw / 2}
            y={y(v)}
            width={bw}
            height={bot - y(v)}
            style={{ fill: "var(--wl-accent)", opacity: v === maxAcute ? 0.95 : 0.45 } as React.CSSProperties}
          />
        ))}
        <path
          d={linePath(ch.map((v, i) => [x(i + 1), y(v)]))}
          style={{ fill: "none", stroke: "var(--wl-text)", strokeWidth: 2 } as React.CSSProperties}
          strokeLinejoin="round"
        />
        {weekLabels(weeks, H - 3, x)}
      </svg>
    </ChartCard>
  );
}
