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

/** Resumen: el vistazo "¿cómo viene el atleta hoy?" (sólo lectura) — orientación en el macro
 *  (MacroTimeline) + Adherencia del bloque (N/M) + Bienestar + Historial + línea de ciclo redactada.
 *  Las superficies de edición viven en el tab Plan. */
export function ResumenTab({ athleteId, macro, seriesWeeks, comps, cycleCtx }: Props) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {macro && seriesWeeks != null && <MacroTimeline macro={macro} hoy={seriesWeeks} comps={comps} />}

      {/* Lazo diario (slice lazo-diario): rinde DOS Sections — "Adherencia del bloque" (N/M, verdad
          reconciliada atleta > coach > none) + "Bienestar" (check-in). Plan-independiente. */}
      <DailySection athleteId={athleteId} />

      {/* Historial de ciclos (slice macro-history): los macrociclos cerrados + adherencia (constancia). */}
      <MacroHistorySection athleteId={athleteId} />

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
