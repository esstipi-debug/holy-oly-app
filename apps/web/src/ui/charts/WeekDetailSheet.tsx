import type { CSSProperties } from "react";
import type { SessionLog, SessionStatus } from "@holy-oly/core";
import { BottomSheet } from "../BottomSheet";
import { Badge } from "../Badge";
import { STATUS } from "../status";
import { markFor, weekDone } from "../../screens/coach/sessions/sessionLog";
import type { WeekSignal } from "./weekSignals";

const GLYPH: Record<SessionStatus, string> = { done: "✓", missed: "✗" };
const TINT: Record<SessionStatus, string> = { done: STATUS.ok, missed: "var(--wl-danger)" };
function cell(status: SessionStatus | undefined): CSSProperties {
  return {
    width: 26, height: 26, flex: "0 0 auto", borderRadius: 6, cursor: "pointer", padding: 0,
    fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 13, lineHeight: 1,
    color: status ? TINT[status] : "var(--wl-muted)",
    background: status ? `color-mix(in srgb,${TINT[status]} 18%,transparent)` : "transparent",
    border: `1px solid ${status ? `color-mix(in srgb,${TINT[status]} 55%,transparent)` : "color-mix(in srgb,var(--wl-text) 16%,transparent)"}`,
  };
}

/** Panel de detalle de una semana: cross-section valor-vs-banda (sin-dato explícito) +
 *  adherencia editable de esa semana. Abierto al clickear un punto de un chart de señal. */
export function WeekDetailSheet({ open, onClose, week, dateISO, isTaper, signals, perWeek, marks, onToggle }: {
  open: boolean; onClose: () => void;
  week: number; dateISO: string; isTaper: boolean;
  signals: WeekSignal[];
  perWeek: number; marks: SessionLog; onToggle: (week: number, idx: number) => void;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} ariaLabel="Detalle de la semana">
      <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 16, color: "var(--wl-text)" }}>
        Semana {week} {isTaper && <span style={{ color: STATUS.alert }}>· 🚩 taper</span>}
      </div>
      <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)", marginBottom: 12 }}>{dateISO}</div>

      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {signals.map((s) => (
          <div key={s.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, borderTop: "1px solid color-mix(in srgb,var(--wl-text) 7%,transparent)", paddingTop: 7 }}>
            <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--wl-muted)" }}>{s.label}</span>
            {!s.hasData
              ? <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: STATUS.none }}>sin dato</span>
              : s.state && s.state !== "none"
                ? <Badge tone={s.state}>{s.value}</Badge>
                : <span style={{ fontFamily: "var(--mono)", fontSize: 12.5, color: "var(--wl-text)" }}>{s.value}</span>}
          </div>
        ))}
      </div>

      {perWeek > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 13 }}>Adherencia</span>
            <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-muted)" }}>{weekDone(marks, week)}/{perWeek} · tocá · → ✓ → ✗</span>
          </div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8 }}>
            {Array.from({ length: perWeek }, (_, idx) => {
              const st = markFor(marks, week, idx);
              return (
                <button key={idx} type="button" onClick={() => onToggle(week, idx)} style={cell(st)}
                  aria-label={`semana ${week} sesión ${idx + 1}: ${st === "done" ? "entrenó" : st === "missed" ? "no entrenó" : "pendiente"}`}>
                  {st ? GLYPH[st] : ""}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </BottomSheet>
  );
}
