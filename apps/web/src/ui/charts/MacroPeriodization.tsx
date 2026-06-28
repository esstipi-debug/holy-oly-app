import type { CSSProperties, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import type { Macrocycle, MacrocyclePhase } from "@holy-oly/core";

/**
 * Program-level periodization detail (ports the _mockup detail view's three blocks):
 *   1. PeriodizationChart — IMR band corridor per phase + stepped phase-mean line + volume bars;
 *   2. PhaseRibbon ("reparto de fases") — width = phase duration, fill = mean intensity;
 *   3. PhaseRows ("fases en detalle") — per-phase volume bar, IMR range and focus.
 *
 * Pure function of `macro.phaseProfile` (+ peak), so the SAME block serves the coach (catalog →
 * assign) and the athlete ("my program"). Instance-specific progress lives in `MacroTimeline`.
 */

const DASH = "–"; // en dash — matches the mockup's week/IMR ranges

const weekRange = (p: MacrocyclePhase): string =>
  `${p.weeks[0]}${p.weeks[1] > p.weeks[0] ? DASH + p.weeks[1] : ""}`;
const phaseMean = (p: MacrocyclePhase): number => Math.round((p.imrPct[0] + p.imrPct[1]) / 2);
const inPhase = (week: number | null, p: MacrocyclePhase): boolean =>
  week != null && week >= p.weeks[0] && week <= p.weeks[1];

const sec: CSSProperties = {
  fontFamily: "var(--wl-display)", fontSize: 11, letterSpacing: ".16em",
  textTransform: "uppercase", color: "var(--wl-muted)", margin: "20px 0 10px",
};
const cap: CSSProperties = {
  display: "flex", gap: 13, flexWrap: "wrap", margin: "8px 2px 0",
  fontFamily: "var(--mono)", fontSize: 8.5, color: "var(--wl-muted)",
};
const surface: CSSProperties = {
  background: "var(--wl-surface)", borderRadius: "var(--wl-radius)", padding: "12px 10px 6px",
};

// ---- 1. periodization chart (ports periodChart) ----
const W = 320, padL = 20, padR = 10, padT = 14;
const iH = 84, gap = 13, vH = 40, labH = 18;
const H = padT + iH + gap + vH + labH; // 169
const LO = 55, HI = 110, span = W - padL - padR;
const vBase = padT + iH + gap + vH;

function PeriodizationChart({ macro, t }: { macro: Macrocycle; t: TFunction<["charts", "domain"]> }) {
  const phases = macro.phaseProfile;
  const tot = phases.at(-1)?.weeks[1] ?? 1;
  const Lx = (w: number) => padL + ((w - 1) / tot) * span;
  const Rx = (w: number) => padL + (w / tot) * span;
  const Cx = (w: number) => padL + ((w - 0.5) / tot) * span;
  const iy = (v: number) => padT + (1 - (v - LO) / (HI - LO)) * iH;
  const vy = (v: number) => vBase - (v / 100) * vH;

  const grid = [70, 90].map((gv) => (
    <g key={`grid-${gv}`}>
      <line x1={padL} y1={iy(gv)} x2={W - padR} y2={iy(gv)}
        stroke="color-mix(in srgb,var(--wl-text) 10%,transparent)" strokeWidth={1} strokeDasharray="2 3" />
      <text x={padL - 3} y={iy(gv) + 3} textAnchor="end" fontSize={7}
        style={{ fill: "var(--wl-muted)", fontFamily: "var(--mono)" }}>{gv}</text>
    </g>
  ));

  const corridor = phases.map((p) => {
    const x0 = Lx(p.weeks[0]), x1 = Rx(p.weeks[1]), yT = iy(p.imrPct[1]), yB = iy(p.imrPct[0]);
    return (
      <g key={`band-${p.key}`}>
        <rect x={x0} y={yT} width={Math.max(0, x1 - x0)} height={Math.max(0, yB - yT)}
          style={{ fill: "var(--wl-accent)", opacity: 0.14 }} />
        <line x1={x0} y1={yT} x2={x1} y2={yT} stroke="var(--wl-accent)" strokeWidth={1} strokeOpacity={0.45} />
        <line x1={x0} y1={yB} x2={x1} y2={yB} stroke="var(--wl-accent)" strokeWidth={1} strokeOpacity={0.45} />
      </g>
    );
  });

  let mid = "";
  phases.forEach((p, i) => {
    const x0 = Lx(p.weeks[0]), x1 = Rx(p.weeks[1]), yy = iy(phaseMean(p));
    mid += `${i ? "L" : "M"}${x0.toFixed(1)} ${yy.toFixed(1)} L${x1.toFixed(1)} ${yy.toFixed(1)} `;
  });

  const dividers = phases.slice(1).map((p) => (
    <line key={`div-${p.key}`} x1={Lx(p.weeks[0])} y1={padT} x2={Lx(p.weeks[0])} y2={vBase}
      stroke="color-mix(in srgb,var(--wl-text) 12%,transparent)" strokeWidth={1} strokeDasharray="3 3" />
  ));

  const peak = macro.peaks && macro.peakWeek != null ? (
    <g key="peak">
      <line x1={Cx(macro.peakWeek)} y1={padT} x2={Cx(macro.peakWeek)} y2={vBase}
        stroke="var(--wl-accent)" strokeWidth={1.3} strokeDasharray="2 2" strokeOpacity={0.85} />
      <text x={Cx(macro.peakWeek)} y={padT + 7} textAnchor="middle" fontSize={9} fontWeight={700}
        style={{ fill: "var(--wl-accent)" }}>▲</text>
    </g>
  ) : null;

  const bars = phases.map((p) => {
    const x0 = Lx(p.weeks[0]) + 2, x1 = Rx(p.weeks[1]) - 2, yT = vy(p.volRel);
    return (
      <g key={`vol-${p.key}`}>
        <rect x={x0} y={yT} width={Math.max(2, x1 - x0)} height={vBase - yT} rx={2}
          style={{ fill: "color-mix(in srgb,var(--wl-text) 36%,transparent)" }} />
        <text x={Cx((p.weeks[0] + p.weeks[1]) / 2)} y={yT - 2} textAnchor="middle" fontSize={7}
          style={{ fill: "var(--wl-muted)", fontFamily: "var(--mono)" }}>{p.volRel}</text>
      </g>
    );
  });

  const weekLabels = phases.map((p) => (
    <text key={`wk-${p.key}`} x={Cx((p.weeks[0] + p.weeks[1]) / 2)} y={H - 4} textAnchor="middle"
      fontSize={7.5} style={{ fill: "var(--wl-muted)", fontFamily: "var(--mono)" }}>{weekRange(p)}</text>
  ));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img"
      aria-label={t("periodization.aria", { name: t(`domain:macro.${macro.id}.name`), count: tot })}>
      {grid}
      {corridor}
      <path d={mid} style={{ fill: "none", stroke: "var(--wl-accent)", strokeWidth: 2.6 }}
        strokeLinejoin="round" strokeLinecap="round" />
      {dividers}
      {peak}
      {bars}
      <line x1={padL} y1={vBase} x2={W - padR} y2={vBase}
        stroke="color-mix(in srgb,var(--wl-text) 14%,transparent)" strokeWidth={1} />
      {weekLabels}
      <text x={W - padR} y={padT - 4} textAnchor="end" fontSize={7}
        letterSpacing=".1em" style={{ fill: "var(--wl-muted)", fontFamily: "var(--wl-display)" }}>{t("periodization.axisLabel")}</text>
    </svg>
  );
}

