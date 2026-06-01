/**
 * Generate a Prisma migration without Docker (non-interactive): spin up a throwaway
 * embedded Postgres, apply the existing committed migrations, then `migrate diff` the
 * live DB against the schema to produce the new migration SQL. Writes it as a migration
 * folder and tears down.
 *
 * Run:  pnpm --filter @holy-oly/api exec tsx scripts/make-migration.ts <prefix> <name>
 *   e.g. ... make-migration.ts 1 auth   →  prisma/migrations/1_auth/migration.sql
 */
import EmbeddedPostgres from "embedded-postgres";
import { execSync } from "node:child_process";
import { rmSync, mkdirSync, writeFileSync } from "node:fs";

const PORT = 5435;
const DATA_DIR = "./.pgdata-migrate";
const URL = `postgresql://holyoly:holyoly@localhost:${PORT}/holyoly?schema=public`;
const prefix = process.argv[2] ?? "1";
const name = process.argv[3] ?? "migration";
const dir = `prisma/migrations/${prefix}_${name}`;

async function main(): Promise<void> {
  rmSync(DATA_DIR, { recursive: true, force: true });
  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR, user: "holyoly", password: "holyoly", port: PORT,
    persistent: false, initdbFlags: ["--encoding=UTF8", "--locale=C"],
  });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("holyoly");
  const env = { ...process.env, DATABASE_URL: URL };
  try {
    // Bring the throwaway DB to the latest committed migration, then diff schema → SQL.
    execSync("pnpm exec prisma migrate deploy", { env, stdio: "inherit" });
    const sql = execSync(
      `pnpm exec prisma migrate diff --from-url "${URL}" --to-schema-datamodel prisma/schema.prisma --script`,
      { env },
    ).toString();
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/migration.sql`, sql);
    console.log(`\n✅ Wrote ${dir}/migration.sql (${sql.split("\n").length} lines)`);
  } finally {
    await pg.stop();
    rmSync(DATA_DIR, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
