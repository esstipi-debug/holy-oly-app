import type { MonitorSeries } from "../types";
import { acwr } from "./monitor";

/**
 * Readiness 0-100 (heurística — criterio del coach, ajustable): base = recuperación,
 * penalizada cuando el ACWR sale de la banda segura [0.8, 1.3] (proporcional a la
 * distancia, tope 20). Sin recuperación → undefined (sin-dato, nunca un número inventado).
 */
export function readiness(rec: number | undefined, acwrV: number | undefined): number | undefined {
  if (rec == null || !Number.isFinite(rec)) return undefined;
  let penalty = 0;
  if (acwrV != null && Number.isFinite(acwrV)) {
    const over = acwrV > 1.3 ? acwrV - 1.3 : acwrV < 0.8 ? 0.8 - acwrV : 0;
    penalty = Math.min(20, Math.round(over * 40));
  }
  return Math.max(0, Math.min(100, Math.round(rec - penalty)));
}

/** Δ del readiness entre la última semana y ~3 atrás (window disponible). undefined si <2 semanas. */
export function readinessTrend(s: MonitorSeries | undefined): number | undefined {
  if (!s || s.weeks < 2) return undefined;
  const a = acwr(s.acute);
  const at = (i: number): number | undefined => readiness(s.recovery[i], a[i]);
  const last = at(s.weeks - 1);
  const back = at(Math.max(0, s.weeks - 1 - 3));
  if (last == null || back == null) return undefined;
  return last - back;
}
