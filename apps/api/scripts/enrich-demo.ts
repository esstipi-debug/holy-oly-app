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
import { DEMO_PLAN_INPUTS, DEMO_HISTORY_CFG } from "../prisma/seed-demo-data";
import { seedAthleteHistory } from "../prisma/seed-history";

const prisma = new PrismaClient();

const DEMO_IDS = ["mv", "ds", "lr", "sm", "ap", "kv"] as const;
const DEMO_COACH_EMAIL = "coach@holyoly.dev"; // el coach1 del seed (dueño de mv/ds/lr/sm/ap/np)

const DAY_MS = 86_400_000;
const isoDaysAgo = (n: number): string => new Date(Date.now() - n * DAY_MS).toISOString().slice(0, 10);

function totalWeeksOf(macroId: string): number {
  const macro = MACROCYCLES.find((m) => m.id === macroId);
  return macro ? (macro.phaseProfile[macro.phaseProfile.length - 1]?.weeks[1] ?? 0) : 0;
}

/** Limpia (scoped) y reconstruye plan + prescripción de un atleta demo. */
async function rebuildPlan(athleteId: string): Promise<void> {
  const input = DEMO_PLAN_INPUTS[athleteId];
  if (!input) return;
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

  const sexoById: Record<string, "M" | "F"> = { mv: "F", ds: "M", lr: "F", sm: "F", ap: "F", kv: "M" };
  let touched = 0;
  for (const id of DEMO_IDS) {
    const athlete = await prisma.athlete.findUnique({ where: { id } });
    if (!athlete) {
      console.log(`· ${id}: no existe en esta DB — se omite (sólo enriquecemos atletas demo ya sembrados).`);
      continue;
    }
    await rebuildPlan(id);
    const input = DEMO_PLAN_INPUTS[id];
    const cfg = DEMO_HISTORY_CFG[id];
    if (input && cfg) {
      await seedAthleteHistory(
        prisma,
        id,
        { macroId: input.macroId, startDate: isoDaysAgo((input.currentWeek - 1) * 7), startWeek: 1, rms: input.rms as RM, currentWeek: input.currentWeek },
        sexoById[id] ?? "M",
        cfg,
      );
    }
    touched++;
    console.log(`✓ ${id}: plan + prescripción + historial (${cfg?.adherences.length ?? 0} ciclos) + entrenos`);
  }

  await ensureNahuel(coachId);
  console.log(`✓ np (Nahuel P.): atleta sin RM vinculado al coach demo (dispara la alerta del Plantel)`);
  console.log(`\nEnriquecimiento demo completo: ${touched}/${DEMO_IDS.length} atletas + Nahuel. NADA fuera del demo fue tocado.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
