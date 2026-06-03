import type { Prisma, PrismaClient } from "@prisma/client";
import type {
  Atleta, MacrocycleLevel, MonitorSeries, Medal, Competencia, Plan, CycleContext, SessionLog,
  DayLog, DayLogView, DayLogResult, MePlanView, DayLogInput,
  PrescribedExercise, PrescriptionRow, SessionView, MovementFlag, SessionActual,
} from "@holy-oly/core";
import { RMSchema, buildMePlanView, computeStreak, MACROCYCLES, MACRO_RECIPES, instantiatePrescription, buildSessionViews, mergeActuals } from "@holy-oly/core";
import { rowsToSeries } from "./db/mapping";
import { redactCycle } from "./cycle";

/** Authorization primitive: the coach sees an athlete only via an `activo` Vinculo. */
export async function hasActiveLink(prisma: PrismaClient, coachId: string, athleteId: string): Promise<boolean> {
  const v = await prisma.vinculo.findUnique({
    where: { coachId_athleteId: { coachId, athleteId } },
  });
  return v?.estado === "activo";
}

interface AthleteRow {
  id: string; nombre: string; iniciales: string; nivel: MacrocycleLevel;
  macroId: string | null; compite: boolean;
}
function toAtleta(a: AthleteRow): Atleta {
  return {
    id: a.id,
    nombre: a.nombre,
    iniciales: a.iniciales,
    nivel: a.nivel,
    macroId: a.macroId ?? undefined,
    compite: a.compite,
  };
}

/** Roster = athletes with an active Vinculo to this coach. */
export async function getRoster(prisma: PrismaClient, coachId: string): Promise<Atleta[]> {
  const vinculos = await prisma.vinculo.findMany({
    where: { coachId, estado: "activo" },
    include: { athlete: true },
  });
  return vinculos.map((v) => toAtleta(v.athlete));
}

export async function getSeries(prisma: PrismaClient, athleteId: string): Promise<MonitorSeries | undefined> {
  const weeks = await prisma.monitorWeek.findMany({
    where: { athleteId },
    include: { items: true },
  });
  if (weeks.length === 0) return undefined;
  const athlete = await prisma.athlete.findUnique({ where: { id: athleteId } });
  const weekRows = weeks.map((w) => ({
    week: w.week, acute: w.acute, hrv: w.hrv, hrvBase: w.hrvBase, rhr: w.rhr, rhrBase: w.rhrBase,
    imr: w.imr, wellness: w.wellness, recovery: w.recovery,
    compliance: w.compliance, rpe: w.rpe, bodyweight: w.bodyweight,
  }));
  const itemRows = weeks.flatMap((w) => w.items.map((it) => ({ week: w.week, key: it.key, value: it.value })));
  const band: [number, number] | undefined =
    athlete?.weightBandLo != null && athlete.weightBandHi != null
      ? [athlete.weightBandLo, athlete.weightBandHi]
      : undefined;
  return rowsToSeries(weekRows, itemRows, band);
}

export async function getMedals(prisma: PrismaClient, athleteId: string): Promise<Medal[]> {
  const ms = await prisma.medal.findMany({ where: { athleteId } });
  return ms.map((m) => ({
    comp: m.comp, date: m.date, cat: m.cat, medal: m.medal, sn: m.sn, cj: m.cj, place: m.place,
  }));
}

export async function getComps(prisma: PrismaClient, athleteId: string): Promise<Competencia[]> {
  const cs = await prisma.competencia.findMany({ where: { athleteId }, orderBy: { week: "asc" } });
  return cs.map((c) => ({ name: c.name, week: c.week, date: c.date ?? undefined }));
}

export async function getPlan(prisma: PrismaClient, athleteId: string): Promise<Plan | undefined> {
  const p = await prisma.plan.findUnique({ where: { athleteId } });
  if (!p) return undefined;
  const comps = await getComps(prisma, athleteId);
  // rms is a Json column (genuinely untyped at the DB) — validate it, don't cast.
  return { atletaId: p.athleteId, macroId: p.macroId, startWeek: p.startWeek, startDate: p.startDate ?? undefined, rms: RMSchema.parse(p.rms), comps };
}

/** Coach-facing cycle: the redacted projection only — raw consent never leaves the server. */
export async function getCycle(prisma: PrismaClient, athleteId: string): Promise<CycleContext | undefined> {
  const c = await prisma.cycleConsent.findUnique({ where: { athleteId } });
  if (!c) return undefined;
  return redactCycle(c.share, c.state);
}

// ── Writes (Fase 4). Inverse of the reads above; mirror LocalRepository's semantics so the
// two Repository implementations stay swappable. The caller (server.ts) authorizes first. ──

/**
 * Upsert the athlete's plan (replace, keyed by athleteId @unique). Writes only the Plan scalar
 * fields + rms; competitions live in the Competencia table (owned by setComps, reconciled in M5),
 * so plan.comps is intentionally ignored here.
 */
