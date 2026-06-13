import { useState } from "react";
import type { MePlanView } from "@holy-oly/core";
import type { MeClient } from "../../../data/meClient";
import { PlanDetailSheet } from "../PlanDetailSheet";
import { PhaseTrack } from "./PhaseTrack";

/** Countdown a la próxima comp + cinta de fases. Empty (no plan) → honest empty variant. */
export function CaminoCard({ plan, client, sexo }: { plan: MePlanView["plan"]; client?: MeClient; sexo?: "M" | "F" }) {
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
      <div className="ho-card__sub" style={{ marginTop: 4 }}>pista del macro · cada barra = una semana · 🚩 = competencia</div>
      {next && faltan != null ? (
        <div className="ho-count">
          <b>{Math.max(0, faltan)}</b>
          <span>{faltan === 0 ? <>{next.name} es <b>esta semana</b></> : faltan < 0 ? <>{next.name} <b>ya pasó</b></> : <>semanas para <b>{next.name}</b><br />semana {next.week} de {plan.totalWeeks}</>}</span>
        </div>
      ) : null}
      <PhaseTrack plan={plan} />
      <button type="button" className="ho-plan__trigger" onClick={() => setOpen(true)}>
        Ver detalle del plan <span aria-hidden>›</span>
      </button>
      <PlanDetailSheet plan={plan} open={open} onClose={() => setOpen(false)} client={client} sexo={sexo} />
    </div>
  );
}
