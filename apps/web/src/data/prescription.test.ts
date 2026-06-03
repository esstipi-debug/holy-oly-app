import { describe, it, expect, vi, afterEach } from "vitest";
import { LocalRepository } from "./LocalRepository";
import { HttpRepository } from "./HttpRepository";
import { MemStorage } from "../test-utils/MemStorage";
import type { Plan } from "@holy-oly/core";

const RMS = { arranque: 80, envion: 100, sentadilla: 140, frente: 110 };
const plan: Plan = { atletaId: "mv", macroId: "ruso-5d", startWeek: 1, startDate: "2026-04-01", rms: RMS, comps: [] };

describe("LocalRepository prescription", () => {
  it("savePlan instantiates the recipe; getPrescriptionWeek derives kg", async () => {
    const repo = new LocalRepository(new MemStorage());
    // seed a roster entry for mv so getPlan/getPrescription have an athlete context
    await repo.savePlan(plan);
    const week1 = await repo.getPrescriptionWeek("mv", 1);
    expect(week1.length).toBe(5);
    expect(week1[0]!.exercises[0]!.movementId).toBe("arranque");
    expect(week1[0]!.exercises[0]!.targetKg).toBe(54); // 68% of 80
  });
  it("setSession replaces one session", async () => {
    const repo = new LocalRepository(new MemStorage());
    await repo.savePlan(plan);
    await repo.setSession("mv", 1, 0, [{ movementId: "arranque.potencia", sets: 4, reps: 2, pct: 65 }]);
    const s0 = (await repo.getPrescriptionWeek("mv", 1)).find((s) => s.sessionIdx === 0)!;
    expect(s0.exercises).toHaveLength(1);
    expect(s0.exercises[0]!.movementId).toBe("arranque.potencia");
    expect((await repo.getPrescriptionWeek("mv", 1)).length).toBe(5);
    expect((await repo.getPrescriptionWeek("mv", 1)).find((s) => s.sessionIdx === 1)!.exercises.length).toBeGreaterThan(0);
  });
});

describe("HttpRepository prescription", () => {
  afterEach(() => vi.restoreAllMocks());
  it("getPrescriptionWeek GETs ?week and parses; setSession PUTs to /:week/:idx", async () => {
    let seen = "";
    global.fetch = vi.fn(async (url: string, init?: { method?: string }) => {
      seen = `${init?.method ?? "GET"} ${url}`;
      if ((init?.method ?? "GET") === "GET") return { ok: true, status: 200, json: async () => [{ week: 1, sessionIdx: 0, exercises: [{ movementId: "arranque", sets: 5, reps: 2, pct: 80, movementName: "Arranque", targetKg: 64 }] }] } as Response;
      return { ok: true, status: 200, json: async () => ({ ok: true }) } as Response;
    }) as unknown as typeof fetch;
    const repo = new HttpRepository("");
    const wk = await repo.getPrescriptionWeek("mv", 1);
    expect(wk[0]!.exercises[0]!.targetKg).toBe(64);
    expect(seen).toContain("/athletes/mv/prescription?week=1");
    await repo.setSession("mv", 1, 0, [{ movementId: "arranque", sets: 5, reps: 2, pct: 80 }]);
    expect(seen).toBe("PUT /athletes/mv/prescription/1/0");
  });
});
