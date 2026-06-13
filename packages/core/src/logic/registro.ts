import type { SessionRegistro } from "../types";

/** Día de receta (1-based) de un sessionIdx — viene de dayLayoutFor; ausente = idx+1 (D8). */
export type DayOf = (sessionIdx: number) => number;

/** D2: la fecha declarada del entreno acepta cualquier pasada o hoy; jamás futura.
 *  Comparación lexicográfica — válida para ISO YYYY-MM-DD (patrón de la casa). */
export function validateFechaEntreno(fecha: string, hoy: string): "ok" | "futuro" {
  return fecha > hoy ? "futuro" : "ok";
}

/** D1: máx 1 entreno por fecha. Devuelve el registro en conflicto o null. Excepciones:
 *  la sesión editándose a sí misma (D12) y los turnos del MISMO día de receta de la MISMA
 *  semana (D9 — partir el día doble en dos fechas también es legítimo, esto sólo PERMITE). Acepta la lista completa de registros; no es necesario pre-filtrar por fecha. */
export function fechaConflict(
  registros: readonly SessionRegistro[],
  week: number,
  sessionIdx: number,
  fecha: string,
  dayOf: DayOf,
): SessionRegistro | null {
  for (const r of registros) {
    if (r.fecha !== fecha) continue;
    if (r.week === week && r.sessionIdx === sessionIdx) continue;
    if (r.week === week && dayOf(r.sessionIdx) === dayOf(sessionIdx)) continue;
    return r;
  }
  return null;
}

const DAY_MS = 86_400_000;
const addDaysISO = (iso: string, days: number): string =>
  new Date(new Date(`${iso}T00:00:00Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10);

/** Rango calendario de la semana w de un plan anclado a startDate (semanas ancladas al weekday
 *  del startDate — misma regla del heat-map). startDate degenerado → null, jamás NaN. */
export function weekRange(startDate: string, week: number): { from: string; to: string } | null {
  if (!Number.isFinite(new Date(`${startDate}T00:00:00Z`).getTime())) return null;
  const from = addDaysISO(startDate, (week - 1) * 7);
  return { from, to: addDaysISO(from, 6) };
}

/** D2: ¿la fecha cae fuera del rango calendario de esa semana del plan? Alimenta el AVISO
 *  suave del selector — informativo, jamás bloquea. Sin rango computable → false (honesto). */
export function fueraDeSemana(fecha: string, startDate: string, week: number): boolean {
  const r = weekRange(startDate, week);
  return r != null && (fecha < r.from || fecha > r.to);
}
