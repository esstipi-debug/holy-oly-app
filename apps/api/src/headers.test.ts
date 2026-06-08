import { describe, it, expect } from "vitest";
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
    const prevEnv = process.env.NODE_ENV;
    const prevOrigin = process.env.WEB_ORIGIN;
    process.env.NODE_ENV = "production";
    process.env.WEB_ORIGIN = "https://holy-oly.example"; // satisfy the CORS fail-fast
    const app = buildServer();
    await app.ready();
    try {
      const res = await app.inject({ method: "GET", url: "/health" });
      expect(String(res.headers["strict-transport-security"] ?? "")).toContain("max-age=31536000");
    } finally {
      await app.close();
      process.env.NODE_ENV = prevEnv;
      if (prevOrigin === undefined) delete process.env.WEB_ORIGIN;
      else process.env.WEB_ORIGIN = prevOrigin;
    }
  });
});
