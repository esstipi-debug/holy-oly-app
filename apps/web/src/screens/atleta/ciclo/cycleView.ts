import type { CycleData, CycleWindow } from "@holy-oly/core";
import { cycleDayOf, nextCycleWindow, CYCLE_PERIOD_DAYS, CYCLE_LUTEAL_DAYS } from "@holy-oly/core";

/**
 * Modelo de la vista GRAFICADA del ciclo de la atleta — puro, derivado del MISMO criterio del core
 * (período = primeros `CYCLE_PERIOD_DAYS`, lútea = últimos `CYCLE_LUTEAL_DAYS`; folicular = el medio).
 * NO inventa ciencia nueva: sólo nombra los tramos que el core ya define por fecha. Devuelve null
 * cuando no es proyectable (ciclo no-regular, sin fecha/duración, o fuera de horizonte) — sin-dato
 * honesto, jamás precisión falsa.
 */
export type CyclePhase = "menstruacion" | "folicular" | "lutea";

/** Tramo de fase del ciclo: [startDay, endDay) en días 0-based. */
export interface PhaseSeg { phase: CyclePhase; startDay: number; endDay: number }

export interface CycleView {
  lengthDays: number;
  dayInCycle: number;          // 0-based, HOY
  phaseToday: CyclePhase;
  segments: PhaseSeg[];        // contiguos, cubren [0, lengthDays)
  nextWindow: CycleWindow | null;
}

const PHASE_LABEL: Record<CyclePhase, string> = {
  menstruacion: "Menstruación",
  folicular: "Folicular",
  lutea: "Lútea",
};

/**
 * Paleta NEUTRA del ciclo (regla intocable del rulebook §3): tonos del color de texto, JAMÁS la
 * paleta de estado (verde/amarillo/rojo) — el ciclo contextualiza, nunca es una alerta. Tres pasos
 * de luminosidad para distinguir las fases sin matiz: la menstruación ancla (más fuerte).
 */
export const PHASE_FILL: Record<CyclePhase, string> = {
  menstruacion: "color-mix(in srgb, var(--wl-text) 44%, transparent)",
  folicular: "color-mix(in srgb, var(--wl-text) 12%, transparent)",
  lutea: "color-mix(in srgb, var(--wl-text) 27%, transparent)",
};

export function phaseLabel(p: CyclePhase): string {
  return PHASE_LABEL[p];
}

/** Fase de un día dado, con el mismo criterio del core (período primeros N · lútea últimos M). */
export function phaseOfDay(day: number, lengthDays: number): CyclePhase {
  if (day < CYCLE_PERIOD_DAYS) return "menstruacion";
  if (day >= lengthDays - CYCLE_LUTEAL_DAYS) return "lutea";
  return "folicular";
}

export function buildCycleView(cycle: CycleData, today: string): CycleView | null {
  if (cycle.state !== "regular") return null;
  const start = cycle.lastPeriodStart;
  const len = cycle.cycleLengthDays;
  if (start == null || len == null) return null;
  const dayInCycle = cycleDayOf(start, len, today);
  if (dayInCycle == null) return null;

  const lutealStart = Math.max(CYCLE_PERIOD_DAYS, len - CYCLE_LUTEAL_DAYS);
  const all: PhaseSeg[] = [
    { phase: "menstruacion", startDay: 0, endDay: Math.min(CYCLE_PERIOD_DAYS, len) },
    { phase: "folicular", startDay: Math.min(CYCLE_PERIOD_DAYS, len), endDay: lutealStart },
    { phase: "lutea", startDay: lutealStart, endDay: len },
  ];
  const segments = all.filter((s) => s.endDay > s.startDay);

  return {
    lengthDays: len,
    dayInCycle,
    phaseToday: phaseOfDay(dayInCycle, len),
    segments,
    nextWindow: nextCycleWindow(start, len, today),
  };
}
