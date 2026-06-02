import type { Prisma, PrismaClient } from "@prisma/client";
import type {
  Atleta, MacrocycleLevel, MonitorSeries, Medal, Competencia, Plan, CycleContext, SessionLog,
} from "@holy-oly/core";
import { RMSchema } from "@holy-oly/core";
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
  await prisma.plan.upsert({ where: { athleteId }, create: { athleteId, ...data }, update: data });
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
