import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AthleteDailyView, DailyCheckin, ReconciledSession, AdherenceStatus } from "@holy-oly/core";
import { wellnessScore, WELLNESS_ITEMS } from "@holy-oly/core";
import { useRepository } from "../../../data/RepositoryProvider";
import { STATUS } from "../../../ui/status";
import { isoDateLabel } from "../../../ui/charts/planDates";

/** Glifo + tinte por estado reconciliado (cara coach). `planned`/`none` se ven neutros. */
const STATUS_GLYPH: Record<AdherenceStatus, string> = { done: "✓", partial: "≈", skipped: "✗", planned: "·", none: "·" };
const STATUS_TINT: Record<AdherenceStatus, string> = {
  done: STATUS.ok, partial: STATUS.warn, skipped: "var(--wl-danger)", planned: "var(--wl-muted)", none: "var(--wl-muted)",
};
const STATUS_LABEL: Record<AdherenceStatus, string> = {
  done: "hecha", partial: "a medias", skipped: "no hecha", planned: "agendada", none: "sin dato",
};
/** Origen del dato: la verdad registrada por el atleta vs el toggle manual del coach. */
const SOURCE_LABEL: Record<ReconciledSession["source"], string> = {
  athlete: "✓ del atleta", coach: "marca del coach", none: "sin registro",
};

/** Puntaje de bienestar (0-100) de un check-in, reusando la lógica de core. */
function checkinScore(c: DailyCheckin): number {
  return wellnessScore({
    fatiga: c.fatiga, dolor: c.dolor, estres: c.estres, humor: c.humor, motivacion: c.motivacion, sueno: c.sueno,
  });
}

/** Sparkline 0-100 (svg 100×26). [] → línea base tenue. */
function Sparkline({ values }: { values: number[] }) {
  const W = 100, H = 26, pad = 2;
  const x = (i: number) => pad + (values.length <= 1 ? 0 : i / (values.length - 1)) * (W - pad * 2);
  const y = (v: number) => pad + (1 - Math.max(0, Math.min(100, v)) / 100) * (H - pad * 2);
  const d = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  return (
    <svg width={W} height={H} role="img" aria-label="tendencia de bienestar">
      {values.length > 0 && (
        <path d={d} style={{ fill: "none", stroke: "var(--wl-accent)", strokeWidth: 1.5 }} strokeLinejoin="round" strokeLinecap="round" />
      )}
    </svg>
  );
}

/**
 * Sección "Día a día" del drill-down del coach (slice lazo-diario). READ-ONLY: muestra la
 * mini-tendencia de los check-ins (bienestar + peso) y la adherencia RECONCILIADA con un
 * indicador sutil de origen (✓ del atleta vs marca del coach). Carga sus propios datos con
 * error honesto + retry, como RmSection. JAMÁS muestra RPE ni nada del ciclo.
 */
export function DailySection({ athleteId }: { athleteId: string }) {
  const repo = useRepository();
  const [view, setView] = useState<AthleteDailyView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(async () => {
    try {
      const v = await repo.getDaily(athleteId);
      if (!mountedRef.current) return;
      setView(v);
      setError(false);
    } catch {
      if (mountedRef.current) setError(true);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [repo, athleteId]);
  useEffect(() => { void load(); }, [load]);

  const scores = useMemo(() => (view?.checkins ?? []).map(checkinScore), [view]);
  const lastCheckin = view && view.checkins.length > 0 ? view.checkins[view.checkins.length - 1]! : null;
  // Sesiones con algún dato real (≠ none) — el "sin datos" se decide sobre esto, no sobre el total.
  const withData = (view?.adherence ?? []).filter((a) => a.status !== "none");

  return (
    <section aria-label="Día a día · check-in y adherencia" style={{ marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <div style={{ fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 13.5 }}>Día a día</div>
        <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--wl-muted)" }}>últimas semanas · sólo lectura</span>
      </div>

      {error && (
        <div role="alert" style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--wl-danger)", marginTop: 8 }}>
          No se pudo cargar el día a día.{" "}
          <button type="button" onClick={() => void load()}
            style={{ border: 0, background: "transparent", color: "var(--wl-accent)", fontFamily: "var(--mono)", fontSize: 10.5, cursor: "pointer", textDecoration: "underline", padding: 0 }}>
            Reintentar
          </button>
        </div>
      )}

      {loading ? (
        <div role="status" aria-busy="true" style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--wl-muted)", marginTop: 8 }}>
          Cargando día a día…
        </div>
      ) : !error && view && (
        <>
          {/* Mini-tendencia de check-ins (bienestar 0-100 + peso). Sin check-ins → fallback visible. */}
          <div style={{ marginTop: 8, padding: "10px 12px", borderRadius: 12, background: "var(--wl-surface)", border: "1px solid color-mix(in srgb,var(--wl-text) 8%,transparent)" }}>
            <div style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--wl-muted)" }}>Check-in diario · bienestar</div>
            {view.checkins.length === 0 ? (
              <div style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--wl-muted)", marginTop: 6 }}>
                Sin check-ins en las últimas semanas. Cuando registre su día, aparecerá acá.
              </div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6 }}>
                  <Sparkline values={scores} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 18, lineHeight: 1 }}>
                      {scores[scores.length - 1]}<span style={{ fontSize: 11, fontWeight: 600, color: "var(--wl-muted)" }}> /100</span>
                    </div>
                    <div style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--wl-muted)", marginTop: 2 }}>
                      {view.checkins.length} día{view.checkins.length === 1 ? "" : "s"}
                      {lastCheckin?.weight != null ? ` · ${lastCheckin.weight} kg` : ""}
                      {lastCheckin ? ` · ${isoDateLabel(lastCheckin.date)}` : ""}
                    </div>
                  </div>
                </div>
                {/* Último check-in: los 6 ítems crudos (1..5). Jamás RPE. */}
                {lastCheckin && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                    {WELLNESS_ITEMS.map((it) => (
                      <span key={it.field} style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--wl-muted)", padding: "2px 7px", borderRadius: 99, background: "color-mix(in srgb,var(--wl-text) 6%,transparent)" }}>
                        {it.label} {lastCheckin[it.field]}/5
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Adherencia reconciliada con indicador de origen. Sin dato real → fallback visible. */}
          <div style={{ marginTop: 10 }}>
            <div style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--wl-muted)" }}>Adherencia reconciliada</div>
            {withData.length === 0 ? (
              <div style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--wl-muted)", marginTop: 6 }}>
                Sin datos de sesiones en las últimas semanas (ni del atleta ni marcadas).
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                {withData.map((a) => (
                  <div key={`${a.week}-${a.idx}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 10, background: "var(--wl-surface)", border: "1px solid color-mix(in srgb,var(--wl-text) 8%,transparent)" }}>
                    <span aria-hidden="true" style={{ width: 22, height: 22, flex: "0 0 auto", display: "grid", placeItems: "center", borderRadius: 6, fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 12, color: STATUS_TINT[a.status], background: `color-mix(in srgb,${STATUS_TINT[a.status]} 16%,transparent)`, border: `1px solid color-mix(in srgb,${STATUS_TINT[a.status]} 50%,transparent)` }}>
                      {STATUS_GLYPH[a.status]}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 12.5 }}>
                        Sem {a.week} · sesión {a.idx + 1} — {STATUS_LABEL[a.status]}
                      </div>
                      <div style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: a.source === "athlete" ? "var(--wl-accent)" : "var(--wl-muted)", marginTop: 2 }}>
                        {SOURCE_LABEL[a.source]}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
