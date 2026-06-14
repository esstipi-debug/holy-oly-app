import type { SessionRegistro } from "../types";

/** Día de receta (1-based) de un sessionIdx — viene de dayLayoutFor; ausente = idx+1 (D8). */
export type DayOf = (sessionIdx: number) => number;

/** D2: la fecha declarada del entreno acepta cualquier pasada o hoy; jamás futura.
 *  Comparación lexicográfica — válida para ISO YYYY-MM-DD (patrón de la casa). */
export function validateFechaEntreno(fecha: string, hoy: string): "ok" | "futuro" {
  return fecha > hoy ? "futuro" : "ok";
}

/** D1: máx 1 entreno por fecha. Devuelve el registro en conflicto o null. Excepciones:
 *  la sesión editándose a sí misma (D12), los turnos del MISMO día de receta de la MISMA
 *  semana (D9 — partir el día doble en dos fechas también es legítimo, esto sólo PERMITE) y los
 *  registros ANULADOS (secuencia de días, 2026-06-13: un día saltado no ocupó la fecha). Acepta la
 *  lista completa de registros; no es necesario pre-filtrar por fecha. */
export function fechaConflict(
  registros: readonly SessionRegistro[],
  week: number,
  sessionIdx: number,
  fecha: string,
  dayOf: DayOf,
): SessionRegistro | null {
  for (const r of registros) {
    if (r.estado === "anulado") continue;
    if (r.fecha !== fecha) continue;
    if (r.week === week && r.sessionIdx === sessionIdx) continue;
    if (r.week === week && dayOf(r.sessionIdx) === dayOf(sessionIdx)) continue;
    return r;
  }
  return null;
}

/** Secuencia de días (2026-06-13): para COMPLETAR o ANULAR la sesión `targetSessionIdx`, todo día
 *  ANTERIOR (dayOf(idx) < dayOf(target)) de la MISMA semana debe estar resuelto. Solo dentro de la
 *  semana; las semanas son independientes. `allIdxs` = todos los sessionIdx de la semana (del plan);
 *  `resolved(idx)` = ¿esa sesión está resuelta? (tiene registro: hecho o anulado). Pura — la usan
 *  el backend y el cliente offline por igual. */
export function priorDaysResolved(
  allIdxs: readonly number[],
  resolved: (sessionIdx: number) => boolean,
  dayOf: DayOf,
  targetSessionIdx: number,
): boolean {
  return unresolvedPriorDays(allIdxs, resolved, dayOf, targetSessionIdx).length === 0;
}

/** Los sessionIdx de días anteriores aún sin resolver que bloquean a `targetSessionIdx` (vacío =
 *  destrabado). Alimenta el 409 `dia_bloqueado` (qué falta) y la UI del candado. */
export function unresolvedPriorDays(
  allIdxs: readonly number[],
  resolved: (sessionIdx: number) => boolean,
  dayOf: DayOf,
  targetSessionIdx: number,
): number[] {
  const targetDay = dayOf(targetSessionIdx);
  return allIdxs.filter((idx) => dayOf(idx) < targetDay && !resolved(idx));
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
