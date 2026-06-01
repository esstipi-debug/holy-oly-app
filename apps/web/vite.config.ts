import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  server: { port: 8743 },
  // No public source maps in production (security-review H5): don't leak internal structure.
  build: { sourcemap: false },
  test: { environment: "jsdom", globals: true, setupFiles: "./src/test-setup.ts" },
});
