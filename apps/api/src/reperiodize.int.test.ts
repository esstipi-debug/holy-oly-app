import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "./db/client";
import * as repo from "./repo";
import { availableWeeksToComp } from "@holy-oly/core";

// INTEGRATION — periodización adaptativa v2: re-periodizar cuando el coach CAMBIA/agrega la compe
// DESPUÉS de que el atleta arrancó (ruta setComps). Invariante D8 (CRITICAL): sólo semanas
// estrictamente futuras, jamás pisando actuals/registros/ediciones del coach. `today` se controla
// directo (repo-level) para que el borde "futura vs vivida" sea determinístico. Requiere Postgres
// migrado (corre vía el harness verify).

const START = "2026-01-05";    // lunes
const TODAY = "2026-01-26";    // +21 días → semana 4 (weekIndexUnclamped) → futuro = sem 5+
const COMP_FAR = "2026-03-23"; // semana 12 (largo natural del coreano)
const COMP_NEAR = "2026-02-16"; // semana 7
const RMS = { arranque: 80, envion: 100, sentadilla: 140, frente: 110 };

let seq = 0;
async function freshAthlete(): Promise<string> {
  const id = `rp-${Date.now()}-${seq++}`;
  await prisma.athlete.create({ data: { id, nombre: "Reperiod", iniciales: "RP", nivel: "intermediate", compite: true } });
  return id;
}
/** Asigna coreano-5d anclado a START con una compe en `compDate`. setComps PRIMERO (la instanciación
 *  lee las compes persistidas), luego savePlan. */
async function assignCoreano(aId: string, compDate: string): Promise<void> {
  await repo.setComps(prisma, aId, [{ name: "C", week: 0, date: compDate }], TODAY);
  await repo.savePlan(prisma, aId, { atletaId: aId, macroId: "coreano-5d", startWeek: 1, startDate: START, rms: RMS, comps: [] }, TODAY);
}
/** week → { phaseKey persistido, nº de filas } de la prescripción del atleta. */
async function phaseByWeek(aId: string): Promise<Map<number, { phaseKey: string | null; count: number }>> {
  const rows = await prisma.prescribedExercise.findMany({ where: { athleteId: aId } });
  const m = new Map<number, { phaseKey: string | null; count: number }>();
  for (const r of rows) {
    const e = m.get(r.week) ?? { phaseKey: r.phaseKey, count: 0 };
    e.count++;
    m.set(r.week, e);
  }
  return m;
}
const maxWeek = (m: Map<number, unknown>): number => Math.max(...m.keys());

