import { useState, type ReactNode } from "react";
import { Card } from "../Card";
import { Badge } from "../Badge";
import { BottomSheet } from "../BottomSheet";
import type { CellState } from "@holy-oly/core";
import { STATUS } from "../status";

/** Las 3 respuestas que HR-2 exige de todo gráfico. Requerido en ChartCard → ningún chart compila sin contexto. */
export type Explain = { forma: string; sirve: string; lectura: string };

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

/** El panel de detalle (tap) con las 3 preguntas de HR-2: cómo se forma / para qué sirve / contra qué se lee. */
function ChartExplainSheet({ title, explain }: { title: string; explain: Explain }) {
  const rows: [string, string][] = [
    ["Cómo se forma", explain.forma],
    ["Para qué sirve", explain.sirve],
    ["Contra qué se lee", explain.lectura],
  ];
  return (
    <div>
      <div style={{ fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 15, color: "var(--wl-text)", marginBottom: 12 }}>{title}</div>
      {rows.map(([label, value]) => (
        <div key={label} style={{ marginBottom: 12 }}>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: ".04em", color: "var(--wl-muted)", marginBottom: 3 }}>{label}</div>
          <div style={{ fontSize: 13, color: "var(--wl-text)", lineHeight: 1.45 }}>{value}</div>
        </div>
      ))}
    </div>
  );
}

/** Chart card: title + subtitle + optional estado chip + required HR-2 explain (tap "ⓘ" → BottomSheet). */
export function ChartCard({ title, sub, chip, chipState, explain, children }: {
  title: string; sub?: string; chip?: string; chipState?: CellState; explain: Explain; children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <div style={{ fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 13.5, color: "var(--wl-text)" }}>{title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {chip != null && (
            chipState && chipState !== "none"
              ? <Badge tone={chipState}>{chip}</Badge>
              : <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: chipState === "none" ? STATUS.none : "var(--wl-muted)" }}>{chip}</span>
          )}
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={`Cómo se lee: ${title}`}
            style={{
              width: 18, height: 18, borderRadius: 9, border: "1px solid var(--wl-muted)",
              background: "transparent", color: "var(--wl-muted)", fontSize: 11, lineHeight: "15px",
              padding: 0, cursor: "pointer", fontFamily: "var(--mono)", flex: "0 0 auto",
            }}
          >i</button>
        </div>
      </div>
      {sub && <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--wl-muted)", margin: "3px 0 9px" }}>{sub}</div>}
      {children}
      <BottomSheet open={open} onClose={() => setOpen(false)}>
        <ChartExplainSheet title={title} explain={explain} />
      </BottomSheet>
    </Card>
  );
}
