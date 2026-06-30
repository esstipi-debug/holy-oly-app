import { Prisma, type PrismaClient } from "@prisma/client";
import type {
  Atleta, Macrocycle, MacrocycleLevel, MonitorSeries, Medal, Competencia, Plan, CycleContext, SessionLog,
  DayLog, DayLogView, DayLogResult, MePlanView, DayLogInput,
  PrescribedExercise, PrescriptionRow, SessionView, MovementFlag, SessionActual, ExerciseActualInput,
  CycleShare, CycleState, CycleData, MeCycleView, WeekHeat, RM, RmLift, RmReason, RmUpdate, PrCandidate,
  MeRecorrido, RecorridoSemana, AthleteDailyView, EngineWeek, DayOf, MacroHistoryView, MacroHistoryRow, MeHeatDays,
  Competition, CompetitionInput, CompetitionListItem, CompetitionDetailView, CompetitionEntryView, CompetitionEntryInput,
} from "@holy-oly/core";
import { RMSchema, buildMePlanView, computeStreak, MACROCYCLES, ALL_RECIPES, instantiatePrescription, buildAdaptivePlan, effectiveTotalWeeks, availableWeeksToComp, weekIndexUnclamped, reinstantiableWeeks, buildSessionViews, mergeActuals, summarizeSets, barKgForSexo, SetActualsSchema, planHeat, prCandidates, RM_LIFTS, lutealNow, redactCycle, weekDoneSummary, buildDailyView, dailyFromDate, DAILY_WINDOW_WEEKS, prilepinPreviewWeek, dayLayoutFor, fechaConflict, unresolvedPriorDays, CYCLE_CONSENT_VERSION, macroHistoryView, competenciaForPico, buildMeHeatDays, setTonnage, wellnessScore, wellnessStreak, coachStreakRisk, type CoachRisk } from "@holy-oly/core";
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

/** Roster = athletes with an active Vinculo to this coach. `needsRm` señala a los que no tienen RM
 *  cargado (sin plan, o rms incompleto) → sin RM el motor no puede prescribir (alerta del Plantel).
 *  La regla vive en core: un plan SIN RMSchema válido (4 lifts > 0) ⇒ falta RM. */
export async function getRoster(prisma: PrismaClient, coachId: string): Promise<Atleta[]> {
  const vinculos = await prisma.vinculo.findMany({
    where: { coachId, estado: "activo" },
    include: { athlete: true },
  });
  const ids = vinculos.map((v) => v.athleteId);
  const plans = await prisma.plan.findMany({ where: { athleteId: { in: ids } }, select: { athleteId: true, rms: true } });
  const rmsByAthlete = new Map(plans.map((p) => [p.athleteId, p.rms]));
  const needsRm = (athleteId: string): boolean => {
    const raw = rmsByAthlete.get(athleteId);
    // Sin plan → falta RM. Con plan → válido sólo si los 4 lifts existen y son > 0 (RMSchema).
    return raw == null || !RMSchema.safeParse(raw).success;
  };
  return vinculos.map((v) => ({ ...toAtleta(v.athlete), needsRm: needsRm(v.athleteId) }));
}

/** Riesgo predictivo por atleta del coach (mapa). Server-side: N consultas locales, 1 respuesta.
 *  Sólo entra el atleta CON racha de bienestar. */
