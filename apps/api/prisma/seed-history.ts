/**
 * Seed del historial de macrociclos + RM + entrenos reales del ciclo en curso (slice macro-history).
 *
 * Para cada atleta vitrina con plan asignado:
 *  - MacroHistory: N ciclos CERRADOS encadenados hacia atrás desde antes del plan actual, con su
 *    adherencia (core buildMacroHistoryRows). El % se deriva al leer (macroHistoryView).
 *  - RmUpdate: la curva del 1RM — un set "manual" por ciclo cerrado (su rmEnd) + el baseline "assign"
 *    del plan actual (== Plan.rms). La última fila por lift coincide con Plan.rms (invariante SP5).
 *  - SessionActual + SessionRegistro: lo HECHO de las semanas ya transcurridas del ciclo actual, con
 *    FECHAS reales, respetando la secuencia de días, la regla 1×fecha y la excepción AM/PM. Las
 *    sesiones "falladas" (según la adherencia) quedan ANULADAS (resuelven el día, no suman volumen).
 *
 * Determinista (sin RNG): qué sesión se anula sale de un hash de (atleta, semana, sesión).
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import type { MacroHistoryCycleSpec, Macrocycle, RM, RmLift } from "@holy-oly/core";
import { MACROCYCLES, RM_LIFTS, buildMacroHistoryRows, stepDownRm, resolveTargetKg, dayLayoutFor, barKgForSexo } from "@holy-oly/core";

const DAY_MS = 86_400_000;
const isoDaysAgo = (n: number): string => new Date(Date.now() - n * DAY_MS).toISOString().slice(0, 10);
const addDaysIso = (iso: string, days: number): string =>
  new Date(new Date(`${iso}T00:00:00Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10);

/** Hash determinista FNV-1a → 0..99 (para decidir done/anulado sin RNG). */
function pct100(parts: Array<string | number>): number {
  let h = 2166136261;
  for (const p of parts) {
    const s = String(p);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
  }
  return Math.abs(h) % 100;
}

export interface AthleteHistoryCfg {
  /** Ciclos cerrados, de más antiguo a más nuevo — adherencia % de cada uno. */
  adherences: number[];
  /** Paso de RM entre ciclos (la curva sube hacia el ciclo actual). */
  rmStep: number;
  /** Macro de los ciclos cerrados (default: el del plan actual). */
  historyMacroId?: string;
}

/** Plan actual mínimo que necesita el historial (lo escribe seedPlanBundle antes de esto). */
interface PlanRow {
  macroId: string;
  startDate: string | null;
  startWeek: number;
  rms: RM;
  currentWeek: number;
}

/**
 * Siembra MacroHistory + RmUpdate + entrenos del ciclo actual para un atleta con plan ya asignado.
 * `currentWeek` = semana en curso; se siembran actuals de las semanas 1..currentWeek-1.
 */
export async function seedAthleteHistory(
  prisma: PrismaClient,
  athleteId: string,
  plan: PlanRow,
  sexo: "M" | "F",
  cfg: AthleteHistoryCfg,
): Promise<void> {
  const planStart = plan.startDate ?? isoDaysAgo((plan.currentWeek - 1) * 7);
  const historyMacroId = cfg.historyMacroId ?? plan.macroId;
  // El ciclo cerrado más nuevo cierra con un RM un paso por debajo del actual (el ciclo en curso
  // ya viene subiéndolo). rmTop = Plan.rms - rmStep; los anteriores bajan más.
  const rmTop = stepDownRm(plan.rms, 1, cfg.rmStep);
  const n = cfg.adherences.length;
  const specs: MacroHistoryCycleSpec[] = cfg.adherences.map((adherencePct, i) => {
    const below = n - 1 - i; // newest (i=n-1) → rmTop
    return { macroId: historyMacroId, adherencePct, rmEnd: stepDownRm(rmTop, below, cfg.rmStep) };
  });
  // Cerrar el historial una semana antes de que arranque el ciclo actual.
  const endBefore = addDaysIso(planStart, -7);
  const rows = buildMacroHistoryRows(specs, endBefore);

  if (rows.length > 0) {
    await prisma.macroHistory.createMany({
      data: rows.map((r) => ({
        athleteId,
        macroId: r.macroId,
        ordinal: r.ordinal,
        startDate: r.startDate,
        endDate: r.endDate,
        weeks: r.weeks,
        sessionsDone: r.sessionsDone,
        sessionsTotal: r.sessionsTotal,
        rmEnd: (r.rmEnd ?? undefined) as Prisma.InputJsonValue | undefined,
      })),
    });
  }

  // RmUpdate: un "manual" por ciclo cerrado (su rmEnd, fechado al cierre) + el "assign" del plan actual.
  const rmRows: Array<{ athleteId: string; lift: string; kg: number; setAt: string; reason: string }> = [];
  for (const r of rows) {
    if (!r.rmEnd) continue;
    for (const lift of RM_LIFTS) rmRows.push({ athleteId, lift, kg: r.rmEnd[lift], setAt: r.endDate, reason: "manual" });
  }
  for (const lift of RM_LIFTS) rmRows.push({ athleteId, lift, kg: plan.rms[lift], setAt: planStart, reason: "assign" });
  await prisma.rmUpdate.createMany({ data: rmRows });

  // Entrenos del ciclo actual (semanas ya transcurridas) con fechas reales.
  await seedCurrentCycleActuals(prisma, athleteId, plan, sexo, planStart);
}

