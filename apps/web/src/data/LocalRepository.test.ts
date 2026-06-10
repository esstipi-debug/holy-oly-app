import { beforeEach, describe, it, expect } from "vitest";
import { LocalRepository } from "./LocalRepository";
import type { Medal } from "@holy-oly/core";
import { KEYS } from "./keys";
import { MemStorage, seedCycle } from "../test-utils/MemStorage";

const medal: Medal = { comp: "Nacional", date: "2026-03-01", cat: "73kg", medal: "oro", sn: 90, cj: 115, place: "1" };

describe("LocalRepository", () => {
  let store: MemStorage;
  let repo: LocalRepository;
  beforeEach(() => { store = new MemStorage(); repo = new LocalRepository(store); repo.init(); });

  it("seeds a roster of 9 with Mara having a series", async () => {
    expect((await repo.getRoster())).toHaveLength(9);
    expect(await repo.getSeries("mv")).toBeDefined();
  });

  it("seeds the offline athlete Kevin with a plan, prescription and a year of check-ins", async () => {
    expect(await repo.getPlan("kv")).toBeDefined();
    expect((await repo.getSeries("kv"))?.weeks).toBe(52);
    expect((await repo.getPrescriptionWeek("kv", 12)).length).toBeGreaterThan(0);
  });

  it("getSeries is undefined for the no-data athlete (Tomás)", async () => {
    expect(await repo.getSeries("tl")).toBeUndefined();
  });

  it("getPlanHeat: todas las semanas del macro × 7 días; los días con sesión traen lifts; sin plan → []", async () => {
    const heat = await repo.getPlanHeat("kv");
    expect(heat.length).toBeGreaterThan(0);
    expect(heat.every((w) => w.days.length === 7)).toBe(true);
    const withSession = heat.flatMap((w) => w.days).filter((d) => d !== null);
    expect(withSession.length).toBeGreaterThan(0);
    expect(withSession.every((d) => d!.lifts > 0)).toBe(true);
    expect(await repo.getPlanHeat("tl")).toEqual([]);
  });

  it("init is idempotent: re-init does not clobber an added medal", async () => {
    await repo.addMedal("mv", medal);
    new LocalRepository(store).init(); // simulate refresh
    // 2 seeded medals + 1 added = 3; re-init is a no-op so the count must not go back to 2.
    expect(await repo.getMedals("mv")).toHaveLength(3);
  });

  it("cycle redaction: min→populated (luteal null), full→populated, amenorrhea→referral, none→undefined", async () => {
    const tomas = await repo.getCycleContext("tl");
    expect(tomas?.share).toBe("min");
    expect(tomas?.inLutealNow).toBeNull();
    expect(tomas?.health).toBe("ok");
    const mara = await repo.getCycleContext("mv");
    expect(mara?.share).toBe("full");
    expect(mara?.health).toBe("ok");
    seedCycle(store, "ds", "full", "amenorrhea");
    expect((await repo.getCycleContext("ds"))?.health).toBe("referral");
    seedCycle(store, "lr", "none", "regular");
    expect(await repo.getCycleContext("lr")).toBeUndefined();
  });

  it("corrupt JSON falls back instead of throwing", async () => {
    store.setItem("ho:roster", "{not json");
    await expect(repo.getRoster()).resolves.toBeInstanceOf(Array);
  });

  it("rejects structurally-invalid roster (valid JSON, wrong shape) and falls back to []", async () => {
    store.setItem(KEYS.roster, JSON.stringify([{ id: "x" }])); // missing required Atleta fields
    expect(await repo.getRoster()).toEqual([]);
  });

  it("rejects a malformed series and returns undefined (no NaN into the charts)", async () => {
    store.setItem(KEYS.series("mv"), JSON.stringify({ weeks: 12 })); // missing the numeric arrays
    expect(await repo.getSeries("mv")).toBeUndefined();
  });

  it("re-seeds when the stored seed version is stale (old boolean ho:seeded)", async () => {
    // Simulate an M3-era browser: seeded with the OLD boolean marker, no medals.
    const old = new MemStorage();
    old.setItem(KEYS.seeded, JSON.stringify(true));   // pre-versioning marker
    old.setItem(KEYS.roster, JSON.stringify([]));     // stale empty roster
    const repo2 = new LocalRepository(old);
    repo2.init();                                      // stale version → re-seed
    expect(await repo2.getRoster()).toHaveLength(9);
    expect(await repo2.getMedals("mv")).not.toHaveLength(0); // medals now seeded
  });

  it("does not re-seed when the stored version matches (idempotent refresh)", async () => {
    await repo.addMedal("mv", medal);                  // repo is seeded at the current version (beforeEach)
    new LocalRepository(store).init();                 // same version → no-op, must NOT clobber
    expect(await repo.getMedals("mv")).toHaveLength(3); // 2 seeded + 1 added survive
  });
});
