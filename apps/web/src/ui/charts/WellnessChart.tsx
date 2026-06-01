import { type MonitorSeries } from "@holy-oly/core";
import { ChartCard, linePath } from "./chartkit";

export function WellnessChart({ series }: { series: MonitorSeries }) {
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

  const lastWsc = wsc.at(-1);

  return (
    <ChartCard
      title="Bienestar"
      sub="puntaje 0–100 + ítems (1–5)"
      chip={lastWsc != null ? String(lastWsc) : undefined}
    >
      {/* Score area + line chart */}
      <svg viewBox={`0 0 300 ${H}`} width="100%" height={H}>
        {wsc.length > 0 && (
          <path
            d={linePath(wsc.map((v, i) => [x(i + 1), y(v)]))}
            style={{ fill: "none", stroke: "var(--wl-accent)", strokeWidth: 2 } as React.CSSProperties}
            strokeLinejoin="round"
          />
        )}
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
            <span
              style={{
                fontFamily: "var(--mono)",
                fontSize: 10,
                color: "var(--wl-text)",
              } as React.CSSProperties}
            >
              {arr.at(-1)}
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
