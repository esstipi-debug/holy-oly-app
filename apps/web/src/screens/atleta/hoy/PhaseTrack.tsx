import type { CSSProperties } from "react";
import type { MePlanView } from "@holy-oly/core";
import { phaseColor } from "../../../ui/charts/phasePalette";

type PlanView = NonNullable<MePlanView["plan"]>;

/**
 * «Pista del macro» — el tratamiento Pulse del handoff (jo) adaptado a NUESTRO sistema: una barra
 * por semana del macro, coloreada por su fase con el `phaseColor` que ya usa el heat-map (no los
 * colores hardcodeados del prototipo). HOY = barra más alta + halo del acento; pasadas = atenuadas;
 * semana de compe = contorno dorado (`--gold`, consistente con el mapa). Leyenda de fases debajo.
 * Presentacional puro; reemplaza al ribbon proporcional en CaminoCard.
 */
export function PhaseTrack({ plan }: { plan: PlanView }) {
  const total = Math.max(1, plan.totalWeeks);
  const phaseIdxOf = (w: number): number => plan.phases.findIndex((p) => w >= p.from && w <= p.to);
  const compWeeks = new Set(plan.comps.map((c) => c.week));

  const legendName: CSSProperties = {
    fontFamily: "var(--mono)", fontSize: 8.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 3, alignItems: "flex-end", marginTop: 6, height: 28 }}>
        {Array.from({ length: total }, (_, i) => {
          const w = i + 1;
          const pi = phaseIdxOf(w);
          const col = pi >= 0 ? phaseColor(pi) : "color-mix(in srgb, var(--wl-text) 12%, transparent)";
          const past = w < plan.currentWeek;
          const cur = w === plan.currentWeek;
          const isComp = compWeeks.has(w);
          return (
            <div key={w} aria-hidden className="ho-track__wk" style={{
              flex: 1, minWidth: 0, height: cur ? 26 : 17, borderRadius: 3,
              background: cur ? "var(--wl-accent)" : col,
              opacity: past ? 0.4 : 1,
              boxShadow: cur ? "0 0 10px color-mix(in srgb, var(--wl-accent) 55%, transparent)" : "none",
              outline: isComp ? "1.5px solid var(--gold)" : "none", outlineOffset: 1,
            }} />
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 4, marginTop: 9 }}>
        {plan.phases.map((p, i) => {
          const now = plan.currentWeek >= p.from && plan.currentWeek <= p.to;
          return (
            <div key={`${p.name}-${p.from}`} style={{ flex: p.to - p.from + 1, display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
              <span aria-hidden style={{ width: 6, height: 6, borderRadius: 2, background: phaseColor(i), flexShrink: 0 }} />
              <span style={{ ...legendName, color: now ? "var(--wl-text)" : "var(--wl-muted)" }}>{p.name}{now ? " · hoy" : ""}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
