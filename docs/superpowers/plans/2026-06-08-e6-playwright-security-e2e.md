# E6 — Playwright security E2E (CI nightly) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una suite Playwright que ejercite la app real corriendo (Fastify sirviendo SPA + API same-origin contra Postgres embebido) y verifique 4 propiedades de seguridad — login por UI, cross-coach 403, ciclo redactado y headers de helmet — corriendo en un workflow de CI nightly.

**Architecture:** La suite vive en `apps/api/e2e/` (reusa el patrón de `apps/api/scripts/e2e.ts`: embedded-postgres + `buildServer` + seed sobre HTTP real). Un `globalSetup` levanta PG efímero, migra, siembra y arranca `buildServer()` con `SERVE_WEB` + `WEB_DIST_PATH` en `NODE_ENV` no-prod (cookie no-`secure` para que viaje sobre http); guarda el handle en un módulo compartido; `globalTeardown` lo cierra. Los tests usan un browser real para el login por UI y el `request` context del browser (cookie reusada) para las aserciones API que la UI no expone.

**Tech Stack:** `@playwright/test` (solo chromium), `embedded-postgres`, Fastify 5, Prisma 6, `tsx`, GitHub Actions.

**Spec de referencia:** `docs/superpowers/specs/2026-06-08-e6-playwright-security-e2e-design.md`.

---

## File Structure

- Create: `apps/api/playwright.config.ts` — config Playwright (testDir, chromium, baseURL, global setup/teardown).
- Create: `apps/api/e2e/server-handle.ts` — holder tipado compartido entre setup y teardown (mismo proceso runner).
- Create: `apps/api/e2e/global-setup.ts` — boot del stack (PG + migrate + seed + buildServer + listen).
- Create: `apps/api/e2e/global-teardown.ts` — cierre ordenado (app → prisma → pg → rm data dir).
- Create: `apps/api/e2e/security.spec.ts` — los 4 escenarios.
- Create: `.github/workflows/e2e-nightly.yml` — workflow nightly + `workflow_dispatch`.
- Modify: `apps/api/package.json` — devDep `@playwright/test` + script `e2e:browser`.
- Modify: `apps/api/tsconfig.json` — incluir `e2e` y `playwright.config.ts` en el typecheck.
- Modify: `apps/api/.gitignore` (o crear) — ignorar artefactos de Playwright + data dir efímero.

---

## Task 1: Instalar Playwright y scaffolding de config

**Files:**
- Modify: `apps/api/package.json`
- Create: `apps/api/playwright.config.ts`
- Modify: `apps/api/tsconfig.json`
- Modify/Create: `apps/api/.gitignore`

- [ ] **Step 1: Instalar @playwright/test como devDep del paquete api**

Run:
```bash
pnpm --filter @holy-oly/api add -D @playwright/test
```
Expected: agrega `@playwright/test` a `apps/api/package.json` devDependencies y actualiza `pnpm-lock.yaml`. (Usamos `add` en vez de pinear una versión a mano para no inventar un número y mantener el lockfile consistente.)

- [ ] **Step 2: Instalar el browser chromium para correr local**

Run:
```bash
pnpm --filter @holy-oly/api exec playwright install chromium
```
Expected: descarga el binario de chromium (no toca el repo).

- [ ] **Step 3: Agregar el script `e2e:browser`**

En `apps/api/package.json`, dentro de `"scripts"`, agregar (junto a `"e2e": "tsx scripts/e2e.ts"`):
```json
    "e2e:browser": "playwright test",
```

- [ ] **Step 4: Crear `apps/api/playwright.config.ts`**

```ts
import { defineConfig, devices } from "@playwright/test";

// E6 — security E2E against the real app (SPA + API same-origin, real Postgres).
// Serial single-worker: tests share one server + DB and some mutate state (coach B signup).
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL: "http://127.0.0.1:8788",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
```

- [ ] **Step 5: Incluir e2e en el typecheck de api**

En `apps/api/tsconfig.json`, cambiar la línea `"include"` a:
```json
  "include": ["src", "prisma", "e2e", "playwright.config.ts"]
```

- [ ] **Step 6: Ignorar artefactos de Playwright**

En `apps/api/.gitignore` (crear el archivo si no existe), agregar:
```
# Playwright (E6)
/playwright-report/
/test-results/
/.pgdata-e2e-browser/
```

- [ ] **Step 7: Commit**

```bash
git add apps/api/package.json apps/api/playwright.config.ts apps/api/tsconfig.json apps/api/.gitignore pnpm-lock.yaml
git commit -m "chore(e6): scaffold Playwright (devDep + config + script + ignores)"
```

---

## Task 2: Boot del stack (global setup/teardown)

**Files:**
- Create: `apps/api/e2e/server-handle.ts`
- Create: `apps/api/e2e/global-setup.ts`
- Create: `apps/api/e2e/global-teardown.ts`

