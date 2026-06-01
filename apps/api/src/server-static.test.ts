import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";

// Single-service (SERVE_WEB) mode against a tiny temp SPA build: serves assets + falls back to
// index.html for client routes WITHOUT swallowing API routes. No DB query happens here — a dummy
// DATABASE_URL lets the Prisma client construct; static serving + the 401 path never connect.
describe("single-service static serving (SERVE_WEB)", () => {
  let app: FastifyInstance;
  let root: string;
  const prev = {
    SERVE_WEB: process.env.SERVE_WEB,
    WEB_DIST_PATH: process.env.WEB_DIST_PATH,
    DATABASE_URL: process.env.DATABASE_URL,
  };

  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), "holyoly-web-"));
    writeFileSync(join(root, "index.html"), "<!doctype html><title>Holy Oly</title><div id=root></div>");
    mkdirSync(join(root, "assets"));
    writeFileSync(join(root, "assets", "app.js"), "console.log('app')");
    process.env.SERVE_WEB = "true";
    process.env.WEB_DIST_PATH = root;
    process.env.DATABASE_URL ??= "postgresql://u:p@localhost:5432/holyoly";
    const { buildServer } = await import("./server");
    app = buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    rmSync(root, { recursive: true, force: true });
    process.env.SERVE_WEB = prev.SERVE_WEB;
    process.env.WEB_DIST_PATH = prev.WEB_DIST_PATH;
    if (prev.DATABASE_URL === undefined) delete process.env.DATABASE_URL;
  });

  it("serves the SPA shell at /", async () => {
    const res = await app.inject({ method: "GET", url: "/", headers: { accept: "text/html" } });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("Holy Oly");
  });

  it("serves built assets", async () => {
    const res = await app.inject({ method: "GET", url: "/assets/app.js" });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("console.log");
  });

  it("falls back to index.html for client routes", async () => {
    const res = await app.inject({ method: "GET", url: "/coach/a/mv", headers: { accept: "text/html" } });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("Holy Oly");
  });

  it("still serves API routes (401, not the SPA, for an unauthenticated read)", async () => {
    const res = await app.inject({ method: "GET", url: "/roster" });
    expect(res.statusCode).toBe(401);
  });
});
