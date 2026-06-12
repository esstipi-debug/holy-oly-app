import { useCallback, useEffect, useRef, useState } from "react";
import type { EngineWeek, RmLift } from "@holy-oly/core";
import { RM_LIFTS, barKgForSexo } from "@holy-oly/core";
import { useRepository } from "../../../data/RepositoryProvider";
import { DiscRow } from "../../../ui/Disc";
import { RM_LABELS } from "../rm/RmEditSheet";

/** Etiqueta de zona Prilepin tal cual (es el rango de % — el coach lo entiende). */
const ZONE_LABEL: Record<EngineWeek["sets"][number]["zone"], string> = {
  "70-80": "70–80%", "80-90": "80–90%", "90+": "90%+",
};

/**
 * Sección "Vista Prilepin (preview)" del drill-down del coach. PREVIEW READ-ONLY del motor
 * (`prilepin.ts`): genera y muestra la semana del lift elegido desde los datos reales del atleta,
 * SIN persistir y SIN reemplazar el plan basado en recetas. Es superficie COACH → muestra % y
 * zonas (el coach sí los ve). Carga sus propios datos con error honesto + retry, como RmSection;
 * sin datos (sin RM vigente / semana fuera de rango) → fallback "none" visible, jamás inventar.
 */
export function PrilepinSection({ athleteId, hoyWeek, sexo }: {
  athleteId: string;
  hoyWeek: number;
  sexo: "M" | "F";
}) {
  const repo = useRepository();
  const [lift, setLift] = useState<RmLift>("arranque");
  const [week, setWeek] = useState<EngineWeek | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const barKg = barKgForSexo(sexo);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const w = await repo.getPrilepinWeek(athleteId, hoyWeek, lift);
      if (!mountedRef.current) return;
      setWeek(w);
      setError(false);
    } catch {
      if (mountedRef.current) setError(true);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [repo, athleteId, hoyWeek, lift]);
  useEffect(() => { void load(); }, [load]);

  return (
    <section aria-label="Vista Prilepin · preview del motor" style={{ marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <div style={{ fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 13.5 }}>Vista Prilepin (preview)</div>
        <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--wl-muted)" }}>sem {hoyWeek} · sólo lectura</span>
      </div>
      {/* Encuadre explícito: es el MOTOR, no el plan asignado del atleta. */}
      <div style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--wl-muted)", marginTop: 4 }}>
        Generado por el motor Prilepin — no es el plan asignado. No se guarda.
      </div>

      {/* Selector de lift (los 4 RM de la casa). */}
      <div role="group" aria-label="Lift" style={{ display: "flex", flexWrap: "wrap", gap: 0, marginTop: 8, width: "fit-content", background: "var(--wl-surface)", borderRadius: 10, padding: 3, border: "1px solid color-mix(in srgb,var(--wl-text) 8%,transparent)" }}>
        {RM_LIFTS.map((l) => {
          const active = l === lift;
          return (
            <button key={l} type="button" aria-pressed={active} onClick={() => setLift(l)}
              style={{ minHeight: 36, padding: "0 12px", borderRadius: 8, border: 0, cursor: "pointer", fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 12, background: active ? "var(--wl-accent)" : "transparent", color: active ? "var(--wl-bg)" : "var(--wl-muted)" }}>
              {RM_LABELS[l]}
            </button>
          );
        })}
      </div>

      {error && (
        <div role="alert" style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--wl-danger)", marginTop: 8 }}>
          No se pudo cargar el preview Prilepin.{" "}
          <button type="button" onClick={() => void load()}
            style={{ border: 0, background: "transparent", color: "var(--wl-accent)", fontFamily: "var(--mono)", fontSize: 10.5, cursor: "pointer", textDecoration: "underline", padding: 0 }}>
            Reintentar
          </button>
        </div>
      )}

      {loading ? (
        <div role="status" aria-busy="true" style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--wl-muted)", marginTop: 8 }}>
          Generando vista…
        </div>
      ) : !error && (
        week === null ? (
          // Sin datos honesto (sin RM vigente / semana fuera de rango / sin plan).
          <div style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--wl-muted)", marginTop: 8 }}>
            Sin datos para generar el preview (falta RM vigente del lift o el plan no cubre esta semana).
          </div>
        ) : (
          <div style={{ marginTop: 8, padding: "12px", borderRadius: 12, background: "var(--wl-surface)", border: "1px solid color-mix(in srgb,var(--wl-text) 8%,transparent)" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, justifyContent: "space-between" }}>
              <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 16 }}>{week.label}</div>
              {week.heavySinglesAdvisory && (
                <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--warn)", border: "1px solid color-mix(in srgb,var(--warn) 50%,transparent)", padding: "2px 7px", borderRadius: 99 }}>
                  mover singles
                </span>
              )}
            </div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-muted)", marginTop: 4, lineHeight: 1.4 }}>{week.rationale}</div>

            {week.sets.length === 0 ? (
              <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-muted)", marginTop: 8 }}>
                Esta fase no prescribe trabajo para este lift en su sesión principal.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                {week.sets.map((s) => (
                  <div key={s.zone} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 10, background: "var(--wl-bg)", border: "1px solid color-mix(in srgb,var(--wl-text) 8%,transparent)" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 13 }}>
                        {s.sets} × {s.reps} <span style={{ color: "var(--wl-muted)", fontWeight: 600 }}>@ {s.pct}%</span>
                      </div>
                      <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--wl-muted)", marginTop: 2 }}>
                        zona {ZONE_LABEL[s.zone]} · {s.weightKg} kg
                      </div>
                    </div>
                    {/* El kg manda; los discos aproximan. Reusa el componente Disc — nunca redibujar. */}
                    <DiscRow kg={s.weightKg} barKg={barKg} />
                  </div>
                ))}
              </div>
            )}

            {/* Auditoría Prilepin (coach-only): reps prescritas vs rango óptimo de la zona. */}
            {week.audits.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                {week.audits.map((a) => (
                  <span key={a.zone} style={{ fontFamily: "var(--mono)", fontSize: 9, color: a.withinRange ? "var(--wl-muted)" : "var(--warn)", padding: "2px 7px", borderRadius: 99, background: "color-mix(in srgb,var(--wl-text) 6%,transparent)" }}>
                    {ZONE_LABEL[a.zone]}: {a.prescribedReps} reps {a.withinRange ? "· en rango" : "· fuera de rango"}
                  </span>
                ))}
              </div>
            )}
          </div>
        )
      )}
    </section>
  );
}
