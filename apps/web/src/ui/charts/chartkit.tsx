import type { ReactNode } from "react";
import { Card } from "../Card";
import { Badge } from "../Badge";
import type { CellState } from "@holy-oly/core";
import { STATUS } from "../status";

/** SVG polyline path "M x y L x y …" from [x,y] points (ports the mockup's lpath). */
export function linePath(pts: [number, number][]): string {
  return pts.map((p, i) => `${i ? "L" : "M"}${p[0]} ${p[1]}`).join(" ");
}

/** Week-axis ticks at a y baseline (S1 / Smid / Slast), ports xlabels. */
export function weekLabels(weeks: number, yB: number, xAt: (w: number) => number): ReactNode {
  const marks = weeks <= 1 ? [1] : [1, Math.ceil(weeks / 2), weeks];
  return marks.map((w) => (
    <text key={w} x={xAt(w)} y={yB} textAnchor="middle" fontSize={8} fontFamily="JetBrains Mono" style={{ fill: "var(--wl-muted)" }}>S{w}</text>
  ));
}

/** Chart card: title + subtitle + optional estado chip, with the chart svg as children. */
export function ChartCard({ title, sub, chip, chipState, children }: {
  title: string; sub?: string; chip?: string; chipState?: CellState; children: ReactNode;
}) {
  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <div style={{ fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 13.5, color: "var(--wl-text)" }}>{title}</div>
        {chip != null && (
          chipState && chipState !== "none"
            ? <Badge tone={chipState}>{chip}</Badge>
            : <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: chipState === "none" ? STATUS.none : "var(--wl-muted)" }}>{chip}</span>
        )}
      </div>
      {sub && <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--wl-muted)", margin: "3px 0 9px" }}>{sub}</div>}
      {children}
    </Card>
  );
}
