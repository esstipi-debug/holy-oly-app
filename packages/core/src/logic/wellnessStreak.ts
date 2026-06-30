import type { DayLog, MonitorSeries, ReadinessBand, StreakHeadsUp, WatchedWellnessField } from "../types";
import { acwr } from "./monitor";
import { readiness, readinessBand } from "./readiness";

/** Los 5 ítems vigilados + su polaridad: highBad = un valor ALTO es malo (fatiga/dolor/estrés);
 *  para sueño/motivación, un valor BAJO es malo. Espejo de WELLNESS_ITEMS (wellness.ts). */
const WATCHED: { field: WatchedWellnessField; highBad: boolean }[] = [
  { field: "sueno", highBad: false },
  { field: "estres", highBad: true },
  { field: "fatiga", highBad: true },
  { field: "dolor", highBad: true },
  { field: "motivacion", highBad: false },
];

/** Desempate cuando varias rachas empatan en largo: dolor primero (deriva al coach por seguridad). */
const PRIORITY: WatchedWellnessField[] = ["dolor", "sueno", "fatiga", "estres", "motivacion"];

const WARN_DAYS = 3;
const ALERT_DAYS = 5;
const STALE_DAYS = 2; // último check-in más viejo que esto vs `today` → no se avisa

/** Día entero (UTC) de una fecha ISO YYYY-MM-DD, para diferencias en días calendario. */
function dayNumber(iso: string): number {
  return Math.floor(Date.parse(`${iso}T00:00:00Z`) / 86_400_000);
}

/** Un día es "malo" para un ítem si su valor cae en el extremo feo (goodness ≤ 2). */
function isBadDay(log: DayLog, field: WatchedWellnessField, highBad: boolean): boolean {
  const v = log[field];
  if (typeof v !== "number" || !Number.isFinite(v)) return false;
  const good = highBad ? 6 - v : v; // espejo de goodness()
  return good <= 2;
}

/** Largo de la racha de días malos consecutivos (fechas contiguas) de un ítem, terminando en el
 *  día más reciente. `sorted` viene asc por fecha. */
function streakLen(sorted: DayLog[], field: WatchedWellnessField, highBad: boolean): number {
  let len = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (!isBadDay(sorted[i]!, field, highBad)) break;
    if (i < sorted.length - 1 && dayNumber(sorted[i + 1]!.date) - dayNumber(sorted[i]!.date) !== 1) break;
    len++;
  }
  return len;
}

/**
 * Heads-up de racha de bienestar (atleta): el ítem líder en racha de días malos + severidad, o
 * `null` si no hay racha ≥3, si el último check-in está rancio (>2 días), o si faltan datos.
 * PURO: no muta `logs`. La copy vive en la capa web (keyed por item × severity).
 */
export function wellnessStreak(logs: DayLog[], today: string): StreakHeadsUp | null {
  if (logs.length < WARN_DAYS) return null;
  const sorted = [...logs].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const last = sorted[sorted.length - 1]!;
  if (dayNumber(today) - dayNumber(last.date) > STALE_DAYS) return null;

  const streaks = WATCHED
    .map(({ field, highBad }) => ({ field, len: streakLen(sorted, field, highBad) }))
    .filter((s) => s.len >= WARN_DAYS);
  if (streaks.length === 0) return null;

  const leader = streaks.slice().sort((a, b) =>
    b.len - a.len || PRIORITY.indexOf(a.field) - PRIORITY.indexOf(b.field))[0]!;
  const severity: "warn" | "alert" = leader.len >= ALERT_DAYS || streaks.length >= 2 ? "alert" : "warn";
  const alsoStreaking = streaks
    .filter((s) => s.field !== leader.field)
    .sort((a, b) => PRIORITY.indexOf(a.field) - PRIORITY.indexOf(b.field))
    .map((s) => s.field);

  return { item: leader.field, days: leader.len, severity, alsoStreaking };
}

/** Riesgo predictivo COACH-ONLY: la racha del check-in (motor compartido) + contexto de carga
 *  (ACWR sostenido / banda de readiness). El coach SÍ ve "sobrecarga"; el atleta jamás (HR-1). */
export interface CoachRisk {
  item: WatchedWellnessField;
  days: number;
  severity: "warn" | "alert";
  alsoStreaking: WatchedWellnessField[];
  acwrSustained: boolean;               // ACWR > 1.3 en las últimas ≥2 semanas
  readinessBand: ReadinessBand | null;  // banda de la última semana (o null sin serie)
  loadNote: "sobrecarga" | null;        // la carga sostiene/amplifica el riesgo
}

const ACWR_RISK = 1.3;

/** Riesgo del coach: SOLO si hay racha de bienestar (la carga sola la cubre `seriesState`). Enriquece
 *  con ACWR sostenido + readiness. PURO. */
export function coachStreakRisk(
  logs: DayLog[], series: MonitorSeries | undefined, today: string,
): CoachRisk | null {
  const streak = wellnessStreak(logs, today);
  if (!streak) return null;

  let acwrSustained = false;
  let band: ReadinessBand | null = null;
  if (series && series.weeks >= 1) {
    const a = acwr(series.acute);
    const lastTwo = a.slice(-2).filter((v) => Number.isFinite(v));
    acwrSustained = lastTwo.length >= 2 && lastTwo.every((v) => v > ACWR_RISK);
    const lastAcwr = a.at(-1);
    band = readinessBand(readiness(series.recovery.at(-1), Number.isFinite(lastAcwr ?? NaN) ? lastAcwr : undefined));
  }
  const loadNote: "sobrecarga" | null = acwrSustained || band === "red" ? "sobrecarga" : null;
  return { ...streak, acwrSustained, readinessBand: band, loadNote };
}
