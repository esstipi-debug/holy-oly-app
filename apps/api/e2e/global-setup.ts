import EmbeddedPostgres from "embedded-postgres";
import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { handle } from "./server-handle";

const HERE = dirname(fileURLToPath(import.meta.url)); // apps/api/e2e
const API_DIR = resolve(HERE, ".."); // apps/api
const WEB_DIST = resolve(API_DIR, "..", "web", "dist"); // apps/web/dist
const PG_PORT = 5436;
const APP_PORT = 8788;
const DATA_DIR = resolve(API_DIR, ".pgdata-e2e-browser");
const DB_URL = `postgresql://holyoly:holyoly@127.0.0.1:${PG_PORT}/holyoly?schema=public`;

export default async function globalSetup(): Promise<void> {
  if (!existsSync(WEB_DIST)) {
    throw new Error(
      `[e2e] Falta ${WEB_DIST}. Corré: VITE_API_ENABLED=true pnpm --filter @holy-oly/web build`,
    );
  }

  rmSync(DATA_DIR, { recursive: true, force: true });
  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: "holyoly",
    password: "holyoly",
    port: PG_PORT,
    persistent: false,
    // Host locale (es-CL) would default the cluster to WIN1252 and break on chars like "−".
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
  });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("holyoly");

  const env = { ...process.env, DATABASE_URL: DB_URL };
  execSync("pnpm exec prisma migrate deploy", { cwd: API_DIR, env, stdio: "inherit" });
  execSync("pnpm exec tsx prisma/seed.ts", { cwd: API_DIR, env, stdio: "inherit" });

  // Same-origin single-service mode. NOT production: the session cookie is `secure` in prod and
  // would not travel over http → login would fail (same reason local-app.mjs deletes NODE_ENV).
  process.env.DATABASE_URL = DB_URL;
  process.env.SERVE_WEB = "true";
  process.env.WEB_DIST_PATH = WEB_DIST;
  delete process.env.NODE_ENV;

  const { buildServer } = await import("../src/server");
  const app = buildServer();
  await app.listen({ port: APP_PORT, host: "127.0.0.1" });

  handle.app = app;
  handle.pg = pg;
  handle.dataDir = DATA_DIR;
}
