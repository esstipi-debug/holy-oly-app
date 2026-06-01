import { defineConfig } from "vitest/config";

// Unit tests run by default; integration tests (*.int.test.ts) need a live Postgres
// and are excluded here — run them with `pnpm test:int` once the DB is up.
export default defineConfig({
  test: {
    environment: "node",
    exclude: ["**/node_modules/**", "**/dist/**", "**/*.int.test.ts"],
  },
});
