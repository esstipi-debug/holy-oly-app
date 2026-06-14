import { describe, it, expect } from "vitest";
import { LocalMeClient } from "./LocalMeClient";
import { LocalRepository } from "./LocalRepository";
import { MemStorage } from "../test-utils/MemStorage";

const daysAgo = (n: number): string => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

describe("LocalMeClient — ciclo (slice ciclo-visible)", () => {
  it("default honesto sin registro: share none, sin consentir (gate)", async () => {
    const me = new LocalMeClient("x9", new MemStorage());
    expect(await me.getMeCycle()).toEqual({ sexo: "F", share: "none", state: "regular", consented: false });
  });

  it("roundtrip put/get tras consentir + borrar campos al omitirlos", async () => {
    const store = new MemStorage();
    const me = new LocalMeClient("x9", store);
    const data = { share: "full" as const, state: "regular" as const, lastPeriodStart: daysAgo(10), cycleLengthDays: 28 };
    await me.putMeCycle(data, true); // 1ª activación → opt-in
    expect(await me.getMeCycle()).toEqual({ sexo: "F", ...data, consented: true });
    await me.putMeCycle({ share: "min", state: "regular" }); // editar, ya consentido
    expect(await me.getMeCycle()).toEqual({ sexo: "F", share: "min", state: "regular", consented: true });
  });

  it("input inválido rechaza (mirror del 400 del API)", async () => {
    const me = new LocalMeClient("x9", new MemStorage());
    await expect(me.putMeCycle({ share: "full", state: "regular", cycleLengthDays: 50 }, true)).rejects.toThrow();
  });

  it("desactivar borra el registro y vuelve a sin-consentir", async () => {
    const store = new MemStorage();
    const me = new LocalMeClient("x9", store);
    await me.putMeCycle({ share: "full", state: "regular" }, true);
    await me.deleteMeCycle();
    expect(await me.getMeCycle()).toEqual({ sexo: "F", share: "none", state: "regular", consented: false });
  });

  it("el chip del coach (LocalRepository) computa el lúteo REAL desde el seed de Mara", async () => {
    const repo = new LocalRepository(new MemStorage());
    repo.init(); // el seed es explícito (no corre en el constructor)
    // seed: día ~20 de 28 → lútea hoy
    expect(await repo.getCycleContext("mv")).toEqual({ share: "full", inLutealNow: true, health: "ok", reliable: true });
  });

  it("lo que registra la atleta del demo lo refleja el coach local (mismos keys)", async () => {
    const store = new MemStorage();
    const repo = new LocalRepository(store); // seedea
    const me = new LocalMeClient("kv", store);
    await me.putMeCycle({ share: "full", state: "regular", lastPeriodStart: daysAgo(2), cycleLengthDays: 28 }, true);
    // día 2 < 28−14 → no lútea
    expect(await repo.getCycleContext("kv")).toEqual({ share: "full", inLutealNow: false, health: "ok", reliable: true });
  });
});
