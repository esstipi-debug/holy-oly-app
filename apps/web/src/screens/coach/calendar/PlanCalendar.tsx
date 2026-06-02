import { useState } from "react";
import type { Competencia, Macrocycle, SessionLog } from "@holy-oly/core";
import { planWeeks } from "./planRows";
import { phaseColor } from "../../../ui/charts/phasePalette";

/** Calendario del plan: lista plegable de semanas ancladas a fechas. Tocar una semana
 *  abre el WeekDetailSheet del Drilldown (vía onWeekClick → setSelectedWeek). Default cerrada. */
export function PlanCalendar({ macro, weeks, startDate, hoyWeek, comps, marks, perWeek, onWeekClick }: {
  macro: Macrocycle; weeks: number; startDate: string; hoyWeek: number;
  comps: Competencia[]; marks: SessionLog; perWeek: number;
  onWeekClick: (week: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const rows = open ? planWeeks(macro, weeks, startDate, hoyWeek, comps, marks, perWeek) : [];
  return (
    <div style={{ marginTop: 16 }}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
          background: "var(--wl-surface)", border: "1px solid color-mix(in srgb,var(--wl-text) 8%,transparent)",
          borderRadius: 12, padding: "10px 12px", cursor: "pointer", color: "var(--wl-text)" }}>
        <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
          <span style={{ fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 13.5 }}>📅 Calendario del plan</span>
          <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--wl-muted)" }}>{weeks} semanas · HOY sem {hoyWeek}</span>
        </span>
        <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--wl-muted)" }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 8 }}>
          {rows.map((r) => (
            <button key={r.week} type="button" onClick={() => onWeekClick(r.week)}
              aria-label={`Semana ${r.week} · ${r.range}${r.comp ? ` · 🚩 ${r.comp}` : ""} · ${r.done} de ${r.perWeek} sesiones`}
              style={{
                display: "flex", alignItems: "center", gap: 8, textAlign: "left", cursor: "pointer",
                padding: "8px 10px", borderRadius: 10, color: "var(--wl-text)",
                background: r.isToday ? "color-mix(in srgb,var(--wl-accent) 12%,transparent)" : "var(--wl-surface)",
                border: r.isToday
                  ? "1px solid color-mix(in srgb,var(--wl-accent) 55%,transparent)"
                  : "1px solid color-mix(in srgb,var(--wl-text) 8%,transparent)",
              }}>
              <span style={{ width: 52, flexShrink: 0 }}>
                <span style={{ display: "block", fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 12.5 }}>Sem {r.week}</span>
                <span style={{ display: "block", fontFamily: "var(--mono)", fontSize: 9, color: "var(--wl-muted)" }}>{r.range}</span>
              </span>
              <span style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: 10, fontWeight: 700, color: "#0b0b11",
                  background: phaseColor(r.phaseIndex), borderRadius: 5, padding: "2px 7px",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 120 }}>{r.phaseName}</span>
                {r.isToday && <span style={{ fontFamily: "var(--mono)", fontSize: 9, fontWeight: 700, color: "var(--wl-accent)" }}>HOY</span>}
                {r.comp && <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>🚩 {r.comp}</span>}
                {!r.comp && r.isTaper && <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--wl-muted)" }}>taper</span>}
              </span>
              <span style={{ flexShrink: 0, fontFamily: "var(--mono)", fontSize: 10.5,
                color: r.perWeek > 0 && r.done >= r.perWeek ? "#34d058" : "var(--wl-muted)" }}>
                {r.perWeek > 0 ? `${r.done}/${r.perWeek}` : "—"}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
