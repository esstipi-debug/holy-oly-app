# HANDOFF — Go-live: configuración (email real + billing prod) y checklist de deploy

> **Fecha:** 2026-06-12 · **Doc operativo de CONFIGURACIÓN para salir a producción.**
> Consolida la parte de **env vars + secuencia de deploy + checklist**. Lo NUEVO de esta sesión:
> **email real por Google (D1)** y **guard de billing en prod (D2)** — ya no son "pendientes":
> el código está, falta **setear las env vars y correr un script**.
>
> **Extiende** (no reemplaza) a:
> - `docs/superpowers/HANDOFF-2026-06-11-go-live.md` — push bloqueado (PAT) + deploy manual + migraciones.
> - `docs/superpowers/HANDOFF-GO-LIVE.md` — estado canónico del producto + pricing 5-tiers + setup MP.
> - `docs/superpowers/DEPLOY.md` — runbook de Render (blueprint, seed, backups).
>
> ⚠️ Todo lo de configuración acá es **acción del owner**: las claves/secretos viven en tu cuenta, no
> en el repo. Yo no puedo setearlas ni pushear (ver §4).

---

## 0. Qué cambió esta sesión (lo nuevo a configurar)

| Antes (handoffs previos) | Ahora (esta sesión) |
|---|---|
| Email real "pendiente" — sólo `console` (stdout) | **Adapter Google SMTP implementado** (`apps/api/src/email/google.ts`). Se activa con `EMAIL_PROVIDER=google` + 2 vars. |
| Billing podía arrancar en `mock` en cualquier lado | **Guard fail-fast en prod** (`assertBillingProdConfig`): en `NODE_ENV=production` la app **NO levanta en modo mock** — exige MercadoPago + token + webhook secret + los 8 planes, o tira un error que lista exactamente qué falta. **Nunca cobra $0 en prod.** |

Consecuencia práctica: en producción, **arrancar en mock ya no es una opción**. O configurás MercadoPago
completo (§2), o el servicio no bootea. (En dev/local/CI el default sigue siendo `mock` y todo funciona igual.)

---

## 1. Email real (Google / Gmail / Workspace) — D1

**Provider por defecto:** `console` (loguea a stdout en dev — `[email:...]`). Para enviar mails de verdad
(reset de password, verificación de email) hay que setear:

```
EMAIL_PROVIDER=google
GOOGLE_SMTP_USER=coach@tu-dominio.com         # buzón emisor
GOOGLE_SMTP_APP_PASSWORD=xxxxxxxxxxxxxxxx      # App Password de 16 chars (NO la contraseña de la cuenta)
EMAIL_FROM="Holy Oly <no-reply@tu-dominio.com>"   # opcional; default = GOOGLE_SMTP_USER
```

- Transporte: SMTP `smtp.gmail.com:465` (SSL implícito) vía Nodemailer (`secure: true`). Sin OAuth2 —
  un **App Password** alcanza (OAuth2/Gmail API queda como upgrade futuro, no implementado).
- `googleEmailConfigured()` exige **ambas** (`GOOGLE_SMTP_USER` + `GOOGLE_SMTP_APP_PASSWORD`). Si elegís
  `EMAIL_PROVIDER=google` sin alguna, el envío **tira un error claro** (no es un no-op silencioso).
- ⚠️ Las ramas `resend|postmark|ses` de `EMAIL_PROVIDER` **NO están implementadas** (tiran error). El
  único provider real hoy es `google`.

### Cómo generar el App Password
1. La cuenta de Google **debe tener 2FA activado**.
2. Ir a **https://myaccount.google.com/apppasswords** → crear uno nuevo (nombre libre, p. ej. "Holy Oly API").
3. Copiar las 16 letras → `GOOGLE_SMTP_APP_PASSWORD` (sin espacios).
4. **Google Workspace:** el **admin del dominio** debe permitir App Passwords (Admin console → Security →
   menos comúnmente bloqueado). Si "App passwords" no aparece en la cuenta, suele ser que falta 2FA o que
   el admin lo deshabilitó.

> Entregabilidad (SPF/DKIM/DMARC del dominio) sigue siendo tarea de infra del owner si usás dominio propio
> — no la cubre el código.

---

## 2. Billing (MercadoPago) — D2 (guard de prod)

**Provider por defecto:** `mock` (dev/demo). **En producción el guard lo prohíbe.** Para habilitar cobro real:

