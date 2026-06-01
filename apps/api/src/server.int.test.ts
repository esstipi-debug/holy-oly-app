import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "./server";
import { prisma } from "./db/client";

// INTEGRATION — requires a migrated + seeded Postgres (see apps/api/README.md).
// Excluded from the default unit run by the `*.int.test.ts` name; run with `pnpm test:int`.
describe("API integration (coach-scoped reads)", () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = buildServer();
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it("GET /roster returns the seeded coach's athletes", async () => {
    const res = await app.inject({ method: "GET", url: "/roster", headers: { "x-dev-coach": "coach-stub" } });
    expect(res.statusCode).toBe(200);
    const roster = res.json() as Array<{ id: string }>;
    expect(roster.length).toBeGreaterThan(0);
    expect(roster.some((a) => a.id === "mv")).toBe(true);
  });

  it("GET /athletes/mv/series returns Mara's 12-week series", async () => {
    const res = await app.inject({ method: "GET", url: "/athletes/mv/series", headers: { "x-dev-coach": "coach-stub" } });
    expect(res.statusCode).toBe(200);
    expect((res.json() as { weeks: number }).weeks).toBe(12);
  });

  it("GET /athletes/mv/cycle exposes the redacted context, never raw state", async () => {
    const res = await app.inject({ method: "GET", url: "/athletes/mv/cycle", headers: { "x-dev-coach": "coach-stub" } });
    expect(res.statusCode).toBe(200);
    const ctx = res.json() as Record<string, unknown>;
    expect(ctx).toHaveProperty("share");
    expect(ctx).toHaveProperty("health");
    expect(ctx).not.toHaveProperty("state"); // raw cycle state must never leak to a coach
  });

  it("denies a coach with no active Vinculo (tenant isolation)", async () => {
    const res = await app.inject({ method: "GET", url: "/athletes/mv/series", headers: { "x-dev-coach": "other-coach" } });
    expect(res.statusCode).toBe(403);
  });
});
