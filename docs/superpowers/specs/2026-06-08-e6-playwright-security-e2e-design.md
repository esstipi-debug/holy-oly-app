# Diseño — E6: Playwright security E2E (CI nightly)

- **Fecha:** 2026-06-08
- **Origen:** `docs/superpowers/specs/2026-06-07-security-improvement-plan.md` (Oleada E, fila **E6**) y `HANDOFF-GO-LIVE.md` §4 (mejora pendiente "(Opcional) E6 Playwright security E2E en CI nightly").
- **Criterio de aceptación (del plan de seguridad):** "Suite verde en CI" cubriendo **login, cross-coach 403, ciclo sin leak**.

## 1. Objetivo y alcance

Construir una suite de **end-to-end de seguridad** con Playwright que ejercite la **app real corriendo** (Fastify sirviendo el SPA + API en el **mismo origen**, contra un Postgres real embebido), validando propiedades de seguridad tal como las vive un cliente con browser:

1. **Login (UI)** — la cadena cookie de sesión real funciona end-to-end.
2. **Cross-coach 403** — un coach autenticado pero **no vinculado** no puede leer datos de la atleta de otro coach (IDOR / aislamiento multi-tenant).
3. **Ciclo sin leak** — la lectura del ciclo por el coach viene **redactada** server-side (sin `state` crudo).
4. **Headers de seguridad** — las respuestas del server real traen los headers de helmet always-on.

**Enfoque: híbrido.** Al menos un **login por UI** (prueba cookie real + render autenticado + CSP same-origin); las aserciones de seguridad que la UI no puede disparar (cross-coach 403, redacción de ciclo) usan el **`request` context del browser**, que reusa la cookie de sesión del navegador. Razón: cross-coach 403 y "ciclo sin leak" son propiedades de la **API** que la UI nunca expone (la UI no te deja pedir la atleta de otro coach), pero verificarlas desde un browser autenticado prueba la cadena completa cookie→header→authz.

### Fuera de alcance (YAGNI)

- Rate-limit/lockout y gating de billing 402 en el E2E de browser (timing flákely; ya cubiertos por `ratelimit.int.test.ts` y `billing.int.test.ts`).
- Multi-browser (firefox/webkit): solo **chromium** — suficiente para propiedades de seguridad, evita ruido.
- Agregar E6 al CI de PR (push/pull_request): E6 es explícitamente **nightly**; no debe frenar merges ni instalar browsers en cada push.

## 2. Ubicación y boot

La suite vive en **`apps/api/e2e/`**, consistente con el patrón existente `apps/api/scripts/e2e.ts` (que ya bootea PG embebido + `buildServer` + seed sobre HTTP real). `@playwright/test` se agrega como **devDependency de `apps/api`** (ahí están `embedded-postgres`, el seed, `buildServer` y `tsx`).

```
apps/api/
  e2e/
    global-setup.ts      # levanta el stack, deja el handle para teardown
    global-teardown.ts   # cierra server → prisma → pg
    security.spec.ts     # los 4 escenarios
  playwright.config.ts   # config Playwright (solo chromium, baseURL, global setup/teardown)
```

### `global-setup.ts` (espejo de `scripts/e2e.ts`)

1. PG embebido efímero: `persistent: false`, `initdbFlags: ["--encoding=UTF8", "--locale=C"]` (gotcha de locale del host es-CL → WIN1252), puerto fijo (p.ej. **5436**, distinto del 5434 que usa `e2e.ts` y del 5439 de `local-app.mjs` para no chocar).
2. `prisma migrate deploy` + `tsx prisma/seed.ts` (vía `execSync`, env con `DATABASE_URL` apuntando al PG embebido).
3. `process.env.SERVE_WEB = "true"` + `process.env.WEB_DIST_PATH = <apps/web/dist absoluto>` + `process.env.DATABASE_URL = <url>`.
4. **`NODE_ENV` NO se setea a production** (igual que `local-app.mjs`): en prod la cookie es `secure` y no viaja sobre http → el login fallaría.
5. `buildServer()` → `app.listen({ port: 8788, host: "127.0.0.1" })`.
6. Guarda `app` y `pg` (p.ej. en un módulo de estado o `globalThis`) para el teardown.

### `global-teardown.ts`

`app.close()` → `prisma.$disconnect()` (desconectar el singleton antes de frenar PG, si no loguea un reset benigno en teardown) → `pg.stop()` → borrar el data dir.

### Pre-requisito de build

El SPA debe estar buildeado en **modo API-relativo** para que los fetches peguen same-origin:
`VITE_API_ENABLED=true pnpm --filter @holy-oly/web build` → produce `apps/web/dist`. `WEB_DIST_PATH` apunta ahí. (En prod, `render.yaml` lo foldea en `apps/api/dist/public`; acá apuntamos directo a `apps/web/dist`.)

El global-setup **no** buildea el SPA; asume que `apps/web/dist` existe (lo buildea el workflow / el dev antes de correr). Si falta, falla con un mensaje claro ("falta apps/web/dist — corré `VITE_API_ENABLED=true pnpm --filter @holy-oly/web build`").

