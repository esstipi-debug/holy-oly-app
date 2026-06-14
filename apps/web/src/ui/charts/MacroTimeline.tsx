import { volumeCurve, isTaperWeek, type Competencia, type Macrocycle, type MacrocyclePhase } from "@holy-oly/core";
import { useTranslation } from "react-i18next";
import { ChartCard } from "./chartkit";
import { STATUS } from "../status";
import { phaseColor } from "./phasePalette";

const W = 320;
const H = 160;
const TOP = 42;
const BOT = H - 16; // 144
const W0 = 10;
const WW = W - 20; // 300

function xw(w: number, NW: number): number {
  return W0 + ((w - 0.5) / NW) * WW;
}
// volRel is 0–100 (% of the cycle's own volume peak).
function yvol(v: number): number {
  return TOP + (1 - v / 100) * (BOT - TOP - 6);
}
// imrPct (%1RM, ~70–110) midpoint mapped over a fixed 60–110 domain into the chart's y range.
function yint(mid: number): number {
  const n = Math.max(0, Math.min(1, (mid - 60) / 50));
  return TOP + (1 - n) * (BOT - TOP - 6);
}

/**
 * Macrocycle timeline (the drill-down's 8th chart) — fully data-driven from `macro.phaseProfile`:
 *  - phase ribbon: one segment per phase (`phase.weeks`), label `phase.name`, colour by order;
 *  - volume bars: base `phase.volRel` shaped by the taper before each comp (`core.volumeCurve`);
 *  - intensity line: midpoint of `phase.imrPct` per week (ascending staircase);
 *  - comp flags + HOY divider.
 * X axis = macro duration (end of the last phase). HOY = current week (= the series length),
 * which may sit inside the plan (series shorter than the macro) or at its edge.
 */
export function MacroTimeline({
  macro,
  hoy,
  comps,
}: {
  macro: Macrocycle;
  hoy: number;
  comps: Competencia[];
}) {
  const { t } = useTranslation("charts");
  const phases = macro.phaseProfile;
  const NW = phases.at(-1)?.weeks[1] ?? 1; // macro duration
  const phaseAt = (w: number): MacrocyclePhase =>
    phases.find((p) => w >= p.weeks[0] && w <= p.weeks[1]) ?? phases.at(-1)!;

  const vol = volumeCurve(NW, comps, (w) => phaseAt(w).volRel);

  // Phase ribbon
  const ribbon = phases.map((p, i) => {
    const x0 = W0 + ((p.weeks[0] - 1) / NW) * WW;
    const x1 = W0 + (p.weeks[1] / NW) * WW;
    return (
      <g key={p.key}>
        <rect x={x0} y={10} width={Math.max(0, x1 - x0 - 2)} height={20} rx={4}
          style={{ fill: phaseColor(i), opacity: 0.85 }} />
        <text x={(x0 + x1) / 2} y={24} textAnchor="middle" fontSize={8.5} fontWeight={700}
          style={{ fill: "#0b0b11", fontFamily: "var(--wl-display)" }}>{p.name}</text>
      </g>
    );
  });

  // Volume bars + intensity line points
  const bw = (WW / NW) * 0.62;
  const bars: JSX.Element[] = [];
  const ilPoints: [number, number][] = [];
  for (let w = 1; w <= NW; w++) {
    const t = isTaperWeek(w, comps);
    const x = xw(w, NW);
    const v = vol[w - 1]!;
    bars.push(
      <rect key={w} x={x - bw / 2} y={yvol(v)} width={bw} height={BOT - yvol(v)} rx={1}
        style={{ fill: t ? STATUS.alert : "var(--wl-text)", opacity: t ? 0.5 : 0.18 }} />,
    );
    const ph = phaseAt(w);
    ilPoints.push([x, yint((ph.imrPct[0] + ph.imrPct[1]) / 2)]);
  }

  const pathD = ilPoints
    .map(([px, py], i) => `${i === 0 ? "M" : "L"}${px.toFixed(1)} ${py.toFixed(1)}`)
    .join(" ");
  const intensityLine = (
    <path d={pathD} style={{ fill: "none", stroke: "var(--wl-accent)", strokeWidth: 2.2 }} strokeLinejoin="round" />
  );

  // HOY divider (clamped into the macro span)
  const hoyX = xw(Math.min(Math.max(hoy, 1), NW), NW);
  const hoyEl = (
    <g key="hoy">
      <line x1={hoyX} x2={hoyX} y1={36} y2={BOT} style={{ stroke: "var(--wl-text)", opacity: 0.55 }} strokeDasharray="3 2" />
      <text x={hoyX} y={H - 3} textAnchor="middle" fontSize={9} style={{ fill: "var(--wl-text)" }}>{t("timeline.hoy")}</text>
    </g>
  );

  // Flags — one per comp
  const flags = comps.map((c) => {
    const fx = xw(c.week, NW);
    return (
      <g key={`flag-${c.week}-${c.name}`}>
        <line x1={fx} x2={fx} y1={34} y2={BOT} style={{ stroke: STATUS.alert, opacity: 0.6 }} strokeDasharray="2 2" />
        <text x={fx} y={40} textAnchor="middle" fontSize={11}>🚩</text>
        <text x={fx} y={H - 3} textAnchor="middle" fontSize={9} style={{ fill: STATUS.alert }}>{c.name}</text>
      </g>
    );
  });

  return (
    <ChartCard
      title={t("timeline.title")}
      explain={{
        forma: t("timeline.forma"),
        sirve: t("timeline.sirve"),
        lectura: t("timeline.lectura"),
      }}
    >
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label={t("timeline.aria", { name: macro.name, count: NW })}>
        {ribbon}
        {bars}
        {intensityLine}
        {hoyEl}
        {flags}
      </svg>
    </ChartCard>
  );
}