export async function getRosterRisk(prisma: PrismaClient, coachId: string, today: string): Promise<Record<string, CoachRisk>> {
  const vinculos = await prisma.vinculo.findMany({ where: { coachId, estado: "activo" }, select: { athleteId: true } });
  const out: Record<string, CoachRisk> = {};
  for (const { athleteId } of vinculos) {
    const recent = await prisma.dayLog.findMany({ where: { athleteId }, orderBy: { date: "desc" }, take: 14 });
    const series = await getSeries(prisma, athleteId);
    const risk = coachStreakRisk(recent.map(toDayLog), series, today);
    if (risk) out[athleteId] = risk;
  }
  return out;
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

/** La verdad de la atleta (sólo /me). Sin fila → default honesto "no optó" + consented=false
 *  (la UI muestra el gate de activación, PR-L2). `consentedAt != null` ⇒ ya activó el módulo. */
export async function getMyCycle(prisma: PrismaClient, athleteId: string): Promise<MeCycleView> {
  // El ciclo es female-only (owner 2026-06-14): el `sexo` viaja para que la UI gatee toda superficie.
  const a = await prisma.athlete.findUnique({ where: { id: athleteId }, select: { sexo: true } });
  const sexo = narrowSexo(a?.sexo ?? "M");
  const c = await prisma.cycleConsent.findUnique({ where: { athleteId } });
  if (!c) return { sexo, share: "none", state: "regular", consented: false };
  const len = c.cycleLengthDays == null ? NaN : Number(decryptAtRest(c.cycleLengthDays));
  return {
    sexo,
    share: decryptAtRest(c.share) as CycleShare,
    state: decryptAtRest(c.state) as CycleState,
    ...(c.lastPeriodStart == null ? {} : { lastPeriodStart: decryptAtRest(c.lastPeriodStart) }),
    ...(Number.isFinite(len) ? { cycleLengthDays: len } : {}),
    consented: c.consentedAt != null,
  };
}

/** Lanzada cuando una atleta sin consentimiento intenta registrar sin el acto de opt-in (§3). */
export class ConsentRequiredError extends Error {}

/** Ciclo female-only (owner 2026-06-14): un atleta no-femenino no puede registrar ciclo. Defensa
 *  en profundidad — la UI ya oculta el módulo (gate `sexo==="F"`), pero el server tampoco lo escribe. */
export class CycleNotEligibleError extends Error {}

/** Upsert del registro de la atleta — los 4 campos cifrados at-rest (D1). La PRIMERA activación
 *  EXIGE `consent` (opt-in informado, §3); ahí se sella consentedAt + versión vigente. Editar
 *  después NO re-pide consentimiento ni re-escribe el sello (consentedAt/consentVersion sólo se
 *  fijan al consentir; no se cifran — metadata de consentimiento, no salud). Transaccional: el
 *  check de consentimiento y la escritura son atómicos (sin ventana TOCTOU). Devuelve `firstConsent`
 *  para que el audit distinga la activación (cycle.consent) de una edición (cycle.write). */
export async function putMyCycle(prisma: PrismaClient, athleteId: string, input: CycleData, consent: boolean): Promise<{ firstConsent: boolean }> {
  // Female-only (owner 2026-06-14): defensa en profundidad además del gate de la UI.
  const a = await prisma.athlete.findUnique({ where: { id: athleteId }, select: { sexo: true } });
  if (narrowSexo(a?.sexo ?? "M") !== "F") throw new CycleNotEligibleError();
  const encrypted = {
    share: encryptAtRest(input.share),
    state: encryptAtRest(input.state),
    lastPeriodStart: input.lastPeriodStart == null ? null : encryptAtRest(input.lastPeriodStart),
    cycleLengthDays: input.cycleLengthDays == null ? null : encryptAtRest(String(input.cycleLengthDays)),
  };
  return prisma.$transaction(async (tx) => {
    const existing = await tx.cycleConsent.findUnique({ where: { athleteId } });
    const alreadyConsented = existing?.consentedAt != null;
    if (!alreadyConsented && !consent) throw new ConsentRequiredError();
    if (existing) {
      // Ya consintió → sólo los datos. Fila sin sello (caso borde) + consent ahora → fijar el sello.
      const data = alreadyConsented ? encrypted : { ...encrypted, consentedAt: new Date(), consentVersion: CYCLE_CONSENT_VERSION };
      await tx.cycleConsent.update({ where: { athleteId }, data });
    } else {
      await tx.cycleConsent.create({ data: { athleteId, ...encrypted, consentedAt: new Date(), consentVersion: CYCLE_CONSENT_VERSION } });
    }
    return { firstConsent: !alreadyConsented };
  });
}

/** Revocación: la atleta borra su registro entero (es dueña del dato). El coach deja de ver
 *  contexto de inmediato (sin fila → /athletes/:id/cycle rinde 404). */
export async function deleteMyCycle(prisma: PrismaClient, athleteId: string): Promise<void> {
  await prisma.cycleConsent.deleteMany({ where: { athleteId } });
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

/** Replace the whole competition list transactionally — a partial failure must not truncate it. Tras
 *  reemplazarlas, RE-PERIODIZA la prescripción a las compes nuevas (v2), pero SÓLO el futuro intocado
 *  (invariante D8 — `reperiodizeFuture`). Todo en una transacción: compes y prescripción nunca divergen. */
export async function setComps(prisma: PrismaClient, athleteId: string, comps: Competencia[], today: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.competencia.deleteMany({ where: { athleteId } });
    if (comps.length > 0) {
      await tx.competencia.createMany({ data: comps.map((c) => ({ athleteId, name: c.name, week: c.week, date: c.date ?? null })) });
    }
    await reperiodizeFuture(tx, athleteId, comps, today);
  });
}

/**
 * v2 — re-periodización FUTURA-ONLY (invariante D8, CRITICAL). Cuando el coach cambia/agrega compes con
 * el atleta YA en marcha, re-instancia la prescripción a la forma nueva PERO sólo las semanas que es
 * seguro reescribir: estrictamente futuras y sin rastro inmutable. JAMÁS el `deleteMany` global —
 * el pasado, lo registrado y lo editado por el coach se preservan byte a byte (su `phaseKey` persistido
 * es su verdad). Coherente con la doctrina de `updateRms` (no re-instancia; el kg se deriva en lectura).
 * Sin plan / sin macro / sin `startDate` → no-op (no hay periodización anclada a fecha que recalcular).
 * Corre dentro de la transacción de `setComps` (lectura coherente de actuals/registros/ediciones).
 */
