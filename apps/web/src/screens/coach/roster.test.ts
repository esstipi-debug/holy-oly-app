import { describe, it, expect } from "vitest";
import type { CellState, Repository, MonitorSeries, Atleta } from "@holy-oly/core";
import { LocalRepository } from "../../data/LocalRepository";
import { getRosterRows } from "./roster";

class MemStorage implements Storage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.get(k) ?? null; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  removeItem(k: string) { this.m.delete(k); }
  setItem(k: string, v: string) { this.m.set(k, v); }
}

describe("getRosterRows", () => {
  it("derives a row per athlete; the no-data athlete has undefined acwr/rec and cell none", async () => {
    const repo = new LocalRepository(new MemStorage()); repo.init();
    const rows = await getRosterRows(repo);
    expect(rows).toHaveLength(9);
    const tomas = rows.find((r) => r.id === "tl")!;
    expect(tomas.acwr).toBeUndefined();
    expect(tomas.rec).toBeUndefined();
    expect(tomas.cell).toBe("none");
    expect(tomas.history.every((c) => c === "none")).toBe(true);
    const mara = rows.find((r) => r.id === "mv")!;
    expect(mara.metodo).toBe("Ruso 5D");
    expect(typeof mara.acwr).toBe("number");
    expect(mara.history).toHaveLength(12);
  });

  it("pins the DERIVED current-week cell for every athlete (the triage headline)", async () => {
    const repo = new LocalRepository(new MemStorage()); repo.init();
    const rows = await getRosterRows(repo);
    const cellOf = (id: string) => rows.find((r) => r.id === id)!.cell;
    const expected: Record<string, CellState> = {
      mv: "warn", ds: "alert", lr: "ok", sm: "warn",
      tl: "none", ap: "ok", bg: "alert", cf: "ok",
    };
    for (const [id, cell] of Object.entries(expected)) {
      expect(cellOf(id), `athlete ${id} current-week cell`).toBe(cell);
    }
  });
});

describe("getRosterRows · readiness/trend/cat", () => {
  it("computa readiness, trend y cat (weightBand) por atleta", async () => {
    const s: MonitorSeries = {
      weeks: 5, acute: [60, 65, 70, 80, 95], hrv: [70, 70, 70, 70, 70], hrvBase: 70,
      rhr: [50, 50, 50, 50, 50], rhrBase: 50, imr: [70, 72, 74, 76, 78],
      wellness: [80, 80, 80, 80, 80], recovery: [85, 82, 80, 70, 60],
      bodyweight: [64, 64, 64, 64, 64], weightBand: [60, 64],
    };
    const atleta: Atleta = { id: "a1", nombre: "Mara V.", iniciales: "MV", nivel: "advanced", sexo: "F", macroId: "ruso-5d", compite: true };
    const repo = { getRoster: async () => [atleta], getSeries: async () => s, getRosterRisk: async () => ({}) } as unknown as Repository;
    const rows = await getRosterRows(repo);
    expect(rows[0]!.readiness).toBeGreaterThanOrEqual(0);
    expect(rows[0]!.readiness).toBeLessThanOrEqual(100);
    expect(typeof rows[0]!.trend).toBe("number");
    expect(rows[0]!.cat).toBe("64 kg");
  });
  it("atleta sin serie → readiness/trend/cat sin dato (undefined)", async () => {
    const atleta: Atleta = { id: "a2", nombre: "Caro F.", iniciales: "CF", nivel: "beginner", sexo: "F", compite: false };
    const repo = { getRoster: async () => [atleta], getSeries: async () => undefined, getRosterRisk: async () => ({}) } as unknown as Repository;
    const rows = await getRosterRows(repo);
    expect(rows[0]!.readiness).toBeUndefined();
    expect(rows[0]!.trend).toBeUndefined();
    expect(rows[0]!.cat).toBeUndefined();
  });
});
