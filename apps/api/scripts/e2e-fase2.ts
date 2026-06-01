/**
 * Fase 2 end-to-end: the REAL HttpRepository (apps/web) driving the REAL Fastify API
 * against a real (embedded) Postgres. Proves the front↔API↔DB wiring, not just mocks.
 *
 * Run:  pnpm --filter @holy-oly/api e2e
 */
import EmbeddedPostgres from "embedded-postgres";
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

const PG_PORT = 5434;
const API_PORT = 8799;
const DATA_DIR = "./.pgdata-e2e";
const URL = `postgresql://holyoly:holyoly@localhost:${PG_PORT}/holyoly?schema=public`;

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(`E2E assertion failed: ${msg}`);
}

async function main(): Promise<void> {
  rmSync(DATA_DIR, { recursive: true, force: true });
  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR, user: "holyoly", password: "holyoly", port: PG_PORT,
    persistent: false, initdbFlags: ["--encoding=UTF8", "--locale=C"],
  });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("holyoly");

  const env = { ...process.env, DATABASE_URL: URL };
  execSync("pnpm exec prisma migrate deploy", { env, stdio: "inherit" });
  execSync("pnpm exec tsx prisma/seed.ts", { env, stdio: "inherit" });

  // Import AFTER DATABASE_URL is set (the Prisma client reads it at construction).
  process.env.DATABASE_URL = URL;
  const { buildServer } = await import("../src/server");
  const { HttpRepository } = await import("../../web/src/data/HttpRepository");

  const app = buildServer();
  await app.listen({ port: API_PORT, host: "127.0.0.1" });
  try {
    const repo = new HttpRepository(`http://127.0.0.1:${API_PORT}`);

    const roster = await repo.getRoster();
    assert(roster.length === 8, `roster length ${roster.length} (expected 8)`);
    assert(roster.some((a) => a.id === "mv"), "Mara in roster");

    const series = await repo.getSeries("mv");
    assert(series?.weeks === 12, `Mara series weeks ${series?.weeks} (expected 12)`);
    assert(series?.wellnessItems != null, "Mara wellnessItems present");

    const medals = await repo.getMedals("mv");
    assert(medals.length === 2, `Mara medals ${medals.length} (expected 2)`);

    const cycle = await repo.getCycleContext("mv");
    assert(cycle?.share === "full", `cycle share ${cycle?.share}`);
    assert(!Object.prototype.hasOwnProperty.call(cycle ?? {}, "state"), "raw cycle state NOT leaked");

    const share = await repo.getCycleShare("mv");
    assert(share === "full", `cycle share derived ${share}`);

    const missing = await repo.getSeries("tl"); // Tomás: no series
    assert(missing === undefined, "no-data athlete → undefined series");

    console.log("\n✅ Fase 2 e2e OK: HttpRepository ↔ live API ↔ Postgres");
    console.log(`   roster=${roster.length}, Mara series=12wk + wellnessItems, medals=2, cycle redacted (share=full, no state), tl series=undefined`);
  } finally {
    await app.close();
    await pg.stop();
    rmSync(DATA_DIR, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