## 3. Escenarios (`security.spec.ts`)

Cuentas demo del seed: coach `coach@holyoly.dev` / `holyoly-demo`; atleta showcase Mara con `athleteId = "mv"` (vínculo activo con el coach demo).

### 3.1 Login (UI) → roster visible
- `page.goto('/')`, completar email + password del coach demo en `AuthScreen`, submit.
- Esperar que aparezca el roster autenticado (texto **"Mara V."** visible).
- Prueba: cookie de sesión real + render autenticado same-origin.

### 3.2 Cross-coach 403
- En un contexto/`request` nuevo: `request.post('/auth/signup', { role: 'coach', email: <único>, password, name })` → 201 + cookie de **coach B** (sin vínculo a Mara).
- `request.get('/athletes/mv/series')` con esa cookie → **403**.
- Prueba: un coach autenticado pero no vinculado no llega a la atleta de otro (`guardAthlete`).
- Nota: el signup de coach crea `emailVerified=false`, pero el gate de email-no-verificado es sobre **confirmar vínculo**, no sobre reads → el 403 viene del vínculo ausente, no del email. (Documentado para no confundir el origen del 403.)

### 3.3 Ciclo sin leak
- Con la sesión del coach A (logueado en 3.1, mismo contexto): `request.get('/athletes/mv/cycle')` → 200.
- Asertar: el body tiene `share` y **no** tiene `state` (ni ningún campo crudo del ciclo).
- Prueba: redacción server-side (`redactCycle`).

### 3.4 Headers de seguridad
- Sobre la respuesta del documento raíz `/` **y** una respuesta de API (`/health`): asertar headers always-on de helmet:
  - `content-security-policy` presente, conteniendo `default-src 'self'` y `frame-ancestors 'none'`.
  - `x-frame-options: DENY`.
  - `x-content-type-options: nosniff`.
  - `referrer-policy: strict-origin-when-cross-origin`.

## 4. Gotcha: HSTS no se asegura acá

`Strict-Transport-Security` se setea **solo en `NODE_ENV=production`** (`apps/api/src/server.ts:76`). La suite corre **no-prod** (cookie `secure` no viaja sobre http), así que el escenario 3.4 **no** asegura HSTS. HSTS queda cubierto por `apps/api/headers.test.ts` (nivel `inject`, que puede forzar prod sin un browser real). **No "arreglar" esto** corriendo el E2E en prod: rompería el login (cookie secure). Queda escrito explícitamente en el spec del test.

## 5. CI nightly

Nuevo workflow **`.github/workflows/e2e-nightly.yml`**:

- **Triggers:** `schedule` (cron `0 6 * * *` UTC) + `workflow_dispatch` (on-demand).
- **Permisos:** `contents: read`.
- **Pasos:**
  1. `actions/checkout@v4`
  2. `pnpm/action-setup@v4` + `actions/setup-node@v4` (node 22, cache pnpm)
  3. `pnpm install --frozen-lockfile`
  4. `pnpm --filter @holy-oly/api prisma:generate`
  5. `VITE_API_ENABLED=true pnpm --filter @holy-oly/web build`
  6. `pnpm --filter @holy-oly/api exec playwright install --with-deps chromium`
  7. `pnpm --filter @holy-oly/api e2e:browser`
  8. (on-failure) `actions/upload-artifact@v4` con el reporte HTML de Playwright (`apps/api/playwright-report/`).

Script nuevo en `apps/api/package.json`: `"e2e:browser": "playwright test"`.

## 6. Verificación

- **Local (sin Docker):** `VITE_API_ENABLED=true pnpm --filter @holy-oly/web build && pnpm --filter @holy-oly/api e2e:browser` → 4 specs verdes contra PG embebido.
- **Typecheck:** la config + tests pasan `tsc` (incluir `apps/api/e2e` en el typecheck del paquete o un tsconfig propio).
- **No romper lo verde existente:** `pnpm -r test`, `pnpm lint`, `pnpm --filter @holy-oly/api verify` siguen pasando (Playwright no se ejecuta en `pnpm -r test`; es un script aparte).
- **CI:** el workflow corre on `workflow_dispatch` para validarlo sin esperar al cron.

## 7. Reglas de producto (no romper)

No aplica directamente (no hay UI de atleta nueva), pero la suite **refuerza**: ciclo crudo nunca al coach (3.3), aislamiento multi-tenant (3.2).

## 8. Gotchas heredados (recordar)

- **No hay Docker/WSL** en la máquina → todo vía `embedded-postgres`.
- **Locale host = es-CL → WIN1252** → `initdbFlags: ["--encoding=UTF8","--locale=C"]` siempre.
- **Puertos:** elegir uno libre para PG (5436) y app (8788) para no chocar con `verify`/`e2e`/`local-app`. Si quedan `postgres.exe` zombis tomando el puerto: `Get-Process postgres | Stop-Process -Force`.
- **pnpm 10** ignora build scripts en install fresco (warning benigno); `playwright install` baja los browsers aparte.
