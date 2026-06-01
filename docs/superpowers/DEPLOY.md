# Deploy — Holy Oly en Render (runbook)

**Arquitectura (elegida):** **1 solo servicio Node** + **1 Postgres**. Fastify (`apps/api`) sirve el
SPA buildeado (`apps/web/dist`) **y** la API en el **mismo origen** → la cookie de sesión
(`httpOnly` + `SameSite=Lax`) viaja sin CORS ni bajar seguridad. El blueprint está en
[`render.yaml`](../../render.yaml).

> ⚠️ **No puedo crear el deploy por vos** (es tu cuenta de Render). Esto es el paso-a-paso; el
> código + blueprint están verificados localmente (build, tests, e2e verdes).

## 0. Prerrequisito
El código tiene que estar en el **remoto de Git** que conectes a Render (GitHub/GitLab). Pusheá `main`:
```
git push origin main
```

## 1. Crear el Blueprint en Render
1. Render Dashboard → **New** → **Blueprint**.
2. Conectá el repo de Holy Oly. Render lee `render.yaml` y propone crear **2 recursos**:
   - `holy-oly-db` (Postgres)
   - `holy-oly` (web service Node)
3. **Apply** → Render provisiona la DB, inyecta `DATABASE_URL` en el servicio, buildea y deploya.
   - El build: instala deps → `prisma generate` → buildea el front (`VITE_API_ENABLED=true` → modo
     API con fetches relativos) → buildea la API → copia el SPA a `apps/api/dist/public`.
   - El **start** corre `prisma migrate deploy` (aplica las migraciones `0_init` + `1_auth`) y arranca.
4. Cuando el servicio quede **Live**, abrí su URL (algo como `https://holy-oly.onrender.com`).
   - `GET /health` → `{"ok":true}` confirma la API.
   - La raíz `/` sirve el SPA; `/login` muestra el login.

## 2. Sembrar datos demo (opcional, **una sola vez**, DB vacía)
El seed crea el coach demo + 8 atletas + Mara instrumentada — útil para explorar la app ya.
En el servicio `holy-oly` → **Shell**:
```
pnpm --filter @holy-oly/api db:seed
```
- **Cuentas demo:** coach `coach@holyoly.dev` / `holyoly-demo` · inviteCode `HOLY-DEMO`.
- ☠️ **PELIGRO:** el seed hace un **reset destructivo** (borra TODO antes de sembrar). Corrélo
  **solo sobre una DB vacía/recién creada**. **Nunca** con usuarios reales cargados.
- Para un lanzamiento real (sin demo): **no corras el seed** (que los coaches se registren), o
  setéa `SEED_COACH_PASSWORD` / `SEED_COACH_EMAIL` / `SEED_INVITE_CODE` a valores secretos antes
  de correrlo (las creds del seed son env-overridables).

## 3. Verificar
- Login con el coach demo → ves el plantel (heatmap/quadrant/buckets) y el drill-down de Mara.
- Signup de un atleta → ingresa el `inviteCode` → el coach confirma desde Invitaciones → aparece
  en el roster. (Es el flujo del e2e, ahora sobre tu deploy.)

## Notas / caveats
- **Plan free:** el Postgres free **se borra a los 90 días** y el web service hace **cold-start**
  tras inactividad. Para producción real (con cobro) subí ambos a un plan pago (editable en el
  dashboard o en `render.yaml`).
- **HTTPS:** lo da Render → la cookie `secure` (prod) funciona.
- **`SERVE_WEB=true`** hace que Fastify sirva el SPA; por eso **no hace falta `WEB_ORIGIN`** (mismo
  origen, sin CORS). Si algún día separás front y API en dominios distintos, hay que setear
  `WEB_ORIGIN` **y** cambiar la cookie a `SameSite=None` (+ CSRF, Fase 6).
- **No testeé el deploy real en Render** (es tu cuenta). Si el build falla, mirá los logs: lo más
  probable son detalles del entorno (versión de pnpm/corepack, resolución de `prisma`). El código,
  los builds y los tests están verdes localmente.

## Pendiente para producción "completa"
- **Fase 5 — cobro:** suscripción Mercado Pago (tu cuenta + credenciales server-side como env vars).
- **Fase 6 — hardening:** CSP/HSTS, rate-limiting (auth+writes), backups de Postgres,
  monitoring/error-tracking, E2E Playwright. (El `render.yaml` ya trae headers base.)
- **App del atleta** (productor de telemetría) — diseño + build (Fase 4 slices 4-5).
