// Holy Oly — runner full-stack LOCAL (sin Docker). Convierte la demo de "front estático" en la
// app operacional real: levanta un Postgres embebido PERSISTENTE, aplica migraciones, siembra la
// primera vez, y arranca el server Fastify real (API + SPA en el mismo origen → la cookie de sesión
// y todo el hardening de seguridad funcionan localmente). Luego abre Edge en modo app.
//
// Pensado para lanzarse desde Holy Oly.vbs (ventana OCULTA → todo el output se duplica a
// %HOLYOLY_DEMO_DIR%\app.log, si no los diagnósticos se pierden). Variables opcionales:
//   HOLYOLY_DEMO_DIR    carpeta de estado (default C:\HolyOlyDemo) → pgdata + perfil de browser
//   PORT                puerto de la app (default 8765)
//   HOLYOLY_PG_PORT     puerto del Postgres embebido (default 5439)
//   HOLYOLY_NO_BROWSER  si está, no abre Edge (para pruebas/headless)
import EmbeddedPostgres from "embedded-postgres";
import { execSync, spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync, createWriteStream, statSync, renameSync, unlinkSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { connect } from "node:net";
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
const LOCK_FILE = join(DEMO_DIR, "runner.lock");
const LOG_FILE = join(DEMO_DIR, "app.log");

// ── Logs a archivo: el VBS lanza este proceso con ventana oculta, así que SIN esto cualquier
//    crash (de PG, del server o nuestro) muere sin testigo. Tee de stdout+stderr a app.log. ──
function setupFileLog() {
  try {
    mkdirSync(DEMO_DIR, { recursive: true });
    if (existsSync(LOG_FILE) && statSync(LOG_FILE).size > 2 * 1024 * 1024) {
      renameSync(LOG_FILE, `${LOG_FILE}.old`); // rotación simple: 1 generación
    }
    const out = createWriteStream(LOG_FILE, { flags: "a" });
    for (const stream of [process.stdout, process.stderr]) {
      const write = stream.write.bind(stream);
      stream.write = (chunk, enc, cb) => {
        try { out.write(chunk); } catch { /* el log nunca debe tumbar la app */ }
        return write(chunk, enc, cb);
      };
    }
    console.log(`\n[holy-oly] ===== ${new Date().toISOString()} · pid ${process.pid} =====`);
  } catch (err) {
    console.error(`[holy-oly] no pude abrir ${LOG_FILE}: ${err}`);
  }
}

const log = (m) => console.log(`[holy-oly] ${m}`);

process.on("uncaughtException", (err) => { console.error("[holy-oly] uncaught:", err); process.exit(1); });
process.on("unhandledRejection", (err) => { console.error("[holy-oly] unhandled:", err); process.exit(1); });

// ── Salud: /health dice "server vivo" pero NO toca la DB. El probe definitivo es el propio
//    login demo: 302 = stack sano de punta a punta; ≥500 = la DB murió debajo del server. ──
async function serverUp() {
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

/** "up" | "db-dead" | "down" | "not-demo" — estado real del stack en :8765. */
async function stackState() {
  if (!(await serverUp())) return "down";
  try {
    const r = await fetch(`${APP_BASE}/auth/local-demo-login?as=coach`, { redirect: "manual" });
    if (r.status >= 300 && r.status < 400) return "up";
    if (r.status >= 500) return "db-dead";
    return "not-demo"; // 404 = gate ALLOW_LOCAL_DEMO_LOGIN apagado: no es nuestra instancia demo
  } catch {
    return "down";
  }
}

function tcpListening(port, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const sock = connect({ host: "127.0.0.1", port });
    const done = (v) => { sock.destroy(); resolve(v); };
    sock.once("connect", () => done(true));
    sock.once("error", () => done(false));
    sock.setTimeout(timeoutMs, () => done(false));
  });
}

async function waitFor(fn, timeoutMs, everyMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await fn()) return true;
    await new Promise((r) => setTimeout(r, everyMs));
  }
  return false;
}

/** Espera el stack completo: server arriba (rápido) y después login-probe 302 (cada 2s). */
async function waitForStack(timeoutMs = 45_000) {
  if (!(await waitFor(serverUp, timeoutMs, 350))) return false;
  return waitFor(async () => (await stackState()) === "up", timeoutMs, 2_000);
}

// ── Zombie heal: un server vivo con la DB muerta atiende /health ok → sin esto, re-abrir el
//    acceso directo re-abre la ventana rota PARA SIEMPRE. Lo matamos (es nuestro demo) y
//    booteamos de cero. Sólo si el dueño del puerto es node.exe. ──
function portOwnerPid(port) {
  try {
    const out = execSync(`netstat -ano -p tcp`, { encoding: "utf8" });
    for (const line of out.split(/\r?\n/)) {
      const m = line.match(/^\s*TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)\s*$/);
      if (m && Number(m[1]) === port) return Number(m[2]);
    }
  } catch { /* netstat no disponible → no curamos */ }
  return null;
}

function isNodePid(pid) {
  try {
    const out = execSync(`tasklist /fi "PID eq ${pid}" /fo csv /nh`, { encoding: "utf8" });
    return /node\.exe/i.test(out);
  } catch {
    return false;
  }
}

