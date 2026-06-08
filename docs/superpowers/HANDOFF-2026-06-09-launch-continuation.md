# HANDOFF — Holy Oly: continuación lanzamiento (sesión 2+)

- **Fecha:** 2026-06-09
- **Para:** abrir en **otra ventana de Cursor** y seguir sin perder contexto.
- **Leer entero** antes de tocar código. Complementa `HANDOFF-2026-06-08-launch.md` (roadmap original).

---

## 0. Resumen en una línea

**Andamiaje de lanzamiento implementado en working tree (sin commit):** email/reset/verify, billing mock + gating 402, legal borrador, honeypot signup. **Verify verde.** Falta: adapter **Mercado Pago** real, email real, tiers de precio en código, commit/push, decisiones owner.

---

## 1. Estado git (CRÍTICO)

| Hecho | Detalle |
|-------|---------|
| Rama | `main` local |
| vs `origin/main` | **21 commits ahead**, **sin push** |
| Working tree | **Cambios sin commit** (todo el slice launch-readiness) |
| Push | **NO hacer** salvo orden explícita del owner → dispara auto-deploy Render (`holy-oly.onrender.com`) |

### Archivos nuevos (untracked)

```
apps/api/prisma/migrations/13_launch_readiness/
apps/api/src/auth/coach-writes.ts
apps/api/src/auth/one-time-token.ts
apps/api/src/billing/          (+ billing.int.test.ts)
apps/api/src/email/
apps/api/src/password-reset.int.test.ts
apps/api/src/signup-honeypot.int.test.ts
apps/web/src/auth/ForgotPasswordScreen.tsx, ResetPasswordScreen.tsx, VerifyEmailScreen.tsx
apps/web/src/billing/
apps/web/src/screens/coach/SuscripcionScreen.tsx
apps/web/src/screens/legal/LegalPages.tsx
```

### Archivos modificados (sin commit)

`schema.prisma`, `seed.ts`, `auth/routes.ts`, `auth/schemas.ts`, `server.ts`, `vinculo/routes.ts`, `router.tsx`, `AuthContext.tsx`, `AuthScreen.tsx`, `CuentaStub.tsx`, `packages/core/schemas.ts`, `apps/api/.env.example`, etc.

**Próximo commit sugerido (cuando el owner pida):** un solo commit tipo `feat(launch): billing mock, email reset, legal stubs, subscription gating`.

---

## 2. Qué YA está implementado (esta sesión)

### DB — migración `13_launch_readiness`

- `User.emailVerified` (bool; usuarios existentes → `true` en SQL)
- `Subscription` (`coachId` unique, `status`: none|active|past_due|canceled, `provider`, `currentPeriodEnd`)
- `WebhookEvent` (idempotencia)
- `PasswordResetToken`, `EmailVerificationToken` (SHA-256 del token, como sesiones)

### API

| Módulo | Rutas / comportamiento |
|--------|------------------------|
| `email/` | `sendEmail()` — provider `console` en dev; falla si `EMAIL_PROVIDER` no soportado |
| `auth/routes` | `POST /auth/password/forgot`, `/reset`, `/email/verify`, `/email/resend` (coach) |
| `auth` signup | Coach: `emailVerified=false` + crea `Subscription(none)` + email verify. Atleta: `emailVerified=true` |
| `auth/me` | Devuelve `email`, `emailVerified` |
| Honeypot E1 | Campo `website` en signup debe ir vacío → 400 si bot |
| `billing/` | `GET /billing/status`, `POST /billing/checkout`, `POST /billing/webhook`, `POST /billing/mock/activate` (solo dev) |
| Gating E4 | `requireCoachWrite()` → **402** sin suscripción activa; **403** sin email verificado al **confirmar vínculo** |
| Writes coach | `guardAthleteWrite` en PUT/POST `/athletes/:id/*` |

### Web

- `/login/forgot`, `/login/reset`, `/login/verify`
- `/coach/suscripcion` — estado + mock activate en demo
- `/privacidad`, `/terminos` — borradores (E8)
- Login: link olvidé contraseña, honeypot, links legales
- Cuenta: links Suscripción + legal

### Seed demo

- Coach demo: `emailVerified: true`, `Subscription` **active** (mock)
- Mara atleta: `emailVerified: true`

### Tests

- `billing.int.test.ts`, `password-reset.int.test.ts`, `signup-honeypot.int.test.ts`
- **`pnpm --filter @holy-oly/api verify`** → PASS (tras fix `comps: []` en billing test)

---

## 3. Decisiones del owner (bloquean comercial)

### 3.1 Proveedor de pago → **Mercado Pago Chile** (preferencia declarada)

- API Suscripciones: `preapproval_plan` + `preapproval`, CLP, webhooks `x-signature`
- Comisiones MP Chile (suscripciones): **3,19%** al instante · **2,89%** a 10 días (+ IVA sobre comisión)
- Código actual: adapter **`mock`** en `apps/api/src/billing/`. Falta `mercadopago.ts` + env `MERCADOPAGO_ACCESS_TOKEN`

