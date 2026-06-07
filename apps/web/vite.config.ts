import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { readFileSync } from "node:fs";

/**
 * Single-file (`--mode singlefile`) inlines the favicon and drops the manifest link, so the one
 * portable `.html` has zero external local references (the icon `<img>` is inlined via the asset
 * import in AthleteShell; JS/CSS are inlined by viteSingleFile). Only the remote Google Fonts
 * `@import` in theme.css stays — fonts need internet, otherwise the app falls back to system fonts.
 */
function singlefileHtmlCleanup(): Plugin {
  return {
    name: "holyoly-singlefile-html-cleanup",
    transformIndexHtml(html) {
      const svg = readFileSync(new URL("./public/icon.svg", import.meta.url), "utf8");
      const dataUri = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
      return html
        // favicon + apple-touch-icon → inline data URI (Vite may emit the path as "./icon.svg"
        // or "/icon.svg"; match either, replacing the whole href so no stray "." leaks through).
        .replace(/(href=")\.?\/icon\.svg(")/g, `$1${dataUri}$2`)
        .replace(/\s*<link rel="manifest"[^>]*>/, ""); // PWA manifest is meaningless for file://
    },
  };
}

export default defineConfig(({ mode }) => {
  const singlefile = mode === "singlefile";
  return {
    plugins: [react(), ...(singlefile ? [viteSingleFile(), singlefileHtmlCleanup()] : [])],
    server: { port: 8743 },
    build: {
      // No public source maps in production (security-review H5): don't leak internal structure.
      sourcemap: false,
      // Single-file: inline ALL assets as data URIs so nothing lives outside the one .html.
      ...(singlefile ? { assetsInlineLimit: 100 * 1024 * 1024 } : {}),
    },
    test: { environment: "jsdom", globals: true, setupFiles: "./src/test-setup.ts" },
  };
});
