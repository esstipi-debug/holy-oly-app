import { describe, it, expect, beforeEach } from "vitest";
import type { Atleta, MonitorSeries, Plan, PrescriptionRow, DayLog } from "@holy-oly/core";
import { MemStorage } from "../test-utils/MemStorage";
import { JsonStore } from "./storage";
import { KEYS } from "./keys";
import { LocalMeClient } from "./LocalMeClient";
import { FechaOcupadaError } from "./fechaError";

const TODAY = "2026-06-06";
const ID = "kv";

const ROSTER: Atleta[] = [
  { id: "kv", nombre: "Kevin A.", iniciales: "KV", nivel: "intermediate", sexo: "M", compite: true, macroId: "ruso-5d" },
];
const PLAN: Plan = {
  atletaId: "kv", macroId: "ruso-5d", startWeek: 1,
  startDate: "2026-04-04", // 63 days before TODAY → currentWeek 10
  rms: { arranque: 98, envion: 122, sentadilla: 165, frente: 132 },
  comps: [{ name: "Sudamericano", week: 16 }],
};
const SERIES: MonitorSeries = {
  weeks: 12,
  acute: Array(12).fill(360), hrv: Array(12).fill(70), hrvBase: 70,
  rhr: Array(12).fill(50), rhrBase: 50, imr: Array(12).fill(78),
  wellness: Array(12).fill(82), recovery: Array(12).fill(85),
};
const RX: PrescriptionRow[] = [
  { week: 10, sessionIdx: 0, order: 0, movementId: "arranque", sets: 5, reps: 3, pct: 70 },
  { week: 10, sessionIdx: 0, order: 1, movementId: "sentadilla", sets: 5, reps: 5, pct: 75 },
];

function seed(store: MemStorage, opts: { dayLogs?: DayLog[] } = {}): void {
  const s = new JsonStore(store);
  s.set(KEYS.roster, ROSTER);
  s.set(KEYS.plan(ID), PLAN);
  s.set(KEYS.series(ID), SERIES);
  s.set(KEYS.prescription(ID), RX);
  if (opts.dayLogs) s.set(KEYS.dayLog(ID), opts.dayLogs);
}

const log = (date: string): DayLog => ({ date, fatiga: 2, dolor: 1, estres: 2, humor: 4, motivacion: 4, sueno: 4 });
const me = (store: MemStorage): LocalMeClient => new LocalMeClient(ID, store, () => TODAY);

