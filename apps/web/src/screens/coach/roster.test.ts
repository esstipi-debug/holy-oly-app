import { describe, it, expect } from "vitest";
import type { CellState } from "@holy-oly/core";
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
    expect(rows).toHaveLength(8);
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
