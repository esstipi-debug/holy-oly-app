/**
 * Celebración — gamificación DERIVADA (sin backend): XP, nivel y racha se calculan de datos que ya
 * existen (recorrido del macro + sesiones). Reglas aprobadas por el owner (2026-06-15). Funciones
 * PURAS y blindadas (NaN/negativos → 0). El XP acumulado deriva del `recorrido` del macro actual
 * (los macros cerrados no guardan volumen → no se incluyen; all-time persistente exigiría backend).
 */
import type { RecorridoSemana } from "@holy-oly/core";

/** XP de UNA sesión = piso(tonelaje de trabajo / 50) + 25 si completó todas las series.
 *  El calentamiento NO suma (regla de dominio: su tonelaje jamás entra al monitor). */
export function xpForSession(workKg: number, allSetsDone: boolean): number {
  const base = Number.isFinite(workKg) && workKg > 0 ? Math.floor(workKg / 50) : 0;
  return base + (allSetsDone ? 25 : 0);
}

/** XP acumulado = piso(Σ trabajoKg del recorrido / 50). */
export function cumulativeXp(semanas: readonly RecorridoSemana[]): number {
  const total = semanas.reduce((a, s) => a + (Number.isFinite(s.trabajoKg) ? s.trabajoKg : 0), 0);
  return total > 0 ? Math.floor(total / 50) : 0;
}

/** XP acumulado necesario para ALCANZAR el nivel L (curva triangular: subir L→L+1 cuesta 200·L). */
const costToReach = (level: number): number => 100 * level * (level - 1); // L1=0, L2=200, L3=600, L4=1200…

export interface LevelInfo { level: number; nextLevel: number; xpToNext: number }
export function levelInfo(cumXp: number): LevelInfo {
  const xp = Number.isFinite(cumXp) && cumXp > 0 ? Math.floor(cumXp) : 0;
  let level = 1;
  while (costToReach(level + 1) <= xp) level++;
  return { level, nextLevel: level + 1, xpToNext: costToReach(level + 1) - xp };
}

/**
 * Racha = semanas consecutivas (hacia atrás desde la última evaluable) con el plan CUMPLIDO
 * (`sesionesHechas ≥ sesionesTotales`). Alineada a "zero burnout": una semana de descarga/descanso
 * (sesionesTotales 0) NO la rompe ni la suma; SOLO la rompe faltar a una sesión planificada.
 */
export function weekStreak(semanas: readonly RecorridoSemana[], currentWeek: number): number {
  const byWeek = new Map<number, RecorridoSemana>();
  for (const s of semanas) byWeek.set(s.week, s);
  // La semana actual sólo cuenta si ya está completa; si no, evaluamos desde la anterior.
  const cur = byWeek.get(currentWeek);
  const curDone = !!cur && cur.sesionesTotales > 0 && cur.sesionesHechas >= cur.sesionesTotales;
  const start = curDone ? currentWeek : currentWeek - 1;
  let streak = 0;
  for (let w = start; w >= 1; w--) {
    const s = byWeek.get(w);
    if (!s) break;                          // hueco de datos → corta
    if (s.sesionesTotales <= 0) continue;   // semana de descanso/descarga → no rompe ni suma
    if (s.sesionesHechas >= s.sesionesTotales) streak++;
    else break;                             // faltó a una planificada → corta
  }
  return streak;
}

/** Qué celebración mostrar: la de mayor alcance lograda (macro > semana > día). */
export type CelebrationTier = "dia" | "semana" | "macro";
export function highestTier(weekClosed: boolean, macroClosed: boolean): CelebrationTier {
  if (macroClosed) return "macro";
  if (weekClosed) return "semana";
  return "dia";
}
