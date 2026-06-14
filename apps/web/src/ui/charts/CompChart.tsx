import { type MonitorSeries } from "@holy-oly/core";
import { useTranslation } from "react-i18next";
import { ChartCard, linePath, WeekTapZones } from "./chartkit";
import { STATUS } from "../status";

export function CompChart({ series, onPointClick }: { series: MonitorSeries; onPointClick?: (week: number) => void }) {
  const { t } = useTranslation("charts");
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
      title={t("comp.title")}
      sub={t("comp.sub")}
      chip={lastComp != null ? lastComp + "%" : undefined}
      explain={{
        forma: t("comp.forma"),
        sirve: t("comp.sirve"),
        lectura: t("comp.lectura"),
      }}
    >
      <svg viewBox={`0 0 300 ${H}`} width="100%" height={H}>
        {[85, 70].map((thr) => (
          <line key={thr} x1={0} x2={300} y1={y(thr)} y2={y(thr)}
            style={{ stroke: thr === 85 ? STATUS.ok : STATUS.warn, opacity: 0.35 } as React.CSSProperties}
            strokeDasharray="2 3" />
        ))}
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
        {onPointClick && <WeekTapZones weeks={weeks} x={x} top={top} bot={bot} onPick={onPointClick} />}
      </svg>
    </ChartCard>
  );
}
