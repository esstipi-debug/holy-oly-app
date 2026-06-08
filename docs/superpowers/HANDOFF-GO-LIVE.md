# HANDOFF — Holy Oly: GO-LIVE (handoff canónico)

- **Fecha:** 2026-06-08 · **Reemplaza/consolida** los handoffs previos (`HANDOFF-2026-06-08-launch.md`, `HANDOFF-2026-06-09-launch-continuation.md`, `HANDOFF-2026-06-09-google-oauth.md` quedan como historia/detalle).
- **Este es el doc de verdad del estado actual y qué falta para lanzar.** Leer entero.

---

## 0. Estado en una línea
**Seguridad (A–D) + lanzamiento (billing/email/OAuth/gating/legal) IMPLEMENTADO, en `main`, PUSHEADO y DEPLOYADO a Render prod** (`holy-oly.onrender.com`). Falta: **planes ANUALES** + **go-live de Mercado Pago** (llaves + planes reales) + **email real** + decisiones owner. CI verde (fix de `signed-cookie.test` aplicado, commit `8a6eabc`).

---

## 1. Qué YA está hecho y en producción
- **Seguridad completa (Oleadas A–D):** rate-limit + lockout, seed-guard, CI (audit+gitleaks), invite 60-bit, body/timeout, **audit log**, anti-enumeración + password policy, revocación de sesiones, **helmet CSP/HSTS**, logs sin PII, **cifrado de ciclo en reposo (AES-256-GCM)**, export + borrado de cuenta, índice/purga de sesiones, validación movementId. Migraciones 0→12.
- **Lanzamiento (otra sesión, commit `dbd5f0c`):** email/reset/verify (B6), **billing** (`apps/api/src/billing/` con adapter **mock** + `mercadopago.ts` scaffold + gating **402** `requireCoachWrite` + **403** si email no verificado al confirmar vínculo), **signup honeypot** (E1), **Google OAuth**, páginas legales borrador (`/privacidad` `/terminos`), `SuscripcionScreen`. Migraciones **13** (launch_readiness) + **14** (google_oauth). `Subscription` + `WebhookEvent` + `PasswordResetToken` + `EmailVerificationToken`.
- **Precios en código (`packages/core/src/billing/plans.ts`):** 2 tiers **MENSUALES** — `Básico $50.000` (10 atletas) · `Equipo $80.000` (30 atletas).
- **Carta de oro local:** `apps/api/scripts/local-app.mjs` + `C:\HolyOlyDemo\*.vbs` (ahora coach + Kevin=atleta vía `HOLYOLY_DEMO_AS`).
- **Deploy:** `Dockerfile` + `railway.json` + `render.yaml` + `DEPLOY.md`. **main está pusheado y deployado** (Render).
- **Verde:** core 152 · api 47 unit + 55 int + e2e · web 245 · typecheck/lint limpios.

---

## 2. 🎯 DECISIÓN FIJADA: Mercado Pago + estrategia ANUAL-first
- **Proveedor: Mercado Pago Chile** (confirmado: soporta suscripciones mensual→anual; comisión ~**2,89–3,19% + IVA** por cobro, sin costo fijo).
- **Estrategia del owner: vender ANUALIDADES** para asegurar caja y expandirse más rápido → el plan **anual es el destacado**; el mensual queda como entrada.
- ⚠️ **GAP:** el código hoy tiene **sólo planes MENSUALES** (`plans.ts`). **Falta agregar planes ANUALES** y destacarlos. Sugerencia: anual = **~10× el mensual** (2 meses gratis) → Básico anual ≈ $500.000, Equipo anual ≈ $800.000 (owner confirma cifras).

---

## 3. ✅ Checklist para GO-LIVE (lo que falta)
**Cobro (la pieza grande, casi lista):**
- [ ] **Owner:** crear cuenta MP + `MERCADOPAGO_ACCESS_TOKEN` (sandbox + prod) + `BILLING_WEBHOOK_SECRET`.
- [ ] **Owner:** confirmar precios **anuales** (y mensuales) + límites de atletas.
- [ ] **Código:** agregar tiers **anuales** en `plans.ts` (id, priceClp anual, `frequency_type: 'years'`); destacarlos en `SuscripcionScreen`.
- [ ] **Owner:** crear los `preapproval_plan` en el dashboard MP (uno por tier/frecuencia) → setear `MERCADOPAGO_PLAN_*` (ver `mercadoPagoPlanEnvKey`).
- [ ] **Código:** terminar/validar `billing/mercadopago.ts` (checkout `init_point` real + webhook `x-signature` + idempotencia `WebhookEvent`); switch `BILLING_PROVIDER=mercadopago`. Tests con sandbox.

