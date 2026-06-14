import { chronic, type MonitorSeries } from "@holy-oly/core";
import { useTranslation } from "react-i18next";
import { ChartCard, linePath, weekLabels, WeekTapZones, type Explain } from "./chartkit";

// Copy defaults to the coach framing (drilldown). The athlete screen overrides title/sub/explain
// to drop ACWR and speak in 2nd person — same rendering, athlete-safe voice.
export function LoadChart({ series, onPointClick, title, sub, explain }: { series: MonitorSeries; onPointClick?: (week: number) => void; title?: string; sub?: string; explain?: Explain }) {
  const { t } = useTranslation("charts");
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
      title={title ?? t("load.title")}
      sub={sub ?? t("load.sub")}
      chip={acute.at(-1) != null ? String(acute.at(-1)) : undefined}
      explain={explain ?? {
        forma: t("load.forma"),
        sirve: t("load.sirve"),
        lectura: t("load.lectura"),
      }}
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
        {onPointClick && <WeekTapZones weeks={weeks} x={x} top={top} bot={bot} onPick={onPointClick} />}
      </svg>
    </ChartCard>
  );
}
