import { describe, it, expect, vi, afterEach } from "vitest";
import type { MonitorSeries } from "@holy-oly/core";
import { HttpRepository } from "./HttpRepository";

const BASE = "http://api.test";
const initsSeen: Array<{ credentials?: string }> = [];

function mock(status: number, body: unknown): typeof fetch {
  return vi.fn(async (_url: string, init?: { credentials?: string }) => {
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

  it("write methods throw until Fase 4", async () => {
    await expect(new HttpRepository(BASE).addMedal()).rejects.toThrow(/Fase 4/);
  });
});