describe("LocalMeClient", () => {
  let store: MemStorage;
  beforeEach(() => { store = new MemStorage(); });

  it("getMePlan anchors currentWeek to the plan's startDate", async () => {
    seed(store);
    const v = await me(store).getMePlan();
    expect(v.athlete.nombre).toBe("Kevin A.");
    expect(v.plan).not.toBeNull();
    expect(v.plan!.currentWeek).toBe(10);
    expect(v.plan!.totalWeeks).toBe(16);
    expect(v.plan!.comps).toEqual([{ name: "Sudamericano", week: 16 }]);
  });

  it("getMePlan throws when the athlete is absent (mirrors the API 404)", async () => {
    await expect(me(store).getMePlan()).rejects.toThrow(/no athlete/);
  });

  it("getMeSeries returns the stored series, undefined when absent", async () => {
    expect(await me(store).getMeSeries()).toBeUndefined();
    seed(store);
    expect((await me(store).getMeSeries())?.weeks).toBe(12);
  });

  it("getDayLog computes the streak from logged days as of today", async () => {
    seed(store, { dayLogs: [log("2026-06-04"), log("2026-06-05"), log("2026-06-06")] });
    const v = await me(store).getDayLog();
    expect(v.today).toBe(TODAY);
    expect(v.streak).toBe(3);
    expect(v.entry?.date).toBe("2026-06-06");
    expect(v.days).toHaveLength(3);
  });

  it("putDayLog upserts today's entry and recomputes the streak", async () => {
    seed(store, { dayLogs: [log("2026-06-05")] });
    const r = await me(store).putDayLog({ fatiga: 3, dolor: 2, estres: 2, humor: 4, motivacion: 5, sueno: 4 });
    expect(r.entry.date).toBe(TODAY);
    expect(r.streak).toBe(2); // 06-05 + 06-06
    // idempotent on the same day (no duplicate)
    await me(store).putDayLog({ fatiga: 1, dolor: 1, estres: 1, humor: 5, motivacion: 5, sueno: 5 });
    expect((await me(store).getDayLog()).days.filter((d) => d === TODAY)).toHaveLength(1);
  });

  it("getMeSessions derives kg from plan RMs; putMeSession records the top-set actual", async () => {
    seed(store);
    const before = await me(store).getMeSessions(10);
    expect(before).toHaveLength(1);
    expect(before[0]!.exercises[0]!.targetKg).toBe(69); // round(70% × 98)
    expect(before[0]!.exercises[0]!.actual).toBeUndefined();

    await me(store).putMeSession(10, 0, { actuals: [
      { order: 0, movementId: "arranque", done: true, sets: [{ kg: 70, reps: 3, done: true }, { kg: 74, reps: 2, done: true }] },
    ] });
    const after = await me(store).getMeSessions(10);
    expect(after[0]!.exercises[0]!.actual?.done).toBe(true);
    expect(after[0]!.exercises[0]!.actual?.kg).toBe(74); // top set
  });

  it("getMeSessions is [] without a plan", async () => {
    const s = new JsonStore(store);
    s.set(KEYS.roster, ROSTER); // athlete but no plan
    expect(await me(store).getMeSessions(10)).toEqual([]);
  });

  it("getMeRecorrido acumula LO HECHO real por semana (espejo del demo, jamás datos inventados)", async () => {
    seed(store);
    await me(store).putMeSession(10, 0, { actuals: [
      { order: 0, movementId: "arranque", done: true, sets: [{ kg: 70, reps: 3, done: true }, { kg: 74, reps: 2, done: true }] },
    ] });
    const r = await me(store).getMeRecorrido();
    expect(r.semanas).toHaveLength(16); // ruso-5d: todas las semanas del macro
    const w10 = r.semanas[9]!;
    expect(w10.week).toBe(10);
    expect(w10.trabajoKg).toBe(70 * 3 + 74 * 2); // 358
    expect(w10.calentamientoKg).toBeGreaterThan(0); // rampa prescrita del ejercicio hecho (regla 06-11)
    expect(w10.sesionesHechas).toBe(1);
    expect(w10.sesionesTotales).toBe(1); // el seed RX sólo tiene 1 sesión en la semana 10
    // semana sin registro NI prescripción → ceros honestos
    expect(r.semanas[0]).toEqual({ week: 1, trabajoKg: 0, calentamientoKg: 0, sesionesHechas: 0, sesionesTotales: 0 });
  });

  it("getMeRecorrido → { semanas: [] } sin plan (honesto)", async () => {
    const s = new JsonStore(store);
    s.set(KEYS.roster, ROSTER); // athlete but no plan
    expect(await me(store).getMeRecorrido()).toEqual({ semanas: [] });
  });

  it("degrades to empty when own-written localStorage is corrupt (validated reads)", async () => {
    seed(store);
    const s = new JsonStore(store);
    s.set(KEYS.dayLog(ID), [{ date: "2026-06-06", fatiga: 99 }]);       // out-of-range + missing fields
    s.set(KEYS.sessionActuals(ID), [{ week: 10, bogus: true }]);         // missing required fields

    const dl = await me(store).getDayLog();
    expect(dl.days).toEqual([]);
    expect(dl.streak).toBe(0);
    expect(dl.entry).toBeNull();

    const sessions = await me(store).getMeSessions(10); // plan intact → sessions, but actual dropped
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.exercises[0]!.actual).toBeUndefined();
  });

  it("regla 1×fecha en local (D1): segunda sesión el mismo día → FechaOcupadaError; otra fecha → ok", async () => {
    seed(store);
    const c = me(store);
    // sesión 0 de semana 10 queda registrada en TODAY (2026-06-06)
    await c.putMeSession(10, 0, { actuals: [{ order: 0, movementId: "arranque", done: true, kg: 60 }] });
    const views0 = await c.getMeSessions(10);
    expect(views0[0]!.fecha).toBe(TODAY);
    // sesión 10+0 también expone la fecha al editarse a sí misma (D12 — self-edit, no conflicto)
    await c.putMeSession(10, 0, { actuals: [{ order: 0, movementId: "arranque", done: true, kg: 62 }] });
    // nueva sesión en OTRA semana con el MISMO día → conflicto D1
    await expect(c.putMeSession(9, 0, { actuals: [{ order: 0, movementId: "arranque", done: true, kg: 55 }] }))
      .rejects.toBeInstanceOf(FechaOcupadaError);
    // nueva sesión en OTRA semana con OTRA fecha → ok
    await c.putMeSession(9, 0, { fecha: "2026-06-05", actuals: [{ order: 0, movementId: "arranque", done: true, kg: 55 }] });
    // confirmar que la semana 10 sesión 0 aún tiene su fecha original
    const views10 = await c.getMeSessions(10);
    expect(views10[0]!.fecha).toBe(TODAY);
  });

  it("actuals:[] libera la fecha en local (D11)", async () => {
    // Seed con dos sesiones en la semana 10 para poder verificar via getMeSessions
    const s = new JsonStore(store);
    s.set(KEYS.roster, ROSTER);
    s.set(KEYS.plan(ID), PLAN);
    const RX2: PrescriptionRow[] = [
      { week: 10, sessionIdx: 0, order: 0, movementId: "arranque", sets: 5, reps: 3, pct: 70 },
      { week: 10, sessionIdx: 1, order: 0, movementId: "sentadilla", sets: 5, reps: 5, pct: 75 },
    ];
    s.set(KEYS.prescription(ID), RX2);
    const c = me(store);
    // registrar sesión 0 en hoy
    await c.putMeSession(10, 0, { actuals: [{ order: 0, movementId: "arranque", done: true, kg: 60 }] });
    // borrar la sesión 0 (actuals vacíos libera el registro de fecha)
    await c.putMeSession(10, 0, { actuals: [] });
    // ahora sesión 1 puede tomar hoy (no hay conflicto porque la 0 ya no tiene registro de fecha)
    await c.putMeSession(10, 1, { actuals: [{ order: 0, movementId: "sentadilla", done: true, kg: 70 }] });
    const views = await c.getMeSessions(10);
    expect(views.find((v) => v.sessionIdx === 1)?.fecha).toBe(TODAY);
    // sesión 0 no tiene fecha (fue borrada)
    expect(views.find((v) => v.sessionIdx === 0)?.fecha).toBeUndefined();
  });
});
