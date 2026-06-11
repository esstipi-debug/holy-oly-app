/**
 * Motor Prilepin — generador semanal sets × reps × % → kg (core dormant, v1).
 * Spec: docs/superpowers/specs/2026-06-10-motor-prilepin-design.md (decisiones D1–D14).
 * Config + funciones PURAS: el caller ancla fechas (weeksToComp desde Competencia.date, §2b
 * del rulebook) y pasa el RM vigente (SP5). Sin RPE en ningún shape; sin ciclo como input.
 */
import type {
  EngineInput, EnginePhase, EngineSet, EngineWeek, EngineWeekAthleteView, EngineZoneAudit,
  IntensityZone, RmLift,
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

/** Countdown FIJADO AL ANCLAR: fase de cada semana (0-based), la compe SIEMPRE es la última.
 *  Los consumidores indexan `phasePlan(n)[weekIdx]` — JAMÁS re-derivar `[0]` con un
 *  weeksToComp recomputado semana a semana: la compresión depende del largo TOTAL (n=3 salta
 *  el taper; n≥4 no), así que la secuencia vivida solo es consistente si el countdown se fija
 *  al anclar la compe y re-anclar lo recomputa entero (hallazgo HIGH de El Carnicero, D13).
 *  n<1 (compe pasada / sin semanas) o inválido → [] (sin plan honesto). */
export function phasePlan(countdownWeeks: number): EnginePhase[] {
  if (!Number.isInteger(countdownWeeks) || countdownWeeks < 1) return [];
  if (countdownWeeks === 1) return ["comp_week"];
  if (countdownWeeks === 2) return ["peak", "comp_week"];
  // n=3 comprime: SIN semana taper aparte (caso canónico del owner; la disipación de fatiga
  // vive en comp_week, taperFactor 0.25). No es un hueco.
  if (countdownWeeks === 3) return ["intensification", "peak", "comp_week"];
  return [
    ...Array<EnginePhase>(countdownWeeks - 4).fill("accumulation"),
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

/** La prescripción de la semana, o null honesto (RM/countdown/ola degenerados — jamás inventar). */
export function generateWeek(input: EngineInput): EngineWeek | null {
  if (!Number.isFinite(input.rmKg) || input.rmKg <= 0) return null;

  let phase: EnginePhase | null;
  if (input.countdownWeeks !== null) {
    // La posición en el countdown es ESTADO del cableado (D13c): ausente/degenerada → null —
    // "asumir semana 0" reproduciría el bug del re-derivado semanal que cazó El Carnicero.
    const weekIdx = input.weekIdx;
    phase = weekIdx === undefined || !Number.isInteger(weekIdx) || weekIdx < 0
      ? null
      : phasePlan(input.countdownWeeks)[weekIdx] ?? null;
  } else {
    // Ola: la posición también es ESTADO — ausente → null honesto, jamás defaultear a la
    // semana de más volumen (hallazgo de El Carnicero sobre el default 1 del bundle).
    phase = input.waveWeek === undefined ? null : wavePhase(input.waveWeek);
  }
  if (phase === null) return null;
  const profile = PHASE_PROFILE[phase];

  const acwr = input.recentACWR !== null && Number.isFinite(input.recentACWR) ? input.recentACWR : null;
  const acwrFactor = acwr === null ? 1 : acwr > ACWR_HIGH ? 0.9 : acwr < ACWR_LOW ? 1.1 : 1;
  // Nota D9: readiness YA viene penalizado por ACWR (readiness.ts, hasta −20) — un ACWR muy
  // alto puede pegar dos veces (factor estructural + banda del día). Deliberado y conservador:
  // venir cargado y venir poco recuperado son dos razones distintas para bajar volumen.
  // Candidato a calibración con coaches piloto (reconciliación §7.1).
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

/** Redacción atleta-facing (vive en core, patrón redactCycle — una sola fuente, sin drift):
 *  SOLO fase/label/rationale/sets. Los audits, factores y el eco de inputs (ACWR crudo =
 *  número gameable, HR-1) son material coach-only y JAMÁS van en superficie de atleta.
 *  El cableado consume ESTO para el atleta — no filtra por su cuenta (D12). */
export function athleteWeekView(week: EngineWeek): EngineWeekAthleteView {
  return { phase: week.phase, label: week.label, rationale: week.rationale, sets: week.sets };
}
