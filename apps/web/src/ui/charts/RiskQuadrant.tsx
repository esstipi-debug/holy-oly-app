import { Card } from "../Card";
import { STATUS } from "../status";
import type { CellState } from "@holy-oly/core";

export interface QuadPoint { id: string; iniciales: string; acwr: number; rec: number; cell: CellState; }
export interface NoDataPoint { id: string; iniciales: string; }

const S = 300, PAD = 30;
const AXLO = 0.6, AXHI = 1.7, RYLO = 48, RYHI = 94;
const x = (v: number) => PAD + ((v - AXLO) / (AXHI - AXLO)) * (S - PAD - 12);
const y = (v: number) => 12 + (1 - (v - RYLO) / (RYHI - RYLO)) * (S - PAD - 12);
const clampX = (v: number) => Math.max(AXLO, Math.min(AXHI, v));
const clampY = (v: number) => Math.max(RYLO, Math.min(RYHI, v));

export function RiskQuadrant({ points, noData, onPick }:
  { points: QuadPoint[]; noData: NoDataPoint[]; onPick: (id: string) => void }) {
  return (
    <Card>
      <div style={{ fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 13.5, color: "var(--wl-text)" }}>Riesgo ahora</div>
      <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--wl-muted)", margin: "3px 0 9px" }}>carga (ACWR) × recuperación · tocá un punto</div>
      <div style={{ padding: "0 10px" }}>
        <svg data-testid="risk-quadrant" viewBox={`0 0 ${S} ${S}`} width="100%" height={S} role="img" aria-label="Cuadrante de riesgo ACWR × recuperación">
          <rect x={x(0.8)} y={12} width={x(1.3) - x(0.8)} height={S - PAD - 12} style={{ fill: STATUS.ok, opacity: 0.1 }} />
          <rect x={x(1.3)} y={y(70)} width={x(AXHI) - x(1.3)} height={y(RYLO) - y(70)} style={{ fill: STATUS.alert, opacity: 0.12 }} />
          <text x={x(AXHI) - 4} y={y(RYLO) - 6} textAnchor="end" fontSize={8.5} style={{ fill: STATUS.alert }} fontFamily="JetBrains Mono">zona de riesgo</text>
          <line x1={x(1.0)} x2={x(1.0)} y1={12} y2={S - PAD} style={{ stroke: "var(--wl-muted)", opacity: 0.2 }} strokeDasharray="2 3" />
          <line x1={PAD} x2={S - 12} y1={S - PAD} y2={S - PAD} style={{ stroke: "var(--wl-muted)", opacity: 0.3 }} />
          <line x1={PAD} x2={PAD} y1={12} y2={S - PAD} style={{ stroke: "var(--wl-muted)", opacity: 0.3 }} />
          {[0.8, 1.0, 1.3, 1.5].map((t) => (
            <text key={t} x={x(t)} y={S - PAD + 12} textAnchor="middle" fontSize={8} style={{ fill: "var(--wl-muted)" }} fontFamily="JetBrains Mono">{t.toFixed(1)}</text>
          ))}
          <text x={(PAD + S - 12) / 2} y={S - 4} textAnchor="middle" fontSize={8.5} style={{ fill: "var(--wl-muted)" }} fontFamily="Chakra Petch" letterSpacing=".05em">CARGA · ACWR →</text>
          <text x={11} y={(S - PAD) / 2} fontSize={8.5} style={{ fill: "var(--wl-muted)" }} fontFamily="Chakra Petch" transform={`rotate(-90 11 ${((S - PAD) / 2).toFixed(1)})`} textAnchor="middle">← RECUPERACIÓN</text>
          {points.map((p) => {
            const cx = x(clampX(p.acwr)), cy = y(clampY(p.rec));
            return (
              <g key={p.id} data-id={p.id} style={{ cursor: "pointer" }} onClick={() => onPick(p.id)}>
                <circle cx={cx} cy={cy} r={11} style={{ fill: STATUS[p.cell], opacity: 0.9 }} />
                <text x={cx} y={cy + 3} textAnchor="middle" fontSize={8.5} fontWeight={800} fill="#0b0b11" fontFamily="Chakra Petch">{p.iniciales}</text>
              </g>
            );
          })}
        </svg>
      </div>
      {noData.length > 0 && (
        <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--wl-muted)", padding: "6px 13px 0" }}>
          sin datos ({noData.length}): {noData.map((n) => n.iniciales).join(", ")}
        </div>
      )}
    </Card>
  );
}
