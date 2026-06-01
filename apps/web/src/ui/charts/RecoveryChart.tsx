import { recoverySeries, recoveryState, type MonitorSeries } from "@holy-oly/core";
import { ChartCard, linePath } from "./chartkit";
import { STATUS } from "../status";

interface MiniProps {
  arr: number[];
  base: number;
  color: string;
  label: string;
  pad: number;
}

function Mini({ arr, base, color, label, pad }: MiniProps) {
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
      {/* data line */}
      <path
        d={linePath(arr.map((v, i) => [x(i + 1), y(v)]))}
        style={{ fill: "none", stroke: color, strokeWidth: 2 } as React.CSSProperties}
      />
      {/* label */}
      <text
        x={14}
        y={7}
        fontSize={7}
        fontFamily="JetBrains Mono"
        style={{ fill: "var(--wl-muted)" } as React.CSSProperties}
      >
        {label}
      </text>
    </svg>
  );
}

export function RecoveryChart({ series }: { series: MonitorSeries }) {
  const rec = recoverySeries(series);
  const lastRec = rec.at(-1) ?? NaN;

  return (
    <ChartCard
      title="Recuperación"
      sub="HRV ↓ y FC reposo ↑ sostenidos = alerta"
      chip={lastRec != null && !Number.isNaN(lastRec) ? String(lastRec) : undefined}
      chipState={recoveryState(lastRec)}
    >
      <Mini arr={series.hrv} base={series.hrvBase} color={STATUS.ok} label="HRV (ms)" pad={5} />
      <Mini arr={series.rhr} base={series.rhrBase} color="#2dd4e6" label="FC reposo (lpm)" pad={3} />
    </ChartCard>
  );
}
