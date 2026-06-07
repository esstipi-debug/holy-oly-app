import { useState } from "react";
import type { MePlanView } from "@holy-oly/core";
import { PlanDetailSheet } from "../PlanDetailSheet";

type PlanView = NonNullable<MePlanView["plan"]>;

function MacroRibbon({ plan }: { plan: PlanView }) {
  return (
    <div style={{ display: "flex", gap: 3, marginTop: 4 }}>
      {plan.phases.map((p) => {
        const wks = p.to - p.from + 1;
        const fill = Math.round(Math.max(0, Math.min(100, ((p.imr - 60) / 45) * 78 + 16)));
        const now = plan.currentWeek >= p.from && plan.currentWeek <= p.to;
        const hasComp = plan.comps.some((c) => c.week >= p.from && c.week <= p.to);
        return (
          <div key={`${p.name}-${p.from}`} className={"ho-ribbon__seg" + (now ? " now" : "")} style={{ flex: wks, "--fill": `${fill}%` } as React.CSSProperties}>
            <div className="ho-ribbon__nm">{p.name}{hasComp ? " 🚩" : ""}{now ? " • hoy" : ""}</div>
            <div className="ho-ribbon__wk">sem {p.from}–{p.to}</div>
          </div>
        );
      })}
    </div>
  );
}

/** Countdown a la próxima comp + cinta de fases. Empty (no plan) → honest empty variant. */
export function CaminoCard({ plan }: { plan: MePlanView["plan"] }) {
  // Hook must precede the early-return (Rules of Hooks); only meaningful when plan != null
  // (the no-plan branch renders no trigger/sheet, so `open` stays dormant there).
  const [open, setOpen] = useState(false);
  if (!plan) {
    return (
      <div className="ho-card">
        <div className="ho-card__head"><span className="ho-card__t">Camino a la competencia</span><span className="ho-card__end" style={{ color: "var(--wl-muted)" }}>lo fija tu coach</span></div>
        <div className="ho-nodata">
          <div className="ho-nodata__icon">·</div>
          <div className="ho-nodata__t">Todavía no tenés un plan asignado</div>
          <div className="ho-nodata__b">Cuando tu coach te asigne un macrociclo, vas a ver acá tu camino a la próxima competencia.</div>
        </div>
      </div>
    );
  }
  const next = [...plan.comps].sort((a, b) => a.week - b.week).find((c) => c.week >= plan.currentWeek) ?? plan.comps[plan.comps.length - 1];
  const faltan = next ? next.week - plan.currentWeek : null;
  return (
    <div className="ho-card">
      <div className="ho-card__head"><span className="ho-card__t">Camino a la competencia</span><span className="ho-card__end" style={{ color: "var(--wl-muted)" }}>lo fija tu coach</span></div>
      <div className="ho-card__sub" style={{ marginTop: 4 }}>cinta de fases del macro · 🚩 = competencia</div>
      {next && faltan != null ? (
        <div className="ho-count">
          <b>{Math.max(0, faltan)}</b>
          <span>{faltan === 0 ? <>{next.name} es <b>esta semana</b></> : faltan < 0 ? <>{next.name} <b>ya pasó</b></> : <>semanas para <b>{next.name}</b><br />semana {next.week} de {plan.totalWeeks}</>}</span>
        </div>
      ) : null}
      <MacroRibbon plan={plan} />
      <button type="button" className="ho-plan__trigger" onClick={() => setOpen(true)}>
        Ver detalle del plan <span aria-hidden>›</span>
      </button>
      <PlanDetailSheet plan={plan} open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
