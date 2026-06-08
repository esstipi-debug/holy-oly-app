# HANDOFF — Holy Oly: GO-LIVE (handoff canónico)

- **Fecha:** 2026-06-08 · **Doc de verdad del estado actual y qué falta para lanzar.** Leer entero.
- Consolida y reemplaza los handoffs previos (`HANDOFF-2026-06-08-launch.md`, `HANDOFF-2026-06-09-*` quedan como historia/detalle).
- **origin/main:** `e3924c3` (pusheado + deployado a Render `holy-oly.onrender.com`).

---

## 0. Estado en una línea
**Seguridad (A–D) + lanzamiento (email/recuperación, Google OAuth, billing, gating, legal, onboarding) + pricing real 5-tiers + setup de Mercado Pago: TODO codeado y en prod.** Falta sólo **acción del owner**: token MP + correr el script de planes + email real + backups/dominio + revisión legal. Sigue en **mock** hasta poner el token de MP.

## 1. Qué está hecho y en prod
- **Seguridad (Oleadas A–D):** rate-limit + lockout, seed-guard, CI (audit+gitleaks), invite 60-bit, body/timeout, audit log, anti-enumeración + password policy, revocación de sesiones, helmet CSP/HSTS, logs sin PII, **cifrado de ciclo en reposo (AES-256-GCM)**, export + borrado de cuenta, índice/purga de sesiones, validación movementId.
- **Lanzamiento:** email + reset + verify (B6), **billing** (adapter MP + mock, gating **402** sin suscripción / **403** sin email verificado), **Google OAuth**, signup **honeypot** (E1), páginas legales borrador (`/privacidad`, `/terminos`), `SuscripcionScreen`, **onboarding** (guía primera vez). Migraciones 0→14.
- **Pricing real (5 tiers)** en `packages/core/src/billing/plans.ts` — net + IVA, **anual = 2 meses gratis**:

  | id | Plan | Atletas | Coaches | Mensual | Anual |
  |----|------|---------|---------|---------|-------|
  | `coach` | Coach | 1–15 | 1 | $19.900 | $199.000 |
  | `pro` | Pro | 16–40 | 1–2 | $39.900 | $399.000 |
  | `elite` | Elite | 41–80 | 3 | $69.900 | $699.000 |
  | `box` | Box/Club | 81–250 | ilimitado | $129.900 | $1.299.000 |
  | — | Multi-sede | 250+ | ilimitado | contacto (desde $199.900) | — |

  ⚠️ **Precios PROVISORIOS** — falta anclar a **Volt** y confirmar. Al cambiarlos: editar `plans.ts` y **re-correr el script de MP**.
- **Mercado Pago armado:** `apps/api/src/billing/mercadopago.ts` (checkout `preapproval` + webhook `x-signature` + idempotencia) + `scripts/mp-setup-plans.ts` (crea los 8 `preapproval_plan` desde la grilla, monto bruto net×1,19; `--dry-run` previsualiza). UI anual-first (toggle "2 meses gratis", "+ IVA", Multi-sede "Contactanos").
- **Carta de oro local:** `apps/api/scripts/local-app.mjs` + `C:\HolyOlyDemo\*.vbs` (coach + Kevin=atleta). Deploy: `Dockerfile` + `railway.json` + `render.yaml` + `DEPLOY.md`.
- **Verde:** core 157 · api 49 unit + 55 int + e2e · web 258 · typecheck/build limpios.

## 2. ✅ Para GO-LIVE de cobro (acción del owner, ~15 min)
1. Crear cuenta MP (empezar **sandbox**) → `MERCADOPAGO_ACCESS_TOKEN`.
2. `pnpm --filter @holy-oly/api exec tsx scripts/mp-setup-plans.ts --dry-run` (previsualizar) → luego sin `--dry-run` con el token → copiar los `MERCADOPAGO_PLAN_*`.
3. Env (Render/Railway): pegar esos ids + `MERCADOPAGO_WEBHOOK_SECRET` + `BILLING_PROVIDER=mercadopago`.
4. Dashboard MP: webhook → `https://<dominio>/billing/webhook` (evento `subscription_preapproval`).