async function killZombieApi() {
  const pid = portOwnerPid(APP_PORT);
  if (pid == null || pid === process.pid || !isNodePid(pid)) {
    log(`no pude identificar al dueño node de :${APP_PORT} (pid=${pid ?? "?"}) — no mato nada`);
    return false;
  }
  log(`API zombie (server vivo, DB muerta) en pid ${pid} → taskkill /f /t`);
  try { execSync(`taskkill /pid ${pid} /f /t`, { stdio: "ignore" }); } catch { /* ya muerto */ }
  // El LISTEN se libera al morir el proceso; esperamos a que el puerto quede libre.
  return waitFor(async () => !(await tcpListening(APP_PORT)), 5_000, 250);
}

// ── Lock anti doble-boot: coach + Kevin se abren juntos → sin lock, dos boots simultáneos
//    pelean por PG y :8765 (EADDRINUSE) y el perdedor puede llevarse a PG puesto. ──
function readLockPid() {
  try {
    const pid = Number(readFileSync(LOCK_FILE, "utf8").trim());
    if (!Number.isInteger(pid) || pid <= 0) return null;
    process.kill(pid, 0); // throw = no existe
    return pid;
  } catch {
    return null;
  }
}

function takeLock() {
  writeFileSync(LOCK_FILE, String(process.pid));
  process.on("exit", () => {
    try { if (readFileSync(LOCK_FILE, "utf8").trim() === String(process.pid)) unlinkSync(LOCK_FILE); } catch { /* best effort */ }
  });
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
  setupFileLog();

  // Otro runner ya es dueño del stack (p.ej. abriste coach y Kevin juntos): esperá a que esté
  // sano y abrí sólo la ventana. Si nunca sana, caemos al boot completo (con heal de zombies).
  const owner = readLockPid();
  if (owner != null && owner !== process.pid) {
    log(`otro runner (pid ${owner}) tiene el lock → espero el stack para abrir la ventana`);
    if (await waitForStack(60_000)) {
      log("stack sano → abriendo ventana");
      openBrowser();
      return;
    }
    log("el dueño del lock nunca levantó el stack — me hago cargo");
  }

  switch (await stackState()) {
    case "up":
      log("ya está corriendo → abriendo ventana");
      openBrowser();
      return;
    case "db-dead":
      if (!(await killZombieApi())) {
        console.error("[holy-oly] hay un server sin DB en :" + APP_PORT + " y no pude reemplazarlo. Cerrá las ventanas de Holy Oly y reintentá.");
        process.exit(1);
      }
      break; // puerto libre → boot completo
    case "not-demo":
      console.error(`[holy-oly] :${APP_PORT} está ocupado por otra app (no es el demo). Liberá el puerto o seteá PORT.`);
      process.exit(1);
      break;
    case "down":
      break; // boot completo
  }

  takeLock();

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

  let pgOwned = false;
  try {
    if (firstInit) {
      log("inicializando Postgres embebido (primera vez)…");
      await pg.initialise();
    }
    await pg.start();
    pgOwned = true;
    if (firstInit) await pg.createDatabase("holyoly");
    log(`Postgres up en :${PG_PORT}`);
  } catch (err) {
    // ¿Hay realmente un PG previo escuchando, o simplemente no pudo arrancar? Verificarlo:
    // el viejo "continúo" a ciegas dejaba al server vivo SIN base → 500s sin diagnóstico.
    if (await tcpListening(PG_PORT)) {
      log(`Postgres ya estaba arriba en :${PG_PORT} (instancia previa) — lo uso`);
    } else {
      console.error(`[holy-oly] Postgres NO arrancó y nada escucha en :${PG_PORT}.`);
      console.error(`[holy-oly] Detalle: ${String(err).split("\n")[0]}`);
      console.error(`[holy-oly] Revisá ${LOG_FILE} y reintentá; si persiste, borrá C:\\HolyOlyDemo\\pgdata (resetea la demo).`);
      process.exit(1);
    }
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

  if (await waitForStack()) {
    log("stack sano (server + DB) → abriendo ventana");
    openBrowser();
  } else {
    console.error(`[holy-oly] el stack no quedó sano a tiempo — estado: ${await stackState()}. Ver ${LOG_FILE}.`);
  }

  // Watchdog: si PG muere debajo del server (kills externos a postgres son moneda corriente en
  // esta máquina), lo re-arrancamos si es nuestro; si no, al menos queda registrado.
  let healing = false;
  setInterval(async () => {
    if (healing) return;
    const state = await stackState();
    if (state === "up") return;
    healing = true;
    try {
      log(`watchdog: stack "${state}"`);
      if (state === "db-dead" && pgOwned) {
        log("watchdog: re-arrancando Postgres…");
        try { await pg.stop(); } catch { /* ya estaba muerto */ }
        try {
          await pg.start();
          log(`watchdog: Postgres de vuelta en :${PG_PORT}`);
        } catch (err) {
          console.error(`[holy-oly] watchdog: PG no volvió: ${String(err).split("\n")[0]}`);
        }
      }
    } finally {
      healing = false;
    }
  }, 60_000).unref();

  // Cierre prolijo (Ctrl+C en pruebas manuales): bajar PG si lo arrancamos nosotros.
  for (const sig of ["SIGINT", "SIGTERM"]) {
    process.on(sig, async () => {
      log(`${sig} → cerrando`);
      if (pgOwned) { try { await pg.stop(); } catch { /* best effort */ } }
      process.exit(0);
    });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
