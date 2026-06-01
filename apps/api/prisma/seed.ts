import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";
import type { MacrocycleLevel, MonitorSeries } from "@holy-oly/core";
import { seriesToRows } from "../src/db/mapping";

// Demo coach login (Fase 3). Surfaced so the front login demo + e2e can authenticate.
// Overridable via env so production never has to seed these committed defaults.
const COACH_EMAIL = (process.env.SEED_COACH_EMAIL ?? "coach@holyoly.dev").trim().toLowerCase();
const COACH_PASSWORD = process.env.SEED_COACH_PASSWORD ?? "holyoly-demo";
const COACH_INVITE = process.env.SEED_INVITE_CODE ?? "HOLY-DEMO";

const prisma = new PrismaClient();
const COACH_ID = process.env.DEV_COACH_ID ?? "coach-stub";

interface SeedAthlete {
  id: string;
  nombre: string;
  iniciales: string;
  nivel: MacrocycleLevel;
  compite?: boolean;
  macroId?: string;
  weightBandLo?: number;
  weightBandHi?: number;
}

// 8 athletes + the metodo->macroId mappings settled for M4c. Tomás (tl) has no series.
const ATHLETES: SeedAthlete[] = [
  { id: "mv", nombre: "Mara V.", iniciales: "MV", nivel: "intermediate", compite: true, macroId: "ruso-5d", weightBandLo: 80, weightBandHi: 81 },
  { id: "ds", nombre: "Diego S.", iniciales: "DS", nivel: "intermediate", compite: true, macroId: "usa-intermedio" },
  { id: "lr", nombre: "Lucía R.", iniciales: "LR", nivel: "intermediate", compite: true, macroId: "coreano-5d" },
  { id: "sm", nombre: "Sofía M.", iniciales: "SM", nivel: "advanced", macroId: "bulgaro-6d" },
  { id: "tl", nombre: "Tomás L.", iniciales: "TL", nivel: "beginner" },
  { id: "ap", nombre: "Ana P.", iniciales: "AP", nivel: "intermediate", macroId: "cubano-int-5d" },
  { id: "bg", nombre: "Bruno G.", iniciales: "BG", nivel: "intermediate", macroId: "hibrido-5d" },
  { id: "cf", nombre: "Caro F.", iniciales: "CF", nivel: "intermediate", macroId: "colombiano-5d" },
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

async function main(): Promise<void> {
  // Dev-only reset so the seed is re-runnable.
  await prisma.$transaction([
    prisma.session.deleteMany(),
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
    data: { email: COACH_EMAIL, passwordHash: await hash(COACH_PASSWORD), role: "coach" },
  });
  const coach = await prisma.coach.create({
    data: { id: COACH_ID, userId: coachUser.id, name: "Coach Demo", inviteCode: COACH_INVITE },
  });

  for (const a of ATHLETES) {
    await prisma.athlete.create({
      data: {
        id: a.id, nombre: a.nombre, iniciales: a.iniciales, nivel: a.nivel,
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

  console.log(`Seed complete: 1 coach, ${ATHLETES.length} athletes, Mara fully instrumented.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