async function reperiodizeFuture(tx: Prisma.TransactionClient, athleteId: string, comps: Competencia[], today: string): Promise<void> {
  const planRow = await tx.plan.findUnique({ where: { athleteId } });
  if (!planRow) return;
  const macro = MACROCYCLES.find((m) => m.id === planRow.macroId);
  const start = planRow.startDate;
  if (!macro || start == null) return;

  // Forma nueva: semanas-hasta-cada-compe DERIVADAS de la fecha (verdad anclada a fecha), no del `week`.
  // Sin compes → buildAdaptivePlan natural → el futuro se ESTIRA de vuelta al largo del macro.
  const compWeeks = comps.map((c) => c.date).filter((d): d is string => d != null).map((d) => availableWeeksToComp(start, d));
  const totalWeeks = effectiveTotalWeeks(macro, compWeeks);
  const phasePlan = buildAdaptivePlan(macro, compWeeks);
  const phaseByWeek = new Map(phasePlan.map((p) => [p.week, p.phaseKey]));
  const newRowsByWeek = groupByWeek(instantiatePrescription(ALL_RECIPES, macro, totalWeeks, phasePlan));

  // currentWeek SIN clamp superior: recortar al largo NUEVO (más corto si la compe se acercó) ocultaría
  // semanas ya vividas → re-escribiría el pasado. `weekIndexUnclamped` = cuánto avanzó de verdad el atleta.
  const currentWeek = weekIndexUnclamped(start, today);

  // Rastro inmutable (D8): semanas con ≥1 actual (pueden ser backdated, §2b), ≥1 registro, o edición
  // manual del coach (cualquier sesión de la semana editada → se preserva la semana entera).
  const existing = await tx.prescribedExercise.findMany({ where: { athleteId }, select: { week: true, coachEdited: true } });
  const actualRows = await tx.sessionActual.findMany({ where: { athleteId }, select: { week: true } });
  const registroRows = await tx.sessionRegistro.findMany({ where: { athleteId }, select: { week: true } });
  const protectedWeeks = new Set<number>([
    ...actualRows.map((r) => r.week),
    ...registroRows.map((r) => r.week),
    ...existing.filter((r) => r.coachEdited).map((r) => r.week),
  ]);
  const candidateWeeks = [...new Set<number>([...existing.map((r) => r.week), ...newRowsByWeek.keys()])];

  // La regla pura (core) decide qué reescribir; acá sólo aplicamos delete+recreate sobre esas semanas.
  for (const week of reinstantiableWeeks({ candidateWeeks, currentWeek, protectedWeeks })) {
    await tx.prescribedExercise.deleteMany({ where: { athleteId, week } });
    const rows = newRowsByWeek.get(week) ?? []; // [] → semana más allá del plan nuevo: queda borrada (plan encogido).
    if (rows.length > 0) {
      await tx.prescribedExercise.createMany({ data: rows.map((r) => toPrescribedCreate(athleteId, r, phaseByWeek.get(week) ?? null)) });
    }
  }
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
  // Racha de bienestar: las últimas ~14 filas CON valores alcanzan para racha + guarda de frescura
  // (ventana ≥ ALERT_DAYS + margen). El offline (LocalMeClient) pasa TODO el historial y da el MISMO
  // resultado — wellnessStreak sólo camina días contiguos hacia atrás desde el más reciente y corta
  // por frescura; no "uniformar" a un solo findMany pensando que diverge.
  const recent = await prisma.dayLog.findMany({ where: { athleteId }, orderBy: { date: "desc" }, take: 14 });
  const headsUp = wellnessStreak(recent.map(toDayLog), today);
  return { entry: entry ? toDayLog(entry) : null, streak: computeStreak(days, today), days, today, headsUp };
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
  // Periodización ADAPTATIVA: las competencias persistidas (verdad anclada a fecha, tabla Competencia)
  // definen la forma del plan. Las semanas-hasta-cada-compe se DERIVAN contra el startDate del plan
  // (no se confía en el `week` guardado). Sin compes → plan natural (compatibilidad). Es instanciación
  // de ASIGNACIÓN (reset deliberado); re-periodizar al CAMBIAR compes luego = `reperiodizeFuture` (v2).
  const start = plan.startDate;
  const compRows = start != null ? await tx.competencia.findMany({ where: { athleteId } }) : [];
  const compWeeks = start != null
    ? compRows.map((c) => c.date).filter((d): d is string => d != null).map((d) => availableWeeksToComp(start, d))
    : [];
  const totalWeeks = macro ? effectiveTotalWeeks(macro, compWeeks) : 0;
  const phasePlan = macro ? buildAdaptivePlan(macro, compWeeks) : [];
  const phaseByWeek = new Map(phasePlan.map((p) => [p.week, p.phaseKey]));
  const rows: PrescriptionRow[] = macro ? instantiatePrescription(ALL_RECIPES, macro, totalWeeks, phasePlan) : [];
  await tx.prescribedExercise.deleteMany({ where: { athleteId } });
  if (rows.length > 0) {
    await tx.prescribedExercise.createMany({
      data: rows.map((r) => toPrescribedCreate(athleteId, r, phaseByWeek.get(r.week) ?? null)),
    });
  }
}

/** Fila PrescribedExercise lista para `createMany`, con la fase persistida (única fuente de verdad del
 *  read-path) y `coachEdited:false` (la instanciación/re-periodización jamás nace como edición manual). */
