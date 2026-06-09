#!/usr/bin/env node
/**
 * Re-seed the Holy Oly desktop demo Postgres (C:\HolyOlyDemo\pgdata).
 * Stop local-app.mjs first if the DB is locked.
 *
 *   node apps/api/scripts/seed-local.mjs
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, "..");
const PG_PORT = Number(process.env.HOLYOLY_PG_PORT ?? 5439);
const DB_URL = `postgresql://holyoly:holyoly@127.0.0.1:${PG_PORT}/holyoly?schema=public`;

console.log(`Seeding local demo DB at 127.0.0.1:${PG_PORT} …`);
const r = spawnSync("pnpm", ["exec", "tsx", "prisma/seed.ts"], {
  cwd: apiRoot,
  stdio: "inherit",
  shell: true,
  env: { ...process.env, DATABASE_URL: DB_URL, NODE_ENV: "development" },
});
process.exit(r.status ?? 1);