## 3. Resto del go-live (owner / no-código)
- **Email real:** elegir provider (Resend/Postmark/SES) + SPF/DKIM/DMARC; `EMAIL_PROVIDER` + key. (Dev = `console`.)
- **Infra:** backups del Postgres + restore probado; setear `CYCLE_ENCRYPTION_KEY` (64 hex, estable) + `APP_ORIGIN`; dominio propio; ¿Railway como respaldo? (ver `DEPLOY.md`).
- **Legal:** revisar `/privacidad` + `/terminos`; decisión de región (`docs/adr/2026-06-07-data-region.md`).
- **Registro:** honeypot listo; decidir abierto vs invitación.

## 4. Mejoras de negocio pendientes (código, post-precio-final)
- **Promo coach fundador 20%** (precio grandfathered): set de planes "founding" al 80% o cupón. (No construir hasta fijar precio post-Volt.)
- **Nudge anual día 60–90** (no empujar anual en el registro; ofrecerlo cuando vio valor).
- **Upgrade automático prorrateado** al superar el tope de atletas.
- (Opcional) **E6 Playwright** security E2E en CI nightly.

## 5. GOTCHAS (no romper)
- **Push a `main` = auto-deploy a Render prod.** No pushear sin OK.
- ⚠️ **Multi-sesión:** hubo varias sesiones empujando a `main` a la vez (lanzamiento, onboarding) → colisiones de git. El checkout local `C:\Holy Oly 0017` suele quedar **detrás de origin**: **`git pull` antes** de tocar nada, o usar ramas + PR. No correr varios agentes pusheando a `main` en paralelo.
- **No hay Docker** local → `embedded-postgres`; el `Dockerfile` lo compila la plataforma.
- **Migraciones:** `tsx scripts/make-migration.ts <N> <nombre>` y **revisar el SQL** (Prisma genera drop+add destructivo en cambios de tipo — pasó en mig 12, reescrita a `ALTER ... USING`).
- **Reglas de producto:** discos sólo vía `apps/web/src/ui/Disc.tsx`; filas atleta = kg+discos; **RPE nunca** en superficie atleta; **ciclo crudo nunca** al coach (sólo `redactCycle`).
- Gating local: `BILLING_ENFORCE` / `EMAIL_VERIFY_ENFORCE` (off en test).

## 6. Comandos
```
pnpm --filter @holy-oly/api verify     # int + migraciones (PG embebido)
pnpm --filter @holy-oly/api e2e        # e2e full-flow
pnpm -r test ; pnpm -r typecheck ; pnpm lint ; pnpm audit --audit-level=high
node apps/api/scripts/local-app.mjs    # carta de oro local (:8765)
pnpm --filter @holy-oly/api exec tsx scripts/mp-setup-plans.ts --dry-run   # previsualizar planes MP
```
Login demo: `coach@holyoly.dev` / `holyoly-demo`. Emails dev → stdout (`[email:...]`).

## 7. Prompt para la próxima sesión
```text
Continúa Holy Oly desde docs/superpowers/HANDOFF-GO-LIVE.md.
Estado: seguridad + lanzamiento + pricing 5-tiers + setup MP en prod (Render). MP en mock hasta token.
Pendiente owner: token MP + correr scripts/mp-setup-plans.ts + email real + backups/dominio + legal + anclar precios a Volt.
Pendiente código (post-precio): promo coach fundador 20%, nudge anual día-60, upgrade prorrateado.
NO push a main sin OK (dispara deploy prod). git pull antes de tocar (multi-sesión).
```

| Doc | Detalle |
|-----|---------|
| `docs/pricing.md` | grilla + cortes + posicionamiento + runbook MP |
| `DEPLOY.md` · `adr/2026-06-07-data-region.md` · `specs/2026-06-07-security-improvement-plan.md` | deploy · región · plan seguridad |
| `INCIDENT-RESPONSE.md` | runbook de incidente/brecha |

*Consolidado 2026-06-08: A–D + lanzamiento + pricing + MP en prod; falta token MP + email + infra + legal + anclar precios.*
