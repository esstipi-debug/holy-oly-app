import { beforeEach, describe, it, expect } from "vitest";
import { LocalRepository } from "./LocalRepository";
import { MemStorage } from "../test-utils/MemStorage";

describe("LocalRepository — competencias compartidas", () => {
  let repo: LocalRepository;
  beforeEach(() => { repo = new LocalRepository(new MemStorage()); repo.init(); });

  it("crea, lista y cuenta acoplados por rol", async () => {
    const c = await repo.createCompetition({ name: "Nacional", date: "2026-09-15", place: "Santiago" });
    expect(c.id).toBeTruthy();
    expect(await repo.getCompetitions()).toHaveLength(1);
    await repo.acoplarAtletas(c.id, [{ athleteId: "mv", role: "pico" }, { athleteId: "kv", role: "paso" }]);
    const list = await repo.getCompetitions();
    expect(list[0]!.athleteCount).toBe(2);
    expect(list[0]!.picoCount).toBe(1);
    expect(list[0]!.pasoCount).toBe(1);
  });

  it("detalle: el pico de un atleta con plan trae peakWeek; el paso no", async () => {
    const c = await repo.createCompetition({ name: "X", date: "2026-09-15" });
    await repo.acoplarAtletas(c.id, [{ athleteId: "kv", role: "pico" }]); // kv tiene plan en el seed
    const kv = (await repo.getCompetition(c.id))!.entries.find((e) => e.athleteId === "kv")!;
    expect(kv.role).toBe("pico");
    expect(typeof kv.peakWeek).toBe("number");
    await repo.acoplarAtletas(c.id, [{ athleteId: "kv", role: "paso" }]);
    expect((await repo.getCompetition(c.id))!.entries[0]!.peakWeek).toBeUndefined();
  });

  it("re-acoplar el mismo atleta cambia el rol sin duplicar", async () => {
    const c = await repo.createCompetition({ name: "X", date: "2026-09-15" });
    await repo.acoplarAtletas(c.id, [{ athleteId: "mv", role: "pico" }]);
    await repo.acoplarAtletas(c.id, [{ athleteId: "mv", role: "paso" }]);
    const d = (await repo.getCompetition(c.id))!;
    expect(d.entries).toHaveLength(1);
    expect(d.entries[0]!.role).toBe("paso");
  });

  it("desacoplar quita la entry", async () => {
    const c = await repo.createCompetition({ name: "X", date: "2026-09-15" });
    await repo.acoplarAtletas(c.id, [{ athleteId: "mv", role: "pico" }]);
    await repo.desacoplarAtleta(c.id, "mv");
    expect((await repo.getCompetition(c.id))!.entries).toHaveLength(0);
  });

  it("editar cambia nombre/fecha; borrar elimina", async () => {
    const c = await repo.createCompetition({ name: "X", date: "2026-09-15" });
    await repo.updateCompetition(c.id, { name: "Y", date: "2026-10-01" });
    const d = (await repo.getCompetition(c.id))!;
    expect(d.name).toBe("Y");
    expect(d.date).toBe("2026-10-01");
    await repo.deleteCompetition(c.id);
    expect(await repo.getCompetition(c.id)).toBeUndefined();
    expect(await repo.getCompetitions()).toHaveLength(0);
  });
});