async function seedCurrentCycleActuals(
  prisma: PrismaClient,
  athleteId: string,
  plan: PlanRow,
  sexo: "M" | "F",
  planStart: string,
): Promise<void> {
  const macro = MACROCYCLES.find((m) => m.id === plan.macroId);
  if (!macro || plan.currentWeek <= 1) return;
  const presc = await prisma.prescribedExercise.findMany({
    where: { athleteId },
    orderBy: [{ week: "asc" }, { sessionIdx: "asc" }, { order: "asc" }],
  });
  if (presc.length === 0) return;

  for (let week = 1; week < plan.currentWeek; week++) {
    const layout = dayLayoutFor(macro, week);
    const dayOf = (idx: number): number => layout?.[idx]?.day ?? idx + 1;
    const weekRows = presc.filter((r) => r.week === week);
    const sessionIdxs = [...new Set(weekRows.map((r) => r.sessionIdx))].sort((a, b) => a - b);
    const cfgAdh = currentAdherence(athleteId);

    for (const sessionIdx of sessionIdxs) {
      const day = dayOf(sessionIdx);
      // Fecha del día: distinta por día, COMPARTIDA dentro del día (AM/PM) → respeta 1×fecha.
      const fecha = addDaysIso(planStart, (week - 1) * 7 + (day - 1));
      const done = pct100([athleteId, week, sessionIdx]) < cfgAdh;
      if (!done) {
        // Anulado: resuelve el día (desbloquea los siguientes), sin volumen ni actuals.
        await prisma.sessionRegistro.create({ data: { athleteId, week, sessionIdx, fecha, estado: "anulado" } });
        continue;
      }
      const exes = weekRows.filter((r) => r.sessionIdx === sessionIdx).sort((a, b) => a.order - b.order);
      const data = exes.map((ex) => {
        const kg = resolveTargetKg(
          { movementId: ex.movementId, sets: ex.sets, reps: ex.reps, pct: ex.pct ?? undefined, kgOverride: ex.kgOverride ?? undefined, flags: [], notes: undefined },
          plan.rms,
        );
        const sets = kg != null ? Array.from({ length: ex.sets }, () => ({ kg, reps: ex.reps, done: true })) : null;
        return {
          athleteId, week, sessionIdx, order: ex.order,
          movementId: ex.movementId, prescribedMovementId: null,
          done: true, actualKg: kg ?? null, actualReps: kg != null ? ex.reps : null, note: null,
          sets: (sets ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          doneAt: fecha,
        };
      });
      await prisma.sessionActual.createMany({ data });
      await prisma.sessionRegistro.create({ data: { athleteId, week, sessionIdx, fecha, estado: "hecho" } });
    }
  }
}

/** Adherencia del ciclo en curso (los entrenos hechos vs anulados). Un valor por atleta, estable. */
function currentAdherence(athleteId: string): number {
  // 70 + un offset por atleta (60..95) — el ciclo en curso refleja su constancia general.
  return 60 + (pct100([athleteId, "current"]) % 36);
}