function toPrescribedCreate(athleteId: string, r: PrescriptionRow, phaseKey: string | null) {
  return {
    athleteId, week: r.week, sessionIdx: r.sessionIdx, order: r.order, movementId: r.movementId,
    sets: r.sets, reps: r.reps, pct: r.pct ?? null, kgOverride: r.kgOverride ?? null,
    flags: r.flags ?? [], notes: r.notes ?? null, phaseKey, coachEdited: false,
  };
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

/** Plan de fase-por-semana RECALCULADO desde las compes ACTUALES (`plan.comps`, ya cargadas por getPlan).
 *  v2: es sólo el FALLBACK del read-path — la verdad es el `phaseKey` PERSISTIDO de la prescripción
 *  (`phasePlanFromRows` para vistas multi-semana, `weekPhaseKey` para una semana). Este recálculo cubre
 *  únicamente las semanas sin phaseKey persistido (filas pre-migración 99). */
function adaptivePhasePlan(macro: Macrocycle | undefined, plan: Plan | undefined): { phaseKeyAt: (week: number) => string | undefined; totalWeeks: number } {
  if (!macro || !plan) return { phaseKeyAt: () => undefined, totalWeeks: 0 };
  const start = plan.startDate;
  const compWeeks = start != null
    ? plan.comps.map((c) => c.date).filter((d): d is string => d != null).map((d) => availableWeeksToComp(start, d))
    : [];
  const byWeek = new Map(buildAdaptivePlan(macro, compWeeks).map((p) => [p.week, p.phaseKey]));
  return { phaseKeyAt: (week) => byWeek.get(week), totalWeeks: effectiveTotalWeeks(macro, compWeeks) };
}

/** Fuente ÚNICA de la fase por semana para el read-path (heat/dayLayout): el `phaseKey` PERSISTIDO de
 *  las filas de cada semana (fijado al instanciar/re-periodizar). Así una semana del pasado PRESERVADA
 *  conserva SU fase aunque cambien las compes — cierra la brecha read-path↔prescripción de v1. Recae a
 *  `adaptivePhasePlan` (recalculado) sólo para semanas sin phaseKey persistido (filas pre-migración 99).
 *  `totalWeeks` = el mayor entre el rango persistido y el recalculado (cubre encoger/estirar coherente). */
function phasePlanFromRows(
  rows: readonly { week: number; phaseKey: string | null }[],
  macro: Macrocycle | undefined, plan: Plan | undefined,
): { phaseKeyAt: (week: number) => string | undefined; totalWeeks: number } {
  const persisted = new Map<number, string>();
  let maxWeek = 0;
  for (const r of rows) {
    if (r.phaseKey != null && !persisted.has(r.week)) persisted.set(r.week, r.phaseKey);
    if (r.week > maxWeek) maxWeek = r.week;
  }
  const fallback = adaptivePhasePlan(macro, plan);
  return {
    phaseKeyAt: (week) => persisted.get(week) ?? fallback.phaseKeyAt(week),
    totalWeeks: Math.max(maxWeek, fallback.totalWeeks),
  };
}

/** `phaseKey` PERSISTIDO de una semana (única fuente; null en filas pre-migración 99 → el caller recae
 *  al plan recalculado). Para los write-paths que necesitan el dayLayout AM/PM de UNA semana. */
async function weekPhaseKey(db: PrismaClient | Prisma.TransactionClient, athleteId: string, week: number): Promise<string | null> {
  const r = await db.prescribedExercise.findFirst({ where: { athleteId, week }, select: { phaseKey: true } });
  return r?.phaseKey ?? null;
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
  // Fase de la semana = `phaseKey` PERSISTIDO de sus filas (única fuente de verdad); recae al plan
  // recalculado sólo si la fila es pre-migración 99 (phaseKey null).
  const persistedKey = dbRows.find((r) => r.phaseKey != null)?.phaseKey ?? undefined;
  const phaseKey = persistedKey ?? adaptivePhasePlan(macro, plan).phaseKeyAt(week);
  const layout = macro ? dayLayoutFor(macro, week, phaseKey) : null;
  const registros = await prisma.sessionRegistro.findMany({ where: { athleteId, week } });
  // Secuencia de días: un día ANULADO no lleva fecha (no se entrenó) — sólo el flag `anulado`.
  const fechaByIdx = new Map(registros.filter((r) => r.estado !== "anulado").map((r) => [r.sessionIdx, r.fecha]));
  const anuladoIdx = new Set(registros.filter((r) => r.estado === "anulado").map((r) => r.sessionIdx));
  return mergeActuals(buildSessionViews(rows, plan.rms, barKg), actuals).map((v) => ({
    ...v,
    ...(layout?.[v.sessionIdx] ? layout[v.sessionIdx]! : {}),
    ...(fechaByIdx.has(v.sessionIdx) ? { fecha: fechaByIdx.get(v.sessionIdx)! } : {}),
    ...(anuladoIdx.has(v.sessionIdx) ? { anulado: true } : {}),
  }));
}

/**
 * Preview Prilepin (GET /athletes/:id/prilepin-week — COACH-ONLY). Genera la semana del MOTOR
 * (`prilepin.ts`) para un lift desde los datos REALES del atleta (RMs del plan + compe→countdown +
 * serie→ACWR/readiness), SIN persistir y SIN reemplazar la prescripción de recetas. Devuelve el
 * `EngineWeek` crudo (el coach ve pct/zonas/audits — HR-1) o `null` cuando no hay prescripción
 * honesta posible (sin plan, sin RM vigente, semana fuera de rango).
 */
export async function getPrilepinWeek(
  prisma: PrismaClient, athleteId: string, week: number, lift: RmLift,
): Promise<EngineWeek | null> {
  const plan = await getPlan(prisma, athleteId);
  if (!plan) return null; // sin plan → sin RM vigente → none honesto
  const macro = MACROCYCLES.find((m) => m.id === plan.macroId);
  const totalWeeks = macro ? (macro.phaseProfile[macro.phaseProfile.length - 1]?.weeks[1] ?? 0) : 0;
  if (totalWeeks === 0) return null;
  const series = await getSeries(prisma, athleteId); // undefined → sin ACWR/readiness (sin ajuste)
  return prilepinPreviewWeek({ lift, rms: plan.rms, requestedWeek: week, totalWeeks, comps: plan.comps, series });
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

/**
 * Mi Progreso · mapa de calor por día (rediseño 0110). Conecta fuentes REALES ya existentes — sin
 * migración ni captura nueva: carga (SessionActual.doneAt → tonelaje/día), bienestar+peso (DayLog),
 * recuperación (HRV/FC SEMANAL del macro mapeada al calendario). NUNCA expone RPE (HR-1). Siempre
 * devuelve la grilla (vacía si el atleta no tiene datos) — el "gris" es honesto, no se inventa.
 */
export async function getMeHeatDays(prisma: PrismaClient, athleteId: string, today: string): Promise<MeHeatDays> {
  const [plan, actualRows, dayRows, comps, series, athlete] = await Promise.all([
    getPlan(prisma, athleteId),
    prisma.sessionActual.findMany({ where: { athleteId } }),
    prisma.dayLog.findMany({ where: { athleteId } }),
    getComps(prisma, athleteId),
    getSeries(prisma, athleteId),
    prisma.athlete.findUnique({ where: { id: athleteId }, select: { weightBandLo: true, weightBandHi: true } }),
  ]);

  // ── carga por día: tonelaje de trabajo + nº de sesiones, agrupado por la fecha real (doneAt) ──
  const byDate = new Map<string, { kg: number; sessions: Set<string> }>();
  for (const r of actualRows) {
    const a = toSessionActual(r as SessionActualRow);
    if (!a.doneAt) continue;
    const kg = a.sets && a.sets.length > 0
      ? a.sets.reduce((s, set) => s + setTonnage(set), 0)
      : a.done && a.actualKg != null && a.actualReps != null ? a.actualKg * a.actualReps : 0;
    let e = byDate.get(a.doneAt);
    if (!e) { e = { kg: 0, sessions: new Set() }; byDate.set(a.doneAt, e); }
    e.kg += kg;
    e.sessions.add(`${a.week}-${a.sessionIdx}`);
  }
  const training: Record<string, { kg: number; sessions: number }> = {};
  for (const [iso, e] of byDate) training[iso] = { kg: Math.round(e.kg), sessions: e.sessions.size };

  // ── bienestar (score 0–100 de los 6 ítems) + peso, por día (DayLog) ──
  const daylogs = dayRows.map((r) => ({
    date: r.date,
    wellness: wellnessScore({ fatiga: r.fatiga, dolor: r.dolor, estres: r.estres, humor: r.humor, motivacion: r.motivacion, sueno: r.sueno }),
    bw: r.weight ?? null,
  }));

  const compDays = comps.filter((c) => c.date).map((c) => ({ iso: c.date!, name: c.name, note: `S${c.week}` }));
  const band: [number, number] | undefined =
    athlete?.weightBandLo != null && athlete.weightBandHi != null ? [athlete.weightBandLo, athlete.weightBandHi] : undefined;
  const macro = plan ? MACROCYCLES.find((m) => m.id === plan.macroId) : undefined;
  const totalWeeks = macro ? macro.phaseProfile[macro.phaseProfile.length - 1]?.weeks[1] : undefined;

  return buildMeHeatDays({
    today,
    startDate: plan?.startDate,
    totalWeeks,
    training,
    daylogs,
    comps: compDays,
    weekly: series ? { hrv: series.hrv, rhr: series.rhr } : undefined,
    hrvBase: series?.hrvBase,
    rhrBase: series?.rhrBase,
    weightBand: band,
    category: band ? `${Math.round(band[1])} kg` : undefined,
  });
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

// ── Día a día (slice lazo-diario, GET /athletes/:id/daily). Coach-only (el caller autoriza con
//    guardAthlete). Cierra el lazo atleta→coach: el check-in diario crudo + la adherencia
//    RECONCILIADA (actuals del atleta > mark manual del coach > none). JAMÁS toca el ciclo.
//    El CRITERIO (ventana/dedup/reconciliación) vive en core `buildDailyView` — espejo exacto del
//    repo Local (apps/web). Acá sólo se fetchan las filas y se mapean a la forma del input. ──

/**
 * Vista coach del lazo diario: los check-ins crudos del atleta de los últimos N días + la
 * adherencia reconciliada de las semanas recientes del plan. Los check-ins son independientes del
 * plan (se devuelven aunque no haya plan asignado); la adherencia es [] sin plan/macro (honesto).
 * El ciclo NO viaja por acá — sigue por `getCycle` (redactado).
 */
export async function getDailyView(
  prisma: PrismaClient, athleteId: string, today: string, windowWeeks: number = DAILY_WINDOW_WEEKS,
): Promise<AthleteDailyView> {
  const fromDate = dailyFromDate(today, windowWeeks);

  // Filas crudas (el filtrado/dedup/ventana de semanas lo aplica core). Los queries acotan por
  // fecha/semana sólo para no traer de más; core re-windowea con el mismo criterio (idempotente).
  const plan = await getPlan(prisma, athleteId);
  const [dayRows, presRows, actualRows, markRows] = await Promise.all([
    prisma.dayLog.findMany({ where: { athleteId, date: { gte: fromDate } } }),
    prisma.prescribedExercise.findMany({
      where: { athleteId }, select: { week: true, sessionIdx: true },
    }),
    prisma.sessionActual.findMany({ where: { athleteId } }),
    prisma.sessionMark.findMany({ where: { athleteId } }),
  ]);

  return buildDailyView({
    today,
    windowWeeks,
    macroId: plan?.macroId ?? null,
    startDate: plan?.startDate ?? null,
    dayLogs: dayRows.map((r) => ({
      date: r.date, fatiga: r.fatiga, dolor: r.dolor, estres: r.estres,
      humor: r.humor, motivacion: r.motivacion, sueno: r.sueno, weight: r.weight ?? undefined,
    })),
    prescription: presRows.map((r) => ({ week: r.week, sessionIdx: r.sessionIdx })),
    actuals: actualRows.map(toSessionActual),
    marks: markRows.map((m) => ({ week: m.week, idx: m.idx, status: m.status })),
  });
}

/** Per-day heat aggregate of the WHOLE plan (calendar heat map). [] if no plan/macro. Light
 *  select — no RM/kg derivation; athlete-safe payload (% + lift counts). Serves the coach
 *  (`/athletes/:id/heat`, guardAthlete) and the athlete self (`/me/heat`). */
export async function getPlanHeat(prisma: PrismaClient, athleteId: string): Promise<WeekHeat[]> {
  const plan = await getPlan(prisma, athleteId);
  if (!plan) return [];
  const macro = MACROCYCLES.find((m) => m.id === plan.macroId);
  const rows = await prisma.prescribedExercise.findMany({
    where: { athleteId },
    select: { week: true, sessionIdx: true, sets: true, reps: true, pct: true, phaseKey: true },
  });
  // Fase + rango salen del `phaseKey` PERSISTIDO de las filas (única fuente): el heat sigue la
  // prescripción real, no las compes (que podrían haber cambiado sin re-instanciar todo el pasado).
  const { phaseKeyAt, totalWeeks } = phasePlanFromRows(rows, macro, plan);
  if (totalWeeks === 0) return [];
  const layoutCache = new Map<number, ReturnType<typeof dayLayoutFor>>();
  const layoutOf = (week: number) => {
    if (!layoutCache.has(week)) layoutCache.set(week, macro ? dayLayoutFor(macro, week, phaseKeyAt(week)) : null);
    return layoutCache.get(week)!;
  };
  return planHeat(rows.map((r) => ({
    ...r, pct: r.pct ?? undefined,
    day: layoutOf(r.week)?.[r.sessionIdx]?.day,
  })), totalWeeks);
}

/** El conflicto de la regla 1×fecha, identificado (la ruta lo traduce a 409). */
export class FechaOcupadaError extends Error {
  constructor(public readonly conflicto: { week: number; sessionIdx: number; fecha: string }) {
    super("fecha_ocupada");
  }
}

/** Secuencia de días (2026-06-13): la sesión que se quiere completar/anular tiene días anteriores
 *  sin resolver en la misma semana (la ruta lo traduce a 409 `dia_bloqueado`). */
export class DiaBloqueadoError extends Error {
  constructor(public readonly faltan: number[]) {
    super("dia_bloqueado");
  }
}

/** Gate de secuencia de días: para completar/anular `sessionIdx`, todo día anterior de la semana
 *  debe estar resuelto (tener registro: hecho o anulado). Resuelto = existe SessionRegistro.
 *  `allIdxs` = sessionIdx distintos del plan en esa semana. Corre dentro de la tx (lectura coherente). */
async function assertDayUnlocked(
  tx: Prisma.TransactionClient, athleteId: string, week: number, sessionIdx: number, dayOf: DayOf,
): Promise<void> {
  const pres = await tx.prescribedExercise.findMany({
    where: { athleteId, week }, select: { sessionIdx: true }, distinct: ["sessionIdx"],
  });
  const allIdxs = pres.map((p) => p.sessionIdx);
  const regs = await tx.sessionRegistro.findMany({ where: { athleteId, week }, select: { sessionIdx: true } });
  const resolved = new Set(regs.map((r) => r.sessionIdx));
  const faltan = unresolvedPriorDays(allIdxs, (i) => resolved.has(i), dayOf, sessionIdx);
  if (faltan.length > 0) throw new DiaBloqueadoError(faltan);
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
  // Layout AM/PM desde el phaseKey PERSISTIDO de la semana (única fuente, §2b); recae al recalculado
  // sólo si la fila es pre-migración 99.
  const phaseKey = (await weekPhaseKey(prisma, athleteId, week)) ?? adaptivePhasePlan(macro, plan).phaseKeyAt(week);
  const layout = macro ? dayLayoutFor(macro, week, phaseKey) : null;
  // dayOf se deriva antes de la tx: TOCTOU inofensivo — si el coach re-asigna el macro en
  // vuelo, a lo sumo la excepción AM/PM de ESTA escritura usa el layout viejo (no corrompe).
  const dayOf: DayOf = (idx) => layout?.[idx]?.day ?? idx + 1;
  const summarized = actuals.map((a) => ({
    a, sum: a.sets && a.sets.length > 0 ? summarizeSets(a.sets) : { done: a.done, kg: a.kg, reps: a.reps },
  }));
  const anyDone = summarized.some(({ sum }) => sum.done);
  await prisma.$transaction(async (tx) => {
    if (anyDone) {
      // Secuencia de días: no se puede completar el día N sin los anteriores resueltos.
      await assertDayUnlocked(tx, athleteId, week, sessionIdx, dayOf);
      const registros = await tx.sessionRegistro.findMany({
        where: { athleteId, fecha }, select: { week: true, sessionIdx: true, fecha: true, estado: true },
      });
      const conflict = fechaConflict(
        registros.map((r) => ({ ...r, estado: r.estado as "hecho" | "anulado" })),
        week, sessionIdx, fecha, dayOf,
      );
      // Contrato público del conflicto = { week, sessionIdx, fecha } — `estado` es interno, no se filtra.
      if (conflict) throw new FechaOcupadaError({ week: conflict.week, sessionIdx: conflict.sessionIdx, fecha: conflict.fecha });
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
      // Completar SIEMPRE deja la sesión en 'hecho' (revierte un anulado previo, secuencia de días).
      await tx.sessionRegistro.upsert({
        where: { athleteId_week_sessionIdx: { athleteId, week, sessionIdx } },
        create: { athleteId, week, sessionIdx, fecha, estado: "hecho" },
        update: { fecha, estado: "hecho" },
      });
    } else {
      await tx.sessionRegistro.deleteMany({ where: { athleteId, week, sessionIdx } });
    }
  });
}

/** Secuencia de días (2026-06-13): ANULAR una sesión (el atleta falló/canceló). Transaccional.
 *  Gate-checked (los días anteriores deben estar resueltos). Borra las filas SessionActual (sin
 *  volumen) y marca el registro `estado="anulado"` (no ocupa fecha; `fecha` = hoy, irrelevante). */
export async function anularSession(
  prisma: PrismaClient, athleteId: string, week: number, sessionIdx: number, fecha: string,
): Promise<void> {
  const plan = await getPlan(prisma, athleteId);
  const macro = plan ? MACROCYCLES.find((m) => m.id === plan.macroId) : undefined;
  // Layout AM/PM desde el phaseKey PERSISTIDO de la semana (única fuente, §2b); recae al recalculado
  // sólo si la fila es pre-migración 99.
  const phaseKey = (await weekPhaseKey(prisma, athleteId, week)) ?? adaptivePhasePlan(macro, plan).phaseKeyAt(week);
  const layout = macro ? dayLayoutFor(macro, week, phaseKey) : null;
  // dayOf se deriva antes de la tx: TOCTOU inofensivo (mismo trato que setSessionActuals) — si el
  // coach re-asigna el macro en vuelo, a lo sumo la agrupación de días de ESTE anular usa el layout viejo.
  const dayOf: DayOf = (idx) => layout?.[idx]?.day ?? idx + 1;
  await prisma.$transaction(async (tx) => {
    await assertDayUnlocked(tx, athleteId, week, sessionIdx, dayOf);
    await tx.sessionActual.deleteMany({ where: { athleteId, week, sessionIdx } });
    await tx.sessionRegistro.upsert({
      where: { athleteId_week_sessionIdx: { athleteId, week, sessionIdx } },
      create: { athleteId, week, sessionIdx, fecha, estado: "anulado" },
      update: { fecha, estado: "anulado" },
    });
  });
}

/** Secuencia de días: DES-ANULAR (reactivar) — el atleta vuelve el día a pendiente. Sólo borra
 *  registros `anulado` (jamás un día hecho), así que es un no-op seguro sobre días ya completados. */
export async function desanularSession(
  prisma: PrismaClient, athleteId: string, week: number, sessionIdx: number,
): Promise<void> {
  await prisma.sessionRegistro.deleteMany({ where: { athleteId, week, sessionIdx, estado: "anulado" } });
}

/** Replace one session's exercises (coach edit). Transactional. Preserva el `phaseKey` persistido de la
 *  semana (tocar los ejercicios no cambia QUÉ fase es la semana) y MARCA `coachEdited` → la
 *  re-periodización futura-only no la pisa en silencio (invariante D8.3). */
export async function setSession(prisma: PrismaClient, athleteId: string, week: number, sessionIdx: number, exercises: PrescribedExercise[]): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const sibling = await tx.prescribedExercise.findFirst({ where: { athleteId, week }, select: { phaseKey: true } });
    const phaseKey = sibling?.phaseKey ?? null;
    await tx.prescribedExercise.deleteMany({ where: { athleteId, week, sessionIdx } });
    await tx.prescribedExercise.createMany({
      data: exercises.map((ex, order) => ({
        athleteId, week, sessionIdx, order, movementId: ex.movementId, sets: ex.sets, reps: ex.reps,
        pct: ex.pct ?? null, kgOverride: ex.kgOverride ?? null, flags: ex.flags ?? [], notes: ex.notes ?? null,
        phaseKey, coachEdited: true,
      })),
    });
  });
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

/** Historial de macrociclos cerrados (slice macro-history). Lee las filas, las ordena por ordinal y
 *  deja que core (macroHistoryView) derive nombre + adherencia % + agregados. Sirve coach Y atleta
 *  (el endpoint /me pasa el id propio). [] honesto sin historial. `rmEnd` inválido → omitido. */
export async function getMacroHistory(prisma: PrismaClient, athleteId: string): Promise<MacroHistoryView> {
  const rows = await prisma.macroHistory.findMany({ where: { athleteId }, orderBy: { ordinal: "asc" } });
  const mapped: MacroHistoryRow[] = rows.map((r) => {
    const rm = RMSchema.safeParse(r.rmEnd);
    return {
      macroId: r.macroId,
      ordinal: r.ordinal,
      startDate: r.startDate,
      endDate: r.endDate,
      weeks: r.weeks,
      sessionsDone: r.sessionsDone,
      sessionsTotal: r.sessionsTotal,
      rmEnd: rm.success ? rm.data : undefined,
    };
  });
  return macroHistoryView(mapped);
}

/** D3: everything the athlete owns, for a self-service data export (the athlete gets RAW cycle). */
export async function exportAthleteData(prisma: PrismaClient, athleteId: string): Promise<unknown> {
  const [athlete, plan, cycle, dayLogs, actuals, medals, comps, prescription, weeks, sessionMarks, rmUpdates, sessionRegistros, macroHistory] =
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
      // Slice macro-history: los ciclos cerrados del atleta también son su dato (D3).
      prisma.macroHistory.findMany({ where: { athleteId }, orderBy: { ordinal: "asc" } }),
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
  return { athlete, plan, cycle: cycleRaw, dayLogs, actuals, medals, comps, prescription, weeks, sessionMarks, rmUpdates, sessionRegistros, macroHistory };
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

// ── Competencias compartidas del coach (slice competencias 2026-06-14). El coach crea una compe
//    UNA vez y acopla atletas con rol; "pico" sincroniza la fila Competencia por-atleta (alimenta
//    el peaking existente vía competenciaForPico), "paso" no toca el plan. Todo coach-scoped; el
//    caller (routes) ya autorizó coach + vínculo activo de cada atleta. ──

/** startDate del plan + total de semanas del macro de un atleta (para anclar el pico). 0 sin plan/macro. */
async function planAnchor(prisma: PrismaClient, athleteId: string): Promise<{ startDate?: string; totalWeeks: number }> {
  const plan = await prisma.plan.findUnique({ where: { athleteId }, select: { macroId: true, startDate: true } });
  if (!plan) return { totalWeeks: 0 };
  const macro = MACROCYCLES.find((m) => m.id === plan.macroId);
  const totalWeeks = macro ? (macro.phaseProfile[macro.phaseProfile.length - 1]?.weeks[1] ?? 0) : 0;
  return { startDate: plan.startDate ?? undefined, totalWeeks };
}

/** Sincroniza la fila Competencia por-atleta de un acople "pico" (reusa el peaking). Borra la
 *  linkeada por competitionId y, si el atleta tiene plan anclado, la recrea con la semana derivada
 *  (competenciaForPico). Sin startDate/macro → queda sin fila (sin anclar hasta asignar macro). */
async function syncPicoCompetencia(
  prisma: PrismaClient, athleteId: string, competitionId: string, comp: { name: string; date: string },
): Promise<void> {
  const { startDate, totalWeeks } = await planAnchor(prisma, athleteId);
  const row = competenciaForPico(comp, startDate, totalWeeks);
  await prisma.competencia.deleteMany({ where: { athleteId, competitionId } });
  if (row) {
    await prisma.competencia.create({
      data: { athleteId, competitionId, name: row.name, week: row.week, date: row.date ?? null },
    });
  }
}

/** Catálogo de competencias del coach, con el conteo de acoplados por rol. Próximas/pasadas las
 *  ordena el cliente; acá orden por fecha asc. */
export async function getCompetitions(prisma: PrismaClient, coachId: string): Promise<CompetitionListItem[]> {
  const comps = await prisma.competition.findMany({
    where: { coachId },
    orderBy: { date: "asc" },
    include: { entries: { select: { role: true } } },
  });
  return comps.map((c) => ({
    id: c.id,
    name: c.name,
    date: c.date,
    place: c.place ?? undefined,
    athleteCount: c.entries.length,
    picoCount: c.entries.filter((e) => e.role === "pico").length,
    pasoCount: c.entries.filter((e) => e.role === "paso").length,
  }));
}

/** Detalle de una compe del coach + atletas acoplados (pico primero, luego por nombre). `peakWeek`
 *  derivado del plan para los "pico"; `result` presente sólo si ya se cargó (Fase 2). undefined si
 *  la compe no existe o no es del coach (el caller lo traduce a 404). */
export async function getCompetition(prisma: PrismaClient, coachId: string, id: string): Promise<CompetitionDetailView | undefined> {
  const c = await prisma.competition.findUnique({
    where: { id },
    include: { entries: { include: { athlete: { select: { nombre: true, iniciales: true } } } } },
  });
  if (!c || c.coachId !== coachId) return undefined;
  const entries: CompetitionEntryView[] = [];
  for (const e of c.entries) {
    let peakWeek: number | undefined;
    if (e.role === "pico") {
      const { startDate, totalWeeks } = await planAnchor(prisma, e.athleteId);
      peakWeek = competenciaForPico({ name: c.name, date: c.date }, startDate, totalWeeks)?.week;
    }
    const result =
      e.medal != null
        ? { medal: e.medal, cat: e.cat ?? "", sn: e.sn ?? 0, cj: e.cj ?? 0, place: e.place ?? "" }
        : undefined;
    entries.push({
      athleteId: e.athleteId,
      nombre: e.athlete.nombre,
      iniciales: e.athlete.iniciales,
      role: e.role,
      ...(peakWeek != null ? { peakWeek } : {}),
      ...(result ? { result } : {}),
    });
  }
  entries.sort((a, b) => (a.role === b.role ? a.nombre.localeCompare(b.nombre) : a.role === "pico" ? -1 : 1));
  return { id: c.id, name: c.name, date: c.date, place: c.place ?? undefined, entries };
}

/** Crea una compe del coach. Devuelve la fila creada (el cliente la valida con CompetitionSchema). */
export async function createCompetition(prisma: PrismaClient, coachId: string, input: CompetitionInput): Promise<Competition> {
  const c = await prisma.competition.create({
    data: { coachId, name: input.name, date: input.date, place: input.place ?? null },
  });
  return { id: c.id, name: c.name, date: c.date, place: c.place ?? undefined };
}

/** Edita la compe; re-sincroniza las filas Competencia "pico" linkeadas (la fecha/nombre pudo
 *  cambiar → la semana del pico se recalcula). false si no existe o no es del coach. */
export async function updateCompetition(prisma: PrismaClient, coachId: string, id: string, input: CompetitionInput): Promise<boolean> {
  const c = await prisma.competition.findUnique({ where: { id }, include: { entries: { where: { role: "pico" }, select: { athleteId: true } } } });
  if (!c || c.coachId !== coachId) return false;
  await prisma.competition.update({ where: { id }, data: { name: input.name, date: input.date, place: input.place ?? null } });
  for (const e of c.entries) {
    await syncPicoCompetencia(prisma, e.athleteId, id, { name: input.name, date: input.date });
  }
  return true;
}

/** Borra la compe (cascade borra las entries) + limpia las filas Competencia "pico" linkeadas
 *  (desancla el pico de cada atleta). false si no existe o no es del coach. */
export async function deleteCompetition(prisma: PrismaClient, coachId: string, id: string): Promise<boolean> {
  const c = await prisma.competition.findUnique({ where: { id }, select: { coachId: true } });
  if (!c || c.coachId !== coachId) return false;
  await prisma.$transaction([
    prisma.competencia.deleteMany({ where: { competitionId: id } }),
    prisma.competition.delete({ where: { id } }),
  ]);
  return true;
}

/** Acopla atletas (en lote) con rol. Upsert por (competitionId, athleteId) → re-acoplar cambia el
 *  rol. Sincroniza la fila Competencia "pico" o la borra ("paso"). El caller ya validó coach +
 *  vínculo activo de cada atleta. false si la compe no existe o no es del coach. */
export async function acoplarAtletas(prisma: PrismaClient, coachId: string, competitionId: string, entries: CompetitionEntryInput[]): Promise<boolean> {
  const c = await prisma.competition.findUnique({ where: { id: competitionId }, select: { coachId: true, name: true, date: true } });
  if (!c || c.coachId !== coachId) return false;
  for (const e of entries) {
    await prisma.competitionEntry.upsert({
      where: { competitionId_athleteId: { competitionId, athleteId: e.athleteId } },
      create: { competitionId, athleteId: e.athleteId, role: e.role },
      update: { role: e.role },
    });
    if (e.role === "pico") await syncPicoCompetencia(prisma, e.athleteId, competitionId, { name: c.name, date: c.date });
    else await prisma.competencia.deleteMany({ where: { athleteId: e.athleteId, competitionId } });
  }
  return true;
}

/** Desacopla un atleta: borra la entry + la fila Competencia linkeada (desancla el pico). false si
 *  la compe no existe o no es del coach. */
export async function desacoplarAtleta(prisma: PrismaClient, coachId: string, competitionId: string, athleteId: string): Promise<boolean> {
  const c = await prisma.competition.findUnique({ where: { id: competitionId }, select: { coachId: true } });
  if (!c || c.coachId !== coachId) return false;
  await prisma.$transaction([
    prisma.competencia.deleteMany({ where: { athleteId, competitionId } }),
    prisma.competitionEntry.deleteMany({ where: { competitionId, athleteId } }),
  ]);
  return true;
}
