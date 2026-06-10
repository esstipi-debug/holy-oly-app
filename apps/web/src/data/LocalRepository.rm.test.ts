import { describe, it, expect } from "vitest";
import type { Plan, SessionActual } from "@holy-oly/core";
import { LocalRepository } from "./LocalRepository";
import { MemStorage } from "../test-utils/MemStorage";

const PLAN: Plan = {
  atletaId: "x1", macroId: "ruso-5d", startWeek: 1, startDate: "2026-04-01",
  rms: { arranque: 80, envion: 100, sentadilla: 140, frente: 110 }, comps: [],
};

function setup(actuals: SessionActual[] = []) {
  const store = new MemStorage();
  store.setItem("ho:actuals:x1", JSON.stringify(actuals));
  const repo = new LocalRepository(store);
  return { repo, store };
}

describe("LocalRepository — SP5 RMs", () => {
  it("savePlan siembra 4 baselines (reason assign, setAt = startDate)", async () => {
    const { repo } = setup();
    await repo.savePlan(PLAN);
    const hist = await repo.getRmHistory("x1");
    expect(hist).toHaveLength(4);
    expect(hist.every((h) => h.reason === "assign" && h.setAt === "2026-04-01")).toBe(true);
    expect(hist.find((h) => h.lift === "sentadilla")!.kg).toBe(140);
  });

  it("updateRms mergea el plan + appendea historial SIN re-instanciar la prescripción", async () => {
    const { repo } = setup();
    await repo.savePlan(PLAN);
    // edición del coach que updateRms NO debe pisar:
    await repo.setSession("x1", 1, 0, [{ movementId: "sentadilla", sets: 5, reps: 5, pct: 70 }]);

    await repo.updateRms("x1", [{ lift: "sentadilla", kg: 160 }], "manual");

    const plan = (await repo.getPlan("x1"))!;
    expect(plan.rms.sentadilla).toBe(160);
    expect(plan.rms.arranque).toBe(80);

    const week = await repo.getPrescriptionWeek("x1", 1);
    const s0 = week.find((s) => s.sessionIdx === 0)!;
    expect(s0.exercises).toHaveLength(1); // la edición sobrevivió
    expect(s0.exercises[0]!.targetKg).toBe(112); // 70% de 160 — cascada

    const hist = await repo.getRmHistory("x1");
    expect(hist[0]).toMatchObject({ lift: "sentadilla", kg: 160, reason: "manual" }); // desc
    expect(hist).toHaveLength(5);
  });

  it("getPrCandidates: estricto > RM, desde los actuals del storage; [] sin plan", async () => {
    const { repo } = setup([
      { week: 1, sessionIdx: 0, order: 0, movementId: "arranque", done: true, actualKg: 85 },
      { week: 1, sessionIdx: 0, order: 1, movementId: "envion.tijera", done: true, actualKg: 100 }, // == RM → no
    ]);
    expect(await repo.getPrCandidates("x1")).toEqual([]); // sin plan → honesto
    await repo.savePlan(PLAN);
    const cands = await repo.getPrCandidates("x1");
    expect(cands).toHaveLength(1);
    expect(cands[0]).toMatchObject({ lift: "arranque", kg: 85 });
  });

  it("updateRms sin plan → rechaza (error), no escribe nada", async () => {
    const { repo } = setup();
    await expect(repo.updateRms("x1", [{ lift: "arranque", kg: 90 }], "manual")).rejects.toThrow();
    expect(await repo.getRmHistory("x1")).toEqual([]);
  });
});
