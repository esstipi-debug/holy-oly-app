import { describe, it, expect, vi, afterEach } from "vitest";
import * as me from "./httpMeClient";

afterEach(() => vi.restoreAllMocks());

function res(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe("httpMeClient", () => {
  it("getMePlan parses the view (plan may be null)", async () => {
    global.fetch = vi.fn(async () => res(200, { athlete: { nombre: "Demo", iniciales: "DA", sexo: "F" }, plan: null })) as unknown as typeof fetch;
    expect((await me.getMePlan()).plan).toBeNull();
  });

  it("getMeSeries returns undefined on 404", async () => {
    global.fetch = vi.fn(async () => res(404, { error: "no series" })) as unknown as typeof fetch;
    expect(await me.getMeSeries()).toBeUndefined();
  });

  it("getDayLog parses the view", async () => {
    global.fetch = vi.fn(async () => res(200, { entry: null, streak: 0, days: [], today: "2026-06-03" })) as unknown as typeof fetch;
    const v = await me.getDayLog();
    expect(v.streak).toBe(0);
    expect(v.today).toBe("2026-06-03");
  });

  it("putDayLog PUTs the body with credentials and returns the result", async () => {
    let seen: { method?: string; credentials?: string; body?: string } = {};
    global.fetch = vi.fn(async (_u: string, init: { method?: string; credentials?: string; body?: string }) => {
      seen = init;
      return res(200, { entry: { date: "2026-06-03", fatiga: 2, dolor: 1, estres: 3, humor: 4, motivacion: 5, sueno: 4, weight: 80.8 }, streak: 1 });
    }) as unknown as typeof fetch;
    const r = await me.putDayLog({ fatiga: 2, dolor: 1, estres: 3, humor: 4, motivacion: 5, sueno: 4, weight: 80.8 });
    expect(r.streak).toBe(1);
    expect(seen.method).toBe("PUT");
    expect(seen.credentials).toBe("include");
    expect(JSON.parse(seen.body ?? "{}").fatiga).toBe(2);
  });

  it("surfaces the API error message on failure", async () => {
    global.fetch = vi.fn(async () => res(400, { error: "invalid daylog" })) as unknown as typeof fetch;
    await expect(me.putDayLog({ fatiga: 9, dolor: 1, estres: 3, humor: 4, motivacion: 5, sueno: 4 })).rejects.toThrow(/invalid daylog/);
  });

  it("getMeSeries rethrows non-404 errors", async () => {
    global.fetch = vi.fn(async () => res(401, { error: "unauthorized" })) as unknown as typeof fetch;
    await expect(me.getMeSeries()).rejects.toThrow(/unauthorized/);
  });

  it("getMePlan throws on error (e.g. expired session)", async () => {
    global.fetch = vi.fn(async () => res(401, { error: "unauthorized" })) as unknown as typeof fetch;
    await expect(me.getMePlan()).rejects.toThrow(/unauthorized/);
  });

  it("getMeRecorrido parses the wire shape (semanas per week)", async () => {
    global.fetch = vi.fn(async () => res(200, {
      semanas: [{ week: 1, trabajoKg: 240, calentamientoKg: 100, sesionesHechas: 1, sesionesTotales: 5 }],
    })) as unknown as typeof fetch;
    const r = await me.getMeRecorrido();
    expect(r.semanas).toHaveLength(1);
    expect(r.semanas[0]!.trabajoKg).toBe(240);
  });

  it("getMeRecorrido throws on error (e.g. expired session)", async () => {
    global.fetch = vi.fn(async () => res(401, { error: "unauthorized" })) as unknown as typeof fetch;
    await expect(me.getMeRecorrido()).rejects.toThrow(/unauthorized/);
  });
});
