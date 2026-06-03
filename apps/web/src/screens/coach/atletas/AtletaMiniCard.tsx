import type { CellState } from "@holy-oly/core";
import type { RosterRow } from "../roster";
import { STATUS } from "../../../ui/status";
import { LEGEND_NOISE } from "./legendNoise";

function HeatStrip({ history }: { history: CellState[] }) {
  const last7 = history.slice(-7);
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {last7.map((k, i) => (
        <div key={i} style={{
          width: 11, height: 11, borderRadius: 3,
          background: k === "none" ? "transparent" : STATUS[k],
          border: k === "none" ? `1px dashed ${STATUS.none}` : "none",
        }} />
      ))}
    </div>
  );
}

/** Mini-card de atleta (estilo FUT): initials + readiness + nombre + heat-strip. Tap → drill-down.
 *  El color de la barra/initials sale del estado (STATUS); sin-dato → "—" (nunca un número inventado). */
export function AtletaMiniCard({ row, onPick }: { row: RosterRow; onPick: (id: string) => void }) {
  const nd = row.cell === "none";
  const st = STATUS[row.cell];
  return (
    <button type="button" onClick={() => onPick(row.id)}
      aria-label={`${row.nombre} · readiness ${nd ? "sin dato" : row.readiness}`}
      style={{
        position: "relative", textAlign: "left", borderRadius: 16, overflow: "hidden", padding: "12px 13px",
        cursor: "pointer", color: "var(--wl-text)",
        background: "linear-gradient(158deg,#20262E 0%,#11151A 55%,#0B0E12 100%)", border: "1px solid rgba(255,255,255,.08)",
      }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: LEGEND_NOISE, backgroundSize: "90px", opacity: .05, mixBlendMode: "overlay", pointerEvents: "none" }} />
      <span style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${st}, transparent)` }} />
      <div style={{ position: "relative", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: `color-mix(in srgb, ${st} 16%, transparent)`, border: `1px solid color-mix(in srgb, ${st} 45%, transparent)`, fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 13, color: nd ? "var(--wl-muted)" : st }}>{row.iniciales}</div>
        <span style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 28, lineHeight: .9, color: nd ? "var(--wl-muted)" : "#fff" }}>{nd ? "—" : row.readiness}</span>
      </div>
      <div style={{ position: "relative", marginTop: 10 }}>
        <div style={{ fontFamily: "var(--wl-cond, var(--wl-display))", fontWeight: 700, fontSize: 17, letterSpacing: .2, textTransform: "uppercase", lineHeight: 1, color: "#fff" }}>{row.nombre}</div>
        <div style={{ fontFamily: "var(--mono)", fontSize: 8.5, color: "var(--wl-muted)", textTransform: "uppercase", marginTop: 3 }}>{row.metodo}{row.cat ? ` · ${row.cat}` : ""}</div>
      </div>
      <div style={{ position: "relative", marginTop: 9 }}><HeatStrip history={row.history} /></div>
    </button>
  );
}