```
BILLING_PROVIDER=mercadopago
MERCADOPAGO_ACCESS_TOKEN=APP_USR-...           # token de tu app MP (sandbox o prod)
MERCADOPAGO_WEBHOOK_SECRET=...                 # secret del webhook (panel MP)
# Los 8 planes (4 tiers × 2 períodos) — generados por el script (§ abajo):
MERCADOPAGO_PLAN_COACH_MONTHLY=...
MERCADOPAGO_PLAN_COACH_ANNUAL=...
MERCADOPAGO_PLAN_PRO_MONTHLY=...
MERCADOPAGO_PLAN_PRO_ANNUAL=...
MERCADOPAGO_PLAN_ELITE_MONTHLY=...
MERCADOPAGO_PLAN_ELITE_ANNUAL=...
MERCADOPAGO_PLAN_BOX_MONTHLY=...
MERCADOPAGO_PLAN_BOX_ANNUAL=...
```

### El guard `assertBillingProdConfig` (qué exige, fail-fast)
Se corre al registrar el plugin de billing. **Sólo actúa en `NODE_ENV=production`** (no-op fuera de prod).
Si falta algo, **tira un error que lista exactamente qué** y la app **no arranca**:
- `BILLING_PROVIDER` debe ser `mercadopago` (no `mock`).
- `MERCADOPAGO_ACCESS_TOKEN` presente.
- `MERCADOPAGO_WEBHOOK_SECRET` presente.
- los **8** `MERCADOPAGO_PLAN_*` presentes.

Invariante (D2): en prod la app **nunca** cae al checkout mock de $0. `mockCheckoutAllowed()` es `false`
cuando `NODE_ENV=production`. (Detalle en `apps/api/src/billing/config.ts`.)

### Generar los 8 planes
Crea los `preapproval_plan` en MercadoPago desde la grilla de pricing de core (montos GROSS = net + IVA)
e imprime las 8 líneas `MERCADOPAGO_PLAN_*` listas para pegar en el env:

```
# Previsualizar montos (NO toca MP, no necesita token):
pnpm --filter @holy-oly/api exec tsx scripts/mp-setup-plans.ts --dry-run

# Crear de verdad (sandbox o prod según el token); usa APP_ORIGIN para los back_urls:
MERCADOPAGO_ACCESS_TOKEN=APP_USR-... APP_ORIGIN=https://tu-dominio \
  pnpm --filter @holy-oly/api exec tsx scripts/mp-setup-plans.ts
```

- `--dry-run` imprime `# MERCADOPAGO_PLAN_... → <tier>/<período> <monto CLP> (IVA incl.)`.
- Sin `--dry-run` y con token, imprime `MERCADOPAGO_PLAN_...="<id>"   # <tier>/<período> ...` → **pegar
  esas 8 líneas en el env del API** (Render).
- Sin token y sin `--dry-run` → sale con error ("Falta MERCADOPAGO_ACCESS_TOKEN").
- ⚠️ Si cambiás precios (`packages/core/src/billing/plans.ts`, p. ej. al anclar a Volt) → **re-correr el
  script** y reemplazar los 8 ids.

### Webhook en el panel de MercadoPago
Configurar la URL de webhook apuntando a tu dominio:
```
https://<tu-dominio>/billing/webhook
```
Evento: `subscription_preapproval`. El secret de ese webhook = `MERCADOPAGO_WEBHOOK_SECRET` (el adapter
valida la firma `x-signature` + idempotencia).

---

## 3. Otras env vars críticas de prod

De `apps/api/.env.example`, `render.yaml` y la memoria de go-live. **Las que importan para no bootear a medias:**

