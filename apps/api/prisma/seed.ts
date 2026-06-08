import { PrismaClient, Prisma } from "@prisma/client";
import { hash } from "@node-rs/argon2";
import type { MacrocycleLevel, MonitorSeries } from "@holy-oly/core";
import { MACROCYCLES, MACRO_RECIPES, instantiatePrescription } from "@holy-oly/core";
import { seriesToRows } from "../src/db/mapping";
import { loadSeedConfig } from "./seed-guard";

const prisma = new PrismaClient();

interface SeedAthlete {
  id: string;
  nombre: string;
  iniciales: string;
  nivel: MacrocycleLevel;
  sexo?: "M" | "F";
  compite?: boolean;
  macroId?: string;
  weightBandLo?: number;
  weightBandHi?: number;
}

// 8 athletes + the metodo->macroId mappings settled for M4c. Tomás (tl) has no series.
const ATHLETES: SeedAthlete[] = [
  { id: "mv", nombre: "Mara V.", iniciales: "MV", nivel: "intermediate", sexo: "F", compite: true, macroId: "ruso-5d", weightBandLo: 80, weightBandHi: 81 },
  { id: "ds", nombre: "Diego S.", iniciales: "DS", nivel: "intermediate", compite: true, macroId: "usa-intermedio" },
  { id: "lr", nombre: "Lucía R.", iniciales: "LR", nivel: "intermediate", sexo: "F", compite: true, macroId: "coreano-5d" },
  { id: "sm", nombre: "Sofía M.", iniciales: "SM", nivel: "advanced", sexo: "F", macroId: "bulgaro-6d" },
  { id: "tl", nombre: "Tomás L.", iniciales: "TL", nivel: "beginner" },
  { id: "ap", nombre: "Ana P.", iniciales: "AP", nivel: "intermediate", sexo: "F", macroId: "cubano-int-5d" },
  { id: "bg", nombre: "Bruno G.", iniciales: "BG", nivel: "intermediate", macroId: "hibrido-5d" },
  { id: "cf", nombre: "Caro F.", iniciales: "CF", nivel: "intermediate", sexo: "F", macroId: "colombiano-5d" },
];

// Mara — the full-instrumented showcase (12 weeks, ported from the prototype seeds).
// `recovery` is omitted: seriesToRows recomputes it via core on write.
const MARA: MonitorSeries = {
  weeks: 12,
  acute: [300, 320, 340, 300, 360, 380, 400, 320, 420, 700, 380, 340],
  hrv: [72, 71, 70, 73, 69, 70, 68, 72, 67, 62, 64, 69], hrvBase: 70,
  rhr: [49, 50, 50, 48, 51, 50, 52, 49, 53, 56, 54, 50], rhrBase: 50,
  imr: [66, 68, 70, 69, 76, 78, 80, 79, 86, 93, 88, 89],
  wellness: [82, 80, 78, 83, 74, 72, 70, 80, 66, 58, 62, 70],
  recovery: [],
  compliance: [95, 92, 98, 90, 94, 88, 96, 91, 85, 72, 90, 94],
  rpe: [7, 7, 8, 7, 8, 8, 9, 7, 9, 10, 8, 7],
  bodyweight: [81.2, 81.1, 80.9, 80.8, 80.9, 80.7, 80.6, 80.5, 80.6, 80.3, 80.4, 80.8],
  wellnessItems: {
    Fatiga: [2, 2, 3, 2, 3, 3, 4, 2, 4, 5, 3, 2],
    Dolor: [1, 2, 2, 1, 2, 2, 3, 2, 3, 4, 2, 2],
    Estrés: [2, 2, 2, 3, 3, 3, 3, 2, 4, 4, 3, 2],
    Humor: [4, 4, 4, 4, 3, 3, 3, 4, 2, 1, 3, 4],
    Motivación: [5, 5, 4, 4, 4, 4, 3, 4, 3, 2, 4, 5],
    Sueño: [4, 4, 4, 4, 3, 3, 3, 4, 2, 1, 3, 4],
  },
};

// Mara's competition RMs (from her palmarés: Arr 92 / Env 116) → drive kg = %×RM in the prescription.
const MARA_RMS = { arranque: 92, envion: 116, sentadilla: 150, frente: 122 };

// A natural 24-day check-in history for Mara (1-5 per item; mostly good with a couple of dips).
const DAY_PATTERNS = [
  { fatiga: 2, dolor: 1, estres: 2, humor: 4, motivacion: 5, sueno: 4, weight: 80.8 },
  { fatiga: 2, dolor: 2, estres: 2, humor: 4, motivacion: 4, sueno: 4, weight: 80.7 },
  { fatiga: 3, dolor: 2, estres: 3, humor: 3, motivacion: 4, sueno: 3, weight: 80.9 },
  { fatiga: 2, dolor: 1, estres: 2, humor: 5, motivacion: 5, sueno: 5, weight: 80.6 },
  { fatiga: 4, dolor: 3, estres: 3, humor: 3, motivacion: 3, sueno: 2, weight: 81.0 },
  { fatiga: 2, dolor: 2, estres: 2, humor: 4, motivacion: 4, sueno: 4, weight: 80.8 },
  { fatiga: 3, dolor: 2, estres: 2, humor: 4, motivacion: 5, sueno: 4, weight: 80.7 },
];

/** ISO YYYY-MM-DD `n` days before now (run-time, so the streak/heatmap align with the server clock). */
function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

