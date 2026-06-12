import { Prisma, type PrismaClient } from "@prisma/client";
import type {
  Atleta, MacrocycleLevel, MonitorSeries, Medal, Competencia, Plan, CycleContext, SessionLog,
  DayLog, DayLogView, DayLogResult, MePlanView, DayLogInput,
  PrescribedExercise, PrescriptionRow, SessionView, MovementFlag, SessionActual, ExerciseActualInput,
  CycleShare, CycleState, CycleData, WeekHeat, RM, RmLift, RmReason, RmUpdate, PrCandidate,
  MeRecorrido, RecorridoSemana, DayOf,
} from "@holy-oly/core";
import { RMSchema, buildMePlanView, computeStreak, MACROCYCLES, ALL_RECIPES, instantiatePrescription, buildSessionViews, mergeActuals, summarizeSets, barKgForSexo, SetActualsSchema, planHeat, prCandidates, RM_LIFTS, lutealNow, redactCycle, weekDoneSummary, dayLayoutFor, fechaConflict } from "@holy-oly/core";
import { rowsToSeries } from "./db/mapping";
import { decryptAtRest, encryptAtRest } from "./crypto-at-rest";

/** Authorization primitive: the coach sees an athlete only via an `activo` Vinculo. */
export async function hasActiveLink(prisma: PrismaClient, coachId: string, athleteId: string): Promise<boolean> {
  const v = await prisma.vinculo.findUnique({
    where: { coachId_athleteId: { coachId, athleteId } },
  });
  return v?.estado === "activo";
}

function narrowSexo(s: string): "M" | "F" { return s === "F" ? "F" : "M"; }

