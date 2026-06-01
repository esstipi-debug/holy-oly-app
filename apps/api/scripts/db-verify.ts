/**
 * No-Docker verification: spin up a real Postgres via embedded-postgres, apply the
 * committed migration, seed, and run the integration tests against it, then tear down.
 * Lets Fase 1 be verified end-to-end on any machine without Docker / a system Postgres.
 *
 * Run:  pnpm --filter @holy-oly/api verify
 */
import EmbeddedPostgres from "embedded-postgres";
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

const PORT = 5433;
const DB = "holyoly";
const DATA_DIR = "./.pgdata-verify";
const URL = `postgresql://holyoly:holyoly@localhost:${PORT}/${DB}?schema=public`;

function run(cmd: string, env: NodeJS.ProcessEnv): void {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { stdio: "inherit", env });
}

async function main(): Promise<void> {
  rmSync(DATA_DIR, { recursive: true, force: true });
  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: "holyoly",
    password: "holyoly",
    port: PORT,
    persistent: false,
    // Force UTF8 to match production Postgres (the Windows host locale would otherwise
    // default the cluster to WIN1252, which can't store chars like U+2212 "−").
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
  });

  console.log("[verify] initialising embedded Postgres…");
  await pg.initialise();
  await pg.start();
  await pg.createDatabase(DB);
  console.log(`[verify] Postgres up on :${PORT}`);

  const env = { ...process.env, DATABASE_URL: URL };
  try {
    run("pnpm exec prisma migrate deploy", env);
    run("pnpm exec tsx prisma/seed.ts", env);
    run("pnpm exec vitest run --config vitest.int.config.ts", env);
    console.log("\n✅ Fase 1 verified against a real Postgres (embedded).");
  } finally {
    await pg.stop();
    rmSync(DATA_DIR, { recursive: true, force: true });
    console.log("[verify] Postgres stopped, data dir removed.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
