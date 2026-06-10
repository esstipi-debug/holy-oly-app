import { useCallback, useEffect, useState } from "react";
import type { Plan, PrCandidate, RmLift, RmUpdate } from "@holy-oly/core";
import { RM_LIFTS, rmVigencia } from "@holy-oly/core";
import { useRepository } from "../../../data/RepositoryProvider";
import { RM_LABELS, RmEditSheet, type RmSheetMode } from "./RmEditSheet";

const STALE_WEEKS = 12; // hint sutil, sin umbral duro (el spec manda mostrar la edad siempre)

/** Sección "RMs" del drill-down del coach (SP5). Carga sus propios datos (candidatos + historial)
 *  con error honesto + retry, como PlanMapSection. El atleta JAMÁS ve esta superficie. */
export function RmSection({ athleteId, plan, today, onRmsChange }: {
  athleteId: string;
  plan: Plan;
  today: string;
  onRmsChange: () => void;
}) {
  const repo = useRepository();
  const [candidates, setCandidates] = useState<PrCandidate[]>([]);
  const [history, setHistory] = useState<RmUpdate[]>([]);
  const [error, setError] = useState(false);
  const [sheet, setSheet] = useState<RmSheetMode | null>(null);

  const load = useCallback(async () => {
    try {
      const [c, h] = await Promise.all([repo.getPrCandidates(athleteId), repo.getRmHistory(athleteId)]);
      setCandidates(c);
      setHistory(h);
      setError(false);
    } catch {
      setError(true);
    }
  }, [repo, athleteId]);
  useEffect(() => { void load(); }, [load]);

  const vig = rmVigencia(history, plan.startDate, today);
  const vigLabel = (l: RmLift): string => {
    const w = vig[l].weeksAgo;
    if (w == null) return "—";
    return w === 0 ? "fijado esta semana" : `fijado hace ${w} sem`;
  };

  async function save(updates: { lift: RmLift; kg: number }[], reason: "manual" | "pr"): Promise<void> {
    await repo.updateRms(athleteId, updates, reason);
    await load();
    onRmsChange();
  }

  return (
    <section style={{ marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <div style={{ fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 13.5 }}>RMs · base del plan</div>
        <button type="button" onClick={() => setSheet({ kind: "manual" })}
          style={{ padding: "6px 14px", borderRadius: 10, border: "1px solid color-mix(in srgb,var(--wl-accent) 50%,transparent)", background: "color-mix(in srgb,var(--wl-accent) 12%,transparent)", color: "var(--wl-text)", fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
          Editar
        </button>
      </div>
      {error && (
        <div role="alert" style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "#ff3b46", marginTop: 8 }}>
          No se pudieron cargar los PRs/historial.{" "}
          <button type="button" onClick={() => void load()}
            style={{ border: 0, background: "transparent", color: "var(--wl-accent)", fontFamily: "var(--mono)", fontSize: 10.5, cursor: "pointer", textDecoration: "underline", padding: 0 }}>
            Reintentar
          </button>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
        {RM_LIFTS.map((l) => {
          const stale = (vig[l].weeksAgo ?? 0) >= STALE_WEEKS;
          return (
            <div key={l} style={{ padding: "10px 12px", borderRadius: 12, background: "var(--wl-surface)", border: "1px solid color-mix(in srgb,var(--wl-text) 8%,transparent)" }}>
              <div style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--wl-muted)" }}>{RM_LABELS[l]}</div>
              <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 18, marginTop: 2 }}>{plan.rms[l]} kg</div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 9.5, marginTop: 2, color: stale ? "#eab308" : "var(--wl-muted)" }}>{vigLabel(l)}</div>
            </div>
          );
        })}
      </div>
      {candidates.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 12.5 }}>PRs por confirmar</div>
          {candidates.map((c) => (
            <div key={c.lift} style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, padding: "10px 12px", borderRadius: 12, background: "color-mix(in srgb,var(--wl-accent) 8%,var(--wl-surface))", border: "1px solid color-mix(in srgb,var(--wl-accent) 35%,transparent)" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 12.5 }}>{c.movementName}</div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-muted)", marginTop: 2 }}>
                  levantó {c.kg} kg · sem {c.week}
                </div>
              </div>
              <button type="button" aria-label={`Confirmar PR de ${RM_LABELS[c.lift]}`} onClick={() => setSheet({ kind: "pr", candidate: c })}
                style={{ flex: "0 0 auto", minHeight: 40, padding: "0 12px", borderRadius: 10, border: 0, background: "var(--wl-accent)", color: "var(--wl-bg)", fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 11.5, cursor: "pointer" }}>
                Confirmar → subir RM
              </button>
            </div>
          ))}
        </div>
      )}
      {sheet != null && (
        <RmEditSheet open mode={sheet} rms={plan.rms} onClose={() => setSheet(null)} onSave={save} />
      )}
    </section>
  );
}