| Var | Requerida | Qué hace / nota |
|-----|-----------|-----------------|
| `DATABASE_URL` | **sí** | Postgres managed. En Render lo inyecta el blueprint (`fromDatabase`). |
| `NODE_ENV=production` | **sí** | cookie `secure`, HSTS, **activa los guards** de billing/CORS. (Render lo setea.) |
| `SERVE_WEB=true` | **sí** | Fastify sirve el SPA + API mismo origen → sin CORS, la cookie de sesión "just works". (Render lo setea.) |
| **`CYCLE_ENCRYPTION_KEY`** | 🔴 **crítica** | 64 hex (32 bytes) → cifra el ciclo menstrual at-rest (mig 12/17). **Sin ella, leer/escribir ciclo falla.** **Estable** (rotarla huérfana los datos cifrados). Generar: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. |
| `APP_ORIGIN` | **sí** | URL pública del SPA — links de reset/verify de email **y** back_urls de MP. P. ej. `https://holy-oly.onrender.com`. |
| `API_ORIGIN` | sólo split deploy | URL pública de la API para el callback OAuth cuando front y API están en orígenes distintos. Con `SERVE_WEB=true` (mismo origen) **no hace falta** (default = `APP_ORIGIN`). |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | sí, si usás OAuth Google | Login con Google. Redirect URI autorizado debe ser `${API_ORIGIN o APP_ORIGIN}/auth/google/callback`. |
| `GOOGLE_OAUTH_STATE_SECRET` | opcional | secret del `state` CSRF de OAuth; default = `GOOGLE_CLIENT_SECRET`. |
| `BILLING_ENFORCE` | opcional | gating de write del coach (402 sin suscripción). Default **on** en dev/prod; `false` lo desactiva. |
| `EMAIL_VERIFY_ENFORCE` | opcional | el coach debe verificar email antes de confirmar vínculos. Default **on** en dev/prod. |
| `WEB_ORIGIN` | sólo split front/API | con `SERVE_WEB=true` **no hace falta**. Si separás dominios: setearla **y** pasar la cookie a `SameSite=None` (+ CSRF) — `server.ts` exige `WEB_ORIGIN` en prod si hay CORS credentializado. |
| `PORT` | la inyecta la plataforma | Render/Railway lo dan; `main.ts` bindea `0.0.0.0`. |
| `SESSION_TTL_DAYS` / `SINGLE_SESSION_LOGIN` | opcional | TTL de sesión (default 30) / un login revoca sesiones previas. |
| `ALLOW_LOCAL_DEMO_LOGIN` | dejar **ausente/false** | el `local-demo-login` es loopback-only (inerte en prod), pero mantenerlo explícitamente off. |

> El seed (`ALLOW_DEMO_SEED=true` + `SEED_*`) es destructivo y **sólo** para sembrar una DB vacía una vez
> — ver `DEPLOY.md §2`. Para un lanzamiento real (sin demo): **no correr el seed**.

---

## 4. Secuencia de deploy

**Migraciones:** corren solas en el arranque. El `startCommand` de Render es
`pnpm --filter @holy-oly/api start:prod`, y `start:prod` = **`prisma migrate deploy && node dist/main.js`**
(`apps/api/package.json`). Aplica las pendientes en cada deploy.

**Estado de migraciones (committeadas):** `0`–`14`, `16`, `17`. Hay un **hueco en la `15`** = el WIP de
booking, **parqueado en la rama `wip/booking`** (no se pushea desde `main`). Prisma **no exige numeración
contigua** → aplica `0`–`14`, `16`, `17` sin problema. 16 (`RmUpdate`, append-only) y 17 (`cycle_fields`,
columnas cifradas) son **aditivas** → seguras sobre el estado E6.
⚠️ Cuando el booking se commitee, renumerar su migración a **18** (no `15`) para que ordene DESPUÉS de las
ya aplicadas.

**Push + deploy (bloqueado por credenciales del owner — ver `HANDOFF-2026-06-11-go-live.md §3`):**
- `git push origin main` → hoy **403** porque el PAT fine-grained de `esstipi-debug` **no tiene
  `Contents: write`** sobre `esstipi-debug/holy-oly-app`. **Fix:** regenerar el PAT con **Contents: Read
  and write** (+ Workflows si hay Actions) → re-login `gh` → push.
- **Deploy NO automático:** `autoDeploy=off` + hook GitHub→Render roto. Tras el push, disparar a mano:
  Render dashboard **Manual Deploy**, o la **API** del servicio `srv-d8etrvvavr4c73954o4g` (key del owner).

**Script de go-live (armado, validado, NO ejecutado):** `scripts/go-live/push-and-deploy.ps1` (+ su
`README.md`). Hace push → chequea env vars (avisa si falta `CYCLE_ENCRYPTION_KEY`) → dispara el deploy vía
API → polling + health check. El owner lo corre con `$env:RENDER_API_KEY` seteada **una vez regenerado el
PAT** con write. (Vive en el root del repo principal `C:\Holy Oly 0017`, no en este worktree.)

