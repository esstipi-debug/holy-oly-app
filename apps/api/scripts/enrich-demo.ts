/**
 * Enriquecimiento NO-DESTRUCTIVO del demo (para producción). A diferencia de `prisma/seed.ts` (que
 * borra TODO y reinicia), este script SOLO toca los atletas demo conocidos — jamás coaches/atletas
 * reales. Idempotente: por cada atleta demo limpia y reconstruye su plan + prescripción + historial
 * de ciclos + RM + entrenos del ciclo en curso. Agrega "Nahuel P." (sin RM) si no existe.
 *
 * Correr (con DATABASE_URL apuntando a la DB destino):
 *   DATABASE_URL=... pnpm --filter @holy-oly/api enrich:demo
 *
 * Seguridad: aborta si no encuentra el coach demo (coach@holyoly.dev) → evita correr contra una DB
 * equivocada. Todos los deletes van SCOPED por athleteId (nunca un deleteMany global).
 */
import { PrismaClient, Prisma } from "@prisma/client";
import type { RM } from "@holy-oly/core";
import { MACROCYCLES, ALL_RECIPES, instantiatePrescription } from "@holy-oly/core";
import { DEMO_PLAN_INPUTS, DEMO_HISTORY_CFG, makeDayLogYear } from "../prisma/seed-demo-data";
import { seedAthleteHistory } from "../prisma/seed-history";

const prisma = new PrismaClient();

const DEMO_IDS = ["mv", "ds", "lr", "sm", "ap", "kv"] as const;
const DEMO_COACH_EMAIL = "coach@holyoly.dev"; // el coach1 del seed (dueño de mv/ds/lr/sm/ap/np)

interface PlanInput { macroId: string; currentWeek: number; rms: RM; comps: { name: string; week: number }[] }
interface HistoryCfg { adherences: number[]; rmStep: number }

/**
 * Atletas LEGACY del seed VIEJO de prod: el coach demo de prod tiene a Tomás/Bruno/Caro en su plantel
 * (antes del split coach1/coach2), sin plan → la alerta "Falta RM" los marcaba. NO van en el seed
 * canónico actual (donde bg/cf/tl son de coach2 / el no-data exemplar), por eso viven SOLO acá:
 * limpian prod sin cambiar el demo local. Si no existen en la DB destino, se omiten.
 */
const LEGACY_PLAN_INPUTS: Record<string, PlanInput> = {
  bg: { macroId: "hibrido-5d", currentWeek: 8, rms: { arranque: 80, envion: 102, sentadilla: 145, frente: 115 }, comps: [{ name: "Regional", week: 12 }] },
  cf: { macroId: "colombiano-5d", currentWeek: 7, rms: { arranque: 58, envion: 75, sentadilla: 100, frente: 80 }, comps: [{ name: "Apertura", week: 12 }] },
  tl: { macroId: "usa-principiante", currentWeek: 6, rms: { arranque: 45, envion: 58, sentadilla: 78, frente: 60 }, comps: [] },
};
const LEGACY_HISTORY_CFG: Record<string, HistoryCfg> = {
  bg: { adherences: [82, 84, 84], rmStep: 3 },
  cf: { adherences: [88, 90, 89], rmStep: 3 },
  tl: { adherences: [80, 82], rmStep: 2 },
};
const SEXO_BY_ID: Record<string, "M" | "F"> = { mv: "F", ds: "M", lr: "F", sm: "F", ap: "F", kv: "M", bg: "M", cf: "F", tl: "M" };

const DAY_MS = 86_400_000;
const isoDaysAgo = (n: number): string => new Date(Date.now() - n * DAY_MS).toISOString().slice(0, 10);
const TODAY = new Date().toISOString().slice(0, 10);

/** Siembra (scoped) un año de check-ins diarios HASTA HOY → alimenta el mapa de calor de Bienestar
 *  y Peso (Mi Progreso) + el radar de la Celebración (hoy vs promedio). Idempotente. */
async function rebuildDayLogs(athleteId: string): Promise<void> {
  await prisma.dayLog.deleteMany({ where: { athleteId } });
  const logs = makeDayLogYear(TODAY);
  await prisma.dayLog.createMany({
    data: logs.map((l) => ({
      athleteId, date: l.date,
      fatiga: l.fatiga, dolor: l.dolor, estres: l.estres, humor: l.humor, motivacion: l.motivacion, sueno: l.sueno,
      weight: l.weight ?? null,
    })),
  });
}

function totalWeeksOf(macroId: string): number {
  const macro = MACROCYCLES.find((m) => m.id === macroId);
  return macro ? (macro.phaseProfile[macro.phaseProfile.length - 1]?.weeks[1] ?? 0) : 0;
}

