# HANDOFF — Holy Oly: del estado actual al lanzamiento

- **Fecha:** 2026-06-08
- **Para:** la próxima sesión. **Objetivo:** "arrancar con todo lo pendiente" para poder lanzar.
- **Regla:** este doc es autocontenido. Leerlo entero antes de tocar nada.

---

## 0. Estado actual (qué YA está hecho)

**El plan de seguridad (`docs/superpowers/specs/2026-06-07-security-improvement-plan.md`) está 100% implementado en código** (Oleadas A–D), TDD, migración por slice. Resumen:
- A1 rate-limit + A1b lockout · A2/A3 seed-guard + secretos · A5/A8 CI (audit+gitleaks+Dependabot) · A6 invite 60-bit · A7 body/timeout · A9 audit log.
- B1 anti-enumeración · B5 password policy · B3/B4 sesiones (revoke-all, maxAge, sliding).
- C1/C2 helmet CSP+HSTS · C5/C6 logs sin PII + headers en una capa · C4 CORS test.
- D1 cifrado de ciclo en reposo (AES-256-GCM) · D2 seed uuid · D3 export · D4 borrado de cuenta · D5 índice/purga de sesiones · D7 validación movementId.

**Carta de oro local operacional** (`apps/api/scripts/local-app.mjs` + `C:\HolyOlyDemo\*.vbs`): Postgres embebido persistente + Fastify (API+SPA mismo origen) + cifrado de ciclo. Doble-click **Holy Oly** → login `coach@holyoly.dev` / `holyoly-demo`.

**Deploy upload-ready:** `Dockerfile` portable + `railway.json` + `render.yaml` + `docs/superpowers/DEPLOY.md` (tabla de env, pasos Railway/Render, backups/RPO-RTO).

**Tests verdes:** core 152 · api 40 unit + 49 int + e2e · web 245 · typecheck/lint/build/`pnpm audit` PASS. Migraciones 0→12.

### ⚠️ Estado de git / GOTCHAS (leer sí o sí)
- Todo está en **`main` LOCAL** (`C:\Holy Oly 0017`), **FF, ~24 commits, NO pusheado a origin**.
- **Pushear a `origin/main` = auto-deploy a Render prod** (holy-oly.onrender.com). Decisión del owner (ver §6).
- **No hay Docker** en la máquina → local usa `embedded-postgres`; el `Dockerfile` lo compila la plataforma (no se pudo `docker build` local, está revisado a mano).
- **Migraciones sin Docker:** `pnpm --filter @holy-oly/api exec tsx scripts/make-migration.ts <N> <nombre>` (genera SQL diff; **revisar el SQL** — Prisma a veces genera drop+add destructivo, como pasó en mig 12 que se reescribió a `ALTER ... USING`).
- **Verificar:** `pnpm --filter @holy-oly/api verify` (int con PG embebido) · `... e2e` · `... test` (unit). Si fallan por puerto: `Get-Process postgres | Stop-Process -Force`.
- **`CYCLE_ENCRYPTION_KEY`** (D1): 64 hex. **Estable** (rotarla sin re-cifrar rompe la lectura). Local: el runner genera/lee `C:\HolyOlyDemo\.cycle-key`. Prod: setearla en la plataforma.
- **Reglas intocables del producto** (no romper): discos vía `apps/web/src/ui/Disc.tsx` (nunca redibujar), kg+discos en toda fila del atleta, **RPE no va en superficie del atleta**, y el **ciclo crudo nunca sale al coach** (sólo `redactCycle`). Detalle en `MEMORY.md`.

---

## 1. 🔴 DECISIÓN BLOQUEANTE: proveedor de pago (antes de E3–E5)

El modelo es **B2B: el coach paga suscripción** (atletas gratis). **Mercado Pago opera en Chile**, pero su **API de Suscripciones (preapproval) en Chile hay que confirmarla** (MP es más maduro en recurrente en AR/BR/MX). Opciones para **SaaS recurrente en Chile**:

| Proveedor | Recurrente | Notas |
|-----------|-----------|-------|
| **Stripe** (recomendado) | Sí, excelente | Disponible en Chile, CLP, mejor tooling de subscriptions + webhooks firmados. |
| **Flow.cl** | Sí | Local, integra Webpay; subscriptions vía su API. |
| **Transbank Webpay (oneclick)** | Sí (oneclick mall) | Estándar chileno de tarjetas; más bajo nivel. |
| **Mercado Pago** | Verificar en CL | Alcance/wallet MP; confirmar `preapproval` en Chile. |

