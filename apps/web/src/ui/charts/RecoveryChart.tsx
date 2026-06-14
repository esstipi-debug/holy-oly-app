import { recoverySeries, recoveryState, type CellState, type MonitorSeries } from "@holy-oly/core";
import { useTranslation } from "react-i18next";
import { ChartCard, linePath, WeekTapZones, type Explain } from "./chartkit";
import { STATUS } from "../status";

interface MiniProps {
  arr: number[];
  base: number;
  label: string;
  pad: number;
  pointState?: CellState;
  onPick?: (week: number) => void;
}

function Mini({ arr, base, label, pad, pointState, onPick }: MiniProps) {
  const weeks = arr.length;
  const mn = Math.min(...arr, base) - pad - 2;
  const mx = Math.max(...arr, base) + pad + 2;
  const top = 8, bot = 46;
  const y = (v: number) => top + (1 - (v - mn) / (mx - mn)) * (bot - top);
  const x = (w: number) => 12 + (weeks <= 1 ? 0 : (w - 1) / (weeks - 1)) * (300 - 24);

  return (
    <svg viewBox="0 0 300 52" width="100%" height={52}>
      {/* green band */}
      <rect
        x={12}
        y={y(base + pad)}
        width={300 - 24}
        height={y(base - pad) - y(base + pad)}
        style={{ fill: STATUS.ok, opacity: 0.12 } as React.CSSProperties}
      />
      {/* dashed baseline */}
      <line
        x1={12} x2={300 - 12}
        y1={y(base)} y2={y(base)}
        style={{ stroke: STATUS.ok, opacity: 0.5 } as React.CSSProperties}
        strokeDasharray="3 2"
      />
      {/* data line (neutra — el estado va en el último punto, no en la línea) */}
      <path
        d={linePath(arr.map((v, i) => [x(i + 1), y(v)]))}
        style={{ fill: "none", stroke: "var(--wl-text)", strokeWidth: 2 } as React.CSSProperties}
      />
      {arr.length > 0 && pointState && (
        <circle cx={x(weeks)} cy={y(arr[weeks - 1]!)} r={3}
          style={{ fill: STATUS[pointState] } as React.CSSProperties} />
      )}
      {/* label */}
      <text
        x={14}
        y={7}
        fontSize={7}
        style={{ fill: "var(--wl-muted)", fontFamily: "var(--mono)" } as React.CSSProperties}
      >
        {label}
      </text>
      {onPick && <WeekTapZones weeks={weeks} x={x} top={top} bot={bot} onPick={onPick} />}
    </svg>
  );
}

export function RecoveryChart({ series, onPointClick, title, sub, explain }: { series: MonitorSeries; onPointClick?: (week: number) => void; title?: string; sub?: string; explain?: Explain }) {
  const { t } = useTranslation("charts");
  const rec = recoverySeries(series);
  const lastRec = rec.at(-1) ?? NaN;
  const st = recoveryState(lastRec);

  return (
    <ChartCard
      title={title ?? t("recovery.title")}
      sub={sub ?? t("recovery.sub")}
      chip={lastRec != null && !Number.isNaN(lastRec) ? String(lastRec) : undefined}
      chipState={recoveryState(lastRec)}
      explain={explain ?? {
        forma: t("recovery.forma"),
        sirve: t("recovery.sirve"),
        lectura: t("recovery.lectura"),
      }}
    >
      <Mini arr={series.hrv} base={series.hrvBase} label={t("recovery.hrvLabel")} pad={5} pointState={st} onPick={onPointClick} />
      <Mini arr={series.rhr} base={series.rhrBase} label={t("recovery.rhrLabel")} pad={3} pointState={st} onPick={onPointClick} />
    </ChartCard>
  );
}
