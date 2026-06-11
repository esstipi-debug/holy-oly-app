import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Plan, PrCandidate, RmLift, RmUpdate } from "@holy-oly/core";
import { RM_LIFTS, rmVigencia } from "@holy-oly/core";
import { useRepository } from "../../../data/RepositoryProvider";
import { isoDateLabel } from "../../../ui/charts/planDates";
import { RM_LABELS, RmEditSheet, type RmSheetMode } from "./RmEditSheet";

const STALE_WEEKS = 12; // hint sutil, sin umbral duro (el spec manda mostrar la edad siempre)
const STALE_HINT = `RM fijado hace ≥${STALE_WEEKS} sem: los % prescritos pierden precisión — re-testeá o confirmá un PR.`;

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [sheet, setSheet] = useState<RmSheetMode | null>(null);

  // Guard de unmount (StrictMode-safe: el efecto re-arma el flag en cada mount).
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(async () => {
    try {
      const [c, h] = await Promise.all([repo.getPrCandidates(athleteId), repo.getRmHistory(athleteId)]);
      if (!mountedRef.current) return;
      setCandidates(c);
      setHistory(h);
      setError(false);
    } catch {
      if (mountedRef.current) setError(true);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [repo, athleteId]);
  useEffect(() => { void load(); }, [load]);

  // Ante error de carga NO computar el fallback a startDate: la vigencia mostraría una fecha
  // que no sabemos vigente (el RM pudo cambiar ayer). Error → "—" honesto + banner al lado.
  const vig = useMemo(
    () => (error ? null : rmVigencia(history, plan.startDate, today)),
    [error, history, plan.startDate, today],
  );
  const vigLabel = (l: RmLift): string => {
    const w = vig?.[l].weeksAgo;
    if (w == null) return "—";
    return w === 0 ? "fijado esta semana" : `fijado hace ${w} sem`;
  };

  const save = useCallback(async (updates: { lift: RmLift; kg: number }[], reason: "manual" | "pr"): Promise<void> => {
    await repo.updateRms(athleteId, updates, reason); // throw → el sheet muestra su error y queda abierto
    if (!mountedRef.current) return;
    await load(); // sus errores los maneja load (banner + vigencia "—"); el RM ya quedó guardado
    if (mountedRef.current) onRmsChange();
  }, [repo, athleteId, load, onRmsChange]);

  return (
    <section aria-label="RMs · base del plan" style={{ marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <div style={{ fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 13.5 }}>RMs · base del plan</div>
        <button type="button" aria-label="Editar RMs" onClick={() => setSheet({ kind: "manual" })}
          style={{ padding: "6px 14px", borderRadius: 10, border: "1px solid color-mix(in srgb,var(--wl-accent) 50%,transparent)", background: "color-mix(in srgb,var(--wl-accent) 12%,transparent)", color: "var(--wl-text)", fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
          Editar
        </button>
      </div>
      {error && (
        <div role="alert" style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--wl-danger)", marginTop: 8 }}>
          No se pudieron cargar los PRs/historial.{" "}
          <button type="button" onClick={() => void load()}
            style={{ border: 0, background: "transparent", color: "var(--wl-accent)", fontFamily: "var(--mono)", fontSize: 10.5, cursor: "pointer", textDecoration: "underline", padding: 0 }}>
            Reintentar
          </button>
        </div>
      )}
      {loading ? (
        <div role="status" aria-busy="true" style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--wl-muted)", marginTop: 8 }}>
          Cargando RMs…
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
            {RM_LIFTS.map((l) => {
              const stale = (vig?.[l].weeksAgo ?? 0) >= STALE_WEEKS;
              return (
                <div key={l} style={{ padding: "10px 12px", borderRadius: 12, background: "var(--wl-surface)", border: "1px solid color-mix(in srgb,var(--wl-text) 8%,transparent)" }}>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--wl-muted)" }}>{RM_LABELS[l]}</div>
                  <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 18, marginTop: 2 }}>{plan.rms[l]} kg</div>
                  <div title={stale ? STALE_HINT : undefined}
                    style={{ fontFamily: "var(--mono)", fontSize: 9.5, marginTop: 2, color: stale ? "var(--warn)" : "var(--wl-muted)" }}>
                    {vigLabel(l)}{stale ? " · re-testear" : ""}
                  </div>
                </div>
              );
            })}
          </div>
          {candidates.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 12.5 }}>PRs por confirmar</div>
              {/* key por lift: prCandidates garantiza ≤1 candidato por lift (invariante de core). */}
              {candidates.map((c) => (
                <div key={c.lift} style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, padding: "10px 12px", borderRadius: 12, background: "color-mix(in srgb,var(--wl-accent) 8%,var(--wl-surface))", border: "1px solid color-mix(in srgb,var(--wl-accent) 35%,transparent)" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 12.5 }}>{c.movementName}</div>
                    <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-muted)", marginTop: 2 }}>
                      levantó {c.kg} kg · {c.doneAt ? isoDateLabel(c.doneAt) : `sem ${c.week}`}
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
        </>
      )}
      {sheet != null && (
        <RmEditSheet open mode={sheet} rms={plan.rms} onClose={() => setSheet(null)} onSave={save} />
      )}
    </section>
  );
}
