import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/main.ts"],
  format: ["esm"],
  clean: true,
  splitting: false,
  // Bundle the workspace `core` INTO the output: its package.json points at `./src/index.ts`
  // (consumed via tsx/vite everywhere else), so leaving it external makes the compiled
  // `node dist/main.js` try to import a `.ts` at runtime → ERR_UNKNOWN_FILE_EXTENSION.
  noExternal: ["@holy-oly/core"],
});
