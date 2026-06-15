/**
 * Radar de bienestar de la Celebración (rediseño 0110): conecta HOY (la entrada del check-in del
 * día) vs el PROMEDIO (los ítems semanales del monitor). Cada eje 0..1 con la polaridad "bueno"
 * (fatiga/dolor/estrés invertidos). Sin check-in de hoy → null → la card muestra su empty-state
 * honesto (no se inventa un radar). Pura y testeable.
 */
import type { DayLog, MonitorSeries } from "@holy-oly/core";
import { WELLNESS_ITEMS, goodness } from "@holy-oly/core";
import type { RadarData } from "./Radar";

const norm = (v: number, highBad: boolean): number => (goodness(Math.max(1, Math.min(5, v)), highBad) - 1) / 4;
const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function buildWellnessRadar(entry: DayLog | null, series: MonitorSeries | undefined): RadarData | null {
  if (!entry) return null;
  const labels: string[] = [];
  const today: number[] = [];
  const avg: number[] = [];
  for (const item of WELLNESS_ITEMS) {
    const v = entry[item.field];
    if (v == null || !Number.isFinite(v)) continue;
    labels.push(item.label);
    today.push(norm(v, item.highBad));
    const arr = series?.wellnessItems?.[item.field] ?? series?.wellnessItems?.[item.label];
    avg.push(arr && arr.length ? norm(mean(arr), item.highBad) : norm(v, item.highBad));
  }
  // Necesita ≥3 ejes para un polígono legible; si no, empty-state honesto.
  return labels.length >= 3 ? { labels, today, avg } : null;
}
