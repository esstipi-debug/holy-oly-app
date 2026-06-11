# HANDOFF — Go-live a Render (sesión 2026-06-11, cierre)

> Orden del owner: «comitea, merge, cierra este chat como corresponde. que quede todo en regla en
> render». Esto levanta el freeze local-only. Estado: **TODO commiteado y mergeado a `main` local;
> el push y el deploy quedan BLOQUEADOS por credenciales que sólo el owner controla** (ver §3).

## 1. Qué quedó en regla (local) ✅

- `main` (checkout `C:\Holy Oly 0017`) = **`1634e30`**, worktree limpio, FF completo de todos los
  slices de hoy (motor Prilepin dormant · homogeneización UI · bugs owner: calentamiento cuenta /
  flecha atrás / nombres curados / sesión completa · recorrido de ciclos · fluidez calendario +
  ciclo perceptible).
- Suites verdes: **core 257 · web 345 · api 50 unit + 79 int** · `pnpm -r typecheck` ✓ · lint 0
  errores (1 warning preexistente en `apps/api/src/email/index.ts`).
- Build de prod conocido-bueno (se buildeó hoy para la instancia `:8765`).
- `main` está **56 commits adelante de `origin/main`** (que sigue en `5db28e8`, congelado).

## 2. Migraciones (importante para el deploy)

- Commiteadas: **0–14 + 16 + 17** (hay un **hueco en la 15** = el WIP booking sin commitear, que
  NO se pushea). Prisma no exige numeración contigua → el deploy aplica 0–14, 16, 17 sin problema.
- `render.yaml` → `startCommand` = `prisma migrate deploy && node dist/main.js`: **las migraciones
  corren solas en cada deploy**. 16 (`RmUpdate`, append-only) y 17 (`cycle_fields`, columnas
  cifradas) son **aditivas** → seguras sobre el estado E6.
- ⚠️ **Caveat futuro:** cuando el booking WIP se commitee con su `15_booking`, esa migración
  ordenará ANTES de la 16/17 ya aplicadas → renumerarla a **18** al commitear (ya anotado en
  memoria), o Prisma la aplicará fuera de orden.

## 3. Lo que FALTA para «en regla en render» — requiere al owner 🔴

### 3.1 Push bloqueado (auth de GitHub)
`git push origin main` → **403: «Permission denied to esstipi-debug»**. El PAT fine-grained de
`esstipi-debug` (`github_pat_11BV…`, vía `gh`) **no tiene `Contents: write`** sobre
`esstipi-debug/holy-oly-app` (probado con el credential-manager y con el token de `gh` — mismo 403).
**Fix (owner):** regenerar el PAT con permiso **Contents: Read and write** (y **Workflows** si hay
GitHub Actions) para este repo → `gh auth refresh` / re-login → `git push origin main`. O pushear
desde un entorno con credenciales de escritura. **Hasta esto, nada llega a GitHub y Render no puede
recibir el código.**

### 3.2 Deploy NO es automático
Memoria + render.yaml: **autoDeploy=OFF** y el hook GitHub→Render está roto. Aun después del push,
hay que **disparar el deploy a mano** (Render dashboard «Manual Deploy», o la API con la key del
servicio `srv-d8etrvvavr4c73954o4g` — guardada por el owner, no accesible desde acá).

### 3.3 Env vars de prod (secretos — NO están en render.yaml)
`render.yaml` sólo declara `NODE_VERSION/NODE_ENV/SERVE_WEB/DATABASE_URL`. El app necesita estos
secretos seteados en el dashboard de Render (ver `docs/superpowers/DEPLOY.md` para la lista
canónica). **Críticos para no bootear a medias:**
- **`CYCLE_ENCRYPTION_KEY`** 🔴 — el ciclo está cifrado at-rest (mig 12/17). Sin esto, leer/escribir
  ciclo falla. **Debe ser estable** (rotarla huérfana los datos cifrados existentes).
- `APP_ORIGIN`/`API_ORIGIN`/`WEB_ORIGIN` — cookie same-origin correcta.
- `GOOGLE_CLIENT_ID/SECRET/OAUTH_STATE_SECRET` — OAuth (si se usa).
- `BILLING_PROVIDER`/`MERCADOPAGO_ACCESS_TOKEN`/`*_WEBHOOK_SECRET`/`BILLING_ENFORCE`/
  `ALLOW_MOCK_BILLING` — MP real vs mock (hoy el adapter MP real sigue pendiente → arrancar en mock
  hasta cablearlo).
- `EMAIL_PROVIDER`/`EMAIL_VERIFY_ENFORCE` — email real vs mock (email real pendiente).
- `ALLOW_LOCAL_DEMO_LOGIN` debe quedar **false/ausente** en prod (loopback-only igual, pero
  explícito).

## 4. Secuencia de go-live (para el owner)
1. Regenerar PAT con Contents:write → `git push origin main` (§3.1).
2. En Render: setear los env vars de §3.3 (sobre todo `CYCLE_ENCRYPTION_KEY`).
3. Manual Deploy del servicio (§3.2) → el build corre y `migrate deploy` aplica 16/17.
4. Seed one-off si la DB está vacía (ver `DEPLOY.md`); verificar `/health`.
5. Smoke: login coach + atleta, drill-down, entreno, recorrido, ciclo de Mara.

## 5. Pendientes de producto (sin cambios)
Adapter MP real · email real · legal · i18n (parqueado) · booking WIP (mig → 18) · recetas de los
23 macros · readiness→modulación (próximo slice de motor) · borrar `C:\HolyOlyDemo-sp5-smoke`.