**ACCIÓN DEL OWNER:** elegir proveedor + crear cuenta + obtener llaves (test + prod). E3–E5 abajo está escrito **agnóstico de proveedor**: la decisión sólo cambia el "adapter".

---

## 2. E3–E5 · Cobro / suscripción (Fase 5 — la pieza grande, NO construida)

**Meta:** el coach se suscribe; sólo coaches con suscripción activa pueden escribir (gestionar atletas).

**Diseño sugerido (agnóstico de proveedor):**
- **Schema (migración nueva):** modelo `Subscription { id, coachId @unique, provider, providerCustomerId?, providerSubId?, status (active|past_due|canceled|none), currentPeriodEnd DateTime?, updatedAt }`. FK a Coach onDelete Cascade.
- **E3 · Webhook** `POST /billing/webhook`:
  - **Verificación de firma** del proveedor (Stripe: `stripe-signature` HMAC; MP: x-signature). Sin firma válida → 401.
  - **Idempotencia** por `event_id`/`payment_id` (tabla `WebhookEvent` o `processedEventIds`): procesar exactamente una vez.
  - **Ventana de replay** (±5 min sobre el timestamp).
  - Actualiza `Subscription.status` + `currentPeriodEnd` según el evento.
  - El webhook **NO** usa la sesión-cookie (es server-to-server) → excluir del rate-limit por-IP normal o usar allowlist; sí debe pasar por bodyLimit razonable.
- **E4 · Gating** middleware `requireActiveSubscription` (en `apps/api/src/auth/guards.ts`): aplicar a los **writes coach** (`PUT/POST /athletes/:id/*` y vínculo `confirm`). Si `status != active` (o `currentPeriodEnd < now`) → **402 Payment Required** con body claro. Reads coach: decidir si se gatean también (sugerido: permitir lectura, bloquear escritura).
- **Checkout:** endpoint `POST /billing/checkout` → crea la sesión de checkout del proveedor → devuelve URL → el front redirige. `GET /billing/status` → estado de la suscripción para la UI.
- **UI (web):** pantalla "Suscripción" en el área del coach (estado, botón suscribir/gestionar, banner 402 cuando bloqueado).
- **Claves del proveedor: SOLO server-side** (env), **nunca `VITE_*`** salvo la *public key* del checkout (p.ej. `VITE_STRIPE_PUBLISHABLE_KEY`).

**Tests (TDD):** webhook firma-mala→401; evento replay fuera de ventana→401; `event_id` duplicado→procesado una vez; `requireActiveSubscription` → write sin suscripción 402, con suscripción 200. Usar fixtures del proveedor (Stripe CLI / MP sandbox).

**Esfuerzo:** L (1–2 sprints). **Bloqueado por:** §1 (proveedor + llaves).

---

## 3. B0 + B6 · Email + recuperación de cuenta / verificación

**Por qué:** hoy un coach que olvida la contraseña **queda afuera para siempre** (no hay reset). Para B2B pago es básicamente obligatorio.

- **B0 · Proveedor de email (decisión + cuenta del owner):** Resend / Postmark / SES. Configurar **SPF/DKIM/DMARC** del dominio. Key server-side. Módulo `apps/api/src/email/` con `sendEmail(to, template, data)`.
- **B6 · Reset de contraseña:**
  - `POST /auth/password/forgot` (rate-limited): genera token single-use, **expira ≤1h**, guarda **SHA-256(token)** (mismo patrón que sesiones), envía email con link. Respuesta **genérica** (no revela si el email existe → cierra B2/enumeración).
  - `POST /auth/password/reset`: valida token (no usado, no expirado) → set nuevo hash → **invalida todas las sesiones** (`invalidateSessionsByUserId`) → audita `password.reset`.
  - Schema: tabla `PasswordResetToken { id(sha256), userId, expiresAt }` o reusar patrón.
- **B6b · Verificación de email (gatea registro coach):** bool `User.emailVerified` + `POST /auth/email/verify` con token; el coach no activa roster hasta verificar. (Coordina con E1.)
- **Cierra el B2 diferido:** con email, signup puede ser no-filtrante (respuesta neutral + email).

**Tests:** reset single-use (2º uso→401), expirado→401, reset invalida sesiones; forgot con email inexistente → 200 genérico.
**Esfuerzo:** L. **Bloqueado por:** elección de proveedor de email (owner).

---

## 4. E1 · Política de registro + anti-bot (decisión de producto)

