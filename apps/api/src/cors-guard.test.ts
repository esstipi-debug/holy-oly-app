import { describe, it, expect } from "vitest";
import { buildServer } from "./server";

// C4 — credentialed CORS must never fall back to reflecting any Origin. In production, if Fastify
// isn't serving the SPA (SERVE_WEB) and no explicit WEB_ORIGIN is set, buildServer must fail fast.
describe("CORS fail-fast (C4)", () => {
  it("throws in production without SERVE_WEB or WEB_ORIGIN", () => {
    const env = process.env;
    const prev = { node: env.NODE_ENV, serve: env.SERVE_WEB, origin: env.WEB_ORIGIN };
    env.NODE_ENV = "production";
    delete env.SERVE_WEB;
    delete env.WEB_ORIGIN;
    try {
      expect(() => buildServer()).toThrow(/WEB_ORIGIN/);
    } finally {
      env.NODE_ENV = prev.node;
      if (prev.serve === undefined) delete env.SERVE_WEB;
      else env.SERVE_WEB = prev.serve;
      if (prev.origin === undefined) delete env.WEB_ORIGIN;
      else env.WEB_ORIGIN = prev.origin;
    }
  });
});
