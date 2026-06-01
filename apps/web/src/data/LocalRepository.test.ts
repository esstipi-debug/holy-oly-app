import { beforeEach, describe, it, expect } from "vitest";
import { LocalRepository } from "./LocalRepository";
import type { Medal } from "@holy-oly/core";
import { KEYS } from "./keys";

// In-memory Storage shim (no jsdom localStorage needed).
class MemStorage implements Storage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.get(k) ?? null; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  removeItem(k: string) { this.m.delete(k); }
  setItem(k: string, v: string) { this.m.set(k, v); }
}

const medal: Medal = { comp: "Nacional", date: "2026-03-01", cat: "73kg", medal: "oro", sn: 90, cj: 115, place: "1" };

describe("LocalRepository", () => {
  let store: MemStorage;
  let repo: LocalRepository;
  beforeEach(() => { store = new MemStorage(); repo = new LocalRepository(store); repo.init(); });

  it("seeds a roster of 8 with Mara having a series", async () => {
    expect((await repo.getRoster())).toHaveLength(8);
    expect(await repo.getSeries("mv")).toBeDefined();
  });

  it("getSeries is undefined for the no-data athlete (Tomás)", async () => {
    expect(await repo.getSeries("tl")).toBeUndefined();
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
    await repo.__setCycleForTest("ds", "full", "amenorrhea");
    expect((await repo.getCycleContext("ds"))?.health).toBe("referral");
    await repo.__setCycleForTest("lr", "none", "regular");
    expect(await repo.getCycleContext("lr")).toBeUndefined();
  });

  it("corrupt JSON falls back instead of throwing", async () => {
    store.setItem("ho:roster", "{not json");
    await expect(repo.getRoster()).resolves.toBeInstanceOf(Array);
  });

  it("re-seeds when the stored seed version is stale (old boolean ho:seeded)", async () => {
    // Simulate an M3-era browser: seeded with the OLD boolean marker, no medals.
    const old = new MemStorage();
    old.setItem(KEYS.seeded, JSON.stringify(true));   // pre-versioning marker
    old.setItem(KEYS.roster, JSON.stringify([]));     // stale empty roster
    const repo2 = new LocalRepository(old);
    repo2.init();                                      // stale version → re-seed
    expect(await repo2.getRoster()).toHaveLength(8);
    expect(await repo2.getMedals("mv")).not.toHaveLength(0); // medals now seeded
  });

  it("does not re-seed when the stored version matches (idempotent refresh)", async () => {
    await repo.addMedal("mv", medal);                  // repo is seeded at the current version (beforeEach)
    new LocalRepository(store).init();                 // same version → no-op, must NOT clobber
    expect(await repo.getMedals("mv")).toHaveLength(3); // 2 seeded + 1 added survive
  });
});
