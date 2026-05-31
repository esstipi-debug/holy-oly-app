import { Card } from "../Card";
import { Medal } from "../Medal";
import { STATUS } from "../status";
import type { RosterRow } from "../../screens/coach/roster";

const NAME_W = 104;
const CELL = 22;

function cellStyle(c: RosterRow["history"][number]): React.CSSProperties {
  if (c === "none") {
    return { width: CELL, height: CELL, borderRadius: 4, flex: "0 0 auto",
      background: "transparent", border: "1px dashed var(--wl-muted)" };
  }
  return { width: CELL, height: CELL, borderRadius: 4, flex: "0 0 auto",
    background: STATUS[c], opacity: c === "ok" ? 0.55 : 0.92 };
}

export function Heatmap({ rows, weeks, onPick }:
  { rows: RosterRow[]; weeks: number; onPick: (id: string) => void }) {
  return (
    <Card>
      <div style={{ fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 13.5, color: "var(--wl-text)" }}>
        Estado del plantel
      </div>
      <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--wl-muted)", margin: "3px 0 9px" }}>
        una fila por atleta · color = estado · deslizá → para ver historial
      </div>
      <div style={{ overflowX: "auto" }}>
        {/* week-number header */}
        <div style={{ display: "flex", alignItems: "center", height: 20 }}>
          <div style={{ position: "sticky", left: 0, zIndex: 2, flex: `0 0 ${NAME_W}px`, width: NAME_W, background: "var(--wl-surface)" }} />
          <div style={{ display: "flex", gap: 3, padding: "0 10px 0 4px" }}>
            {Array.from({ length: weeks }).map((_, i) => (
              <span key={i} data-testid="hm-week" style={{ width: CELL, textAlign: "center", fontFamily: "var(--mono)", fontSize: 7.5, color: "var(--wl-muted)", flex: "0 0 auto" }}>{i + 1}</span>
            ))}
          </div>
        </div>
        {/* rows */}
        {rows.map((r) => (
          <div key={r.id} style={{ display: "flex", alignItems: "center", height: 34, borderTop: "1px solid color-mix(in srgb,var(--wl-text) 6%,transparent)" }}>
            <div onClick={() => onPick(r.id)} role="button" aria-label={r.nombre}
              style={{ position: "sticky", left: 0, zIndex: 2, flex: `0 0 ${NAME_W}px`, width: NAME_W, padding: "0 10px", background: "var(--wl-surface)", cursor: "pointer" }}>
              {r.compite && (
                <span style={{ position: "absolute", top: 5, right: 6, lineHeight: 0 }} title="Compite">
                  <Medal metal="oro" size={14} />
                </span>
              )}
              <b style={{ fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 11.5, color: "var(--wl-text)", display: "block", lineHeight: 1.05, paddingRight: 16 }}>{r.nombre}</b>
              <span style={{ fontFamily: "var(--mono)", fontSize: 8, color: "var(--wl-muted)" }}>{r.metodo}</span>
            </div>
            <div style={{ display: "flex", gap: 3, padding: "0 10px 0 4px" }}>
              {r.history.map((c, i) => <div key={i} style={cellStyle(c)} />)}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
