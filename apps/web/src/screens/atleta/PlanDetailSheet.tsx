import { useState } from "react";
import type { MePlanView } from "@holy-oly/core";
import { MACROCYCLES } from "@holy-oly/core";
import { BottomSheet } from "../../ui/BottomSheet";
import type { MeClient } from "../../data/meClient";
import { PlanMapSection } from "./PlanMapSection";
import { PhaseAtletaDetail } from "./PhaseAtletaDetail";
import { CicloCarousel } from "./ciclo/CicloCarousel";

type PlanView = NonNullable<MePlanView["plan"]>;

/** Relative volume (0–100) → athlete-readable label. */
function volLabel(volRel: number): "alto" | "medio" | "bajo" {
  return volRel >= 80 ? "alto" : volRel >= 55 ? "medio" : "bajo";
}

/**
 * "Detalle del plan" (atleta) — drill-in from the Home «Camino» card into the macro's meso
 * structure. Read-only (the coach owns the plan). Intensity = % of competition lifts, volume =
 * relative — NEVER RPE (athlete surfaces never show RPE). Built on the shared BottomSheet.
 */
export function PlanDetailSheet({ plan, open, onClose, client, sexo }: {
  plan: PlanView; open: boolean; onClose: () => void;
  /** Con cliente, el sheet suma el mapa de calor del plan (lazy, sólo montado abierto). */
  client?: MeClient; sexo?: "M" | "F";
}) {
  const next = [...plan.comps].sort((a, b) => a.week - b.week).find((c) => c.week >= plan.currentWeek) ?? plan.comps[plan.comps.length - 1];
  const faltan = next ? next.week - plan.currentWeek : null;
  // Macro del catálogo (de `plan.macroId`) para el detalle de fase clickeable; null sin macroId.
  const macro = plan.macroId ? (MACROCYCLES.find((m) => m.id === plan.macroId) ?? null) : null;
  const [openPhase, setOpenPhase] = useState<string | null>(null);

  return (
    <BottomSheet open={open} onClose={onClose} ariaLabel="Detalle del plan">
      <div className="ho-plan__head">
        <div>
          <div className="ho-plan__macro">{plan.macroName}</div>
          <div className="ho-plan__wk">semana {plan.currentWeek} de {plan.totalWeeks}</div>
        </div>
        <button type="button" className="ho-plan__close" onClick={onClose} aria-label="Cerrar">✕</button>
      </div>

      {next && faltan != null && (
        <div className="ho-plan__count">
          <b>{Math.max(0, faltan)}</b>
          <span>
            {faltan === 0 ? <>{next.name} es <b>esta semana</b></>
              : faltan < 0 ? <>{next.name} <b>ya pasó</b></>
                : <>semanas para <b>{next.name}</b></>}
          </span>
        </div>
      )}

      <div className="ho-plan__periodlabel">Periodización · volumen por fase</div>
      {/* Decorative volume bars — the same data is conveyed textually in the meso cards below,
          so this is intentionally aria-hidden (no info loss for screen readers). */}
      <div className="ho-plan__strip" aria-hidden>
        {plan.phases.map((p) => {
          const now = plan.currentWeek >= p.from && plan.currentWeek <= p.to;
          return (
            <div key={`s-${p.name}-${p.from}`} className={"ho-plan__seg" + (now ? " now" : "")} style={{ flex: p.to - p.from + 1 }}>
              <span className="ho-plan__segbar" style={{ height: `${Math.max(8, Math.min(100, p.volRel))}%` }} />
            </div>
          );
        })}
      </div>

      <div className="ho-plan__mesos">
        {plan.phases.map((p) => {
          const wks = p.to - p.from + 1;
          const now = plan.currentWeek >= p.from && plan.currentWeek <= p.to;
          const hasComp = plan.comps.some((c) => c.week >= p.from && c.week <= p.to);
          const open = openPhase === p.name;
          return (
            <div key={`m-${p.name}-${p.from}`} className={"ho-plan__meso" + (now ? " now" : "")}>
              <button type="button" className="ho-plan__mesobtn" aria-expanded={open}
                onClick={() => setOpenPhase((cur) => (cur === p.name ? null : p.name))}>
                <div className="ho-plan__mesohead">
                  <span className="ho-plan__mesonm">
                    {p.name}
                    {hasComp && <span className="ho-plan__flag" aria-label="competencia"> 🚩</span>}
                    {now && <span className="ho-plan__hoy"> • hoy</span>}
                  </span>
                  <span className="ho-plan__mesowk">sem {p.from}–{p.to} · {wks} sem <span className={"ho-plan__chev" + (open ? " open" : "")} aria-hidden>›</span></span>
                </div>
                <div className="ho-plan__mesofocus">{p.focus}</div>
                <div className="ho-plan__mesometrics">
                  <span><b>{p.imrLo}–{p.imrHi}%</b> de tus marcas</span>
                  <span>volumen <b>{volLabel(p.volRel)}</b></span>
                </div>
              </button>
              {open && (
                <PhaseAtletaDetail phase={p} macro={macro} currentWeek={plan.currentWeek}
                  {...(client ? { client } : {})} {...(sexo ? { sexo } : {})} />
              )}
            </div>
          );
        })}
      </div>

      {/* «Tu ciclo» — vista propia del ciclo menstrual (carrusel), separada del mapa de competencia. */}
      {client != null && open && <CicloCarousel client={client} />}

      {client != null && open && <PlanMapSection plan={plan} client={client} sexo={sexo} />}
    </BottomSheet>
  );
}