**Email (B0/B6 — recuperación ya codeada, falta provider real):**
- [ ] **Owner:** elegir provider (Resend/Postmark/SES) + SPF/DKIM/DMARC; setear `EMAIL_PROVIDER` + key. (Dev usa `console`.)

**Infra / legal / producto:**
- [ ] Activar **backups** del Postgres prod + probar 1 restore (A4a). Setear en prod: `CYCLE_ENCRYPTION_KEY` (64 hex), MP + email keys, `APP_ORIGIN`.
- [ ] **Dominio propio** (en vez de `*.onrender.com`). ¿**Railway** además/en vez de Render? (ver §abajo).
- [ ] **Legal:** revisar `/privacidad` y `/terminos` (borradores) + decisión de región (`docs/adr/2026-06-07-data-region.md`).
- [ ] **Registro:** honeypot listo; decidir abierto vs sólo-invitación.
- [ ] (Opcional) **E6 Playwright** security E2E en CI nightly.

---

## 4. Env vars de producción
`DATABASE_URL` · `NODE_ENV=production` · `SERVE_WEB=true` · `CYCLE_ENCRYPTION_KEY` (64 hex) · `APP_ORIGIN` · `EMAIL_PROVIDER`(+key) · `BILLING_PROVIDER=mercadopago` · `MERCADOPAGO_ACCESS_TOKEN` · `BILLING_WEBHOOK_SECRET` · `MERCADOPAGO_PLAN_*` (por tier) · opcionales `SESSION_TTL_DAYS`/`SINGLE_SESSION_LOGIN`/`WEB_ORIGIN`. Para sembrar: `ALLOW_DEMO_SEED=true`+`SEED_*`. Detalle: `apps/api/.env.example` + `DEPLOY.md`.

## 5. Hosting / respaldo (recordatorio)
**Ya está en Render prod (pusheado).** Para respaldo/velocidad: **Railway** (sin cold-start, Postgres persistente, ~$5–10/mes) como primaria + Render como standby; el respaldo real = **backups de DB + restore probado**. Deploya con el mismo `Dockerfile`. (Render free borra la DB a los 90 días → subir de plan o migrar.)

## 6. GOTCHAS (no romper)
- **Push a `main` = auto-deploy a Render prod.** No pushear sin OK del owner.
- **No hay Docker** en la máquina → local usa `embedded-postgres`; el `Dockerfile` lo compila la plataforma.
- **Migraciones:** `pnpm --filter @holy-oly/api exec tsx scripts/make-migration.ts <N> <nombre>` y **revisar el SQL** (Prisma genera drop+add destructivo en cambios de tipo — pasó en mig 12, se reescribió a `ALTER ... USING`).
- **Reglas de producto:** discos sólo vía `apps/web/src/ui/Disc.tsx`; filas atleta = kg+discos; **RPE nunca** en superficie atleta; **ciclo crudo nunca** al coach (sólo `redactCycle`).
- Gating local: `BILLING_ENFORCE` / `EMAIL_VERIFY_ENFORCE` (off en test).

## 7. Comandos
```
pnpm --filter @holy-oly/api verify     # int + migraciones (PG embebido)
pnpm --filter @holy-oly/api e2e        # e2e full-flow
pnpm -r test ; pnpm -r typecheck ; pnpm lint ; pnpm audit --audit-level=high
node apps/api/scripts/local-app.mjs    # carta de oro local (:8765)
```
Login demo: `coach@holyoly.dev` / `holyoly-demo`. Emails dev → stdout (`[email:...]`).

## 8. Prompt para la próxima sesión
```text
Continúa Holy Oly desde docs/superpowers/HANDOFF-GO-LIVE.md.
Estado: seguridad + lanzamiento en prod (Render). MP fijado, estrategia ANUAL-first.
Prioridad: (1) agregar planes ANUALES en packages/core/src/billing/plans.ts + destacarlos en SuscripcionScreen,
(2) terminar billing/mercadopago.ts (checkout init_point + webhook x-signature + idempotencia) con sandbox,
(3) email provider real. NO push a main sin OK (dispara deploy prod).
```

| Doc | Detalle |
|-----|---------|
| `HANDOFF-2026-06-09-launch-continuation.md` | detalle del scaffolding de lanzamiento + env |
| `HANDOFF-2026-06-09-google-oauth.md` | detalle Google OAuth |
| `DEPLOY.md` · `adr/2026-06-07-data-region.md` · `specs/2026-06-07-security-improvement-plan.md` | deploy · región · plan seguridad |

*Consolidado 2026-06-08: seguridad A–D + lanzamiento en prod; falta anualidades + go-live MP + email real.*
