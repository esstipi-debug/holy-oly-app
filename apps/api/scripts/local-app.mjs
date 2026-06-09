// Holy Oly — runner full-stack LOCAL (sin Docker). Convierte la demo de "front estático" en la
// app operacional real: levanta un Postgres embebido PERSISTENTE, aplica migraciones, siembra la
// primera vez, y arranca el server Fastify real (API + SPA en el mismo origen → la cookie de sesión
// y todo el hardening de seguridad funcionan localmente). Luego abre Edge en modo app.
//
// Pensado para lanzarse desde Holy Oly.vbs. Variables opcionales:
//   HOLYOLY_DEMO_DIR   carpeta de estado (default C:\HolyOlyDemo) → pgdata + perfil de browser
//   PORT               puerto de la app (default 8765)
//   HOLYOLY_PG_PORT    puerto del Postgres embebido (default 5439)
//   HOLYOLY_NO_BROWSER  si está, no abre Edge (para pruebas/headless)
import EmbeddedPostgres from "embedded-postgres";
import { execSync, spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url)); // apps/api/scripts
const API_DIR = join(HERE, ".."); // apps/api
const DEMO_DIR = process.env.HOLYOLY_DEMO_DIR ?? "C:\\HolyOlyDemo";
const PG_DATA = join(DEMO_DIR, "pgdata");
const BROWSER_PROFILE = process.env.HOLYOLY_BROWSER_PROFILE ?? join(DEMO_DIR, "browser");
const PG_PORT = Number(process.env.HOLYOLY_PG_PORT ?? 5439);
const APP_PORT = Number(process.env.PORT ?? 8765);
const APP_BASE = `http://127.0.0.1:${APP_PORT}`;
/** coach (default) | atleta — desktop shortcut "Kevin" opens the seeded athlete (Mara). */
const DEMO_AS = process.env.HOLYOLY_DEMO_AS === "atleta" ? "atleta" : "coach";
const APP_URL = `${APP_BASE}/auth/local-demo-login?as=${DEMO_AS}`;
const DB_URL = `postgresql://holyoly:holyoly@127.0.0.1:${PG_PORT}/holyoly?schema=public`;

const log = (m) => console.log(`[holy-oly] ${m}`);

async function healthy() {
  try {
    const r = await fetch(`${APP_BASE}/health`);
    if (!r.ok) return false;
    // Must be the real API (the old static server answers /health with index.html → not JSON).
    const j = await r.json().catch(() => null);
    return j != null && j.ok === true;
  } catch {
    return false;
  }
}

async function waitForHealth(timeoutMs = 30_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await healthy()) return true;
    await new Promise((r) => setTimeout(r, 350));
  }
  return false;
}

function openBrowser() {
  if (process.env.HOLYOLY_NO_BROWSER) return;
  const candidates = [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ];
  const edge = candidates.find((p) => existsSync(p));
  if (edge) {
    spawn(edge, [`--app=${APP_URL}`, "--window-size=430,860", `--user-data-dir=${BROWSER_PROFILE}`], {
      detached: true,
      stdio: "ignore",
    }).unref();
  } else {
    // Fallback: navegador por defecto.
    spawn("cmd", ["/c", "start", "", APP_URL], { detached: true, stdio: "ignore" }).unref();
  }
}

async function main() {
  // Si la app ya está corriendo (otra instancia), sólo abrir la ventana.
  if (await healthy()) {
    log("ya está corriendo → abriendo ventana");
    openBrowser();
    return;
  }

  const distMain = join(API_DIR, "dist", "main.js");
  const distPublic = join(API_DIR, "dist", "public");
  if (!existsSync(distMain) || !existsSync(distPublic)) {
    console.error(
      "[holy-oly] Falta el build. Corré 'Actualizar Holy Oly' (compila api + web modo-API).",
    );
    process.exit(1);
  }

  // D1: machine-local key so cycle data is encrypted at rest locally too. Stored under the demo
  // dir (NOT in the repo). Must be set before seed/server so writes encrypt and reads decrypt.
  if (!process.env.CYCLE_ENCRYPTION_KEY) {
    const keyFile = join(DEMO_DIR, ".cycle-key");
    const k = existsSync(keyFile) ? readFileSync(keyFile, "utf8").trim() : randomBytes(32).toString("hex");
    if (!existsSync(keyFile)) writeFileSync(keyFile, k);
    process.env.CYCLE_ENCRYPTION_KEY = k;
  }

  const firstInit = !existsSync(join(PG_DATA, "PG_VERSION"));
  const pg = new EmbeddedPostgres({
    databaseDir: PG_DATA,
    user: "holyoly",
    password: "holyoly",
    port: PG_PORT,
    persistent: true,
    // Forzar UTF8/locale C: el locale del host (es-*) si no defaultea el cluster a WIN1252 y
    // rompe con caracteres como "−" (U+2212).
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
  });

  try {
    if (firstInit) {
      log("inicializando Postgres embebido (primera vez)…");
      await pg.initialise();
    }
    await pg.start();
    if (firstInit) await pg.createDatabase("holyoly");
    log(`Postgres up en :${PG_PORT}`);
  } catch (err) {
    // Probablemente ya hay un Postgres corriendo en ese puerto (instancia previa) → seguimos.
    log(`Postgres ya estaba arriba o no se pudo iniciar (${String(err).split("\n")[0]}) — continúo`);
  }

  const env = { ...process.env, DATABASE_URL: DB_URL };
  log("aplicando migraciones…");
  execSync("pnpm exec prisma migrate deploy", { cwd: API_DIR, env, stdio: "inherit" });

  if (firstInit) {
    log("sembrando datos demo (sólo la primera vez)…");
    // El seed es un reset destructivo → SOLO en la primera inicialización del cluster.
    execSync("pnpm exec tsx prisma/seed.ts", { cwd: API_DIR, env, stdio: "inherit" });
  }

  // Arrancar el server Fastify real, en proceso, sirviendo API + SPA en el mismo origen.
  process.env.DATABASE_URL = DB_URL;
  process.env.SERVE_WEB = "true";
  process.env.ALLOW_LOCAL_DEMO_LOGIN = "true";
  process.env.WEB_DIST_PATH = distPublic;
  process.env.PORT = String(APP_PORT);
  // Local es http://127.0.0.1 → NO production (si no, la cookie 'secure' no viajaría sobre http).
  delete process.env.NODE_ENV;
  log(`arrancando la app en ${APP_BASE} (demo: ${DEMO_AS})`);
  await import(pathToFileURL(distMain).href);

  if (await waitForHealth()) {
    log("lista → abriendo ventana");
    openBrowser();
  } else {
    console.error("[holy-oly] el server no respondió /health a tiempo");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
