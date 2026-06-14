import { PrismaClient, Prisma } from "@prisma/client";
import { hash } from "@node-rs/argon2";
import type { MacrocycleLevel, MonitorSeries, RM } from "@holy-oly/core";
import { MACROCYCLES, ALL_RECIPES, instantiatePrescription, CYCLE_CONSENT_VERSION } from "@holy-oly/core";
import { seriesToRows } from "../src/db/mapping";
import { loadSeedConfig } from "./seed-guard";
import { encryptAtRest } from "../src/crypto-at-rest";
import {
  COACH1_ATHLETE_IDS,
  COACH2_ATHLETE_IDS,
  DEMO_MEDALS,
  DEMO_PLAN_INPUTS,
  DEMO_HISTORY_CFG,
  DEMO_SERIES,
  makeDayLogYear,
} from "./seed-demo-data";
import { EXTRA_GYMS, buildExtraAthletes, generateLongSeries, type GeneratedAthlete } from "./seed-demo-generate";
import { seedAthleteHistory } from "./seed-history";

const prisma = new PrismaClient();

const MONITOR_BATCH = 120;
const WELLNESS_BATCH = 400;

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

const ATHLETES: SeedAthlete[] = [
  { id: "mv", nombre: "Mara V.", iniciales: "MV", nivel: "intermediate", sexo: "F", compite: true, macroId: "ruso-5d", weightBandLo: 80, weightBandHi: 81 },
  { id: "ds", nombre: "Diego S.", iniciales: "DS", nivel: "intermediate", compite: true, macroId: "usa-intermedio" },
  { id: "lr", nombre: "Lucía R.", iniciales: "LR", nivel: "intermediate", sexo: "F", compite: true, macroId: "coreano-5d" },
  { id: "sm", nombre: "Sofía M.", iniciales: "SM", nivel: "advanced", sexo: "F", macroId: "bulgaro-6d" },
  { id: "tl", nombre: "Tomás L.", iniciales: "TL", nivel: "beginner" },
  { id: "ap", nombre: "Ana P.", iniciales: "AP", nivel: "intermediate", sexo: "F", macroId: "cubano-int-5d" },
  // Nahuel — recién sumado al plantel del coach1: SIN macro, SIN serie, SIN RM. Dispara la alerta
  // "Falta RM" en el Plantel (slice macro-history): sin RM el motor no puede prescribir.
  { id: "np", nombre: "Nahuel P.", iniciales: "NP", nivel: "beginner", sexo: "M" },
  { id: "bg", nombre: "Bruno G.", iniciales: "BG", nivel: "intermediate", macroId: "hibrido-5d" },
  { id: "cf", nombre: "Caro F.", iniciales: "CF", nivel: "intermediate", sexo: "F", macroId: "colombiano-5d" },
  { id: "kv", nombre: "Kevin A.", iniciales: "KV", nivel: "intermediate", sexo: "M", compite: true, macroId: "ruso-5d", weightBandLo: 80, weightBandHi: 82 },
];

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function coachForShowcaseAthlete(athleteId: string): "coach1" | "coach2" {
  if ((COACH2_ATHLETE_IDS as readonly string[]).includes(athleteId)) return "coach2";
  return "coach1";
}

async function seedMonitorSeries(athleteId: string, series: MonitorSeries): Promise<void> {
  const { weeks, items } = seriesToRows(series);
  for (let start = 0; start < weeks.length; start += MONITOR_BATCH) {
    const chunk = weeks.slice(start, start + MONITOR_BATCH);
    await prisma.monitorWeek.createMany({
      data: chunk.map((w) => ({
        athleteId,
        week: w.week,
        acute: w.acute,
        hrv: w.hrv,
        hrvBase: w.hrvBase,
        rhr: w.rhr,
        rhrBase: w.rhrBase,
        imr: w.imr,
        wellness: w.wellness,
        recovery: w.recovery,
        compliance: w.compliance,
        rpe: w.rpe,
        bodyweight: w.bodyweight,
      })),
    });
  }
  if (!items.length) return;
  const rows = await prisma.monitorWeek.findMany({
    where: { athleteId },
    select: { id: true, week: true },
  });
  const weekToId = new Map(rows.map((r) => [r.week, r.id]));
  const wellnessPayload = items
    .map((it) => {
      const monitorWeekId = weekToId.get(it.week);
      if (!monitorWeekId) return null;
      return { monitorWeekId, key: it.key, value: it.value };
    })
    .filter((x): x is { monitorWeekId: string; key: string; value: number } => x !== null);
  for (let start = 0; start < wellnessPayload.length; start += WELLNESS_BATCH) {
    await prisma.wellnessItem.createMany({ data: wellnessPayload.slice(start, start + WELLNESS_BATCH) });
  }
}