- [ ] **Step 1: Crear el holder compartido `apps/api/e2e/server-handle.ts`**

`globalSetup` y `globalTeardown` corren en el MISMO proceso runner de Playwright, así que un módulo singleton comparte estado entre ambos.

```ts
import type EmbeddedPostgres from "embedded-postgres";
import type { FastifyInstance } from "fastify";

// Shared between globalSetup and globalTeardown (same runner process).
export const handle: {
  app?: FastifyInstance;
  pg?: EmbeddedPostgres;
  dataDir?: string;
} = {};
```

- [ ] **Step 2: Crear `apps/api/e2e/global-setup.ts`**

Espejo de `scripts/e2e.ts`, pero sirviendo también el SPA (`SERVE_WEB` + `WEB_DIST_PATH`) y dejando el handle para el teardown. Puertos propios (PG 5436, app 8788) para no chocar con `verify`/`e2e`/`local-app`.

```ts
import EmbeddedPostgres from "embedded-postgres";
import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { handle } from "./server-handle";

const HERE = dirname(fileURLToPath(import.meta.url)); // apps/api/e2e
const API_DIR = resolve(HERE, ".."); // apps/api
const WEB_DIST = resolve(API_DIR, "..", "web", "dist"); // apps/web/dist
const PG_PORT = 5436;
const APP_PORT = 8788;
const DATA_DIR = resolve(API_DIR, ".pgdata-e2e-browser");
const DB_URL = `postgresql://holyoly:holyoly@127.0.0.1:${PG_PORT}/holyoly?schema=public`;

export default async function globalSetup(): Promise<void> {
  if (!existsSync(WEB_DIST)) {
    throw new Error(
      `[e2e] Falta ${WEB_DIST}. Corré: VITE_API_ENABLED=true pnpm --filter @holy-oly/web build`,
    );
  }

  rmSync(DATA_DIR, { recursive: true, force: true });
  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: "holyoly",
    password: "holyoly",
    port: PG_PORT,
    persistent: false,
    // Host locale (es-CL) would default the cluster to WIN1252 and break on chars like "−".
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
  });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("holyoly");

  const env = { ...process.env, DATABASE_URL: DB_URL };
  execSync("pnpm exec prisma migrate deploy", { cwd: API_DIR, env, stdio: "inherit" });
  execSync("pnpm exec tsx prisma/seed.ts", { cwd: API_DIR, env, stdio: "inherit" });

  // Same-origin single-service mode. NOT production: the session cookie is `secure` in prod and
  // would not travel over http → login would fail (same reason local-app.mjs deletes NODE_ENV).
  process.env.DATABASE_URL = DB_URL;
  process.env.SERVE_WEB = "true";
  process.env.WEB_DIST_PATH = WEB_DIST;
  delete process.env.NODE_ENV;

  const { buildServer } = await import("../src/server");
  const app = buildServer();
  await app.listen({ port: APP_PORT, host: "127.0.0.1" });

  handle.app = app;
  handle.pg = pg;
  handle.dataDir = DATA_DIR;
}
```

- [ ] **Step 3: Crear `apps/api/e2e/global-teardown.ts`**

```ts
import { rmSync } from "node:fs";
import { handle } from "./server-handle";

export default async function globalTeardown(): Promise<void> {
  if (handle.app) await handle.app.close();
  // Disconnect the Prisma singleton before stopping Postgres (else a benign reset is logged).
  const { prisma } = await import("../src/db/client");
  await prisma.$disconnect().catch(() => undefined);
  if (handle.pg) await handle.pg.stop();
  if (handle.dataDir) rmSync(handle.dataDir, { recursive: true, force: true });
}
```

- [ ] **Step 4: Typecheck del paquete api**

Run:
```bash
pnpm --filter @holy-oly/api typecheck
```
Expected: PASS (sin tests aún; sólo valida que setup/teardown/config compilan y que `buildServer`, `prisma`, `embedded-postgres` resuelven tipos).

- [ ] **Step 5: Commit**

```bash
git add apps/api/e2e/server-handle.ts apps/api/e2e/global-setup.ts apps/api/e2e/global-teardown.ts
git commit -m "feat(e6): boot del stack para el E2E (embedded PG + buildServer same-origin)"
```

---

## Task 3: Los 4 escenarios de seguridad

**Files:**
- Create: `apps/api/e2e/security.spec.ts`

Nota: la app ya implementa estas propiedades, así que los tests pasan en verde de entrada (no hay fase RED — el valor es de regresión: si alguien rompe el authz, la redacción o los headers, esta suite lo caza).

- [ ] **Step 1: Escribir `apps/api/e2e/security.spec.ts`**

```ts
import { test, expect, request as apiRequest } from "@playwright/test";

