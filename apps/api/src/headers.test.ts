import { describe, it, expect, vi } from "vitest";
import { buildServer } from "./server";

// C1/C2 — security headers via @fastify/helmet. No DB needed (GET /health).
describe("security headers (C1/C2/C6)", () => {
  it("sets a restrictive CSP with the SPA's required style/font origins", async () => {
    const app = buildServer();
    await app.ready();
    try {
      const res = await app.inject({ method: "GET", url: "/health" });
      const csp = String(res.headers["content-security-policy"] ?? "");
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("https://fonts.googleapis.com"); // style-src for the Google Fonts @import
      expect(csp).toContain("https://fonts.gstatic.com"); // font-src
      expect(res.headers["x-frame-options"]).toBe("DENY");
      expect(res.headers["x-content-type-options"]).toBe("nosniff");
    } finally {
      await app.close();
    }
  });

  it("emits HSTS only in production", async () => {
    // A production boot now runs the billing prod-config guard (D2): it refuses to start in mock
    // mode so prod can never charge $0. Simulate a fully-configured production so the guard passes
    // and we can assert the HSTS header (the thing this test actually cares about).
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("WEB_ORIGIN", "https://holy-oly.example"); // satisfy the CORS fail-fast
    vi.stubEnv("BILLING_PROVIDER", "mercadopago");
    vi.stubEnv("MERCADOPAGO_ACCESS_TOKEN", "APP_USR-test-token");
    vi.stubEnv("MERCADOPAGO_WEBHOOK_SECRET", "test-webhook-secret");
    for (const key of [
      "MERCADOPAGO_PLAN_COACH_MONTHLY",
      "MERCADOPAGO_PLAN_COACH_SEMIANNUAL",
      "MERCADOPAGO_PLAN_PRO_MONTHLY",
      "MERCADOPAGO_PLAN_PRO_SEMIANNUAL",
      "MERCADOPAGO_PLAN_ELITE_MONTHLY",
      "MERCADOPAGO_PLAN_ELITE_SEMIANNUAL",
      "MERCADOPAGO_PLAN_BOX_MONTHLY",
      "MERCADOPAGO_PLAN_BOX_SEMIANNUAL",
    ]) {
      vi.stubEnv(key, "test-plan-id");
    }
    const app = buildServer();
    await app.ready();
    try {
      const res = await app.inject({ method: "GET", url: "/health" });
      expect(String(res.headers["strict-transport-security"] ?? "")).toContain("max-age=31536000");
    } finally {
      await app.close();
      vi.unstubAllEnvs();
    }
  });
});
