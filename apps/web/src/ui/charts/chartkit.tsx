import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
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
    <text key={w} x={xAt(w)} y={yB} textAnchor="middle" fontSize={8} style={{ fill: "var(--wl-muted)", fontFamily: "var(--mono)" }}>S{w}</text>
  ));
}

/** Zonas de tap transparentes, una por semana, sobre el plot. Hit-target grande (mobile);
 *  funciona para charts de puntos y de líneas. Emite onPick(week). */
export function WeekTapZones({ weeks, x, top, bot, onPick }: {
  weeks: number; x: (w: number) => number; top: number; bot: number; onPick: (week: number) => void;
}) {
  if (weeks < 1) return null;
  const half = weeks > 1 ? (x(2) - x(1)) / 2 : 150;
  return (
    <>
      {Array.from({ length: weeks }, (_, i) => {
        const w = i + 1;
        return (
          <rect
            key={w}
            data-week={w}
            x={x(w) - half}
            y={top}
            width={half * 2}
            height={bot - top}
            fill="transparent"
            style={{ cursor: "pointer" } as React.CSSProperties}
            onClick={() => onPick(w)}
          />
        );
      })}
    </>
  );
}

/** El panel de detalle (tap) con las 3 preguntas de HR-2: cómo se forma / para qué sirve / contra qué se lee. */
export function ChartExplainSheet({ title, explain }: { title: string; explain: Explain }) {
  const { t } = useTranslation("charts");
  const rows: [string, string][] = [
    [t("explain.forma"), explain.forma],
    [t("explain.sirve"), explain.sirve],
    [t("explain.lectura"), explain.lectura],
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

/** Chart card: title + subtitle + optional estado chip + required HR-2 explain (tap "ⓘ" → BottomSheet).
 *  `bare`: dentro de un host que ya provee chrome + ⓘ (p.ej. SignalCard del rediseño de Mi Progreso),
 *  renderiza SÓLO el SVG — sin Card, título, chip ni explain (el host es dueño de todo eso). */
export function ChartCard({ title, sub, chip, chipState, explain, children, bare = false }: {
  title: string; sub?: string; chip?: string; chipState?: CellState; explain: Explain; children: ReactNode; bare?: boolean;
}) {
  const { t } = useTranslation("charts");
  const [open, setOpen] = useState(false);
  if (bare) return <>{children}</>;
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
            aria-label={t("howToRead", { title })}
            aria-haspopup="dialog"
            aria-expanded={open}
            style={{
              // 24×24 = target mínimo de WCAG 2.2 (SC 2.5.8). Glifo en --wl-text para pasar contraste
              // AA en todos los skins (el aro --wl-muted es decorativo, no texto).
              width: 24, height: 24, borderRadius: 12, border: "1px solid var(--wl-muted)",
              background: "transparent", color: "var(--wl-text)", fontSize: 13, lineHeight: 1,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              padding: 0, cursor: "pointer", fontFamily: "var(--mono)", flex: "0 0 auto",
            }}
          >ⓘ</button>
        </div>
      </div>
      {sub && <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--wl-muted)", margin: "3px 0 9px" }}>{sub}</div>}
      {children}
      <BottomSheet open={open} onClose={() => setOpen(false)} ariaLabel={title || t("detailFallback")}>
        <ChartExplainSheet title={title} explain={explain} />
      </BottomSheet>
    </Card>
  );
}
