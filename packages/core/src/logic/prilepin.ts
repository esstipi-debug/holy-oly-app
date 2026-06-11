/**
 * Motor Prilepin — generador semanal sets × reps × % → kg (core dormant, v1).
 * Spec: docs/superpowers/specs/2026-06-10-motor-prilepin-design.md (decisiones D1–D12).
 * Config + funciones PURAS: el caller ancla fechas (weeksToComp desde Competencia.date, §2b
 * del rulebook) y pasa el RM vigente (SP5). Sin RPE en ningún shape; sin ciclo como input.
 */
import type { EnginePhase, IntensityZone } from "../types";

/** Tabla de Prilepin: reps óptimas y rango por zona (heurística observacional soviética, no ECA). */
export const PRILEPIN: Record<IntensityZone, { optimal: number; min: number; max: number; repsPerSet: number }> = {
  "70-80": { optimal: 18, min: 12, max: 24, repsPerSet: 3 },
  "80-90": { optimal: 15, min: 10, max: 20, repsPerSet: 2 },
  "90+": { optimal: 4, min: 1, max: 10, repsPerSet: 1 },
};

/** Perfil por fase: fracción del óptimo Prilepin por zona + techo de % de la semana. */
export const PHASE_PROFILE: Record<EnginePhase, {
  taperFactor: number; zoneMix: Record<IntensityZone, number>; topPct: number; label: string;
}> = {
  accumulation: { taperFactor: 1.0, zoneMix: { "70-80": 0.6, "80-90": 0.4, "90+": 0 }, topPct: 85, label: "Acumulación" },
  intensification: { taperFactor: 0.8, zoneMix: { "70-80": 0.3, "80-90": 0.6, "90+": 0.1 }, topPct: 90, label: "Intensificación" },
  peak: { taperFactor: 0.55, zoneMix: { "70-80": 0.1, "80-90": 0.5, "90+": 0.4 }, topPct: 95, label: "Pico" },
  taper: { taperFactor: 0.4, zoneMix: { "70-80": 0.1, "80-90": 0.4, "90+": 0.5 }, topPct: 100, label: "Taper" },
  comp_week: { taperFactor: 0.25, zoneMix: { "70-80": 0, "80-90": 0.3, "90+": 0.7 }, topPct: 100, label: "Semana de competencia" },
  deload: { taperFactor: 0.5, zoneMix: { "70-80": 0.8, "80-90": 0.2, "90+": 0 }, topPct: 80, label: "Descarga" },
};

const WAVE: readonly EnginePhase[] = [
  "accumulation", "accumulation", "intensification", "intensification", "peak", "deload",
];

/** Fase de la ola sin compe (1-based, cicla). `peak` en semana 5 = mini-pico (test opcional). */
export function wavePhase(waveWeek: number): EnginePhase | null {
  if (!Number.isInteger(waveWeek) || waveWeek < 1) return null;
  return WAVE[(waveWeek - 1) % WAVE.length]!;
}

/** Semanas restantes → fase de CADA semana hasta la compe. Inválido → [] (sin plan honesto). */
export function phasePlan(weeksToComp: number): EnginePhase[] {
  if (!Number.isInteger(weeksToComp) || weeksToComp < 0) return [];
  if (weeksToComp === 0) return ["comp_week"];
  if (weeksToComp === 1) return ["taper"];
  if (weeksToComp === 2) return ["peak", "comp_week"];
  if (weeksToComp === 3) return ["intensification", "peak", "comp_week"];
  return [
    ...Array<EnginePhase>(weeksToComp - 4).fill("accumulation"),
    "intensification", "peak", "taper", "comp_week",
  ];
}
