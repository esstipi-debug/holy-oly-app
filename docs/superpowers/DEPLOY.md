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
En el servicio `holy-oly` → **Shell** (las credenciales las definís vos, no van en el repo):
```
ALLOW_DEMO_SEED=true \
  SEED_COACH_EMAIL=tu-coach@dominio.com \
  SEED_COACH_PASSWORD='<password-fuerte>' \
  SEED_INVITE_CODE='<codigo-12-chars>' \
  pnpm --filter @holy-oly/api db:seed
```
- ☠️ **Reset destructivo:** el seed borra TODO antes de sembrar. Por eso en producción
  (`NODE_ENV=production`) **falla por defecto** (guard A2) — hay que pasar `ALLOW_DEMO_SEED=true`
  a propósito, y entonces los `SEED_*` son **obligatorios** (no hay defaults commiteados que
  puedan filtrarse a prod, guard A3). Corrélo **solo sobre una DB vacía/recién creada**.
- **Cuentas demo:** las definís con esos `SEED_*`. En dev/local/CI hay defaults de demo
  (ver `apps/api/prisma/seed-guard.ts`) — **nunca** los uses en un deploy real.
- Para un lanzamiento real (sin demo): **no corras el seed** — que los coaches se registren.

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

## Backups, RPO/RTO y recuperación (A4a)
> ⚠️ **El Postgres free NO tiene backups automáticos y se borra a los ~90 días** → riesgo operativo
> #1 (pérdida total). Antes de tener usuarios reales:

1. **Subir el Postgres a un plan pago** (`render.yaml` `databases[0].plan` o el dashboard) — habilita
   **backups diarios automáticos + PITR**.
2. **RPO** (pérdida máxima): backup diario ≈ ≤24 h; PITR ≈ minutos.
3. **RTO** (tiempo de restore): desde el dashboard de Render — medir y registrar tras la 1ª prueba.
4. **Probar un restore una vez** (no asumir que el backup sirve) y anotar pasos/tiempos.
5. **Fallback interino (mientras siga free):** `pg_dump` periódico, guardado FUERA de Render:
   ```
   pg_dump "$DATABASE_URL" -Fc -f holyoly-$(date +%F).dump
   # restore: pg_restore --clean --no-owner -d "$DATABASE_URL" holyoly-YYYY-MM-DD.dump
   ```

> Acción del **owner**: el upgrade de plan es facturación → no lo puedo hacer yo.

## Pendiente para producción "completa"
- **Fase 5 — cobro:** suscripción Mercado Pago (tu cuenta + credenciales server-side como env vars).
- **Hardening — HECHO (plan de seguridad, Oleadas A–C):** rate-limit + lockout (A1/A1b), CSP/HSTS
  vía helmet (C1/C2), body/timeout (A7), seed-guard (A2/A3), CI + audit + gitleaks (A5/A8), invite
  60-bit (A6), anti-enumeración + passwords (B1/B5), revocación de sesiones (B3/B4), headers en una
  capa + logs sin PII (C5/C6). El `render.yaml` ahora delega los headers a helmet (sólo conserva
  Permissions-Policy).
- **Plan de seguridad — HECHO también:** audit log (A9), cifrado de ciclo en reposo (D1),
  export/borrado de datos (D3/D4), índice de sesiones (D5), seed uuid (D2). **Pendiente:**
  backups+plan pago (A4a, arriba), E2E Playwright (E6), y lo gateado por vos: email→recuperación
  (B0/B6), Mercado Pago (E3–E5).
- **Monitoring/error-tracking (E5):** Sentry o similar — ver `docs/INCIDENT-RESPONSE.md`.
- **App del atleta** (productor de telemetría) — diseño + build (Fase 4 slices 4-5).

## Subir a una plataforma (Railway / Render / cualquier contenedor)
La app es agnóstica de plataforma (12-factor): un solo servicio Node sirve API + SPA en el mismo
origen y todo se configura por env. Hay un **`Dockerfile`** portable (multi-stage) → deploya igual
en Railway, Fly.io, Render o cualquier host de contenedores.

### Variables de entorno
| Var | Requerida | Qué hace |
|-----|-----------|----------|
| `DATABASE_URL` | **sí** | Postgres manejado del proveedor. |
| `NODE_ENV=production` | sí | cookie `secure`, HSTS, logs (el Dockerfile ya lo setea). |
| `SERVE_WEB=true` | sí | Fastify sirve el SPA + API mismo origen (el Dockerfile ya lo setea). |
| `PORT` | la inyecta la plataforma | puerto de escucha (Railway/Render lo dan; main.ts bindea 0.0.0.0). |
| `CYCLE_ENCRYPTION_KEY` | recomendada | 64 hex (32 bytes) → cifra el ciclo en reposo (D1). Generá: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. **No rotar sin re-cifrar.** |
| `SESSION_TTL_DAYS` | opcional | TTL de sesión (default 30). |
| `SINGLE_SESSION_LOGIN` | opcional | `true` → un login revoca las sesiones previas. |
| `WEB_ORIGIN` | sólo si separás front/API | origen del SPA (CORS). Con `SERVE_WEB=true` no hace falta. |
| `ALLOW_DEMO_SEED` + `SEED_*` | sólo para sembrar | requeridas para correr el seed en prod (guard A2/A3). |

### Railway (recomendado: always-on + Postgres persistente)
1. New Project → Deploy from GitHub repo (detecta el `Dockerfile` vía `railway.json`).
2. Add → **PostgreSQL** (Railway inyecta `DATABASE_URL`).
3. Variables: `NODE_ENV=production`, `SERVE_WEB=true`, `CYCLE_ENCRYPTION_KEY=<hex>` (PORT lo inyecta Railway).
4. Deploy → `start:prod` corre `prisma migrate deploy` y arranca; healthcheck `/health`.
5. (Opcional) Sembrar demo una vez: `ALLOW_DEMO_SEED=true SEED_COACH_*` + `pnpm --filter @holy-oly/api db:seed`.

### Render
Ya hay `render.yaml` (build Node). Alternativamente puede usar el `Dockerfile`. Sembrar: Shell con
`ALLOW_DEMO_SEED=true` + `SEED_*` (§2).

### Paridad con la carta de oro local
El runner local (`apps/api/scripts/local-app.mjs`) corre **el mismo `dist/main.js`** que el
contenedor; la única diferencia es el origen de Postgres (embebido local vs managed en la nube).
Lo que probás local = lo que corre en la plataforma.