const BASE = "http://127.0.0.1:8788";

// Seed (apps/api/prisma/seed.ts): coach demo + Mara (athleteId "mv", vínculo activo).
const COACH_EMAIL = "coach@holyoly.dev";
const COACH_PASSWORD = "holyoly-demo";

test.describe("E6 security E2E", () => {
  test("login (UI) → roster autenticado visible", async ({ page }) => {
    await page.goto("/");
    await page.locator('input[type="email"]').fill(COACH_EMAIL);
    await page.locator('input[type="password"]').fill(COACH_PASSWORD);
    await page.getByRole("button", { name: "Ingresar" }).click();
    // Post-login el coach ve su roster: Mara V. está sembrada.
    await expect(page.getByText("Mara V.")).toBeVisible({ timeout: 15_000 });
  });

  test("cross-coach read → 403 (aislamiento multi-tenant)", async () => {
    const ctx = await apiRequest.newContext({ baseURL: BASE });
    const signup = await ctx.post("/auth/signup", {
      data: {
        email: `e2e-coachB-${Date.now()}@x.dev`,
        password: "coachB-pass-1",
        role: "coach",
        name: "Coach B",
      },
    });
    expect(signup.status()).toBe(201); // coach B autenticado, SIN vínculo a Mara
    const res = await ctx.get("/athletes/mv/series");
    expect(res.status()).toBe(403); // guardAthlete: sin vínculo activo
    await ctx.dispose();
  });

  test("coach cycle read → redactado (sin state crudo)", async () => {
    const ctx = await apiRequest.newContext({ baseURL: BASE });
    const login = await ctx.post("/auth/login", {
      data: { email: COACH_EMAIL, password: COACH_PASSWORD },
    });
    expect(login.status()).toBe(200);
    const res = await ctx.get("/athletes/mv/cycle");
    expect(res.status()).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty("share");
    expect(body).not.toHaveProperty("state"); // redactCycle server-side
    await ctx.dispose();
  });

  test("headers de seguridad presentes (documento + API)", async () => {
    const ctx = await apiRequest.newContext({ baseURL: BASE });
    for (const path of ["/", "/health"]) {
      const res = await ctx.get(path);
      const h = res.headers();
      expect(h["content-security-policy"]).toContain("default-src 'self'");
      expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
      expect(h["x-frame-options"]).toBe("DENY");
      expect(h["x-content-type-options"]).toBe("nosniff");
      expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
      // HSTS NO se asegura acá: es prod-only (server.ts) y la suite corre no-prod. Lo cubre headers.test.ts.
    }
    await ctx.dispose();
  });
});
```

- [ ] **Step 2: Commit (sin correr aún — la corrida necesita el SPA buildeado, Task 4)**

```bash
git add apps/api/e2e/security.spec.ts
git commit -m "feat(e6): 4 escenarios de seguridad (login UI, cross-coach 403, ciclo redactado, headers)"
```

---

## Task 4: Verificación local de la suite

**Files:** (ninguno — corrida)

- [ ] **Step 1: Buildear el SPA en modo API-relativo (same-origin)**

Run:
```bash
VITE_API_ENABLED=true pnpm --filter @holy-oly/web build
```
Expected: genera `apps/web/dist` (SPA con fetches relativos). En PowerShell: `$env:VITE_API_ENABLED="true"; pnpm --filter @holy-oly/web build`.

- [ ] **Step 2: Correr la suite Playwright**

Run:
```bash
pnpm --filter @holy-oly/api e2e:browser
```
Expected: PASS — 4 tests verdes en chromium. El reporter `list` muestra los 4; el server embebido se levanta en globalSetup y se cierra en globalTeardown.

- [ ] **Step 3: Si algo falla, diagnosticar (orden de causas probables)**

- Boot/timeout: revisar el log de globalSetup (migraciones/seed por stdout). Si hay `postgres.exe` zombi tomando 5436: `Get-Process postgres | Stop-Process -Force` y reintentar.
- Login UI no encuentra "Mara V.": abrir el trace (`pnpm --filter @holy-oly/api exec playwright show-trace`) — verificar selector del botón ("Ingresar") y que el post-login renderiza el roster.
- 403/redacción/headers: confirmar contra `scripts/e2e.ts` (mismas rutas) y `server.ts` (helmet) que el contrato no cambió.

Arreglar la causa raíz (selector/boot), NO debilitar la aserción de seguridad.

- [ ] **Step 4: Confirmar que no quedó data dir ni proceso colgado**

Run:
```bash
git status --porcelain apps/api
```
Expected: vacío (el `.pgdata-e2e-browser/`, `playwright-report/`, `test-results/` están gitignored). Verificar que no quedó `postgres.exe`: `Get-Process postgres -ErrorAction SilentlyContinue`.

---

## Task 5: Workflow de CI nightly

**Files:**
- Create: `.github/workflows/e2e-nightly.yml`

- [ ] **Step 1: Crear `.github/workflows/e2e-nightly.yml`**

```yaml
name: E2E security (nightly)

