import { describe, it, expect, vi, afterEach } from "vitest";
import * as vc from "./vinculoClient";

afterEach(() => vi.restoreAllMocks());

function res(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe("vinculoClient", () => {
  it("acceptCode posts {code} with credentials and returns estado", async () => {
    let seen: { method?: string; credentials?: string; body?: string } = {};
    global.fetch = vi.fn(async (_u: string, init: { method?: string; credentials?: string; body?: string }) => {
      seen = init;
      return res(201, { id: "v1", estado: "pendiente" });
    }) as unknown as typeof fetch;

    const r = await vc.acceptCode("HOLY-DEMO");
    expect(r.estado).toBe("pendiente");
    expect(seen.method).toBe("POST");
    expect(seen.credentials).toBe("include");
    expect(JSON.parse(seen.body ?? "{}")).toEqual({ code: "HOLY-DEMO" });
  });

  it("listVinculos returns the rows", async () => {
    global.fetch = vi.fn(async () =>
      res(200, [{ id: "v1", estado: "activo", athlete: { id: "mv", nombre: "Mara", iniciales: "MV" } }]),
    ) as unknown as typeof fetch;
    const rows = await vc.listVinculos();
    expect(rows[0]?.athlete.nombre).toBe("Mara");
  });

  it("rotateInvite returns the new code; errors surface the API message", async () => {
    global.fetch = vi.fn(async () => res(200, { inviteCode: "ABCD2345" })) as unknown as typeof fetch;
    expect((await vc.rotateInvite()).inviteCode).toBe("ABCD2345");

    global.fetch = vi.fn(async () => res(401, { error: "coach session required" })) as unknown as typeof fetch;
    await expect(vc.rotateInvite()).rejects.toThrow(/coach session required/);
  });
});
