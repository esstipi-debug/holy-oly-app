import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { EngineWeek, RmLift } from "@holy-oly/core";
import { RM_LIFTS, barKgForSexo, readinessModulation } from "@holy-oly/core";
import { useRepository } from "../../../data/RepositoryProvider";
import { DiscRow } from "../../../ui/Disc";
import { useRmLabels } from "../rm/RmEditSheet";
import { RetryButton } from "../../../ui/RetryButton";
import { SegmentedToggle } from "../../../ui/SegmentedToggle";
import { Loading } from "../../../ui/Loading";

/** Etiqueta de zona Prilepin tal cual (es el rango de % — el coach lo entiende). */
const ZONE_LABEL: Record<EngineWeek["sets"][number]["zone"], string> = {
  "70-80": "70–80%", "80-90": "80–90%", "90+": "90%+",
};

/** Color semántico de la banda de readiness (espejo de la paleta status.ts: ok/warn/alert).
 *  none = sin señal → tono neutro (jamás se pinta como un estado). */
const BAND_COLOR: Record<NonNullable<ReturnType<typeof readinessModulation>["band"]> | "none", string> = {
  green: "var(--ok)", amber: "var(--warn)", red: "var(--alert)", none: "var(--wl-muted)",
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
  const { t } = useTranslation(["coach", "domain"]);
  const RM_LABELS = useRmLabels();
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
    <section aria-label={t("prilAria")} style={{ marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <div style={{ fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 13.5 }}>{t("prilTitle")}</div>
        <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--wl-muted)" }}>{t("prilReadOnly", { week: hoyWeek })}</span>
      </div>
      {/* Encuadre explícito: es el MOTOR, no el plan asignado del atleta. */}
      <div style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--wl-muted)", marginTop: 4 }}>
        {t("prilEngineNote")}
      </div>

      {/* Selector de lift (los 4 RM de la casa). */}
      <SegmentedToggle
        ariaLabel={t("prilLiftAria")}
        options={RM_LIFTS.map((l) => [l, RM_LABELS[l]] as const)}
        value={lift}
        onChange={setLift}
        size="sm"
        wrap
        style={{ marginTop: 8 }}
      />

      {error && (
        <div role="alert" style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--wl-danger)", marginTop: 8 }}>
          {t("prilLoadError")}{" "}
          <RetryButton onClick={() => void load()} fontSize={10.5} />
        </div>
      )}

      {loading ? (
        <Loading style={{ fontFamily: "var(--mono)", fontSize: 10.5, marginTop: 8 }}>{t("prilGenerating")}</Loading>
      ) : !error && (
        week === null ? (
          // Sin datos honesto (sin RM vigente / semana fuera de rango / sin plan).
          <div style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--wl-muted)", marginTop: 8 }}>
            {t("prilNoData")}
          </div>
        ) : (
          <div style={{ marginTop: 8, padding: "12px", borderRadius: 12, background: "var(--wl-surface)", border: "1px solid color-mix(in srgb,var(--wl-text) 8%,transparent)" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, justifyContent: "space-between" }}>
              <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 16 }}>{t(`domain:enginePhase.${week.phase}.label`)}</div>
              {week.heavySinglesAdvisory && (
                <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--warn)", border: "1px solid color-mix(in srgb,var(--warn) 50%,transparent)", padding: "2px 7px", borderRadius: 99 }}>
                  {t("prilMoveSingles")}
                </span>
              )}
            </div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-muted)", marginTop: 4, lineHeight: 1.4 }}>{t(`domain:enginePhase.${week.phase}.rationale`)}</div>

            {/* Ajuste por readiness (coach-only, read-only): redacta lo que el motor YA aplicó con
                la banda del día — no es el plan asignado, no entra al semáforo. Sin señal → fallback. */}
            {(() => {
              const mod = readinessModulation(week);
              const color = BAND_COLOR[mod.band ?? "none"];
              // Proyección del dominio: headline/rationale por banda estable (o el caso "none"
              // honesto). El sufijo "mover singles" se vuelve a componer acá (core lo concatena).
              const headline = mod.band ? t(`domain:readiness.${mod.band}.headline`) : t("domain:readinessNone.headline");
              const rationale = mod.band
                ? t(`domain:readiness.${mod.band}.rationale`) + (mod.moveHeavySingles ? ` ${t("domain:readinessMoveSingles")}` : "")
                : t("domain:readinessNone.rationale");
              return (
                <div aria-label={t("prilReadinessAdjust")} style={{ marginTop: 10, padding: "8px 10px", borderRadius: 10, background: "var(--wl-bg)", borderLeft: `3px solid ${color}`, border: "1px solid color-mix(in srgb,var(--wl-text) 8%,transparent)" }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, justifyContent: "space-between" }}>
                    <div style={{ fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 12 }}>
                      {t("prilReadinessAdjust")}
                    </div>
                    <span style={{ fontFamily: "var(--mono)", fontSize: 9, color, border: `1px solid color-mix(in srgb,${color} 50%,transparent)`, padding: "2px 7px", borderRadius: 99 }}>
                      {headline}
                    </span>
                  </div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--wl-muted)", marginTop: 4, lineHeight: 1.4 }}>
                    {rationale}
                  </div>
                </div>
              );
            })()}

            {week.sets.length === 0 ? (
              <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-muted)", marginTop: 8 }}>
                {t("prilNoWork")}
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
                        {t("prilZoneKg", { zone: ZONE_LABEL[s.zone], kg: s.weightKg })}
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
                    {t("prilAuditReps", { zone: ZONE_LABEL[a.zone], reps: a.prescribedReps })} {a.withinRange ? t("prilInRange") : t("prilOutRange")}
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
