import type { PrismaClient } from "@prisma/client";
import type {
  Atleta, MacrocycleLevel, MonitorSeries, Medal, Competencia, Plan, CycleContext,
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
  return cs.map((c) => ({ name: c.name, week: c.week }));
}

export async function getPlan(prisma: PrismaClient, athleteId: string): Promise<Plan | undefined> {
  const p = await prisma.plan.findUnique({ where: { athleteId } });
  if (!p) return undefined;
  const comps = await getComps(prisma, athleteId);
  // rms is a Json column (genuinely untyped at the DB) — validate it, don't cast.
  return { atletaId: p.athleteId, macroId: p.macroId, startWeek: p.startWeek, rms: RMSchema.parse(p.rms), comps };
}

/** Coach-facing cycle: the redacted projection only — raw consent never leaves the server. */
export async function getCycle(prisma: PrismaClient, athleteId: string): Promise<CycleContext | undefined> {
  const c = await prisma.cycleConsent.findUnique({ where: { athleteId } });
  if (!c) return undefined;
  return redactCycle(c.share, c.state);
}
