import type { CSSProperties } from "react";
import type { SessionLog, SessionStatus } from "@holy-oly/core";
import { STATUS } from "../../../ui/status";
import { markFor, weekDone } from "./sessionLog";

const GLYPH: Record<SessionStatus, string> = { done: "✓", missed: "✗" };
const TINT: Record<SessionStatus, string> = { done: STATUS.ok, missed: "var(--wl-danger)" };

const row: CSSProperties = { display: "flex", alignItems: "center", gap: 8 };
const wkLabel: CSSProperties = {
  fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-muted)", width: 44, flexShrink: 0,
};
const count: CSSProperties = {
  fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-muted)", width: 34, flexShrink: 0, textAlign: "right",
};
function cell(status: SessionStatus | undefined): CSSProperties {
  return {
    width: 22, height: 22, flex: "0 0 auto", borderRadius: 6, cursor: "pointer", padding: 0,
    fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 12, lineHeight: 1,
    color: status ? TINT[status] : "var(--wl-muted)",
    background: status ? `color-mix(in srgb,${TINT[status]} 18%,transparent)` : "transparent",
    border: `1px solid ${status ? `color-mix(in srgb,${TINT[status]} 55%,transparent)` : "color-mix(in srgb,var(--wl-text) 16%,transparent)"}`,
  };
}

/** Plan-adherence grid (one row per week): the coach taps each planned session to cycle
 *  pendiente → entrenó (✓) → no entrenó (✗). Sessions/week are derived from the plan. */
export function SessionAdherence({ marks, weeks, perWeek, onToggle }: {
  marks: SessionLog;
  weeks: number;
  perWeek: number;
  onToggle: (week: number, idx: number) => void;
}) {
  if (perWeek <= 0) {
    return <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)" }}>Este plan no define sesiones por semana.</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {Array.from({ length: weeks }, (_, w0) => {
        const week = w0 + 1;
        return (
          <div key={week} style={row}>
            <span style={wkLabel}>Sem {week}</span>
            <div style={{ display: "flex", gap: 4, flex: 1, flexWrap: "wrap" }}>
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
            <span style={count}>{weekDone(marks, week)}/{perWeek}</span>
          </div>
        );
      })}
    </div>
  );
}
