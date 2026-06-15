/**
 * Mi Progreso (rediseño) — tarjeta de una señal: hero (valor grande + delta vs tu normal) + mini-stats
 * + el chart REUSADO en modo `bare` (solo el SVG) + read-line, con ⓘ→BottomSheet (HR-2) propio.
 * El chart aporta solo su gráfico; el nombre/hero/ⓘ los provee esta card (evita el título duplicado).
 */
import { useState, type ReactNode } from "react";
import { Card } from "../../../ui/Card";
import { BottomSheet } from "../../../ui/BottomSheet";
import { ChartExplainSheet, type Explain } from "../../../ui/charts/chartkit";
import { STATUS } from "../../../ui/status";
import type { SignalDisplay, SignalDelta, SignalStat } from "./signalData";

const GLYPH: Record<SignalDelta["dir"], string> = { up: "▲", down: "▼", flat: "■" };

function DeltaChip({ delta }: { delta: SignalDelta }) {
  const c = STATUS[delta.state];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: c, border: `1px solid ${c}55`, background: `${c}1f`, fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, padding: "4px 9px", borderRadius: 99, whiteSpace: "nowrap" }}>
      <span aria-hidden style={{ fontSize: 9 }}>{GLYPH[delta.dir]}</span>
      <span>{delta.text}</span>
      <em style={{ fontStyle: "normal", fontWeight: 500, opacity: 0.8 }}>{delta.note}</em>
    </span>
  );
}

function StatTile({ s }: { s: SignalStat }) {
  const c = s.state ? STATUS[s.state] : "var(--wl-text)";
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontFamily: "var(--mono)", fontSize: 8.5, textTransform: "uppercase", letterSpacing: ".04em", color: "var(--wl-muted)" }}>{s.label}</div>
      <div style={{ fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 13, color: c, marginTop: 2 }}>{s.value}</div>
      {s.sub && <div style={{ fontFamily: "var(--mono)", fontSize: 8.5, color: "var(--wl-muted)", marginTop: 1 }}>{s.sub}</div>}
    </div>
  );
}

export interface SignalCardProps {
  name: string;
  sub: string;
  display: SignalDisplay;
  explain: Explain;
  children: ReactNode; // el chart en modo bare (solo el SVG)
}

export function SignalCard({ name, sub, display, explain, children }: SignalCardProps) {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <div>
          <div style={{ fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 14, color: "var(--wl-text)" }}>{name}</div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--wl-muted)", marginTop: 2 }}>{sub}</div>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Cómo se lee: ${name}`}
          aria-haspopup="dialog"
          aria-expanded={open}
          style={{ width: 24, height: 24, borderRadius: 12, border: "1px solid var(--wl-muted)", background: "transparent", color: "var(--wl-text)", fontSize: 13, lineHeight: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0, cursor: "pointer", fontFamily: "var(--mono)", flex: "0 0 auto" }}
        >ⓘ</button>
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8, margin: "10px 0 8px" }}>
        <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 40, lineHeight: 1, color: "var(--wl-text)" }}>
          {display.big}
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--wl-muted)", marginLeft: 4 }}>{display.unit}</span>
        </div>
        {display.delta && <DeltaChip delta={display.delta} />}
      </div>

      <div style={{ display: "flex", gap: 10, margin: "0 0 12px" }}>
        {display.stats.map((s, i) => <StatTile key={i} s={s} />)}
      </div>

      {children}

      <div style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--wl-muted)", marginTop: 10, lineHeight: 1.5 }}>{display.read}</div>

      <BottomSheet open={open} onClose={() => setOpen(false)} ariaLabel={name}>
        <ChartExplainSheet title={name} explain={explain} />
      </BottomSheet>
    </Card>
  );
}