async function seedMedals(athleteId: string): Promise<void> {
  const medals = DEMO_MEDALS[athleteId];
  if (!medals?.length) return;
  await prisma.medal.createMany({
    data: medals.map((m) => ({ athleteId, comp: m.comp, date: m.date, cat: m.cat, medal: m.medal, sn: m.sn, cj: m.cj, place: m.place })),
  });
}

async function seedGeneratedMedals(a: GeneratedAthlete, idx: number): Promise<void> {
  if (!a.compite || idx % 4 === 3) return;
  const cat = a.sexo === "F" ? `−${a.weightBandLo ?? 64}` : `−${a.weightBandLo ?? 81}`;
  await prisma.medal.createMany({
    data: [
      {
        athleteId: a.id,
        comp: idx % 2 === 0 ? "Regional" : "Nacional",
        date: `202${5 + (idx % 2)}-${String((idx % 11) + 1).padStart(2, "0")}`,
        cat,
        medal: idx % 3 === 0 ? "oro" : idx % 3 === 1 ? "plata" : "bronce",
        sn: 70 + idx,
        cj: 90 + idx * 2,
        place: `${(idx % 3) + 1}º`,
      },
    ],
  });
}

async function seedPlanBundle(athleteId: string): Promise<void> {
  const input = DEMO_PLAN_INPUTS[athleteId];
  if (!input) return;
  const macro = MACROCYCLES.find((m) => m.id === input.macroId);
  if (!macro) return;
  const totalWeeks = macro.phaseProfile[macro.phaseProfile.length - 1]!.weeks[1];
  const weeksBack = (input.currentWeek - 1) * 7;
  await prisma.plan.create({
    data: {
      athleteId,
      macroId: input.macroId,
      startWeek: 1,
      startDate: isoDaysAgo(weeksBack),
      rms: input.rms as unknown as Prisma.InputJsonValue,
    },
  });
  for (const c of input.comps) {
    await prisma.competencia.create({ data: { athleteId, name: c.name, week: c.week } });
  }
  const presc = instantiatePrescription(ALL_RECIPES, macro, totalWeeks);
  await prisma.prescribedExercise.createMany({
    data: presc.map((r) => ({
      athleteId,
      week: r.week,
      sessionIdx: r.sessionIdx,
      order: r.order,
      movementId: r.movementId,
      sets: r.sets,
      reps: r.reps,
      pct: r.pct ?? null,
      kgOverride: r.kgOverride ?? null,
      flags: r.flags ?? [],
      notes: r.notes ?? null,
    })),
  });
}

async function seedLightPlan(a: GeneratedAthlete, idx: number): Promise<void> {
  const macro = MACROCYCLES.find((m) => m.id === a.macroId);
  if (!macro) return;
  const macroWeeks = macro.phaseProfile[macro.phaseProfile.length - 1]!.weeks[1];
  const currentWeek = Math.min(a.weekCount, Math.max(4, (idx % macroWeeks) + 1));
  const weeksBack = (currentWeek - 1) * 7;
  const rms: RM = {
    arranque: 65 + (idx % 25),
    envion: 85 + (idx % 30),
    sentadilla: 110 + (idx % 40),
    frente: 90 + (idx % 25),
  };
  await prisma.plan.create({
    data: {
      athleteId: a.id,
      macroId: a.macroId,
      startWeek: 1,
      startDate: isoDaysAgo(weeksBack),
      rms: rms as unknown as Prisma.InputJsonValue,
    },
  });
  if (a.compite) {
    await prisma.competencia.create({
      data: { athleteId: a.id, name: idx % 2 === 0 ? "Sudamericano" : "Panamericano", week: Math.min(macroWeeks, 16) },
    });
  }
}

async function seedDayLogs(athleteId: string, today: string): Promise<void> {
  const logs = makeDayLogYear(today);
  const BATCH = 200;
  for (let start = 0; start < logs.length; start += BATCH) {
    await prisma.dayLog.createMany({
      data: logs.slice(start, start + BATCH).map((l) => ({
        athleteId,
        date: l.date,
        fatiga: l.fatiga,
        dolor: l.dolor,
        estres: l.estres,
        humor: l.humor,
        motivacion: l.motivacion,
        sueno: l.sueno,
        weight: l.weight,
      })),
    });
  }
}

