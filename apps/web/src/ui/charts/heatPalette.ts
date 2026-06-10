/** Rampa de intensidad del calendario-mapa (índigo → fucsia, Neon Bloom). Deliberadamente NO usa
 *  verde/ámbar/rojo (reservados al semáforo de estado) ni los azules categóricos de PHASE_RAMP.
 *  Encoding mixto (decisión owner 2026-06-10): tono = % tope del día · opacidad = volumen. */
export const HEAT_STOPS: ReadonlyArray<readonly [number, string]> = [
  [74, "51,48,94"],
  [81, "75,68,173"],
  [87, "132,64,232"],
  [92, "201,43,201"],
  [Infinity, "255,45,150"],
];

/** Día con filas pero sin ningún % → tono neutro: sin-dato honesto, no se inventa intensidad. */
export const HEAT_NEUTRAL_RGB = "98,104,122";

export function heatRgb(topPct: number | undefined): string {
  if (topPct == null) return HEAT_NEUTRAL_RGB;
  for (const [max, rgb] of HEAT_STOPS) if (topPct <= max) return rgb;
  return HEAT_STOPS[HEAT_STOPS.length - 1]![1];
}

/** Opacidad por volumen relativo del día: 0.35 (piso legible) → 1. Sin máximo conocido → 1. */
export function heatAlpha(lifts: number, maxLifts: number): number {
  if (maxLifts <= 0) return 1;
  return 0.35 + 0.65 * Math.min(1, Math.max(0, lifts) / maxLifts);
}

/** Color CSS final de una celda del mapa. */
export function heatCellColor(topPct: number | undefined, lifts: number, maxLifts: number): string {
  return `rgba(${heatRgb(topPct)},${heatAlpha(lifts, maxLifts).toFixed(2)})`;
}
