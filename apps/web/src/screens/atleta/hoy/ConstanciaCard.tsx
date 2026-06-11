import type { CSSProperties } from "react";
import { calendarWeeks } from "@holy-oly/core";

const DAY_HEADS = ["L", "M", "X", "J", "V", "S", "D"];

/** Grilla compacta estilo mapa (celdas 16px, HOY con anillo) — el mismo lenguaje visual del
 *  calendario-mapa del plan, en vez de los bloques 32px que gritaban sin decir nada. */
function CalendarHeatmap({ days, today }: { days: string[]; today: string }) {
  const set = new Set(days);
  const grid = calendarWeeks(today, 8);
  const cell = (date: string): CSSProperties => {
    const base: CSSProperties = { width: 16, height: 16, borderRadius: 4, boxSizing: "border-box" };
    // Anillo derivado del texto del skin (no blanco fijo): contrasta en skins oscuras Y claras.
    const ring = date === today ? "inset 0 0 0 1.5px color-mix(in srgb, var(--wl-text) 88%, transparent)" : undefined;
    if (date > today) return { ...base, background: "color-mix(in srgb, var(--wl-text) 3%, transparent)" };
    if (set.has(date)) return { ...base, background: "color-mix(in srgb, var(--wl-accent) 86%, transparent)", boxShadow: ring };
    return { ...base, background: "color-mix(in srgb, var(--wl-text) 7%, transparent)", boxShadow: ring };
  };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 16px)", gap: 4, justifyContent: "center" }}>
      {DAY_HEADS.map((d, i) => (
        <span key={`h${i}`} style={{ textAlign: "center", fontFamily: "var(--mono)", fontSize: 8.5, color: "var(--wl-muted)" }}>{d}</span>
      ))}
      {grid.flatMap((week) => week.map((date) => <div key={date} title={date} style={cell(date)} />))}
    </div>
  );
}

/** Racha + heatmap. Empty (no logged days) → honest "tu racha empieza hoy". */
export function ConstanciaCard({ streak, days, today }: { streak: number; days: string[]; today: string }) {
  if (days.length === 0) {
    return (
      <div className="ho-card">
        <div className="ho-card__head"><span className="ho-card__t">Constancia de registro</span></div>
        <div className="ho-nodata">
          <div className="ho-nodata__icon">·</div>
          <div className="ho-nodata__t">Tu racha empieza hoy</div>
          <div className="ho-nodata__b">Registrá un día y arranca a contar. El descanso planificado no la rompe.</div>
        </div>
      </div>
    );
  }
  return (
    <div className="ho-card">
      <div className="ho-card__head"><span className="ho-card__t">Constancia de registro</span></div>
      <div className="ho-card__sub">últimas 8 semanas · hoy con anillo</div>
      <div className="ho-streak">
        <b>{streak}</b>
        <span>días de racha<br />el descanso no la rompe</span>
      </div>
      <CalendarHeatmap days={days} today={today} />
    </div>
  );
}
