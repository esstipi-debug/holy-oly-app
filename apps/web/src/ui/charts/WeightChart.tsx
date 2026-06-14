import { weightBandState, type MonitorSeries } from "@holy-oly/core";
import { useTranslation } from "react-i18next";
import { ChartCard, linePath, WeekTapZones, type Explain } from "./chartkit";
import { STATUS } from "../status";

export function WeightChart({ series, onPointClick, title, sub, explain }: { series: MonitorSeries; onPointClick?: (week: number) => void; title?: string; sub?: string; explain?: Explain }) {
  const { t } = useTranslation("charts");
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
      title={title ?? t("weight.title")}
      sub={sub ?? t("weight.sub")}
      chip={lastWt != null ? t("weight.chip", { value: lastWt }) : undefined}
      explain={explain ?? {
        forma: t("weight.forma"),
        sirve: t("weight.sirve"),
        lectura: t("weight.lectura"),
      }}
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
            style={{ fill: STATUS[weightBandState(lastWt, band)] } as React.CSSProperties}
          />
        )}
        {onPointClick && <WeekTapZones weeks={weeks} x={x} top={top} bot={bot} onPick={onPointClick} />}
      </svg>
    </ChartCard>
  );
}
