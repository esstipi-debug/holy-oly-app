/**
 * Ciclo menstrual — proyección PURA sobre fechas (slice ciclo-visible, Capas 1–2).
 * Defaults v1 (criterio nombrado, NO ciencia inventada — ajustables acá y en ningún otro lado):
 * período = primeros 5 días · pre-período = últimos 5 · lútea = últimos 14 (aprox estándar) ·
 * horizonte = 3 ciclos desde lastPeriodStart (más allá la proyección decae a null — honesto).
 * La ELEGIBILIDAD (state === "regular") la gatea el caller; estas funciones sólo hacen fechas.
 */
import type { CycleContext, CycleMark, CycleShare, CycleState } from "../types";

export const CYCLE_PERIOD_DAYS = 5;
export const CYCLE_PRE_DAYS = 5;
export const CYCLE_LUTEAL_DAYS = 14;
export const CYCLE_HORIZON_CYCLES = 3;
export const CYCLE_LEN_MIN = 21;
export const CYCLE_LEN_MAX = 45;

const DAY = 86_400_000;
const ms = (iso: string): number => new Date(`${iso}T00:00:00Z`).getTime();

/** Día 0-based dentro del ciclo para `date`; null si date < inicio, fuera de horizonte, o len inválido. */
export function cycleDayOf(lastPeriodStart: string, lengthDays: number, date: string): number | null {
  if (!Number.isInteger(lengthDays) || lengthDays < CYCLE_LEN_MIN || lengthDays > CYCLE_LEN_MAX) return null;
  const diff = Math.floor((ms(date) - ms(lastPeriodStart)) / DAY);
  if (diff < 0 || diff >= lengthDays * CYCLE_HORIZON_CYCLES) return null;
  return diff % lengthDays;
}

/** Marca proyectada del día: período (0..4) · pre-período (len−5..len−1) · null. */
export function cycleMarkFor(lastPeriodStart: string, lengthDays: number, date: string): CycleMark | null {
  const d = cycleDayOf(lastPeriodStart, lengthDays, date);
  if (d == null) return null;
  if (d < CYCLE_PERIOD_DAYS) return "periodo";
  if (d >= lengthDays - CYCLE_PRE_DAYS) return "preperiodo";
  return null;
}

/** ¿`today` cae en la ventana lútea (últimos 14 días)? null sin proyección válida. */
export function lutealNow(lastPeriodStart: string, lengthDays: number, today: string): boolean | null {
  const d = cycleDayOf(lastPeriodStart, lengthDays, today);
  if (d == null) return null;
  return d >= lengthDays - CYCLE_LUTEAL_DAYS;
}

/**
 * Redacción coach-facing (vive en core para que API y LocalRepository no driften):
 * el coach SOLO recibe este shape — jamás fase/día/fechas. `lutealNow` lo computa el caller
 * (sólo bajo share "full"); acá se anula para "min" por contrato.
 */
export function redactCycle(share: CycleShare, state: CycleState, lutealNow: boolean | null): CycleContext | undefined {
  if (share === "none") return undefined;
  const reliable = state === "regular";
  const health: CycleContext["health"] = state === "amenorrhea" ? "referral" : "ok";
  return { share, inLutealNow: share === "full" ? lutealNow : null, health, reliable };
}