interface AthleteRow {
  id: string; nombre: string; iniciales: string; nivel: MacrocycleLevel;
  macroId: string | null; compite: boolean; sexo: string;
}
function toAtleta(a: AthleteRow): Atleta {
  return {
    id: a.id,
    nombre: a.nombre,
    iniciales: a.iniciales,
    nivel: a.nivel,
    macroId: a.macroId ?? undefined,
    compite: a.compite,
    sexo: narrowSexo(a.sexo),
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
export async function getCycle(prisma: PrismaClient, athleteId: string, today: string): Promise<CycleContext | undefined> {
  const c = await prisma.cycleConsent.findUnique({ where: { athleteId } });
  if (!c) return undefined;
  // Decrypt at rest (D1) before redacting; legacy plaintext passes through unchanged.
  const share = decryptAtRest(c.share) as CycleShare;
  const state = decryptAtRest(c.state) as CycleState;
  // Lúteo REAL sólo bajo "full" + estado regular + datos; si no, null honesto (jamás inventar).
  let luteal: boolean | null = null;
  if (share === "full" && state === "regular" && c.lastPeriodStart != null && c.cycleLengthDays != null) {
    const len = Number(decryptAtRest(c.cycleLengthDays));
    luteal = Number.isFinite(len) ? lutealNow(decryptAtRest(c.lastPeriodStart), len, today) : null;
  }
  return redactCycle(share, state, luteal);
}

/** La verdad de la atleta (sólo /me). Sin fila → default honesto "no optó". */
export async function getMyCycle(prisma: PrismaClient, athleteId: string): Promise<CycleData> {
  const c = await prisma.cycleConsent.findUnique({ where: { athleteId } });
  if (!c) return { share: "none", state: "regular" };
  const len = c.cycleLengthDays == null ? NaN : Number(decryptAtRest(c.cycleLengthDays));
  return {
    share: decryptAtRest(c.share) as CycleShare,
    state: decryptAtRest(c.state) as CycleState,
    ...(c.lastPeriodStart == null ? {} : { lastPeriodStart: decryptAtRest(c.lastPeriodStart) }),
    ...(Number.isFinite(len) ? { cycleLengthDays: len } : {}),
  };
}

/** Upsert del registro de la atleta — los 4 campos cifrados at-rest (D1). */
export async function putMyCycle(prisma: PrismaClient, athleteId: string, input: CycleData): Promise<void> {
  const data = {
    share: encryptAtRest(input.share),
    state: encryptAtRest(input.state),
    lastPeriodStart: input.lastPeriodStart == null ? null : encryptAtRest(input.lastPeriodStart),
    cycleLengthDays: input.cycleLengthDays == null ? null : encryptAtRest(String(input.cycleLengthDays)),
  };
  await prisma.cycleConsent.upsert({ where: { athleteId }, create: { athleteId, ...data }, update: data });
}

// ── Writes (Fase 4). Inverse of the reads above; mirror LocalRepository's semantics so the
// two Repository implementations stay swappable. The caller (server.ts) authorizes first. ──

/**
 * Upsert the athlete's plan (replace, keyed by athleteId @unique). Writes only the Plan scalar
 * fields + rms; competitions live in the Competencia table (owned by setComps, reconciled in M5),
 * so plan.comps is intentionally ignored here.
 */
export async function savePlan(prisma: PrismaClient, athleteId: string, plan: Plan, today: string): Promise<void> {
  // rms is a plain {lift: number} object → JSON-safe; the double cast satisfies Prisma's Json input
  // type (RM has no string index signature to overlap InputJsonValue directly).
  const data = { macroId: plan.macroId, startWeek: plan.startWeek, startDate: plan.startDate ?? null, rms: plan.rms as unknown as Prisma.InputJsonValue };
  await prisma.$transaction(async (tx) => {
    await tx.plan.upsert({ where: { athleteId }, create: { athleteId, ...data }, update: data });
    await instantiateForPlan(tx, athleteId, plan);
    // SP5: cada asignación fija los 4 RMs → baseline del historial. `setAt = today` (la fecha del
    // ACTO de fijarlos): con el anclaje por compe el startDate cae en el pasado de forma rutinaria
    // y retro-fechar el baseline mostraría "fijado hace N sem" sobre RMs recién tipeados (falso-stale)
    // además de romper el invariante "última RmUpdate por lift == Plan.rms" al re-asignar.
    // startDate queda SOLO como fallback de rmVigencia para planes pre-SP5 (sin historial).
    await tx.rmUpdate.createMany({
      data: RM_LIFTS.map((lift) => ({ athleteId, lift, kg: plan.rms[lift], setAt: today, reason: "assign" })),
    });
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
  return buildMePlanView({ nombre: a.nombre, iniciales: a.iniciales, sexo: narrowSexo(a.sexo) }, plan, today);
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
  const rows: PrescriptionRow[] = macro ? instantiatePrescription(ALL_RECIPES, macro, totalWeeks) : [];
  await tx.prescribedExercise.deleteMany({ where: { athleteId } });
  if (rows.length > 0) {
    await tx.prescribedExercise.createMany({
      data: rows.map((r) => ({
        athleteId, week: r.week, sessionIdx: r.sessionIdx, order: r.order, movementId: r.movementId,
        sets: r.sets, reps: r.reps, pct: r.pct ?? null, kgOverride: r.kgOverride ?? null,
        flags: r.flags ?? [], notes: r.notes ?? null,
      })),
    });
  }
}

/** Fila cruda de SessionActual → tipo de core (compartido por getPrescriptionWeek y SP5). */
interface SessionActualRow {
  week: number; sessionIdx: number; order: number; movementId: string; done: boolean;
  prescribedMovementId: string | null; actualKg: number | null; actualReps: number | null;
  note: string | null; doneAt: string | null; sets: unknown;
}
function toSessionActual(a: SessionActualRow): SessionActual {
  const parsedSets = a.sets != null ? SetActualsSchema.safeParse(a.sets) : null;
  return {
    week: a.week, sessionIdx: a.sessionIdx, order: a.order, movementId: a.movementId, done: a.done,
    prescribedMovementId: a.prescribedMovementId ?? undefined,
    actualKg: a.actualKg ?? undefined, actualReps: a.actualReps ?? undefined,
    note: a.note ?? undefined, doneAt: a.doneAt ?? undefined,
    sets: parsedSets && parsedSets.success ? parsedSets.data : undefined,
  };
}

/** Fila cruda de PrescribedExercise → tipo de core (compartido por getPrescriptionWeek y recorrido). */
interface PrescribedExerciseRow {
  week: number; sessionIdx: number; order: number; movementId: string; sets: number; reps: number;
  pct: number | null; kgOverride: number | null; flags: string[]; notes: string | null;
}
function toPrescriptionRow(r: PrescribedExerciseRow): PrescriptionRow {
  return {
    week: r.week, sessionIdx: r.sessionIdx, order: r.order, movementId: r.movementId, sets: r.sets, reps: r.reps,
    pct: r.pct ?? undefined, kgOverride: r.kgOverride ?? undefined,
    flags: r.flags.length > 0 ? (r.flags as MovementFlag[]) : undefined, notes: r.notes ?? undefined,
  };
}

/** A week's sessions with kg derived from the athlete's plan RMs, merged with any athlete actuals.
 *  [] if no plan. Serves both the coach (`guardAthlete`) and athlete self (`/me/sessions`).
 *  Spec 2026-06-12: cada vista lleva `day`/`turno` del layout de la receta (D8) y la `fecha`
 *  real registrada por la atleta (D1) cuando existen. */
export async function getPrescriptionWeek(prisma: PrismaClient, athleteId: string, week: number): Promise<SessionView[]> {
  const plan = await getPlan(prisma, athleteId);
  if (!plan) return [];
  const dbRows = await prisma.prescribedExercise.findMany({
    where: { athleteId, week }, orderBy: [{ sessionIdx: "asc" }, { order: "asc" }],
  });
  const rows: PrescriptionRow[] = dbRows.map(toPrescriptionRow);
  const actualRows = await prisma.sessionActual.findMany({ where: { athleteId, week } });
  const actuals: SessionActual[] = actualRows.map(toSessionActual);
  // Actuals matched to exercises POSITIONALLY (order == view index). A coach edit that reorders a session after actuals are recorded can misalign them — acceptable for SP3 (revisit in SP4).
  const athlete = await prisma.athlete.findUnique({ where: { id: athleteId }, select: { sexo: true } });
  const barKg = barKgForSexo((athlete?.sexo as "M" | "F" | undefined) ?? "M");
  const macro = MACROCYCLES.find((m) => m.id === plan.macroId);
  const layout = macro ? dayLayoutFor(macro, week) : null;
  const registros = await prisma.sessionRegistro.findMany({ where: { athleteId, week } });
  const fechaByIdx = new Map(registros.map((r) => [r.sessionIdx, r.fecha]));
  return mergeActuals(buildSessionViews(rows, plan.rms, barKg), actuals).map((v) => ({
    ...v,
    ...(layout?.[v.sessionIdx] ? layout[v.sessionIdx]! : {}),
    ...(fechaByIdx.has(v.sessionIdx) ? { fecha: fechaByIdx.get(v.sessionIdx)! } : {}),
  }));
}

/** Recorrido del macro (GET /me/recorrido): lo HECHO acumulado por semana, construyendo las
 *  vistas con el MISMO builder que /me/sessions (warmup server-side — regla 06-11) y resumiendo
 *  con `weekDoneSummary`. `{ semanas: [] }` sin plan/macro (honesto). Eficiencia: prescripción y
 *  actuals viajan en UNA query cada uno y se agrupan por semana en memoria — la iteración 1..N
 *  es puro CPU, jamás N queries. */
export async function getMeRecorrido(prisma: PrismaClient, athleteId: string): Promise<MeRecorrido> {
  const plan = await getPlan(prisma, athleteId);
  if (!plan) return { semanas: [] };
  const macro = MACROCYCLES.find((m) => m.id === plan.macroId);
  const totalWeeks = macro ? (macro.phaseProfile[macro.phaseProfile.length - 1]?.weeks[1] ?? 0) : 0;
  if (totalWeeks === 0) return { semanas: [] };
  const [dbRows, actualRows, athlete] = await Promise.all([
    prisma.prescribedExercise.findMany({ where: { athleteId }, orderBy: [{ sessionIdx: "asc" }, { order: "asc" }] }),
    prisma.sessionActual.findMany({ where: { athleteId } }),
    prisma.athlete.findUnique({ where: { id: athleteId }, select: { sexo: true } }),
  ]);
  const barKg = barKgForSexo((athlete?.sexo as "M" | "F" | undefined) ?? "M");
  const rowsByWeek = groupByWeek(dbRows.map(toPrescriptionRow));
  const actualsByWeek = groupByWeek(actualRows.map(toSessionActual));
  const semanas: RecorridoSemana[] = [];
  for (let week = 1; week <= totalWeeks; week++) {
    const views = mergeActuals(
      buildSessionViews(rowsByWeek.get(week) ?? [], plan.rms, barKg),
      actualsByWeek.get(week) ?? [],
    );
    const { trabajoKg, calentamientoKg, sesionesHechas, sesionesTotales } = weekDoneSummary(views);
    semanas.push({ week, trabajoKg, calentamientoKg, sesionesHechas, sesionesTotales });
  }
  return { semanas };
}

function groupByWeek<T extends { week: number }>(items: T[]): Map<number, T[]> {
  const m = new Map<number, T[]>();
  for (const it of items) {
    const arr = m.get(it.week);
    if (arr) arr.push(it);
    else m.set(it.week, [it]);
  }
  return m;
}

/** Per-day heat aggregate of the WHOLE plan (calendar heat map). [] if no plan/macro. Light
 *  select — no RM/kg derivation; athlete-safe payload (% + lift counts). Serves the coach
 *  (`/athletes/:id/heat`, guardAthlete) and the athlete self (`/me/heat`). */
export async function getPlanHeat(prisma: PrismaClient, athleteId: string): Promise<WeekHeat[]> {
  const plan = await getPlan(prisma, athleteId);
  if (!plan) return [];
  const macro = MACROCYCLES.find((m) => m.id === plan.macroId);
  const totalWeeks = macro ? (macro.phaseProfile[macro.phaseProfile.length - 1]?.weeks[1] ?? 0) : 0;
  if (totalWeeks === 0) return [];
  const rows = await prisma.prescribedExercise.findMany({
    where: { athleteId },
    select: { week: true, sessionIdx: true, sets: true, reps: true, pct: true },
  });
  return planHeat(rows.map((r) => ({ ...r, pct: r.pct ?? undefined })), totalWeeks);
}

/** El conflicto de la regla 1×fecha, identificado (la ruta lo traduce a 409). */
export class FechaOcupadaError extends Error {
  constructor(public readonly conflicto: { week: number; sessionIdx: number; fecha: string }) {
    super("fecha_ocupada");
  }
}

/** Replace one session's athlete actuals + su registro de fecha (spec 2026-06-12 D1/D3).
 *  Transaccional. `fecha` = fecha REAL del entreno (la ruta ya validó ≤ hoy): estampa doneAt
 *  en filas done (las ediciones ya no corren la procedencia) y aplica la regla 1×fecha con
 *  la excepción AM/PM intra-semana vía dayLayoutFor (core). 0 filas done → el registro se
 *  borra y la fecha se libera (D11).
 *  Asume escritor único por atleta (app móvil, sin retries concurrentes en vuelo): dos
 *  transacciones simultáneas con la misma fecha podrían pasar el chequeo (read-committed). */
export async function setSessionActuals(
  prisma: PrismaClient, athleteId: string, week: number, sessionIdx: number,
  actuals: ExerciseActualInput[],
  fecha: string,
): Promise<void> {
  const plan = await getPlan(prisma, athleteId);
  const macro = plan ? MACROCYCLES.find((m) => m.id === plan.macroId) : undefined;
  const layout = macro ? dayLayoutFor(macro, week) : null;
  // dayOf se deriva antes de la tx: TOCTOU inofensivo — si el coach re-asigna el macro en
  // vuelo, a lo sumo la excepción AM/PM de ESTA escritura usa el layout viejo (no corrompe).
  const dayOf: DayOf = (idx) => layout?.[idx]?.day ?? idx + 1;
  const summarized = actuals.map((a) => ({
    a, sum: a.sets && a.sets.length > 0 ? summarizeSets(a.sets) : { done: a.done, kg: a.kg, reps: a.reps },
  }));
  const anyDone = summarized.some(({ sum }) => sum.done);
  await prisma.$transaction(async (tx) => {
    if (anyDone) {
      const registros = await tx.sessionRegistro.findMany({
        where: { athleteId, fecha }, select: { week: true, sessionIdx: true, fecha: true },
      });
      const conflict = fechaConflict(registros, week, sessionIdx, fecha, dayOf);
      if (conflict) throw new FechaOcupadaError(conflict);
    }
    await tx.sessionActual.deleteMany({ where: { athleteId, week, sessionIdx } });
    if (summarized.length > 0) {
      await tx.sessionActual.createMany({
        data: summarized.map(({ a, sum }) => ({
          athleteId, week, sessionIdx, order: a.order, movementId: a.movementId,
          prescribedMovementId: a.prescribedMovementId ?? null,
          done: sum.done,
          actualKg: sum.kg ?? null, actualReps: sum.reps ?? null, note: a.note ?? null,
          sets: a.sets && a.sets.length > 0 ? (a.sets as Prisma.InputJsonValue) : Prisma.JsonNull,
          doneAt: sum.done ? fecha : null,
        })),
      });
    }
    if (anyDone) {
      await tx.sessionRegistro.upsert({
        where: { athleteId_week_sessionIdx: { athleteId, week, sessionIdx } },
        create: { athleteId, week, sessionIdx, fecha },
        update: { fecha },
      });
    } else {
      await tx.sessionRegistro.deleteMany({ where: { athleteId, week, sessionIdx } });
    }
  });
}

/** Replace one session's exercises (coach edit). Transactional. */
export async function setSession(prisma: PrismaClient, athleteId: string, week: number, sessionIdx: number, exercises: PrescribedExercise[]): Promise<void> {
  await prisma.$transaction([
    prisma.prescribedExercise.deleteMany({ where: { athleteId, week, sessionIdx } }),
    prisma.prescribedExercise.createMany({
      data: exercises.map((ex, order) => ({
        athleteId, week, sessionIdx, order, movementId: ex.movementId, sets: ex.sets, reps: ex.reps,
        pct: ex.pct ?? null, kgOverride: ex.kgOverride ?? null, flags: ex.flags ?? [], notes: ex.notes ?? null,
      })),
    }),
  ]);
}

// ── SP5: RMs a mitad de ciclo. updateRms NO re-instancia (las ediciones del coach sobreviven);
//    el kg se deriva en lectura (rms × pct) → la cascada es automática. ──

/** Merge transaccional de 1+ lifts en Plan.rms + append al historial. false si no hay plan. */
export async function updateRms(prisma: PrismaClient, athleteId: string, updates: { lift: RmLift; kg: number }[], reason: "manual" | "pr", today: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const p = await tx.plan.findUnique({ where: { athleteId } });
    if (!p) return false;
    const merged: RM = { ...RMSchema.parse(p.rms) };
    for (const u of updates) merged[u.lift] = u.kg;
    await tx.plan.update({ where: { athleteId }, data: { rms: merged as unknown as Prisma.InputJsonValue } });
    await tx.rmUpdate.createMany({ data: updates.map((u) => ({ athleteId, lift: u.lift, kg: u.kg, setAt: today, reason })) });
    return true;
  });
}

/** Sets hechos que SUPERAN el RM vigente (≤1 por lift). [] sin plan — honesto. */
export async function getPrCandidates(prisma: PrismaClient, athleteId: string): Promise<PrCandidate[]> {
  const plan = await getPlan(prisma, athleteId);
  if (!plan) return [];
  const rows = await prisma.sessionActual.findMany({ where: { athleteId } });
  return prCandidates(rows.map(toSessionActual), plan.rms);
}

/** Historial append-only, más nuevo primero (mismo día → createdAt desestabiliza el empate). */
export async function getRmHistory(prisma: PrismaClient, athleteId: string): Promise<RmUpdate[]> {
  const rows = await prisma.rmUpdate.findMany({ where: { athleteId }, orderBy: [{ setAt: "desc" }, { createdAt: "desc" }] });
  return rows.map((r) => ({ lift: r.lift as RmLift, kg: r.kg, setAt: r.setAt, reason: r.reason as RmReason }));
}

/** D3: everything the athlete owns, for a self-service data export (the athlete gets RAW cycle). */
export async function exportAthleteData(prisma: PrismaClient, athleteId: string): Promise<unknown> {
  const [athlete, plan, cycle, dayLogs, actuals, medals, comps, prescription, weeks, sessionMarks, rmUpdates, sessionRegistros] =
    await Promise.all([
      prisma.athlete.findUnique({ where: { id: athleteId } }),
      prisma.plan.findUnique({ where: { athleteId } }),
      prisma.cycleConsent.findUnique({ where: { athleteId } }),
      prisma.dayLog.findMany({ where: { athleteId }, orderBy: { date: "asc" } }),
      prisma.sessionActual.findMany({ where: { athleteId } }),
      prisma.medal.findMany({ where: { athleteId } }),
      prisma.competencia.findMany({ where: { athleteId } }),
      prisma.prescribedExercise.findMany({ where: { athleteId } }),
      prisma.monitorWeek.findMany({ where: { athleteId }, include: { items: true } }),
      prisma.sessionMark.findMany({ where: { athleteId } }),
      // SP5: la curva del 1RM es dato del atleta → viaja en su export (D3).
      prisma.rmUpdate.findMany({ where: { athleteId }, orderBy: [{ setAt: "asc" }, { createdAt: "asc" }] }),
      // Spec 2026-06-12: la fecha real de cada entreno también es suya (D3).
      prisma.sessionRegistro.findMany({ where: { athleteId }, select: { week: true, sessionIdx: true, fecha: true } }),
    ]);
  // The athlete owns their cycle → return it decrypted (raw values), not redacted.
  const cycleRaw = cycle
    ? {
        ...cycle,
        share: decryptAtRest(cycle.share),
        state: decryptAtRest(cycle.state),
        lastPeriodStart: cycle.lastPeriodStart == null ? null : decryptAtRest(cycle.lastPeriodStart),
        cycleLengthDays: cycle.cycleLengthDays == null ? null : decryptAtRest(cycle.cycleLengthDays),
      }
    : null;
  return { athlete, plan, cycle: cycleRaw, dayLogs, actuals, medals, comps, prescription, weeks, sessionMarks, rmUpdates, sessionRegistros };
}

/**
 * D4: delete the athlete's account. Deleting the Athlete row cascades ALL athlete-owned data
 * (daylogs, cycle, actuals, plan, vínculos, …); deleting the User cascades its sessions. Run as a
 * transaction. This is why we must delete explicitly (Athlete.user is onDelete: SetNull, so deleting
 * only the User would orphan the health data).
 */
export async function deleteAthleteAccount(prisma: PrismaClient, athleteId: string, userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.athlete.delete({ where: { id: athleteId } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);
}