async function main(): Promise<void> {
  // Resolve + validate seed config FIRST: refuses to run the destructive reset in production
  // unless ALLOW_DEMO_SEED=true, and requires explicit SEED_* secrets there (no demo defaults).
  const cfg = loadSeedConfig();

  // Dev-only reset so the seed is re-runnable. Children before parents (FK-safe).
  await prisma.$transaction([
    prisma.session.deleteMany(),
    prisma.prescribedExercise.deleteMany(),
    prisma.dayLog.deleteMany(),
    prisma.sessionMark.deleteMany(),
    prisma.wellnessItem.deleteMany(),
    prisma.monitorWeek.deleteMany(),
    prisma.medal.deleteMany(),
    prisma.competencia.deleteMany(),
    prisma.plan.deleteMany(),
    prisma.cycleConsent.deleteMany(),
    prisma.vinculo.deleteMany(),
    prisma.athlete.deleteMany(),
    prisma.coach.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  const coachUser = await prisma.user.create({
    data: { email: cfg.coachEmail, passwordHash: await hash(cfg.coachPassword), role: "coach" },
  });
  const coach = await prisma.coach.create({
    data: { id: cfg.coachId, userId: coachUser.id, name: "Coach Demo", inviteCode: cfg.coachInvite },
  });

  for (const a of ATHLETES) {
    await prisma.athlete.create({
      data: {
        id: a.id, nombre: a.nombre, iniciales: a.iniciales, nivel: a.nivel,
        sexo: a.sexo ?? "M",
        compite: a.compite ?? false, macroId: a.macroId ?? null,
        weightBandLo: a.weightBandLo ?? null, weightBandHi: a.weightBandHi ?? null,
      },
    });
    await prisma.vinculo.create({ data: { coachId: coach.id, athleteId: a.id, estado: "activo" } });
    await prisma.cycleConsent.create({
      data: { athleteId: a.id, share: a.id === "mv" ? "full" : "min", state: "regular" },
    });
  }

  // Mara's series → MonitorWeek rows (+ WellnessItem children) via the mapping.
  const { weeks, items } = seriesToRows(MARA);
  for (const w of weeks) {
    const wItems = items.filter((it) => it.week === w.week).map((it) => ({ key: it.key, value: it.value }));
    await prisma.monitorWeek.create({ data: { athleteId: "mv", ...w, items: { create: wItems } } });
  }

  await prisma.medal.createMany({
    data: [
      { athleteId: "mv", comp: "Nacional Absoluto", date: "2026-03", cat: "−81", medal: "oro", sn: 92, cj: 116, place: "1º" },
      { athleteId: "mv", comp: "Apertura Regional", date: "2025-11", cat: "−81", medal: "plata", sn: 88, cj: 110, place: "2º" },
    ],
  });

  // Mara's target competition (the M4c seed: Nacional at week 16).
  await prisma.competencia.create({ data: { athleteId: "mv", name: "Nacional", week: 16 } });

  // Mara's showcase athlete login + assigned plan + instantiated prescription + a check-in history,
  // so logging in as `mara@holyoly.dev` shows the athlete app fully populated. Roster stays 8 — mv
  // is already one of the seeded athletes; this only attaches a login and adds her own plan/daylogs.
  const maraUser = await prisma.user.create({
    data: { email: cfg.maraEmail, passwordHash: await hash(cfg.maraPassword), role: "atleta" },
  });
  await prisma.athlete.update({ where: { id: "mv" }, data: { userId: maraUser.id } });

  // Plan anchored ~7 weeks back → current week ≈ 8 (Fuerza básica); comp is the Nacional above.
  await prisma.plan.create({
    data: {
      athleteId: "mv", macroId: "ruso-5d", startWeek: 1, startDate: isoDaysAgo(49),
      rms: MARA_RMS as unknown as Prisma.InputJsonValue,
    },
  });

  // Instantiate Mara's prescription from the Ruso 5D recipe (kg = %×RM, derived on read).
  const ruso = MACROCYCLES.find((m) => m.id === "ruso-5d")!;
  const totalWeeks = ruso.phaseProfile[ruso.phaseProfile.length - 1]!.weeks[1];
  const presc = instantiatePrescription(MACRO_RECIPES, ruso, totalWeeks);
  await prisma.prescribedExercise.createMany({
    data: presc.map((r) => ({
      athleteId: "mv", week: r.week, sessionIdx: r.sessionIdx, order: r.order, movementId: r.movementId,
      sets: r.sets, reps: r.reps, pct: r.pct ?? null, kgOverride: r.kgOverride ?? null,
      flags: r.flags ?? [], notes: r.notes ?? null,
    })),
  });

  // 24 consecutive daily check-ins ending today → a streak + a filled constancia heatmap.
  for (let i = 0; i < 24; i++) {
    const p = DAY_PATTERNS[i % DAY_PATTERNS.length]!;
    await prisma.dayLog.create({ data: { athleteId: "mv", date: isoDaysAgo(i), ...p } });
  }

  // Demo athlete login (no Vínculo, empty → demo the join flow + the /me empty-state assertions).
  const atletaUser = await prisma.user.create({
    data: { email: cfg.atletaEmail, passwordHash: await hash(cfg.atletaPassword), role: "atleta" },
  });
  await prisma.athlete.create({
    data: { id: "demo-atleta", nombre: "Demo Atleta", iniciales: "DA", nivel: "beginner", sexo: "M", userId: atletaUser.id },
  });

  console.log(`Seed complete: coach + ${ATHLETES.length} athletes (Mara instrumented + login ${cfg.maraEmail}) + empty demo athlete login ${cfg.atletaEmail}.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