// ---- 2. phase ribbon (ports phaseRibbon) ----
function PhaseRibbon({ macro, t }: { macro: Macrocycle; t: TFunction<["charts", "domain"]> }) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {macro.phaseProfile.map((p) => {
        const wks = p.weeks[1] - p.weeks[0] + 1;
        const m = phaseMean(p);
        const fill = Math.round(((m - LO) / (HI - LO)) * 78 + 16);
        const peak = macro.peaks && inPhase(macro.peakWeek, p);
        return (
          <div key={p.key} style={{
            position: "relative", flex: wks, minWidth: 0, minHeight: 66, borderRadius: 8,
            padding: "8px 8px 9px", overflow: "hidden",
            background: "color-mix(in srgb,var(--wl-text) 6%,transparent)",
            border: "1px solid color-mix(in srgb,var(--wl-text) 9%,transparent)",
          }}>
            <span style={{
              position: "absolute", left: 0, right: 0, bottom: 0, height: `${fill}%`, opacity: 0.2,
              pointerEvents: "none",
              background: "linear-gradient(var(--wl-accent), color-mix(in srgb,var(--wl-accent) 35%,transparent))",
            }} />
            <span style={{
              position: "relative", zIndex: 1, display: "block", fontFamily: "var(--wl-display)",
              fontWeight: 700, fontSize: 9, lineHeight: 1.1, color: "var(--wl-text)", overflowWrap: "break-word",
            }}>{t(`domain:macro.${macro.id}.phase.${p.key}.name`)}{peak ? " ▲" : ""}</span>
            <span style={{
              position: "relative", zIndex: 1, display: "block", marginTop: 3,
              fontFamily: "var(--mono)", fontSize: 8.5, color: "var(--wl-muted)",
            }}>{t("periodization.ribbonWeeks", { range: weekRange(p), count: wks })}</span>
            <span style={{
              position: "relative", zIndex: 1, display: "block", marginTop: 4,
              fontFamily: "var(--mono)", fontSize: 8, color: "var(--wl-accent)",
            }}>{t("periodization.ribbonImr", { mean: m })}</span>
          </div>
        );
      })}
    </div>
  );
}

