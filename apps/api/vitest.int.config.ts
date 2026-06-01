import { defineConfig } from "vitest/config";

// Integration tests only. Run via the db-verify orchestrator (embedded Postgres) or
// against any reachable Postgres with DATABASE_URL set.
export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.int.test.ts"],
    pool: "forks",
    fileParallelism: false,
  },
});