function showcaseSeries(): Record<string, MonitorSeries> {
  return {
    ...DEMO_SERIES,
    kv: generateLongSeries(500, 7),
  };
}

async function main(): Promise<void> {
  const cfg = loadSeedConfig();
  const extraAthletes = buildExtraAthletes();

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
    prisma.webhookEvent.deleteMany(),
    prisma.passwordResetToken.deleteMany(),
    prisma.emailVerificationToken.deleteMany(),
    prisma.subscription.deleteMany(),
    prisma.vinculo.deleteMany(),
    prisma.athlete.deleteMany(),
    prisma.coach.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  const coachUser = await prisma.user.create({
    data: {
      email: cfg.coachEmail,
      passwordHash: await hash(cfg.coachPassword),
      role: "coach",
      emailVerified: true,
    },
  });
  const coach = await prisma.coach.create({
    data: { id: cfg.coachId, userId: coachUser.id, name: "Coach Demo", inviteCode: cfg.coachInvite },
  });
  await prisma.subscription.create({
    data: {
      coachId: coach.id,
      provider: "mock",
      status: "active",
      currentPeriodEnd: new Date(Date.now() + 365 * 86400_000),
    },
  });

  const coach2User = await prisma.user.create({
    data: {
      email: cfg.coach2Email,
      passwordHash: await hash(cfg.coach2Password),
      role: "coach",
      emailVerified: true,
    },
  });
  const coach2 = await prisma.coach.create({
    data: { id: cfg.coach2Id, userId: coach2User.id, name: "Coach Ana L.", inviteCode: cfg.coach2Invite },
  });
  await prisma.subscription.create({
    data: {
      coachId: coach2.id,
      provider: "mock",
      status: "active",
      currentPeriodEnd: new Date(Date.now() + 365 * 86400_000),
    },
  });

  const extraCoaches: Array<{ gymKey: string; coachId: string }> = [];
  for (const gym of EXTRA_GYMS) {
    const user = await prisma.user.create({
      data: {
        email: gym.email,
        passwordHash: await hash(gym.password),
        role: "coach",
        emailVerified: true,
      },
    });
    const c = await prisma.coach.create({
      data: { userId: user.id, name: gym.name, inviteCode: gym.inviteCode },
    });
    await prisma.subscription.create({
      data: {
        coachId: c.id,
        provider: "mock",
        status: "active",
        currentPeriodEnd: new Date(Date.now() + 365 * 86400_000),
      },
    });
    extraCoaches.push({ gymKey: gym.key, coachId: c.id });
  }

  const coachIdByKey: Record<string, string> = {
    coach1: coach.id,
    coach2: coach2.id,
    ...Object.fromEntries(extraCoaches.map((c) => [c.gymKey, c.coachId])),
  };

  for (const a of ATHLETES) {
    await prisma.athlete.create({
      data: {
        id: a.id,
        nombre: a.nombre,
        iniciales: a.iniciales,
        nivel: a.nivel,
        sexo: a.sexo ?? "M",
        compite: a.compite ?? false,
        macroId: a.macroId ?? null,
        weightBandLo: a.weightBandLo ?? null,
        weightBandHi: a.weightBandHi ?? null,
      },
    });
    const ck = coachForShowcaseAthlete(a.id);
    await prisma.vinculo.create({ data: { coachId: coachIdByKey[ck]!, athleteId: a.id, estado: "activo" } });
    await prisma.cycleConsent.create({
      data: {
        athleteId: a.id,
        share: encryptAtRest(a.id === "mv" ? "full" : "min"),
        state: encryptAtRest("regular"),
        // PR-L2: las atletas demo ya consintieron (activadas) → la app muestra el registro, no el gate.
        consentedAt: new Date(),
        consentVersion: CYCLE_CONSENT_VERSION,
        // Slice ciclo-visible: Mara con registro (día ~20 de 28 → lútea hoy, demo visible).
        ...(a.id === "mv"
          ? {
              lastPeriodStart: encryptAtRest(new Date(Date.now() - 20 * 86_400_000).toISOString().slice(0, 10)),
              cycleLengthDays: encryptAtRest("28"),
            }
          : {}),
      },
    });
  }

  for (let i = 0; i < extraAthletes.length; i++) {
    const a = extraAthletes[i]!;
    await prisma.athlete.create({
      data: {
        id: a.id,
        nombre: a.nombre,
        iniciales: a.iniciales,
        nivel: a.nivel,
        sexo: a.sexo,
        compite: a.compite,
        macroId: a.macroId,
        weightBandLo: a.weightBandLo ?? null,
        weightBandHi: a.weightBandHi ?? null,
      },
    });
    await prisma.vinculo.create({
      data: { coachId: coachIdByKey[a.gymKey]!, athleteId: a.id, estado: "activo" },
    });
    await prisma.cycleConsent.create({
      data: {
        athleteId: a.id,
        share: encryptAtRest(i % 7 === 0 ? "full" : "min"),
        state: encryptAtRest(i % 11 === 0 ? "irregular" : "regular"),
        consentedAt: new Date(),
        consentVersion: CYCLE_CONSENT_VERSION,
      },
    });
  }

  const today = isoDaysAgo(0);
  for (const [athleteId, series] of Object.entries(showcaseSeries())) {
    await seedMonitorSeries(athleteId, series);
    await seedMedals(athleteId);
  }

  for (let i = 0; i < extraAthletes.length; i++) {
    const a = extraAthletes[i]!;
    const series = generateLongSeries(a.weekCount, i + 11);
    await seedMonitorSeries(a.id, series);
    await seedGeneratedMedals(a, i);
    await seedLightPlan(a, i);
  }

  // Vitrina con plan: prescripción + historial de ciclos cerrados + RM + entrenos con fecha del
  // ciclo en curso (slice macro-history). Antes sólo mv/kv tenían plan → el resto quedaba sin info.
  const SHOWCASE_PLANNED = ["mv", "ds", "lr", "sm", "ap", "kv"] as const;
  const sexoOf = (id: string): "M" | "F" => ATHLETES.find((a) => a.id === id)?.sexo ?? "M";
  for (const id of SHOWCASE_PLANNED) {
    await seedPlanBundle(id);
    const input = DEMO_PLAN_INPUTS[id];
    const cfg = DEMO_HISTORY_CFG[id];
    if (!input || !cfg) continue;
    await seedAthleteHistory(
      prisma,
      id,
      { macroId: input.macroId, startDate: isoDaysAgo((input.currentWeek - 1) * 7), startWeek: 1, rms: input.rms, currentWeek: input.currentWeek },
      sexoOf(id),
      cfg,
    );
  }

  const maraUser = await prisma.user.create({
    data: { email: cfg.maraEmail, passwordHash: await hash(cfg.maraPassword), role: "atleta", emailVerified: true },
  });
  await prisma.athlete.update({ where: { id: "mv" }, data: { userId: maraUser.id } });
  await seedDayLogs("mv", today);

  const kevinUser = await prisma.user.create({
    data: { email: cfg.kevinEmail, passwordHash: await hash(cfg.kevinPassword), role: "atleta", emailVerified: true },
  });
  await prisma.athlete.update({ where: { id: "kv" }, data: { userId: kevinUser.id } });
  await seedDayLogs("kv", today);

  const atletaUser = await prisma.user.create({
    data: { email: cfg.atletaEmail, passwordHash: await hash(cfg.atletaPassword), role: "atleta" },
  });
  await prisma.athlete.create({
    data: { id: "demo-atleta", nombre: "Demo Atleta", iniciales: "DA", nivel: "beginner", sexo: "M", userId: atletaUser.id },
  });

  const totalAthletes = ATHLETES.length + extraAthletes.length;
  const maxWeeks = Math.max(...extraAthletes.map((a) => a.weekCount), 500);
  console.log(
    `Seed complete: ${totalAthletes} athletes across ${2 + EXTRA_GYMS.length} gyms · ` +
      `showcase ${COACH1_ATHLETE_IDS.length}+${COACH2_ATHLETE_IDS.length} · ` +
      `+${extraAthletes.length} generated (histories up to ${maxWeeks} wks, ${MACROCYCLES.length} macrocycles) · ` +
      `logins: ${cfg.coachEmail}, ${cfg.coach2Email}, ${EXTRA_GYMS.map((g) => g.email).join(", ")} · ` +
      `${cfg.maraEmail}, ${cfg.kevinEmail}, ${cfg.atletaEmail}`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