// ---- 3. phase rows (ports phaseRows) ----
function PhaseRows({ macro, t }: { macro: Macrocycle; t: TFunction<["charts", "domain"]> }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      {macro.phaseProfile.map((p) => (
        <div key={p.key} style={{
          background: "var(--wl-surface)", borderRadius: "var(--wl-radius)", padding: "11px 12px",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 13.5, color: "var(--wl-text)" }}>{t(`domain:macro.${macro.id}.phase.${p.key}.name`)}</span>
            <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--wl-muted)", whiteSpace: "nowrap" }}>
              {t("periodization.rowWeeksImr", { range: weekRange(p), lo: p.imrPct[0], hi: p.imrPct[1] })}
            </span>
          </div>
          <div style={{
            height: 7, borderRadius: 99, margin: "8px 0 6px", overflow: "hidden",
            background: "color-mix(in srgb,var(--wl-text) 10%,transparent)",
          }}>
            <span style={{ display: "block", height: "100%", borderRadius: 99, width: `${p.volRel}%`, background: "var(--wl-accent)" }} />
          </div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--wl-muted)" }}>{t("periodization.rowVolFocus", { vol: p.volRel, focus: t(`domain:macro.${macro.id}.phase.${p.key}.focus`) })}</div>
        </div>
      ))}
    </div>
  );
}

function Swatch({ kind }: { kind: "band" | "line" | "bar" }) {
  const base: CSSProperties = { display: "inline-block", width: 12, height: 9, marginRight: 5, borderRadius: 2 };
  if (kind === "line") return <i style={{ ...base, height: 0, borderTop: "2.6px solid var(--wl-accent)" }} />;
  if (kind === "bar") return <i style={{ ...base, height: 8, background: "color-mix(in srgb,var(--wl-text) 38%,transparent)" }} />;
  return <i style={{ ...base, background: "var(--wl-accent)", opacity: 0.16, border: "1px solid color-mix(in srgb,var(--wl-accent) 50%,transparent)" }} />;
}

function CapItem({ children }: { children: ReactNode }) {
  return <span style={{ display: "inline-flex", alignItems: "center" }}>{children}</span>;
}

export function MacroPeriodization({ macro }: { macro: Macrocycle }) {
  const { t } = useTranslation("charts");
  return (
    <div>
      <div style={sec}>{t("periodization.secChart")}</div>
      <div style={surface}><PeriodizationChart macro={macro} t={t} /></div>
      <div style={cap}>
        <CapItem><Swatch kind="band" />{t("periodization.capBand")}</CapItem>
        <CapItem><Swatch kind="line" />{t("periodization.capLine")}</CapItem>
        <CapItem><Swatch kind="bar" />{t("periodization.capBar")}</CapItem>
      </div>

      <div style={sec}>{t("periodization.secRibbon")}</div>
      <PhaseRibbon macro={macro} t={t} />
      <div style={cap}>
        <CapItem>{t("periodization.capWidth")}</CapItem>
        <CapItem><Swatch kind="band" />{t("periodization.capFill")}</CapItem>
      </div>

      <div style={sec}>{t("periodization.secRows", { count: macro.phaseProfile.length })}</div>
      <PhaseRows macro={macro} t={t} />
    </div>
  );
}
