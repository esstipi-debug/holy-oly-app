import { volumeCurve, isTaperWeek, type Competencia } from "@holy-oly/core";

const W = 320;
const H = 160;
const TOP = 42;
const BOT = H - 16; // 144
const W0 = 10;
const WW = W - 20; // 300

function xw(w: number, NW: number): number {
  return W0 + ((w - 0.5) / NW) * WW;
}

function yv(v: number): number {
  return TOP + (1 - v / 100) * (BOT - TOP - 6);
}

const PHASES: [string, number, number, string][] = [
  ["Hiper", 1, 4, "#6f86ff"],
  ["Fuerza", 5, 8, "#2dd4e6"],
  ["Potencia", 9, 12, "#ffab2e"],
  ["Peaking", 13, 16, "#ff3b46"],
];

function intAt(w: number, comps: Competencia[]): number {
  let best = 62;
  for (const c of comps) {
    let d = c.week - w;
    if (d < 0) d = -d * 1.6;
    best = Math.max(best, 100 - d * 3.2);
  }
  return best;
}

/**
 * Macrocycle timeline (phase ribbon + volume bars + intensity line + comp flags).
 * NOTE: tuned for 16-week macros — the phase ribbon and base wave are hardcoded to a
 * 4×4-week structure. M3 will make phases/wave data-driven from the Macrocycle's
 * phaseProfile. Volume bars come from core.volumeCurve; taper highlight from core.isTaperWeek.
 */
export function MacroTimeline({
  weeks,
  hoy,
  comps,
}: {
  weeks: number;
  hoy: number;
  comps: Competencia[];
}) {
  const NW = weeks;

  // Base volume wave
  const wave = [1, 0.9, 0.6, 0.45];
  const pf = [1, 0.88, 0.72, 0.5];
  const baseAt = (w: number): number => {
    const wi = (w - 1) % 4;
    const pi = Math.min(Math.floor((w - 1) / 4), pf.length - 1);
    return wave[wi]! * pf[pi]! * 100;
  };

  const vol = volumeCurve(weeks, comps, baseAt);

  // Phase ribbon
  const ribbon = PHASES.map(([label, s, e, color]) => {
    const x0 = W0 + ((s - 1) / NW) * WW;
    const x1 = W0 + (e / NW) * WW;
    return (
      <g key={label}>
        <rect
          x={x0}
          y={10}
          width={x1 - x0 - 2}
          height={20}
          rx={4}
          style={{ fill: color, opacity: 0.85 }}
        />
        <text
          x={(x0 + x1) / 2}
          y={24}
          textAnchor="middle"
          fontSize={8.5}
          fontWeight={700}
          style={{ fill: "#0b0b11" }}
          fontFamily="Chakra Petch"
        >
          {label}
        </text>
      </g>
    );
  });

  // Volume bars + intensity line points
  const bw = (WW / NW) * 0.62;
  const bars: JSX.Element[] = [];
  const ilPoints: [number, number][] = [];

  for (let w = 1; w <= weeks; w++) {
    const t = isTaperWeek(w, comps);
    const x = xw(w, NW);
    const v = vol[w - 1]!;
    bars.push(
      <rect
        key={w}
        x={x - bw / 2}
        y={yv(v)}
        width={bw}
        height={BOT - yv(v)}
        rx={1}
        style={{
          fill: t ? "#ff3b46" : "var(--wl-text)",
          opacity: t ? 0.5 : 0.18,
        }}
      />
    );
    ilPoints.push([x, TOP + (1 - (intAt(w, comps) - 60) / 45) * (BOT - TOP - 6)]);
  }

  // Intensity line path
  const pathD = ilPoints
    .map(([px, py], i) => `${i === 0 ? "M" : "L"}${px.toFixed(1)} ${py.toFixed(1)}`)
    .join(" ");

  const intensityLine = (
    <path
      d={pathD}
      style={{ fill: "none", stroke: "var(--wl-accent)", strokeWidth: 2.2 }}
      strokeLinejoin="round"
    />
  );

  // HOY divider
  const hoyX = xw(hoy, NW);
  const hoyEl = (
    <g key="hoy">
      <line
        x1={hoyX}
        x2={hoyX}
        y1={36}
        y2={BOT}
        style={{ stroke: "var(--wl-text)", opacity: 0.55 }}
        strokeDasharray="3 2"
      />
      <text
        x={hoyX}
        y={H - 3}
        textAnchor="middle"
        fontSize={9}
        style={{ fill: "var(--wl-text)" }}
      >
        HOY
      </text>
    </g>
  );

  // Flags — one per comp (tested)
  const flags = comps.map((c) => {
    const fx = xw(c.week, NW);
    return (
      <g key={`flag-${c.week}-${c.name}`}>
        <line
          x1={fx}
          x2={fx}
          y1={34}
          y2={BOT}
          style={{ stroke: "#ff3b46", opacity: 0.6 }}
          strokeDasharray="2 2"
        />
        <text x={fx} y={40} textAnchor="middle" fontSize={11}>
          🚩
        </text>
        <text
          x={fx}
          y={H - 3}
          textAnchor="middle"
          fontSize={9}
          style={{ fill: "#ff3b46" }}
        >
          {c.name}
        </text>
      </g>
    );
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label={`Macrociclo ${weeks} semanas`}>
      {ribbon}
      {bars}
      {intensityLine}
      {hoyEl}
      {flags}
    </svg>
  );
}