**Orden recomendado:**
1. Regenerar PAT con `Contents: write` (§4) → desbloquea el push.
2. Setear en Render las env vars de §1 (email), §2 (billing + 8 planes) y §3 (sobre todo `CYCLE_ENCRYPTION_KEY`).
3. Correr `mp-setup-plans.ts` (con token) y pegar los 8 `MERCADOPAGO_PLAN_*`.
4. Configurar el webhook MP en el panel (§2).
5. `git push origin main` (o el script `push-and-deploy.ps1`).
6. **Manual Deploy** → el build corre y `migrate deploy` aplica 16/17.
7. Verificar `GET /health` → `{"ok":true}`. Smoke: login coach + atleta, drill-down, entreno, ciclo de Mara,
   un reset de password real (llega el mail), un checkout MP (sandbox).

---

## 5. Checklist pre-deploy (tildable)

- [ ] **Email:** `EMAIL_PROVIDER=google` + `GOOGLE_SMTP_USER` + `GOOGLE_SMTP_APP_PASSWORD` seteados (App Password con 2FA; en Workspace el admin lo permite).
- [ ] **Billing provider+token+secret:** `BILLING_PROVIDER=mercadopago` + `MERCADOPAGO_ACCESS_TOKEN` + `MERCADOPAGO_WEBHOOK_SECRET`.
- [ ] **8 planes MP:** `mp-setup-plans.ts` corrido (con token) y los 8 `MERCADOPAGO_PLAN_*` pegados en el env.
- [ ] **`CYCLE_ENCRYPTION_KEY`** seteada (64 hex, estable — sin ella el ciclo cifrado falla).
- [ ] **`APP_ORIGIN`** = dominio real (links de email + back_urls MP). `NODE_ENV=production` + `SERVE_WEB=true` presentes.
- [ ] **OAuth** (si se usa): `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` + redirect URI `…/auth/google/callback` autorizado.
- [ ] **PAT regenerado** con `Contents: write` → push desbloqueado.
- [ ] **Webhook MP** configurado en el panel → `https://<dominio>/billing/webhook` (`subscription_preapproval`).
- [ ] **Deploy disparado** a mano (Manual Deploy / API) → `GET /health` OK → smoke (login + reset email real + checkout sandbox).

> Recordatorio del guard D2: si el billing **no** está completo, en prod el servicio **no arranca** (es a
> propósito — nunca cobra $0). Si el deploy falla al bootear, leé el error: lista exactamente qué env var de
> billing falta.

---

## 6. Legal — PENDIENTE (acción del owner / abogado)

No es código. **No redacto texto legal vinculante acá** — esto es sólo el checklist de QUÉ debe cubrir el
documento que prepare el owner/abogado, dado lo que la app maneja:

- [ ] **Política de privacidad** que cubra los datos efectivamente manejados, en particular:
  - **Datos de ciclo menstrual** (opt-in, cifrados at-rest) — categoría sensible; declarar finalidad
    (contextualizar recuperación), base legal/consentimiento, retención y que el atleta puede exportarlos/borrarlos.
  - **Métricas del atleta** (RMs, cargas, adherencia, bienestar, readiness) y la relación coach⇄atleta
    (quién ve qué; el ciclo crudo **nunca** llega al coach).
  - Datos de cuenta (email, auth, OAuth Google), logs/auditoría, y el procesamiento de **pagos por
    MercadoPago** (qué datos se comparten con MP).
  - Derechos del titular: acceso, **exportación** y **borrado** (ya cableados en la app — D3/D4).
  - Región de datos / transferencias (ver `docs/adr/2026-06-07-data-region.md`).
- [ ] **Términos de servicio** (uso, suscripción/cobro, cancelación, responsabilidad, ley aplicable).
- [ ] Revisar/actualizar los borradores existentes en la app (`/privacidad`, `/terminos`) con el texto final.

---

## 7. Referencias

| Doc | Para qué |
|-----|----------|
| `docs/superpowers/HANDOFF-2026-06-11-go-live.md` | Push bloqueado (PAT) · deploy manual · migraciones (detalle). |
| `docs/superpowers/HANDOFF-GO-LIVE.md` | Estado canónico del producto · pricing 5-tiers · setup MP original. |
| `docs/superpowers/DEPLOY.md` | Runbook Render (blueprint, seed one-off, backups/RPO/RTO, tabla de env vars). |
| `docs/pricing.md` | Grilla de precios + cortes + runbook MP. |
| `scripts/go-live/push-and-deploy.ps1` (+ `README.md`) | Script de push + deploy vía API (root del repo; necesita PAT con write + `RENDER_API_KEY`). |
| `apps/api/.env.example` | Lista consolidada de env vars con comentarios. |
| `apps/api/src/billing/config.ts` · `apps/api/src/email/google.ts` | Fuente de verdad del guard D2 y del adapter de email D1. |
