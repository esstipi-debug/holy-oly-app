import { defineConfig } from "vitest/config";

// Unit tests run by default; integration tests (*.int.test.ts) need a live Postgres
// and are excluded here — run them with `pnpm test:int` once the DB is up. The Playwright
// security suite (e2e/) uses @playwright/test, not vitest, so it's excluded too — run it
// with `pnpm e2e:browser`.
export default defineConfig({
  test: {
    environment: "node",
    exclude: ["**/node_modules/**", "**/dist/**", "**/*.int.test.ts", "**/e2e/**"],
  },
});