describe("Re-periodización futura-only al cambiar la compe (v2, invariante D8)", () => {
  afterAll(async () => { await prisma.$disconnect(); });

  it("sanity: las fechas de compe mapean a las semanas esperadas", () => {
    expect(availableWeeksToComp(START, COMP_FAR)).toBe(12);
    expect(availableWeeksToComp(START, COMP_NEAR)).toBe(7);
  });

  it("acercar la compe (12→7) re-periodiza SÓLO el futuro y encoge el plan", async () => {
    const aId = await freshAthlete();
    await assignCoreano(aId, COMP_FAR);
    let weeks = await phaseByWeek(aId);
    expect(maxWeek(weeks)).toBe(12);
    expect(weeks.get(4)!.phaseKey).toBe("cimentacion");

    await repo.setComps(prisma, aId, [{ name: "C", week: 0, date: COMP_NEAR }], TODAY);
    weeks = await phaseByWeek(aId);
    expect(maxWeek(weeks)).toBe(7); // sem 8..12 (futuras, libres) borradas
    expect(weeks.get(5)!.phaseKey).toBe("realizacion"); // sem 5 (futura) re-periodizada al nuevo plan
    expect(weeks.get(7)!.phaseKey).toBe("realizacion"); // pica en la fecha
  });

  it("jamás toca el pasado/presente: la semana en curso conserva SU fase persistida", async () => {
    const aId = await freshAthlete();
    await assignCoreano(aId, COMP_FAR);
    await repo.setComps(prisma, aId, [{ name: "C", week: 0, date: COMP_NEAR }], TODAY);
    const weeks = await phaseByWeek(aId);
    // Sem 3 y 4 eran cimentación (plan viejo) y son ≤ currentWeek(4) → intactas, AUNQUE el plan nuevo
    // las pondría en transformación. La fase PERSISTIDA es la única verdad del pasado (cierra la brecha
    // del read-path: jamás se recalcula la fase del pasado desde las compes actuales).
    expect(weeks.get(3)!.phaseKey).toBe("cimentacion");
    expect(weeks.get(4)!.phaseKey).toBe("cimentacion");
  });

  it("preserva una semana futura con ≥1 SessionActual (pueden ser backdated, §2b)", async () => {
    const aId = await freshAthlete();
    await assignCoreano(aId, COMP_FAR); // sem 6 = transformación (5-8)
    await prisma.sessionActual.create({
      data: { athleteId: aId, week: 6, sessionIdx: 0, order: 0, movementId: "arranque", done: true, actualKg: 60, actualReps: 3, doneAt: "2026-01-20" },
    });
    await repo.setComps(prisma, aId, [{ name: "C", week: 0, date: COMP_NEAR }], TODAY);
    const weeks = await phaseByWeek(aId);
    expect(weeks.get(6)!.phaseKey).toBe("transformacion"); // PRESERVADA (tenía actual)
    expect(weeks.get(5)!.phaseKey).toBe("realizacion"); // sem 5 (sin rastro) sí re-periodizada
  });

  it("preserva una semana futura con ≥1 SessionRegistro", async () => {
    const aId = await freshAthlete();
    await assignCoreano(aId, COMP_FAR); // sem 5 = transformación (5-8)
    await prisma.sessionRegistro.create({
      data: { athleteId: aId, week: 5, sessionIdx: 0, fecha: "2026-01-19", estado: "hecho" },
    });
    await repo.setComps(prisma, aId, [{ name: "C", week: 0, date: COMP_NEAR }], TODAY);
    const weeks = await phaseByWeek(aId);
    expect(weeks.get(5)!.phaseKey).toBe("transformacion"); // PRESERVADA (tenía registro)
  });

  it("preserva una edición manual del coach en semana futura (D8.3 — jamás pisar en silencio)", async () => {
    const aId = await freshAthlete();
    await assignCoreano(aId, COMP_FAR);
    await repo.setSession(prisma, aId, 6, 0, [{ movementId: "press-hombros", sets: 3, reps: 5 }]);
    await repo.setComps(prisma, aId, [{ name: "C", week: 0, date: COMP_NEAR }], TODAY);
    const s0 = await prisma.prescribedExercise.findMany({ where: { athleteId: aId, week: 6, sessionIdx: 0 }, orderBy: { order: "asc" } });
    expect(s0).toHaveLength(1);
    expect(s0[0]!.movementId).toBe("press-hombros"); // edición intacta
    expect(s0[0]!.coachEdited).toBe(true);
  });

  it("quitar todas las compes revierte el futuro al largo natural del macro", async () => {
    const aId = await freshAthlete();
    await assignCoreano(aId, COMP_NEAR); // 7 semanas
    expect(maxWeek(await phaseByWeek(aId))).toBe(7);
    await repo.setComps(prisma, aId, [], TODAY); // sin compes → buildAdaptivePlan natural (12)
    const weeks = await phaseByWeek(aId);
    expect(maxWeek(weeks)).toBe(12); // futuro estirado al natural
    expect(weeks.get(12)!.phaseKey).toBe("realizacion");
  });

  it("read-path coherente: getPlanHeat refleja el rango PERSISTIDO y getPrescriptionWeek lee el pasado preservado", async () => {
    const aId = await freshAthlete();
    await assignCoreano(aId, COMP_FAR);
    await repo.setComps(prisma, aId, [{ name: "C", week: 0, date: COMP_NEAR }], TODAY);
    const heat = await repo.getPlanHeat(prisma, aId);
    expect(heat.length).toBe(7); // el heat sigue la prescripción persistida (encogida), no la compe stale
    const week4 = await repo.getPrescriptionWeek(prisma, aId, 4); // semana preservada (cimentación)
    expect(week4.length).toBeGreaterThan(0);
  });
});
