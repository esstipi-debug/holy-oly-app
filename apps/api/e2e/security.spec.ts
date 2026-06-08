import { test, expect, request as apiRequest } from "@playwright/test";

const BASE = "http://127.0.0.1:8788";

// Seed (apps/api/prisma/seed.ts): coach demo + Mara (athleteId "mv", vínculo activo).
const COACH_EMAIL = "coach@holyoly.dev";
const COACH_PASSWORD = "holyoly-demo";

test.describe("E6 security E2E", () => {
  test("login (UI) → roster autenticado visible", async ({ page }) => {
    await page.goto("/");
    await page.locator('input[type="email"]').fill(COACH_EMAIL);
    await page.locator('input[type="password"]').fill(COACH_PASSWORD);
    await page.getByRole("button", { name: "Ingresar" }).click();
    // Post-login el coach ve su roster: Mara V. está sembrada.
    await expect(page.getByText("Mara V.")).toBeVisible({ timeout: 15_000 });
  });

  test("cross-coach read → 403 (aislamiento multi-tenant)", async () => {
    const ctx = await apiRequest.newContext({ baseURL: BASE });
    const signup = await ctx.post("/auth/signup", {
      data: {
        email: `e2e-coachB-${Date.now()}@x.dev`,
        password: "coachB-pass-1",
        role: "coach",
        name: "Coach B",
      },
    });
    expect(signup.status()).toBe(201); // coach B autenticado, SIN vínculo a Mara
    const res = await ctx.get("/athletes/mv/series");
    expect(res.status()).toBe(403); // guardAthlete: sin vínculo activo
    await ctx.dispose();
  });

  test("coach cycle read → redactado (sin state crudo)", async () => {
    const ctx = await apiRequest.newContext({ baseURL: BASE });
    const login = await ctx.post("/auth/login", {
      data: { email: COACH_EMAIL, password: COACH_PASSWORD },
    });
    expect(login.status()).toBe(200);
    const res = await ctx.get("/athletes/mv/cycle");
    expect(res.status()).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty("share");
    expect(body).not.toHaveProperty("state"); // redactCycle server-side
    await ctx.dispose();
  });

  test("headers de seguridad presentes (documento + API)", async () => {
    const ctx = await apiRequest.newContext({ baseURL: BASE });
    for (const path of ["/", "/health"]) {
      const res = await ctx.get(path);
      const h = res.headers();
      expect(h["content-security-policy"]).toContain("default-src 'self'");
      expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
      expect(h["x-frame-options"]).toBe("DENY");
      expect(h["x-content-type-options"]).toBe("nosniff");
      expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
      // HSTS NO se asegura acá: es prod-only (server.ts) y la suite corre no-prod. Lo cubre headers.test.ts.
    }
    await ctx.dispose();
  });
});