on:
  schedule:
    - cron: "0 6 * * *" # 06:00 UTC ≈ 03:00 Chile
  workflow_dispatch: {}

permissions:
  contents: read

jobs:
  e2e-security:
    name: playwright security e2e (chromium)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @holy-oly/api prisma:generate
      - name: Build SPA (same-origin / API-relative)
        run: VITE_API_ENABLED=true pnpm --filter @holy-oly/web build
      - name: Install Playwright chromium + OS deps
        run: pnpm --filter @holy-oly/api exec playwright install --with-deps chromium
      - name: Run security E2E
        run: pnpm --filter @holy-oly/api e2e:browser
      - name: Upload Playwright report on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: apps/api/playwright-report/
          retention-days: 7
```

- [ ] **Step 2: Validar la sintaxis YAML del workflow**

Run:
```bash
node -e "const fs=require('fs');const s=fs.readFileSync('.github/workflows/e2e-nightly.yml','utf8');if(!/workflow_dispatch/.test(s)||!/cron:/.test(s))throw new Error('workflow incompleto');console.log('workflow OK')"
```
Expected: imprime `workflow OK`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/e2e-nightly.yml
git commit -m "ci(e6): workflow nightly de security E2E (schedule + workflow_dispatch)"
```

---

## Task 6: Verificación integral + docs

**Files:**
- Modify: `docs/superpowers/HANDOFF-GO-LIVE.md` (marcar E6 hecho)
- Modify: `CHANGELOG.md` (si existe)

- [ ] **Step 1: Confirmar que lo verde existente sigue verde**

Run:
```bash
pnpm -r typecheck && pnpm lint && pnpm -r test
```
Expected: PASS en los 3. (Playwright NO corre en `pnpm -r test` — es el script aparte `e2e:browser`.)

- [ ] **Step 2: Confirmar que el build de api no bundlea e2e**

Run:
```bash
pnpm --filter @holy-oly/api build
```
Expected: PASS; `apps/api/dist/main.js` existe y NO referencia `playwright` (entry es sólo `src/main.ts`). Verificar:
```bash
node -e "const s=require('fs').readFileSync('apps/api/dist/main.js','utf8');if(/@playwright|playwright-core/.test(s))throw new Error('playwright se coló al bundle');console.log('bundle limpio')"
```
Expected: `bundle limpio`.

- [ ] **Step 3: Actualizar el handoff canónico**

En `docs/superpowers/HANDOFF-GO-LIVE.md`, en la sección "§4 Mejoras de negocio pendientes", cambiar la línea de E6 de:
```
- (Opcional) **E6 Playwright** security E2E en CI nightly.
```
a:
```
- ✅ **E6 Playwright** security E2E en CI nightly — HECHO (`apps/api/e2e/`, workflow `e2e-nightly.yml`; 4 specs: login UI, cross-coach 403, ciclo redactado, headers).
```

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/HANDOFF-GO-LIVE.md
git commit -m "docs(e6): marcar E6 (Playwright security E2E) como hecho en el handoff"
```

- [ ] **Step 5: Reporte final al usuario**

Resumir: 4 specs verdes localmente, workflow nightly creado (corre 06:00 UTC + `workflow_dispatch`), no se tocó `main`. Recordar que el push a `main` dispara auto-deploy a Render → pedir OK explícito antes de pushear/mergear.

---

## Self-Review (hecho por el autor del plan)

- **Cobertura del spec:** §3.1 login → Task 3 test 1 · §3.2 cross-coach 403 → test 2 · §3.3 ciclo sin leak → test 3 · §3.4 headers → test 4 · §2 boot/ubicación → Task 2 · §4 gotcha HSTS → comentario en test 4 + nota · §5 CI nightly → Task 5 · §6 verificación → Task 4 + Task 6. Sin gaps.
- **Mecanismo setup↔teardown:** el spec dejó abierto cómo se comparte estado; el plan lo resuelve con `server-handle.ts` (singleton en el proceso runner, donde Playwright corre ambos hooks). Si en la implementación Playwright separara los procesos (no es el caso documentado), el fallback es `webServer: { command: "tsx scripts/<serve>.ts", url }` + boot en proceso hijo bajo tsx.
- **Placeholders:** ninguno; todo el código va completo.
- **Consistencia de nombres:** `handle.app/pg/dataDir`, puertos 5436/8788, `e2e:browser`, `WEB_DIST` → `apps/web/dist`, rutas `/athletes/mv/series` y `/athletes/mv/cycle` (coinciden con `scripts/e2e.ts`).