- **Decisión del owner:** ¿registro de coach **abierto** o **sólo invitación/waitlist**?
- **Si abierto:** anti-bot en `/auth/signup` — honeypot (preferido ECC) o Turnstile/hCaptcha; + verificación de email (B6b) antes de activar roster. A1 (rate-limit por-IP) ya está pero no frena botnets.
- **Si invitación:** flujo de waitlist/código de invitación de coach (distinto del invite coach→atleta que ya existe).
- **Tests:** signup sin challenge/invitación válido → 400/403.
**Esfuerzo:** M. **Bloqueado por:** decisión de producto.

---

## 5. E8 · Privacidad / legal (datos de salud en US, LatAm)

- ADR ya redactado: `docs/adr/2026-06-07-data-region.md`. **Falta la DECISIÓN del owner** (mantener US + aviso, o mover región) + asesoría legal.
- **Aviso de privacidad** (página en la web + link en signup): qué datos (incl. ciclo menstrual), dónde se alojan (US/Render-Railway), transferencia internacional (AR Ley 25.326 / normativa CL), derechos de export/borrado (D3/D4 ya existen), retención.
- **Términos de servicio** (B2B).
- Runbook de incidente/brecha: `docs/INCIDENT-RESPONSE.md` (ya existe).
**Esfuerzo:** S (código) + decisión/contenido legal (owner).

---

## 6. Hosting / infra (A4a) — "respaldo": Railway primaria + Render standby

- **Recomendado:** **Railway primaria** (sin cold-start, Postgres persistente, ~$5–10/mes) + **Render-free standby** (cold-start, $0; promover/restaurar backup si Railway cae). **El respaldo real = backups de DB + restore probado** (la computación se redeploya con el `Dockerfile`).
- **Pasos Railway:** New Project → repo (usa `Dockerfile` vía `railway.json`) → add PostgreSQL → env `NODE_ENV=production`, `SERVE_WEB=true`, `CYCLE_ENCRYPTION_KEY=<hex>` → deploy → healthcheck `/health`. Sembrar demo (opcional, 1 vez): `ALLOW_DEMO_SEED=true SEED_COACH_*` + `db:seed`. Detalle: `docs/superpowers/DEPLOY.md`.
- **Backups (A4a):** activar backups del Postgres del proveedor + **probar 1 restore** y anotar RPO/RTO.
- **Dominio propio** (en vez de `*.railway.app`).
- **Push:** decidir si pushear `main` a origin (auto-deploy Render) y/o conectar Railway al repo. **Hoy nada está pusheado.**
**Bloqueado por:** cuentas/plan del owner.

---

## 7. E6 · E2E de seguridad en CI (opcional, no bloqueante)

Playwright nightly: login, cross-coach 403, ciclo sin leak, rate-limit 429. Agregar al `.github/workflows/ci.yml` o un workflow nightly. **Esfuerzo:** M. **No bloquea el launch.**

---

## 8. Orden sugerido para la próxima sesión

```text
Decisiones del owner PRIMERO (desbloquean todo):
  - Proveedor de pago (§1)  · Proveedor de email (§3)  · Registro abierto/invitación (§4)
  - Hosting (Railway sí/no, push sí/no) (§6)  · Región/legal (§5)

Implementación (código), en este orden:
  1. B0 + B6 (email + recuperación)   ← desbloquea recuperación y signup no-filtrante (B2)
  2. E1 (registro + anti-bot)
  3. E3–E5 (cobro) con el adapter del proveedor elegido   ← la pieza grande
  4. E8 (página de privacidad/términos) · E6 (Playwright nightly)
Infra (owner + yo): Railway + backups + dominio (§6) — se puede hacer en paralelo desde el día 1.
```

### Qué puede hacer la próxima sesión SIN esperar decisiones
- Andamiaje de **E6 Playwright** (tests de seguridad).
- **Anti-bot honeypot** de E1 (no requiere servicio externo).
- **Estructura** de `Subscription` + `requireActiveSubscription` + el endpoint de webhook con un **adapter mock** (para tener el gating 402 y los tests listos antes de cablear el proveedor real).
- Página de **aviso de privacidad** (contenido borrador) en la web.

### Comandos útiles
```
pnpm --filter @holy-oly/api verify      # int (PG embebido)
pnpm --filter @holy-oly/api e2e         # e2e full-flow
pnpm -r test ; pnpm -r typecheck ; pnpm lint ; pnpm audit --audit-level=high
pnpm --filter @holy-oly/api exec tsx scripts/make-migration.ts <N> <nombre>   # nueva migración (REVISAR el SQL)
```

*Generado al cerrar el cluster de migraciones + packaging de deploy (2026-06-08). Fuente de verdad del plan de seguridad: `specs/2026-06-07-security-improvement-plan.md`.*
