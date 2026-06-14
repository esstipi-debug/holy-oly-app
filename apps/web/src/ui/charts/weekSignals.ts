import {
  acwr, acwrStateSafe, recoveryState,
  imrStateForWeekSafe, weightBandState,
  type CellState, type Macrocycle, type MonitorSeries,
} from "@holy-oly/core";

/** Clave estable de cada señal → key de catálogo `charts:signal.<key>`. El `label` español queda
 *  como identidad e idioma por defecto; la superficie (WeekDetailSheet) lo traduce por `key`. */
export type WeekSignalKey =
  | "acwr" | "acuteLoad" | "recovery" | "imr" | "wellness" | "compliance" | "weight";

export interface WeekSignal {
  /** Clave estable, idioma-agnóstica — la usa la UI para traducir el label. */
  key: WeekSignalKey;
  /** Etiqueta por defecto (es), también identidad de la fila. La UI la localiza vía `key`. */
  label: string;
  value: string;          // valor formateado, o "—" sin dato
  hasData: boolean;
  state?: CellState;       // sólo señales con banda (ACWR/recuperación/IMR/peso)
}

/** Etiquetas por defecto (es) por clave — identidad estable; la UI las localiza vía `key`. */
const DEFAULT_LABELS: Record<WeekSignalKey, string> = {
  acwr: "ACWR",
  acuteLoad: "Carga aguda",
  recovery: "Recuperación",
  imr: "IMR",
  wellness: "Bienestar",
  compliance: "Cumplimiento",
  weight: "Peso",
};

const SIGNAL_ORDER: readonly WeekSignalKey[] = [
  "acwr", "acuteLoad", "recovery", "imr", "wellness", "compliance", "weight",
];

const fin = (v: number | undefined): number | undefined =>
  v != null && Number.isFinite(v) ? v : undefined;

function row(key: WeekSignalKey, v: number | undefined, fmt: (n: number) => string, state?: CellState): WeekSignal {
  const label = DEFAULT_LABELS[key];
  return v != null
    ? { key, label, value: fmt(v), hasData: true, state }
    : { key, label, value: "—", hasData: false };
}

/** Cross-section de todas las señales semanales para la semana `week` (1-based).
 *  Faltante/NaN → hasData:false ("sin dato"), sin estado — jamás un valor inventado ni falso-verde.
 *  Recuperación = el score canónico almacenado (`series.recovery`, el eje-y del cuadrante), no recomputado. */
export function weekSignals(series: MonitorSeries | undefined, macro: Macrocycle | undefined, week: number): WeekSignal[] {
  if (!series) {
    return SIGNAL_ORDER.map((key) => ({ key, label: DEFAULT_LABELS[key], value: "—", hasData: false }));
  }
  const i = week - 1;
  const acwrV = fin(acwr(series.acute)[i]);
  const recV = fin(series.recovery[i]);
  const imrV = fin(series.imr[i]);
  const wtV = fin(series.bodyweight?.[i]);
  return [
    row("acwr", acwrV, (n) => n.toFixed(2), acwrV != null ? acwrStateSafe(acwrV) : undefined),
    row("acuteLoad", fin(series.acute[i]), (n) => String(Math.round(n))),
    row("recovery", recV, (n) => String(Math.round(n)), recV != null ? recoveryState(recV) : undefined),
    row("imr", imrV, (n) => String(Math.round(n)), imrV != null && macro ? imrStateForWeekSafe(imrV, macro, week) : undefined),
    row("wellness", fin(series.wellness[i]), (n) => String(Math.round(n))),
    row("compliance", fin(series.compliance?.[i]), (n) => `${Math.round(n)}%`),
    row("weight", wtV, (n) => `${n} kg`, wtV != null ? weightBandState(wtV, series.weightBand) : undefined),
  ];
}