/** Limpia (scoped) y reconstruye plan + prescripción de un atleta demo. */
async function rebuildPlan(athleteId: string, input: PlanInput): Promise<void> {
  const macro = MACROCYCLES.find((m) => m.id === input.macroId);
  if (!macro) return;
  const totalWeeks = totalWeeksOf(input.macroId);
  const startDate = isoDaysAgo((input.currentWeek - 1) * 7);

  // Limpieza SCOPED — sólo de este atleta demo.
  await prisma.macroHistory.deleteMany({ where: { athleteId } });
  await prisma.rmUpdate.deleteMany({ where: { athleteId } });
  await prisma.sessionActual.deleteMany({ where: { athleteId } });
  await prisma.sessionRegistro.deleteMany({ where: { athleteId } });
  await prisma.prescribedExercise.deleteMany({ where: { athleteId } });
  await prisma.competencia.deleteMany({ where: { athleteId } });

  await prisma.plan.upsert({
    where: { athleteId },
    create: { athleteId, macroId: input.macroId, startWeek: 1, startDate, rms: input.rms as unknown as Prisma.InputJsonValue },
    update: { macroId: input.macroId, startWeek: 1, startDate, rms: input.rms as unknown as Prisma.InputJsonValue },
  });
  for (const c of input.comps) {
    await prisma.competencia.create({ data: { athleteId, name: c.name, week: c.week } });
  }
  const presc = instantiatePrescription(ALL_RECIPES, macro, totalWeeks);
  await prisma.prescribedExercise.createMany({
    data: presc.map((r) => ({
      athleteId, week: r.week, sessionIdx: r.sessionIdx, order: r.order, movementId: r.movementId,
      sets: r.sets, reps: r.reps, pct: r.pct ?? null, kgOverride: r.kgOverride ?? null, flags: r.flags ?? [], notes: r.notes ?? null,
    })),
  });
}

async function ensureNahuel(coachId: string): Promise<void> {
  const existing = await prisma.athlete.findUnique({ where: { id: "np" } });
  if (!existing) {
    await prisma.athlete.create({ data: { id: "np", nombre: "Nahuel P.", iniciales: "NP", nivel: "beginner", sexo: "M" } });
  }
  // Vínculo activo al coach demo (idempotente vía la unique [coachId, athleteId]).
  await prisma.vinculo.upsert({
    where: { coachId_athleteId: { coachId, athleteId: "np" } },
    create: { coachId, athleteId: "np", estado: "activo" },
    update: { estado: "activo" },
  });
}

async function main(): Promise<void> {
  const coachUser = await prisma.user.findUnique({ where: { email: DEMO_COACH_EMAIL }, include: { coach: true } });
  const coachId = coachUser?.coach?.id;
  if (!coachId) {
    throw new Error(`Coach demo (${DEMO_COACH_EMAIL}) no encontrado — abortando para no tocar una DB equivocada.`);
  }

  // Demo canónico (mv/ds/lr/sm/ap/kv) + legacy de prod (bg/cf/tl). Mismo tratamiento; los que no
  // existan en la DB destino se omiten (p.ej. los legacy NO están en el demo local → no se tocan).
  const entries: Array<{ id: string; input: PlanInput; cfg: HistoryCfg }> = [
    ...DEMO_IDS.flatMap((id) => {
      const input = DEMO_PLAN_INPUTS[id];
      const cfg = DEMO_HISTORY_CFG[id];
      return input && cfg ? [{ id, input, cfg }] : [];
    }),
    ...Object.keys(LEGACY_PLAN_INPUTS).flatMap((id) => {
      const input = LEGACY_PLAN_INPUTS[id];
      const cfg = LEGACY_HISTORY_CFG[id];
      return input && cfg ? [{ id, input, cfg }] : [];
    }),
  ];

  let touched = 0;
  for (const { id, input, cfg } of entries) {
    const athlete = await prisma.athlete.findUnique({ where: { id } });
    if (!athlete) {
      console.log(`· ${id}: no existe en esta DB — se omite (sólo enriquecemos atletas ya sembrados).`);
      continue;
    }
    await rebuildPlan(id, input);
    await seedAthleteHistory(
      prisma,
      id,
      { macroId: input.macroId, startDate: isoDaysAgo((input.currentWeek - 1) * 7), startWeek: 1, rms: input.rms, currentWeek: input.currentWeek },
      SEXO_BY_ID[id] ?? "M",
      cfg,
    );
    await rebuildDayLogs(id); // check-ins diarios → Bienestar/Peso (Mi Progreso) + radar (Celebración)
    touched++;
    console.log(`✓ ${id}: plan + prescripción + historial (${cfg.adherences.length} ciclos) + entrenos + check-ins`);
  }

  await ensureNahuel(coachId);
  console.log(`✓ np (Nahuel P.): atleta sin RM vinculado al coach demo (dispara la alerta del Plantel)`);
  console.log(`\nEnriquecimiento demo completo: ${touched} atletas + Nahuel. NADA fuera del demo fue tocado.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