export async function savePlan(prisma: PrismaClient, athleteId: string, plan: Plan): Promise<void> {
  // rms is a plain {lift: number} object → JSON-safe; the double cast satisfies Prisma's Json input
  // type (RM has no string index signature to overlap InputJsonValue directly).
  const data = { macroId: plan.macroId, startWeek: plan.startWeek, startDate: plan.startDate ?? null, rms: plan.rms as unknown as Prisma.InputJsonValue };
  await prisma.$transaction(async (tx) => {
    await tx.plan.upsert({ where: { athleteId }, create: { athleteId, ...data }, update: data });
    await instantiateForPlan(tx, athleteId, plan);
  });
}

/** Append a medal (one row — no read-modify-write, unlike the LocalRepository oracle). */
export async function addMedal(prisma: PrismaClient, athleteId: string, medal: Medal): Promise<void> {
  await prisma.medal.create({
    data: {
      athleteId, comp: medal.comp, date: medal.date, cat: medal.cat,
      medal: medal.medal, sn: medal.sn, cj: medal.cj, place: medal.place,
    },
  });
}

/** Replace the whole competition list transactionally — a partial failure must not truncate it. */
export async function setComps(prisma: PrismaClient, athleteId: string, comps: Competencia[]): Promise<void> {
  await prisma.$transaction([
    prisma.competencia.deleteMany({ where: { athleteId } }),
    prisma.competencia.createMany({ data: comps.map((c) => ({ athleteId, name: c.name, week: c.week, date: c.date ?? null })) }),
  ]);
}

export async function getSessionLog(prisma: PrismaClient, athleteId: string): Promise<SessionLog> {
  const ms = await prisma.sessionMark.findMany({ where: { athleteId }, orderBy: [{ week: "asc" }, { idx: "asc" }] });
  return ms.map((m) => ({ week: m.week, idx: m.idx, status: m.status }));
}

/** Replace the whole session-adherence log transactionally (mirror setComps). */
export async function setSessionLog(prisma: PrismaClient, athleteId: string, log: SessionLog): Promise<void> {
  await prisma.$transaction([
    prisma.sessionMark.deleteMany({ where: { athleteId } }),
    prisma.sessionMark.createMany({ data: log.map((m) => ({ athleteId, week: m.week, idx: m.idx, status: m.status })) }),
  ]);
}

// ── Athlete self (Proyecto A). Scoped to athleteId by the caller (req.athleteId from session). ──

interface DayLogRow {
  date: string; fatiga: number; dolor: number; estres: number;
  humor: number; motivacion: number; sueno: number; weight: number | null;
}
function toDayLog(r: DayLogRow): DayLog {
  return {
    date: r.date, fatiga: r.fatiga, dolor: r.dolor, estres: r.estres,
    humor: r.humor, motivacion: r.motivacion, sueno: r.sueno, weight: r.weight ?? undefined,
  };
}

/** The athlete's own plan view (greeting + camino). `plan: null` when unassigned. */
export async function getMePlanView(prisma: PrismaClient, athleteId: string, today: string): Promise<MePlanView | undefined> {
  const a = await prisma.athlete.findUnique({ where: { id: athleteId } });
  if (!a) return undefined;
  const plan = await getPlan(prisma, athleteId);
  return buildMePlanView({ nombre: a.nombre, iniciales: a.iniciales }, plan, today);
}

/** Today's entry (or the requested date) + streak + logged days (heatmap), all as of `today`. */
export async function getDayLogView(prisma: PrismaClient, athleteId: string, today: string, date?: string): Promise<DayLogView> {
  const target = date ?? today;
  const rows = await prisma.dayLog.findMany({ where: { athleteId }, select: { date: true } });
  const days = rows.map((r) => r.date);
  const entry = await prisma.dayLog.findUnique({ where: { athleteId_date: { athleteId, date: target } } });
  return { entry: entry ? toDayLog(entry) : null, streak: computeStreak(days, today), days, today };
}

/** Upsert the athlete's entry for `today` (one row per athlete-day), then recompute the streak. */
export async function upsertDayLog(prisma: PrismaClient, athleteId: string, today: string, input: DayLogInput): Promise<DayLogResult> {
  const data = {
    fatiga: input.fatiga, dolor: input.dolor, estres: input.estres,
    humor: input.humor, motivacion: input.motivacion, sueno: input.sueno,
    weight: input.weight ?? null,
  };
  const row = await prisma.dayLog.upsert({
    where: { athleteId_date: { athleteId, date: today } },
    create: { athleteId, date: today, ...data },
    update: data,
  });
  const rows = await prisma.dayLog.findMany({ where: { athleteId }, select: { date: true } });
  return { entry: toDayLog(row), streak: computeStreak(rows.map((r) => r.date), today) };
}

