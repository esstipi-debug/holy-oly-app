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
  const fields: string[] = [];
  const today: number[] = [];
  const avg: number[] = [];
  let everyAxisHasHistory = true;
  for (const item of WELLNESS_ITEMS) {
    const v = entry[item.field];
    if (v == null || !Number.isFinite(v)) continue;
    labels.push(item.label); // ES base label (también clave legacy de MonitorSeries) — el display se traduce vía `fields`
    fields.push(item.field); // clave estable para proyectar el label localizado (domain:wellnessItem.{field}.label)
    today.push(norm(v, item.highBad));
    const arr = series?.wellnessItems?.[item.field] ?? series?.wellnessItems?.[item.label];
    if (arr && arr.length) avg.push(norm(mean(arr), item.highBad));
    else everyAxisHasHistory = false; // sin histórico de este ítem → no hay promedio honesto
  }
  if (labels.length < 3) return null; // <3 ejes → polígono ilegible → empty-state honesto
  // Promedio REAL sólo si TODOS los ejes mostrados tienen histórico semanal; si no, `avg: null`
  // → la UI dibuja sólo HOY (jamás un "promedio" que en realidad copia el valor de hoy).
  return { labels, fields, today, avg: everyAxisHasHistory && avg.length === labels.length ? avg : null };
}
