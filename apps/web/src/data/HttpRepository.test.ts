import { describe, it, expect, vi, afterEach } from "vitest";
import type { MonitorSeries, Plan, Medal, Competencia, SessionLog } from "@holy-oly/core";
import { HttpRepository } from "./HttpRepository";

const BASE = "http://api.test";
const initsSeen: Array<{ method?: string; credentials?: string; body?: string }> = [];

function mock(status: number, body: unknown): typeof fetch {
  return vi.fn(async (_url: string, init?: { method?: string; credentials?: string; body?: string }) => {
    initsSeen.push(init ?? {});
    return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
  }) as unknown as typeof fetch;
}

afterEach(() => {
  initsSeen.length = 0;
  vi.restoreAllMocks();
});

const roster = [{ id: "mv", nombre: "Mara V.", iniciales: "MV", nivel: "intermediate", compite: true }];
const series: MonitorSeries = {
  weeks: 1, acute: [300], hrv: [70], hrvBase: 70, rhr: [50], rhrBase: 50, imr: [70], wellness: [80], recovery: [80],
};
const ctx = { share: "full", inLutealNow: false, health: "ok", reliable: true };

describe("HttpRepository", () => {
  it("getRoster hits /roster, sends the session cookie (credentials), and validates", async () => {
    global.fetch = mock(200, roster);
    const r = await new HttpRepository(BASE).getRoster();
    expect(r).toHaveLength(1);
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toBe(`${BASE}/roster`);
    expect(initsSeen[0]?.credentials).toBe("include");
  });

  it("getSeries returns undefined on 404", async () => {
    global.fetch = mock(404, { error: "no series" });
    expect(await new HttpRepository(BASE).getSeries("x")).toBeUndefined();
  });

  it("getSeries parses a 200 series", async () => {
    global.fetch = mock(200, series);
    expect((await new HttpRepository(BASE).getSeries("mv"))?.weeks).toBe(1);
  });

  it("getAthlete resolves from the roster", async () => {
    global.fetch = mock(200, roster);
    expect((await new HttpRepository(BASE).getAthlete("mv"))?.nombre).toBe("Mara V.");
  });

  it("getCycleShare derives from the cycle context (404 → none)", async () => {
    global.fetch = mock(200, ctx);
    expect(await new HttpRepository(BASE).getCycleShare("mv")).toBe("full");
    global.fetch = mock(404, {});
    expect(await new HttpRepository(BASE).getCycleShare("x")).toBe("none");
  });

  it("rejects a structurally-invalid response (validates at the boundary)", async () => {
    global.fetch = mock(200, [{ id: "x" }]);
    await expect(new HttpRepository(BASE).getRoster()).rejects.toThrow();
  });

  it("savePlan PUTs the plan to the athlete path (id from plan.atletaId, with credentials)", async () => {
    global.fetch = mock(200, { ok: true });
    const plan: Plan = {
      atletaId: "mv", macroId: "ruso-5d", startWeek: 1,
      rms: { arranque: 90, envion: 115, sentadilla: 150, frente: 120 }, comps: [],
    };
    await new HttpRepository(BASE).savePlan(plan);
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toBe(`${BASE}/athletes/mv/plan`);
    expect(initsSeen[0]?.method).toBe("PUT");
    expect(initsSeen[0]?.credentials).toBe("include");
    expect(JSON.parse(initsSeen[0]?.body ?? "{}")).toEqual(plan);
  });

  it("addMedal POSTs the medal to the medals path", async () => {
    global.fetch = mock(201, { ok: true });
    const medal: Medal = { comp: "Open", date: "2026-05", cat: "81kg", medal: "oro", sn: 90, cj: 115, place: "1º" };
    await new HttpRepository(BASE).addMedal("mv", medal);
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toBe(`${BASE}/athletes/mv/medals`);
    expect(initsSeen[0]?.method).toBe("POST");
    expect(JSON.parse(initsSeen[0]?.body ?? "{}")).toEqual(medal);
  });

  it("setComps PUTs the comps array to the comps path", async () => {
    global.fetch = mock(200, { ok: true });
    const comps: Competencia[] = [{ name: "Nacional", week: 16 }];
    await new HttpRepository(BASE).setComps("mv", comps);
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toBe(`${BASE}/athletes/mv/comps`);
    expect(initsSeen[0]?.method).toBe("PUT");
    expect(JSON.parse(initsSeen[0]?.body ?? "{}")).toEqual(comps);
  });

  it("getSessionLog GETs the sessions path and validates the log", async () => {
    const log = [{ week: 1, idx: 0, status: "done" }];
    global.fetch = mock(200, log);
    expect(await new HttpRepository(BASE).getSessionLog("mv")).toEqual(log);
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toBe(`${BASE}/athletes/mv/sessions`);
  });

  it("setSessionLog PUTs the log to the sessions path", async () => {
    global.fetch = mock(200, { ok: true });
    const log: SessionLog = [{ week: 2, idx: 1, status: "missed" }];
    await new HttpRepository(BASE).setSessionLog("mv", log);
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toBe(`${BASE}/athletes/mv/sessions`);
    expect(initsSeen[0]?.method).toBe("PUT");
    expect(JSON.parse(initsSeen[0]?.body ?? "[]")).toEqual(log);
  });

  it("a failed write throws HttpError", async () => {
    global.fetch = mock(403, { error: "forbidden" });
    await expect(new HttpRepository(BASE).setComps("mv", [])).rejects.toThrow();
  });
});