// ── Prescription (SP2). Coach-owned. Assigning a plan (re)instantiates from the macro recipe. ──

/** (Re)instantiate the athlete's prescription from the macro recipe, replacing ALL existing rows —
 *  assigning a macro is a deliberate reset (empty when the macro has no recipe → coach builds from
 *  scratch). Runs on the given (transaction) client so it can join savePlan's atomic transaction. */
export async function instantiateForPlan(tx: Prisma.TransactionClient, athleteId: string, plan: Plan): Promise<void> {
  const macro = MACROCYCLES.find((m) => m.id === plan.macroId);
  const totalWeeks = macro ? (macro.phaseProfile[macro.phaseProfile.length - 1]?.weeks[1] ?? 0) : 0;
  const rows: PrescriptionRow[] = macro ? instantiatePrescription(MACRO_RECIPES, macro, totalWeeks) : [];
  await tx.prescribedExercise.deleteMany({ where: { athleteId } });
  if (rows.length > 0) {
    await tx.prescribedExercise.createMany({
      data: rows.map((r) => ({
        athleteId, week: r.week, sessionIdx: r.sessionIdx, order: r.order, movementId: r.movementId,
        sets: r.sets, reps: r.reps, pct: r.pct ?? null, kgOverride: r.kgOverride ?? null,
        rpe: r.rpe ?? null, flags: r.flags ?? [], notes: r.notes ?? null,
      })),
    });
  }
}

/** A week's sessions with kg derived from the athlete's plan RMs, merged with any athlete actuals.
 *  [] if no plan. Serves both the coach (`guardAthlete`) and athlete self (`/me/sessions`). */
export async function getPrescriptionWeek(prisma: PrismaClient, athleteId: string, week: number): Promise<SessionView[]> {
  const plan = await getPlan(prisma, athleteId);
  if (!plan) return [];
  const dbRows = await prisma.prescribedExercise.findMany({
    where: { athleteId, week }, orderBy: [{ sessionIdx: "asc" }, { order: "asc" }],
  });
  const rows: PrescriptionRow[] = dbRows.map((r) => ({
    week: r.week, sessionIdx: r.sessionIdx, order: r.order, movementId: r.movementId, sets: r.sets, reps: r.reps,
    pct: r.pct ?? undefined, kgOverride: r.kgOverride ?? undefined, rpe: r.rpe ?? undefined,
    flags: r.flags.length > 0 ? (r.flags as MovementFlag[]) : undefined, notes: r.notes ?? undefined,
  }));
  const actualRows = await prisma.sessionActual.findMany({ where: { athleteId, week } });
  const actuals: SessionActual[] = actualRows.map((a) => ({
    week: a.week, sessionIdx: a.sessionIdx, order: a.order, movementId: a.movementId, done: a.done,
    actualKg: a.actualKg ?? undefined, actualReps: a.actualReps ?? undefined, actualRpe: a.actualRpe ?? undefined,
    note: a.note ?? undefined, doneAt: a.doneAt ?? undefined,
  }));
  return mergeActuals(buildSessionViews(rows, plan.rms), actuals);
}

/** Replace one session's athlete actuals (self-written). Transactional. `today` stamps doneAt. */
export async function setSessionActuals(
  prisma: PrismaClient, athleteId: string, week: number, sessionIdx: number,
  actuals: Array<{ order: number; movementId: string; done: boolean; kg?: number; reps?: number; rpe?: number; note?: string }>,
  today: string,
): Promise<void> {
  await prisma.$transaction([
    prisma.sessionActual.deleteMany({ where: { athleteId, week, sessionIdx } }),
    prisma.sessionActual.createMany({
      data: actuals.map((a) => ({
        athleteId, week, sessionIdx, order: a.order, movementId: a.movementId, done: a.done,
        actualKg: a.kg ?? null, actualReps: a.reps ?? null, actualRpe: a.rpe ?? null, note: a.note ?? null, doneAt: today,
      })),
    }),
  ]);
}

/** Replace one session's exercises (coach edit). Transactional. */
export async function setSession(prisma: PrismaClient, athleteId: string, week: number, sessionIdx: number, exercises: PrescribedExercise[]): Promise<void> {
  await prisma.$transaction([
    prisma.prescribedExercise.deleteMany({ where: { athleteId, week, sessionIdx } }),
    prisma.prescribedExercise.createMany({
      data: exercises.map((ex, order) => ({
        athleteId, week, sessionIdx, order, movementId: ex.movementId, sets: ex.sets, reps: ex.reps,
        pct: ex.pct ?? null, kgOverride: ex.kgOverride ?? null, rpe: ex.rpe ?? null, flags: ex.flags ?? [], notes: ex.notes ?? null,
      })),
    }),
  ]);
}