### 3.2 Precios de planes (NO están en el repo)

El owner indicó tiers aproximados:

| Plan | Precio CLP/mes (referencia owner) |
|------|-----------------------------------|
| Básico | **$50.000** |
| (siguiente tier) | **$80.000** |
| … | escalonado (“y así”) |

**No hay `MEMORY.md` en el repo** (solo referenciado en planes viejos). **No hay constantes de precio en código** — `SuscripcionScreen` es genérica (“Activar plan demo”). **Acción:** documentar tiers en `docs/` o `packages/core` y mapear a `preapproval_plan_id` de MP.

### 3.3 Otros bloqueantes

- Proveedor email real (Resend/Postmark/SES) + SPF/DKIM
- Registro abierto vs solo invitación (E1 — honeypot ya está)
- Revisión legal de `/privacidad` y `/terminos`
- Región de datos (`docs/adr/2026-06-07-data-region.md`)
- Push / Railway / dominio propio

---

## 4. Variables de entorno nuevas (`apps/api/.env.example`)

```env
APP_ORIGIN="http://localhost:8765"
EMAIL_PROVIDER="console"
BILLING_PROVIDER="mock"
BILLING_WEBHOOK_SECRET="dev-mock-webhook-secret"
# BILLING_ENFORCE="false"      # off solo si quieres desactivar gating local
# EMAIL_VERIFY_ENFORCE="false"
```

**Comportamiento gating:**

- `billingEnforced()`: OFF en `NODE_ENV=test` salvo `BILLING_ENFORCE=true`; ON en dev/prod salvo `BILLING_ENFORCE=false`
- `emailVerifyEnforced()`: mismo patrón con `EMAIL_VERIFY_ENFORCE`

---

## 5. Reglas de producto (NO romper)

Ver `docs/domain/HOLY-OLY-DOMAIN.md`:

- Discos **solo** vía `apps/web/src/ui/Disc.tsx`
- Filas atleta: **kg + discos**; **RPE no en superficie atleta**
- Ciclo crudo **nunca** al coach → solo `redactCycle`

---

## 6. Comandos útiles

```powershell
cd "C:\Holy Oly 0017"

# Demo local (Postgres embebido + API + SPA :8765)
node apps/api/scripts/local-app.mjs

# Verificación completa API (migraciones + int tests)
pnpm --filter @holy-oly/api verify

# Monorepo
pnpm -r typecheck
pnpm -r test

# Nueva migración (revisar SQL a mano)
pnpm --filter @holy-oly/api exec tsx scripts/make-migration.ts <N> <nombre>
```

**Login demo:** `coach@holyoly.dev` / `holyoly-demo`

**Emails en dev:** salen por `console` (stdout del API) — buscar `[email:password_reset]` o `[email:email_verify]`.

---

## 7. Orden sugerido para la próxima sesión

```text
1. [Owner] Confirmar tabla de planes: nombres, $50k / $80k / …, límites (atletas? features?)
2. Commit del working tree launch-readiness (si el owner lo pide)
3. Adapter Mercado Pago:
   - Crear planes en MP (preapproval_plan por tier)
   - POST /billing/checkout → init_point real
   - Webhook → actualizar Subscription.status
4. Pantalla Suscripción: mostrar tiers y precios CLP
5. Email provider real (Resend/etc.)
6. E6 Playwright security E2E en CI (opcional)
7. Push + deploy (solo con OK explícito)
```

### Lo que puede hacer la próxima sesión SIN esperar

- Escribir `docs/pricing.md` o constantes `PLANS` con $50.000 / $80.000
- Esqueleto `billing/mercadopago.ts` (checkout + webhook parser)
- Tests con fixtures MP sandbox
- UI de selección de plan en `SuscripcionScreen`

---

## 8. Referencias

| Doc | Contenido |
|-----|-----------|
| `docs/superpowers/HANDOFF-2026-06-08-launch.md` | Roadmap original E1–E8 |
| `docs/superpowers/DEPLOY.md` | Render/Railway, env prod |
| `docs/adr/2026-06-07-data-region.md` | Región US vs LatAm |
| `docs/domain/HOLY-OLY-DOMAIN.md` | Reglas coach/atleta |

---

## 9. Prompt listo para pegar en otra ventana

```text
Continúa Holy Oly desde docs/superpowers/HANDOFF-2026-06-09-launch-continuation.md.

Contexto: andamiaje launch en working tree sin commit; verify verde; MP Chile elegido;
planes ~$50.000 / $80.000 CLP (owner, no en código aún).

Prioridad: (1) documentar tiers y límites, (2) adapter Mercado Pago sobre billing mock,
(3) UI suscripción con precios. NO push a origin sin pedirlo.
```

---

*Generado 2026-06-09 tras completar launch scaffolding + verify verde.*
