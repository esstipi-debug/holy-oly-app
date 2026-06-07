// Builds the PORTABLE single-file demo: one self-contained .html the coach opens by double-click
// (file://), no server. Runs `vite build --mode singlefile` (hash router + inlined JS/CSS/icon/data)
// and copies the result to a clearly-named file.
//
//   node scripts/local-demo/build-singlefile.mjs
//   → apps/web/dist/Holy Oly.html
//
// Offline caveat: fonts load from Google Fonts (remote @import in theme.css). Online → on-brand
// Saira/Barlow; truly offline → system-font fallback (readable, less polished). Everything else
// (seed data, the P1 toggle, P2 tour, P5 lead-capture) runs with zero network.
import { execSync } from "node:child_process";
import { copyFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const dist = fileURLToPath(new URL("../../apps/web/dist/", import.meta.url));
const src = `${dist}index.html`;
const out = `${dist}Holy Oly.html`;

console.log("==> Building single-file demo (vite --mode singlefile)…");
execSync("pnpm --filter @holy-oly/web build:singlefile", { cwd: repoRoot, stdio: "inherit" });

copyFileSync(src, out);
const kb = (statSync(out).size / 1024).toFixed(0);
console.log(`\n✓ Portable demo: ${out} (${kb} KB)`);
console.log("  Double-click to open (file://). Offline except Google Fonts — see script header.");
