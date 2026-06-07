import { describe, it, expect, vi, afterEach } from "vitest";
import * as me from "./httpMeClient";

describe("httpMeClient sessions", () => {
  afterEach(() => vi.restoreAllMocks());
  it("getMeSessions GETs ?week and parses; putMeSession PUTs the actuals", async () => {
    let seen = "";
    global.fetch = vi.fn(async (url: string, init?: { method?: string }) => {
      seen = `${init?.method ?? "GET"} ${url}`;
      if ((init?.method ?? "GET") === "GET") return { ok: true, status: 200, json: async () => [{ week: 1, sessionIdx: 0, exercises: [{ movementId: "arranque", sets: 5, reps: 3, pct: 70, movementName: "Arranque", targetKg: 56, actual: { done: true, kg: 58, movementId: "arranque", movementName: "Arranque", substituted: false, desfasado: false } }] }] } as Response;
      return { ok: true, status: 200, json: async () => ({ ok: true }) } as Response;
    }) as unknown as typeof fetch;
    const wk = await me.getMeSessions(1);
    expect(wk[0]!.exercises[0]!.actual?.kg).toBe(58);
    expect(seen).toContain("/me/sessions?week=1");
    await me.putMeSession(1, 0, [{ order: 0, movementId: "arranque", done: true, kg: 58, reps: 3 }]);
    expect(seen).toBe("PUT /me/session/1/0");
  });
});
