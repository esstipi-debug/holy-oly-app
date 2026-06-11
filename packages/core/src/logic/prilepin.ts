/**
 * Motor Prilepin — generador semanal sets × reps × % → kg (core dormant, v1).
 * Spec: docs/superpowers/specs/2026-06-10-motor-prilepin-design.md (decisiones D1–D12).
 * Config + funciones PURAS: el caller ancla fechas (weeksToComp desde Competencia.date, §2b
 * del rulebook) y pasa el RM vigente (SP5). Sin RPE en ningún shape; sin ciclo como input.
 */
import type {
  EngineInput, EnginePhase, EngineSet, EngineWeek, EngineZoneAudit, IntensityZone, RmLift,
} from "../types";

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
  return WAVE[(waveWeek - 1) % WAVE.length] ?? null;
}

/** Semanas restantes → fase de CADA semana hasta la compe. Inválido → [] (sin plan honesto). */
export function phasePlan(weeksToComp: number): EnginePhase[] {
  if (!Number.isInteger(weeksToComp) || weeksToComp < 0) return [];
  if (weeksToComp === 0) return ["comp_week"];
  if (weeksToComp === 1) return ["taper"];
  if (weeksToComp === 2) return ["peak", "comp_week"];
  // n=3 comprime pico → semana de compe SIN semana taper aparte (caso canónico del owner;
  // la disipación de fatiga vive en comp_week, taperFactor 0.25). No es un hueco.
  if (weeksToComp === 3) return ["intensification", "peak", "comp_week"];
  return [
    ...Array<EnginePhase>(weeksToComp - 4).fill("accumulation"),
    "intensification", "peak", "taper", "comp_week",
  ];
}

/** Microcopy de supercompensación por fase — explica, no castiga (spec [4] §1). */
const RATIONALE: Record<EnginePhase, string> = {
  accumulation: "Semana de volumen alto: acá se acumula el estímulo que después se convierte en fuerza.",
  intensification: "Últimos kg de fuerza útil: baja el volumen, sube la intensidad.",
  peak: "Afinamos a peso de competencia. Menos trabajo, mismo peso.",
  taper: "Quitamos cansancio sin perder fuerza: el descanso es la mitad del trabajo.",
  comp_week: "Solo aperturas: disipamos fatiga para que llegues afilado el día de la competencia.",
  deload: "Descarga: acá es donde el cuerpo reconstruye y se vuelve más fuerte.",
};

const ZONES: readonly IntensityZone[] = ["70-80", "80-90", "90+"]; // orden ascendente
const ZONE_BASE: Record<IntensityZone, number> = { "70-80": 75, "80-90": 85, "90+": 92 };
/** Techo prescribible por zona. 90+ topea en 95: nunca se programa >95% — el 100 es el intento
 *  del día de la compe, no una carga de entrenamiento (D4). */
const ZONE_CEIL: Record<IntensityZone, number> = { "70-80": 80, "80-90": 90, "90+": 95 };

/** Clásicos: la técnica degrada antes que en sentadilla → menos reps/set.
 *  `sentadilla` y `frente` (sentadilla FRONTAL, el 4° RM de la planilla) usan la tabla. */
const REPS_PER_SET_CLASSIC: Record<IntensityZone, number> = { "70-80": 2, "80-90": 2, "90+": 1 };
const CLASSIC_LIFTS: readonly RmLift[] = ["arranque", "envion"];

// Banda segura ACWR de la casa [0.8, 1.3] (monitor.ts / rulebook §2) — no la del bundle (D3).
const ACWR_HIGH = 1.3;
const ACWR_LOW = 0.8;

/** La prescripción de la semana, o null honesto (RM/semana degenerados — jamás inventar). */
export function generateWeek(input: EngineInput): EngineWeek | null {
  if (!Number.isFinite(input.rmKg) || input.rmKg <= 0) return null;

  const phase: EnginePhase | null = input.weeksToComp !== null
    ? phasePlan(input.weeksToComp)[0] ?? null
    : wavePhase(input.waveWeek ?? 1);
  if (phase === null) return null;
  const profile = PHASE_PROFILE[phase];

  const acwr = input.recentACWR !== null && Number.isFinite(input.recentACWR) ? input.recentACWR : null;
  const acwrFactor = acwr === null ? 1 : acwr > ACWR_HIGH ? 0.9 : acwr < ACWR_LOW ? 1.1 : 1;
  const readiness = input.readiness ?? null;
  const readinessFactor = readiness === "amber" ? 0.9 : readiness === "red" ? 0.75 : 1;
  const taperFinal = profile.taperFactor * acwrFactor * readinessFactor;

  const repsClassic = CLASSIC_LIFTS.includes(input.lift);
  const mixed = ZONES.filter((z) => profile.zoneMix[z] > 0);
  const topZone = mixed[mixed.length - 1];
  // Invariante de PHASE_PROFILE: toda fase mezcla ≥1 zona. Si un perfil futuro lo rompe,
  // null honesto — jamás una "prescripción" vacía con sets: [].
  if (topZone === undefined) return null;

  const sets: EngineSet[] = [];
  const audits: EngineZoneAudit[] = [];
  for (const zone of mixed) {
    const z = PRILEPIN[zone];
    let targetReps = Math.round(z.optimal * taperFinal * profile.zoneMix[zone]);
    // Piso de la zona top: la fase no pierde su seña de intensidad (D5). Las demás se omiten.
    if (zone === topZone) targetReps = Math.max(1, targetReps);
    if (targetReps < 1) continue;
    const reps = repsClassic ? REPS_PER_SET_CLASSIC[zone] : z.repsPerSet;
    const numSets = Math.max(1, Math.round(targetReps / reps));
    const pct = zone === topZone
      ? Math.min(ZONE_CEIL[zone], profile.topPct)
      : Math.min(ZONE_BASE[zone], profile.topPct);
    sets.push({ sets: numSets, reps, pct, weightKg: Math.round((pct / 100) * input.rmKg), zone });
    audits.push({
      zone, optimalReps: z.optimal, prescribedReps: numSets * reps,
      withinRange: numSets * reps >= z.min && numSets * reps <= z.max,
    });
  }

  return {
    phase,
    label: profile.label,
    rationale: RATIONALE[phase],
    sets,
    audits,
    taper: { base: profile.taperFactor, acwrFactor, readinessFactor, final: taperFinal },
    inputs: { acwr, readiness },
    heavySinglesAdvisory: readiness === "red" && sets.some((s) => s.zone === "90+"),
  };
}
