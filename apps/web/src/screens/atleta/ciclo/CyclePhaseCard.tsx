import { useTranslation } from "react-i18next";
import type { CycleView } from "./cycleView";
import { PHASE_FILL, phaseLabel } from "./cycleView";
import { isoRangeLabel } from "../../../ui/charts/planDates";

/** Tarjeta compacta del ciclo: el día grande, la fase en una pastilla neutra, la próxima ventana. */
export function CyclePhaseCard({ view }: { view: CycleView }) {
  const { t } = useTranslation("atleta");
  const { lengthDays, dayInCycle, phaseToday, nextWindow } = view;
  return (
    <div style={{ textAlign: "center", padding: "10px 0 4px" }}>
      <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 44, lineHeight: 1, color: "var(--wl-text)" }}>
        {dayInCycle + 1}<span style={{ fontSize: 17, color: "var(--wl-muted)", fontWeight: 600 }}> / {lengthDays}</span>
      </div>
      <div style={{ display: "inline-block", marginTop: 11, fontFamily: "var(--mono)", fontSize: 11, letterSpacing: ".04em", color: "var(--wl-text)", background: PHASE_FILL[phaseToday], borderRadius: 99, padding: "5px 15px" }}>
        {t("cpcPhaseLabel", { phase: phaseLabel(phaseToday) })}
      </div>
      {nextWindow && (
        <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)", marginTop: 13, lineHeight: 1.5 }}>
          {t("cpcNextPeriod")}<br />
          <span style={{ color: "var(--wl-text)", fontWeight: 700, fontSize: 13 }}>{isoRangeLabel(nextWindow.periodStart, nextWindow.periodEnd)}</span>
        </div>
      )}
    </div>
  );
}
