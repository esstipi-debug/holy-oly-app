import { describe, it, expect, vi, afterEach } from "vitest";
import * as client from "./authClient";

afterEach(() => vi.restoreAllMocks());

function res(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe("authClient", () => {
  it("me() → null on 401", async () => {
    global.fetch = vi.fn(async () => res(401, {})) as unknown as typeof fetch;
    expect(await client.me()).toBeNull();
  });

  it("me() → user on 200", async () => {
    global.fetch = vi.fn(async () => res(200, { id: "u1", role: "coach", coachId: "c1", athleteId: null })) as unknown as typeof fetch;
    expect((await client.me())?.role).toBe("coach");
  });

  it("login posts JSON with credentials and throws the API error message", async () => {
    let seen: { method?: string; credentials?: string } = {};
    global.fetch = vi.fn(async (_u: string, init: { method?: string; credentials?: string }) => {
      seen = init;
      return res(401, { error: "invalid credentials" });
    }) as unknown as typeof fetch;
    await expect(client.login("a@b.co", "x")).rejects.toThrow(/invalid credentials/);
    expect(seen.method).toBe("POST");
    expect(seen.credentials).toBe("include");
  });
});
