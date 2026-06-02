import {
  acwr, acwrStateSafe, recoveryState,
  imrStateForWeekSafe, weightBandState,
  type CellState, type Macrocycle, type MonitorSeries,
} from "@holy-oly/core";

export interface WeekSignal {
  label: string;
  value: string;          // valor formateado, o "—" sin dato
  hasData: boolean;
  state?: CellState;       // sólo señales con banda (ACWR/recuperación/IMR/peso)
}

const fin = (v: number | undefined): number | undefined =>
  v != null && Number.isFinite(v) ? v : undefined;

function row(label: string, v: number | undefined, fmt: (n: number) => string, state?: CellState): WeekSignal {
  return v != null
    ? { label, value: fmt(v), hasData: true, state }
    : { label, value: "—", hasData: false };
}

/** Cross-section de todas las señales semanales para la semana `week` (1-based).
 *  Faltante/NaN → hasData:false ("sin dato"), sin estado — jamás un valor inventado ni falso-verde.
 *  Recuperación = el score canónico almacenado (`series.recovery`, el eje-y del cuadrante), no recomputado. */
export function weekSignals(series: MonitorSeries | undefined, macro: Macrocycle | undefined, week: number): WeekSignal[] {
  if (!series) {
    return ["ACWR", "Carga aguda", "Recuperación", "IMR", "Bienestar", "Cumplimiento", "Peso"]
      .map((label) => ({ label, value: "—", hasData: false }));
  }
  const i = week - 1;
  const acwrV = fin(acwr(series.acute)[i]);
  const recV = fin(series.recovery[i]);
  const imrV = fin(series.imr[i]);
  const wtV = fin(series.bodyweight?.[i]);
  return [
    row("ACWR", acwrV, (n) => n.toFixed(2), acwrV != null ? acwrStateSafe(acwrV) : undefined),
    row("Carga aguda", fin(series.acute[i]), (n) => String(Math.round(n))),
    row("Recuperación", recV, (n) => String(Math.round(n)), recV != null ? recoveryState(recV) : undefined),
    row("IMR", imrV, (n) => String(Math.round(n)), imrV != null && macro ? imrStateForWeekSafe(imrV, macro, week) : undefined),
    row("Bienestar", fin(series.wellness[i]), (n) => String(Math.round(n))),
    row("Cumplimiento", fin(series.compliance?.[i]), (n) => `${Math.round(n)}%`),
    row("Peso", wtV, (n) => `${n} kg`, wtV != null ? weightBandState(wtV, series.weightBand) : undefined),
  ];
}
