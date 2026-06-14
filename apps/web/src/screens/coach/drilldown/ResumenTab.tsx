import type { Competencia, CycleContext, Macrocycle } from "@holy-oly/core";
import { MacroTimeline } from "../../../ui/charts/MacroTimeline";
import { DailySection } from "../daily/DailySection";
import { MacroHistorySection } from "../history/MacroHistorySection";

type Props = {
  athleteId: string;
  macro?: Macrocycle;
  /** series.weeks — semana actual; sin serie no hay MacroTimeline (no hay "hoy" que ubicar). */
  seriesWeeks?: number;
  comps: Competencia[];
  cycleCtx?: CycleContext;
};

/** Resumen: el vistazo "¿cómo viene el atleta hoy?" — orientación en el macro + check-in diario +
 *  contexto de ciclo redactado. Read-only; las superficies de edición viven en el tab Plan. */
export function ResumenTab({ athleteId, macro, seriesWeeks, comps, cycleCtx }: Props) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {macro && seriesWeeks != null && <MacroTimeline macro={macro} hoy={seriesWeeks} comps={comps} />}

      {/* Historial de ciclos (slice macro-history): los macrociclos cerrados + adherencia (constancia). */}
      <MacroHistorySection athleteId={athleteId} />

      {/* Lazo diario (slice lazo-diario): check-in del atleta + adherencia reconciliada (atleta >
          coach > none). Plan-independiente — los check-ins se muestran aunque no haya plan. */}
      <DailySection athleteId={athleteId} />

      {cycleCtx && (
        // Contrato redactado, paleta NEUTRA (jamás la del semáforo — el ciclo no es señal del estado).
        <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-muted)" }}>
          Ciclo · {cycleCtx.share === "full"
            ? `compartido — contexto lúteo hoy: ${cycleCtx.inLutealNow == null ? "—" : cycleCtx.inLutealNow ? "sí" : "no"}`
            : "compartido (mínimo)"}
          {cycleCtx.health === "referral" ? " · derivación sugerida" : ""}
          {!cycleCtx.reliable && cycleCtx.health !== "referral" ? " · registro irregular" : ""}
        </div>
      )}
    </div>
  );
}
