import { type MonitorSeries } from "@holy-oly/core";
import { useTranslation } from "react-i18next";
import { ChartCard, linePath, WeekTapZones, type Explain } from "./chartkit";

export function WellnessChart({ series, onPointClick, title, sub, explain }: { series: MonitorSeries; onPointClick?: (week: number) => void; title?: string; sub?: string; explain?: Explain }) {
  const { t } = useTranslation("charts");
  const wsc = series.wellness;
  const items = series.wellnessItems ?? {};
  const weeks = series.weeks;

  const H = 96, top = 10, bot = 80;
  const lo = 40, hi = 100;
  const x = (w: number) => 12 + (weeks <= 1 ? 0 : (w - 1) / (weeks - 1)) * (300 - 24);
  const y = (v: number) => top + (1 - (v - lo) / (hi - lo)) * (bot - top);

  /** Micro sparkline y for 1..5 range, svg height 22 */
  function spark(arr: number[]): string {
    const sw = arr.length;
    const sx = (i: number) => 2 + (sw <= 1 ? 0 : i / (sw - 1)) * (78 - 4);
    const sy = (v: number) => 3 + (1 - (v - 1) / (5 - 1)) * (22 - 6);
    return linePath(arr.map((v, i) => [sx(i), sy(v)]));
  }

  const valid = wsc.filter((v) => Number.isFinite(v));
  const mean = valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
  const std = valid.length ? Math.sqrt(valid.reduce((a, b) => a + (b - mean) ** 2, 0) / valid.length) : 0;
  const lastWsc = wsc.at(-1);

  return (
    <ChartCard
      title={title ?? t("wellness.title")}
      sub={sub ?? t("wellness.sub")}
      chip={lastWsc != null ? String(lastWsc) : undefined}
      explain={explain ?? {
        forma: t("wellness.forma"),
        sirve: t("wellness.sirve"),
        lectura: t("wellness.lectura"),
      }}
    >
      {/* Score area + line chart */}
      <svg viewBox={`0 0 300 ${H}`} width="100%" height={H}>
        {valid.length > 0 && (
          <rect x={12} y={y(Math.min(hi, mean + std))} width={300 - 24}
            height={y(Math.max(lo, mean - std)) - y(Math.min(hi, mean + std))}
            style={{ fill: "var(--wl-muted)", opacity: 0.12 } as React.CSSProperties} />
        )}
        {valid.length > 0 && (
          <line x1={12} x2={300 - 12} y1={y(mean)} y2={y(mean)}
            style={{ stroke: "var(--wl-muted)", opacity: 0.5 } as React.CSSProperties} strokeDasharray="3 2" />
        )}
        {wsc.length > 0 && (
          <path
            d={linePath(wsc.map((v, i) => [x(i + 1), y(v)]))}
            style={{ fill: "none", stroke: "var(--wl-accent)", strokeWidth: 2 } as React.CSSProperties}
            strokeLinejoin="round"
          />
        )}
        {onPointClick && <WeekTapZones weeks={weeks} x={x} top={top} bot={bot} onPick={onPointClick} />}
      </svg>

      {/* Item sparklines grid */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          marginTop: 8,
        } as React.CSSProperties}
      >
        {Object.entries(items).map(([key, arr]) => (
          <div
            key={key}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
            } as React.CSSProperties}
          >
            <span
              style={{
                fontFamily: "var(--mono)",
                fontSize: 9,
                color: "var(--wl-muted)",
              } as React.CSSProperties}
            >
              {key}
            </span>
            <svg width={78} height={22}>
              {arr.length > 0 && (
                <path
                  d={spark(arr)}
                  style={{
                    fill: "none",
                    stroke: "var(--wl-muted)",
                    strokeWidth: 1.5,
                  } as React.CSSProperties}
                  strokeLinejoin="round"
                />
              )}
            </svg>
          </div>
        ))}
      </div>
    </ChartCard>
  );
}
