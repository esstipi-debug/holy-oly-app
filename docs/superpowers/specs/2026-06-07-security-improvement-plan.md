# Holy Oly — Plan de mejora de seguridad · **v2 (verificado contra el código)**

- **Fecha:** 2026-06-07
- **Estado:** Borrador operativo · complementa Fase 6 del [roadmap de producción](./2026-06-01-production-readiness-roadmap.md)
- **Alcance:** API Fastify + Prisma + Postgres + SPA React (despliegue same-origin en Render)
- **Audiencia:** implementación incremental con TDD e integration tests (patrón `*.int.test.ts` en `apps/api`)
- **Método de esta revisión:** la v1 fue una pasada *read-only*. La v2 **auditó el código real** con 6 revisores especializados en paralelo (auth/sesiones, authz/multi-tenant, datos-en-reposo/DB, SPA/cliente, hardening HTTP/deploy, y crítica estructural del plan). Cada hallazgo abajo está respaldado con `archivo:línea`. Ver el **Apéndice A** para la tabla de evidencia completa.

> Objetivo: llevar la postura de seguridad de **~7/10 (demo controlado)** a **≥8.5/10 (SaaS público B2B)** antes de abrir registro masivo y cobro con Mercado Pago.

---

## 0. Qué cambió respecto a la v1 (el valor de la auditoría)

La pasada read-only era buena, pero al mirar el código real aparecieron correcciones de **hecho**, de **severidad** y de **secuencia**. Las más importantes:

| # | Corrección | v1 decía | v2 (verificado en código) |
|---|------------|----------|----------------------------|
| 1 | **A2 vive en el lugar equivocado** | "CI check en `start:prod`" | `start:prod` **nunca** llama al seed. El reset destructivo es incondicional en `seed.ts:92-109` (invocado en `:195`). El guard debe ir **dentro de `seed.ts`**. |
| 2 | **B1 NO está hecho** | "verificar Argon2 con hash dummy" (como si faltara confirmar) | Falta y está **admitido en un comentario** del código (`auth/routes.ts:62`). Subir a **HIGH** y separar de B2. |
| 3 | **Código de invitación = 40 bits, no ≥60** | "Entropía ≥ 60 bits" (objetivo, P2/Oleada E) | El código real es 8 chars × alfabeto-32 = **40 bits exactos** (`vinculo/routes.ts:7-12`). Sin rate-limit, es brute-forceable. **Promover a P0** y emparejar con A1. (No hay sesgo de módulo: 256 % 32 = 0.) |
| 4 | **D4 es un bug de schema, no solo "documentar cascada"** | "cascada y retención legal documentada" | `Athlete.user` usa `onDelete: SetNull` (`schema.prisma:95`) mientras TODA tabla hija del atleta cascadea. Borrar el `User` deja **vivos** ciclo/daylog/actuals → **viola la invariante 3**. Subir a **HIGH**. |
| 5 | **D1 (cifrado en reposo) está sub-priorizado** | Oleada D (P1–P2); riesgo "Fuga ciclo = Baja (mitigado)" | `redactCycle` protege solo la **vía API**. `CycleConsent.state` está en **texto plano** (`schema.prisma:236-241`). Un dump/backup expone amenorrea/RED-S crudo → **HIGH por la vía at-rest**. Debe ir **antes** de activar backups (A4a). |
| 6 | **D2 es casi un no-op** | "Migración: `Athlete.id` UUID para registros post-signup" | El schema **ya usa** `@default(uuid())` y el signup nunca pasa `id` (`schema.prisma:93`). No hace falta migración; el único riesgo (IDs cortos `mv`/`coach-stub`) es del **seed** → se cubre con A2. |
| 7 | **No existe CI en absoluto** | A5 "pipeline falla en critical/high" (como si hubiera pipeline) | No hay `.github/` (verificado). A5 es "crear CI desde cero (typecheck+tests+`pnpm audit`)", no "agregar un step". |
| 8 | **Faltan controles enteros** | — | Sin **audit log**, sin **recuperación de cuenta/verificación de email**, sin **límites de body/timeout (DoS)**, sin **secret-scanning** (repo público), sin **lockout por cuenta** (A1 es solo por-IP). Ver §3. |
| 9 | **Ítems ya hechos marcados como pendientes** | CORS/error-handler/headers como gaps abiertos | CORS fail-fast (`server.ts:38-45`), error-handler genérico sin stack (`server.ts:47-50`), `X-Frame-Options: DENY` (`render.yaml:46-47`) y sourcemaps off (`vite.config.ts:34`) **ya están**. Mover a "lo que ya está bien". |
| 10 | **Inconsistencias internas** | baseline 7/10 (§1) vs 4/10 (§8); ≥8.5 vs ≥8; "4 P0" vs 5 ítems vs 7 gaps | Reconciliadas abajo (§1.1, §8). Matriz de riesgo separada en **inherente vs residual**. |

---

## 1. Resumen ejecutivo

### 1.1 Postura (baselines reconciliados)

Son **dos escenarios distintos**, no una contradicción:

| Escenario | Postura | Nota |
|-----------|---------|------|
| Demo controlado actual (registro no anunciado, pocos usuarios) | **~7/10** | Buenos fundamentos: sesiones, Argon2id, multi-tenant, redacción de ciclo. |
| Si se abriera al público **hoy** | **~4/10** | Brute-force sin freno, seed destructivo accesible, sin backups, sin recuperación de cuenta. |
| **Objetivo launch** | **≥8.5/10** | Cerrando Oleadas A–C + D1/D4. |

### 1.2 Lo que YA está bien — **verificado en código** (no reimplementar)

| Control | Evidencia |
|---------|-----------|
| Sesiones | Token 20 bytes → cookie; solo SHA-256 en BD (`auth/session.ts`) |
| Contraseñas | Argon2id; params de librería dentro del rango OWASP (`auth/password.ts`) |
| Multi-tenant coach | `guardAthlete` + Vínculo activo en `/athletes/*` (`auth/guards.ts`) |
| Superficie atleta | `/me/*` usa `athleteId` de sesión; sin IDOR por path (`me/routes.ts`) |
| Redacción de ciclo | `redactCycle` descarta `state` crudo; test `server.int.test.ts:57-64` (`not.toHaveProperty("state")`) — **invariante 1 verificada** (`cycle.ts:9-15`) |
| **CORS** | Fail-fast correcto; el path reflect-any-origin es **inalcanzable** en prod (`server.ts:38-45`) — **ya cumple C4** |
| **Error handler** | Devuelve `{ error: "internal server error" }` genérico y loguea server-side; **sin fuga de stack** (`server.ts:47-50`) |
| **Headers de borde** | `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` (`render.yaml:44-53`) |
| Build | Sourcemaps off (`vite.config.ts:34`); `/gallery` dev-only |
| **Cliente** | Cookie httpOnly; `credentials:"include"` en todos los fetch; **sin token en localStorage** (solo data de demo); `AuthUser` solo en React state. **Cero `console.*`** en `apps/web/src`. Sin secretos `VITE_*`. El único `dangerouslySetInnerHTML` (`HolyOlyIcon.tsx`) es SVG estático sin input de usuario. |
| Logout | Invalida sesión en BD (`invalidateSessionToken`) |

### 1.3 Brechas principales (re-priorizadas)

1. **Sin rate limiting + sin lockout por cuenta** → brute force de login y de códigos de invitación de **40 bits**.
2. **Seed destructivo accesible en prod** → un comando en la Shell de Render borra toda la BD (sin guard hoy).
3. **Sin backups** y Postgres free que **se borra ~2026-07-01** → riesgo de pérdida total.
4. **Datos sensibles en texto plano** → `CycleConsent.state` (ciclo) sin cifrado en reposo.
5. **Borrado de cuenta deja datos de salud vivos** (bug `SetNull`).
6. **Sin recuperación de cuenta ni verificación de email** → coach que paga puede quedar bloqueado para siempre; cualquiera registra `coach@victima.com`.
7. **Hardening HTTP incompleto** → falta CSP/HSTS (los demás headers ya están).
8. **Sin CI, sin secret-scanning, sin audit log** → repo **público** sin red de seguridad.
9. **Pagos (Fase 5)** → webhooks MP aún sin firma/idempotencia.

---

## 2. Principios de diseño (invariantes)

No deben romperse al aplicar mejoras:

1. **El ciclo crudo nunca sale del servidor hacia el coach** — solo `CycleContext` redactado (`HOLY-OLY-DOMAIN.md`, HR-1/HR-2). *(Verificado hoy en `cycle.ts`.)*
2. **Todo acceso coach-scoped exige Vínculo activo** — no confiar en IDs adivinables en URL. *(Backstop recomendado: D6.)*
3. **El atleta es dueño de sus datos de ciclo y daylog** — export/borrado deben ser posibles. ⚠️ **Hoy NO se cumple en borrado** (bug D4). Hasta cerrar D3/D4 esto es un **objetivo en curso**, no una invariante satisfecha (corrige la contradicción con §9.3 de la v1).
4. **Secretos y claves de pago solo server-side** — nunca `VITE_*` para MP ni pepper de cifrado. *(Verificado hoy; checklist de PR para Fase 5.)*
5. **Cambios security-critical van con tests de integración** — `server.int.test.ts`, `writes.int.test.ts`, `me.int.test.ts`. **Sin excepciones "opcional"/"o documentado"** (ver §3, criterios endurecidos).

---

## 3. Roadmap de mejoras (oleadas re-priorizadas)

> Cada criterio de aceptación es un **test ejecutable**, no prosa. Esfuerzo: S(≤0.5d) · M(0.5–2d) · L(>2d).

### Oleada A — Bloqueadores pre-launch (P0 · explotable o pérdida-de-datos)

| ID | Mejora | Acción concreta (verificada) | Criterio de aceptación (test) | Esf |
|----|--------|------------------------------|-------------------------------|-----|
| **A1** | Rate limiting | `@fastify/rate-limit@^9` (Fastify 5). Por-ruta: `/auth/login`,`/auth/signup` 10/min/IP; `/vinculos/accept` 5/min/IP; `/invite/rotate` 3/min/IP. Store en memoria (1 instancia) o Redis si se escala. | `server.int.test.ts`: el 11º login fallido/IP en 60s → **429** con `Retry-After`; otra IP en la ventana sigue 401/200. Ídem accept→429 al 6º. | M |
| **A1b** | **Lockout por cuenta** *(NEW)* | Contador de fallos por email + bloqueo blando (p.ej. 10 fallos→15min), independiente del bucket por-IP. Motivo: LatAm usa CGNAT/wifi de gym → el límite por-IP falsea-positivos y no frena stuffing distribuido. Emite evento de audit (A9). | 10 contraseñas malas para un email → bloqueo aunque cada request venga de IP distinta; otra cuenta desde IP nueva sigue funcionando. | M |
| **A2** | Guard de seed en prod | **Dentro de `seed.ts`** (no en `start:prod`): `if (NODE_ENV==="production" && ALLOW_DEMO_SEED!=="true") throw`. Extraer `assertSeedAllowed()` exportable. | `seed-guard.test.ts` (sin DB): con `NODE_ENV=production` y sin `ALLOW_DEMO_SEED` → throw; con el flag → no throw. | S |
| **A3** | Secretos demo | Quitar los literales fallback `?? "holyoly-demo"`/`?? "HOLY-DEMO"` (`seed.ts:10-11`); hacer `SEED_*` **requeridos** cuando el seed corre. Sacar las creds de `DEPLOY.md` (o allowlist explícita de gitleaks). | El seed lanza si falta `SEED_COACH_PASSWORD`; gitleaks (A8) no encuentra literales fuera del allowlist. | S |
| **A4a** | **Backups + restore** *(split de A4)* | Habilitar backups de Postgres y **probar un restore**. Documentar RPO/RTO en `DEPLOY.md`. Interim free-tier: `pg_dump` manual programado. Deadline duro: la DB free se borra ~2026-07-01. | Restore documentado y ejecutado una vez (RPO/RTO registrados); `render.yaml` DB `plan != free`. | M |
| **A5** | **CI desde cero + audit** | Crear `.github/workflows/ci.yml`: `pnpm install --frozen-lockfile` → `pnpm -r typecheck` → `pnpm -r test` → `pnpm audit --audit-level=high` (falla en high/critical). | CI falla ante un advisory high/critical sembrado sin waiver. Script `"audit"` corre local. | S |
| **A6** | **Entropía de invitación** *(promovido de E2)* | `genInviteCode`: 12 chars (12×log2(32)=**60 bits**). Endurecer `AcceptCodeSchema` a `regex(/^[A-Z2-9]{12}$/)` (elimina la fuga 400-vs-404 y descarta antes de tocar la BD). Actualizar seed `HOLY-DEMO`→12 chars. | `vinculo.int.test.ts`: código rotado matchea `/^[A-Z2-9]{12}$/`; un código mal-formado → **400** (no 404). | S |
| **A7** | **Límites de body/timeout (DoS)** *(NEW)* | `Fastify({ bodyLimit: 256*1024, requestTimeout: 15000, connectionTimeout: 10000 })`. Acotar largos de array en los Zod de escritura. | `server-static.test.ts`: body de 300KB → **413**; array de sesión sobre el cap → 400. | S |
| **A8** | **Secret scanning** *(NEW · repo público)* | gitleaks en CI (falla ante secreto); escanear el historial una vez. El repo es público para el auto-deploy de Render → riesgo real. | CI falla ante una API key falsa sembrada; baseline limpio (o allowlist documentado de las creds demo). | S |
| **A9** | **Audit / security-event log** *(NEW)* | Tabla `AuditEvent{ actorUserId, actorRole, action, targetAthleteId?, ip, ts }` (o JSON estructurado). Eventos: login ok/fallo, logout, signup, revoke, cada cambio de Vínculo, cada lectura/escritura coach de `/athletes/:id/*` (esp. `/cycle`), export/borrado. **Sin** password/token/estado-de-ciclo crudo. *Habilita la métrica "<15 min detección" y la evaluación de brecha.* | `*.int.test.ts`: un login fallido y una lectura coach de `/cycle` emiten **1** registro c/u con actor+target+ts; ningún registro contiene PII sensible. | M |

**P0 = {A1, A1b, A2, A3, A4a, A5, A6, A7, A8, A9}** (10 ítems) — usado como baseline en §8. **Riesgo si se omite:** alto (cuentas comprometidas, DB perdida, sin forense).

---

### Oleada B — Autenticación e identidad (P1)

| ID | Mejora | Acción concreta (verificada) | Criterio de aceptación (test) | Esf |
|----|--------|------------------------------|-------------------------------|-----|
| **B0** | **Proveedor de email** *(NEW · dependencia)* | Elegir transaccional (Resend/SES/Postmark) + SPF/DKIM/DMARC. **Bloquea B2/B6/E1.** Key solo server-side. | Envío de prueba en staging pasa DMARC; key no aparece como `VITE_*`. | M |
| **B1+B2** | **Anti-enumeración (login + signup, fusionados)** | Login: `DUMMY_HASH` a nivel módulo; cuando `!user`, correr `verifyPassword(DUMMY_HASH, pw)` igual (`auth/routes.ts:60-63`). Signup: dejar de devolver `409 "email already registered"` (`:32-34`) → 201 neutral (o flujo de confirmación vía B0). | Login email-inexistente vs password-malo: status+body **idénticos** y diferencia de tiempo mediana <50ms (50 muestras). Signup del mismo email dos veces → ambos 201, sin string "already registered". | S |
| **B3** | Revocación de sesiones | `invalidateSessionsByUserId` + llamarla en login si `SINGLE_SESSION_LOGIN`. Endpoint `POST /auth/sessions/revoke-all`. | `server.int.test.ts`: login(A)→login(B)→cookie A da 401 en `/auth/me` (con flag activo). | S |
| **B4** | TTL/renovación + **fix de cookie** | TTL por env (`SESSION_TTL_DAYS`, default coach=14/atleta=30; `session.ts:5-7`). **Bug NEW:** la cookie usa `expires` sin `maxAge`, y la renovación sliding actualiza `expiresAt` en BD pero **nunca re-emite la cookie** → el browser mantiene el vencimiento original. Agregar `maxAge` y re-set en el hook. ADR: sesión-larga sliding vs access+refresh. | `SESSION_TTL_DAYS=1` → sesión expira en 24h (test con reloj controlado); `Set-Cookie` incluye `Max-Age`. | S |
| **B5** | Política de contraseñas | Mínimo **12** chars + lista top-1000 (Set inline, no zxcvbn en el hot-path). Pasar params Argon2 explícitos (`memoryCost:65536,timeCost:3,parallelism:4,Argon2id`). | Signup con "password12" → 400; con 7 chars → 400; con 12 no-común → 201. | S |
| **B6** | **Recuperación + verificación de email** *(promovido de §9)* | Token de reset single-use, expira ≤1h, SHA-256 en BD (como sesiones). Bool `emailVerified` que gatea la activación del roster del coach. Depende de **B0**. Hoy `authRoutes` solo tiene signup/login/logout/me. | Reset single-use (2º uso→401), expirado→401, reset invalida todas las sesiones; coach no-verificado no activa roster. | L |
| **B7** | **2FA coach (opcional)** *(NEW)* | TOTP opcional para `role=coach` (el coach es la llave de todo el roster + billing). Atleta fuera de alcance. Diseñar sesión/recuperación para acomodarlo. | Coach con TOTP debe presentar código válido; recovery codes single-use. | L |

---

### Oleada C — HTTP, headers y logs (P1)

| ID | Mejora | Acción concreta (verificada) | Criterio de aceptación (test) | Esf |
|----|--------|------------------------------|-------------------------------|-----|
| **C1** | CSP | `@fastify/helmet@^13` en `buildServer()` (Fastify sirve el SPA → el header va en la app, no solo en el borde). **Debe** incluir `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com` y `font-src 'self' https://fonts.gstatic.com` por el `@import` de Google Fonts (`theme.css:12`) — si no, **se rompe la tipografía de marca**. `script-src 'self'`. Report-Only → enforce. | Respuesta a `/` trae CSP con `default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'`; sin `unsafe-inline` en `script-src`; SPA carga con 0 violaciones (Playwright). | M |
| **C2** | HSTS | Vía el mismo helmet, prod-gated: `maxAge:31536000, includeSubDomains, preload`. | `server-static.test.ts` con `NODE_ENV=production`: header `strict-transport-security` con `max-age=31536000`. | S |
| **C3** | CSRF (solo si split-origin) | Same-origin hoy (`SERVE_WEB=true`) → bajo. Si `WEB_ORIGIN`≠same: double-submit token o SameSite=Strict + chequeo de Origin en mutaciones. | Matriz de despliegue en `DEPLOY.md`. | M |
| **C4** | CORS | ✅ **Ya cumple** (`server.ts:38-45`). Solo agregar test de regresión del fail-fast. | Test: `NODE_ENV=production`, sin `SERVE_WEB` ni `WEB_ORIGIN` → `buildServer()` lanza. | S |
| **C5** | **Logs sin PII** | `Fastify({ logger:true })` + `reply.log.error(err)` pueden loguear emails/payloads. Config pino `redact:["req.headers.cookie","req.body.password","req.body.email","req.body.code"]`; loguear `err.message`, no el input. **NEW:** fijar `PrismaClient({ log: prod?["error"]:["warn","error"] })` (`db/client.ts:4`) para que nunca loguee queries con params. | Un 500 forzado en `/auth/login` no deja substring de email/password en el log. | S |
| **C6** | **Dueño único de headers** *(NEW · redundancia)* | Hoy 4 headers viven en el borde (`render.yaml`) y helmet emitiría algunos también → duplicados/conflicto. Elegir **una** capa (recomendado: helmet en la app, testeable + permite nonce) y quitar los solapados de `render.yaml`. | Cada header de seguridad aparece **exactamente una vez** en la respuesta a `/` y `/health`. | S |

---

### Oleada D — Datos sensibles y privacidad (P1)

| ID | Mejora | Acción concreta (verificada) | Criterio de aceptación (test) | Esf |
|----|--------|------------------------------|-------------------------------|-----|
| **D1** | **Cifrado de ciclo en reposo** *(re-priorizado ↑; antes de A4a)* | `CycleConsent.state`/`share` en texto plano (`schema.prisma:236-241`). AES-256-GCM app-level (Node `crypto`, IV 12 bytes prepend, clave `CYCLE_ENCRYPTION_KEY` hex-64 en env, rotable). Descifrar solo dentro de `getCycle` antes de `redactCycle`. Hook: Prisma `$extends`. **Secuencia:** hacerlo **antes** de activar backups (A4a) — backups de texto plano amplían el blast radius. | El row crudo de `cycleConsent.findUnique` **no** es igual a `"regular"`/`"amenorrhea"` (es ciphertext); el contrato coach (redacción) sigue verde. | M |
| **D2** | ~~UUIDs~~ → **corregido** | El schema **ya** usa `@default(uuid())` (`schema.prisma:93`); el signup no pasa `id`. **No hay migración.** Residual (IDs cortos del seed `mv`/`coach-stub`) se cubre con A2; además usar UUID para `COACH_ID` en el seed. | Tras seed, `coach.id != "coach-stub"` cuando `DEV_COACH_ID` no está. | S |
| **D3** | Export de datos atleta | `GET /me/export` (requireAthlete): agrega dayLog, cycleConsent (crudo — es del atleta), sessionActual, plan, medal, competencia. `Content-Disposition: attachment`. Si D1, descifrar antes. | `me.int.test.ts`: Mara → 200, body con `dayLogs` (24), `cycleConsent.state` presente, `plan` presente. | S |
| **D4** | **Borrado de cuenta** *(corregido a HIGH · bug de schema)* | `Athlete.user` es `onDelete: SetNull` (`schema.prisma:95`) → borrar el `User` deja vivos Athlete + ciclo/daylog/actuals. Agregar `DELETE /me/account` (transacción: `athlete.delete` → cascada hijos → `user.delete` → clear cookie). Mantener `SetNull` solo para "coach saca atleta del roster" (operación distinta). | `me.int.test.ts`: Mara → `DELETE /me/account` → 200 → `dayLog` de Mara = `[]` → re-login → 401. | M |
| **D5** | Limpieza de sesiones | `@@index([expiresAt])` en `Session` (falta; `schema.prisma:70-77`) — **mover a Oleada A** (one-liner, riesgo cero). ⚠️ **NEW:** Render free **no** tiene scheduler always-on (cron es de pago) → barrido lazy en boot + en `validateSessionToken` (ya borra el row encontrado), o gatear el cron bajo A4. | El índice existe; sesiones expiradas se eliminan sin depender de un scheduler externo. | S |
| **D6** | **Backstop multi-tenant** *(NEW · defensa en profundidad)* | El aislamiento es **solo** código app — un guard olvidado = fuga cross-tenant. Evaluar Postgres RLS (GUC `app.current_coach`/`current_athlete` por request) o, mínimo, un check de CI que falle si una ruta `/athletes/:id/*` no pasa por `guardAthlete`. | Con RLS: query cruda de atleta B bajo contexto de coach A → 0 filas. (O: el lint de CI falla ante una ruta sin guard.) | L |
| **D7** | **Validar `movementId`** *(NEW)* | El atleta puede escribir cualquier `movementId` arbitrario en `PUT /me/session` (`me/routes.ts:61-73`, `repo.ts:240-261`) — no se valida contra el catálogo. Zod `.refine(id => MOVEMENTS.has(id))` con el catálogo de `@holy-oly/core`. | `me.int.test.ts`: `movementId` inexistente → 400. | M |

---

### Oleada E — Producto, pagos y gobernanza (P2 · alineado Fase 5–6)

| ID | Mejora | Acción concreta | Criterio de aceptación | Esf |
|----|--------|-----------------|------------------------|-----|
| **E1** | Registro coach + **anti-bot** *(NEW)* | Waitlist/invitación/verificación (B6) antes de roster activo. Anti-bot liviano (honeypot o Turnstile) — A1 por-IP no frena botnets. | Signup sin challenge/invitación válido → 400/403. | M |
| **E3** | Webhook Mercado Pago | Verificación HMAC/firma; **ventana de replay ±5min**; **idempotencia por `payment_id`** (key persistida, transición de estado exactamente-una-vez). De-priorizar IP allowlist (las IPs de MP cambian). | Fixtures MP: firma mala→401; evento válido replayeado fuera de ±5min→401; `payment_id` duplicado→200 procesado una sola vez. | M |
| **E4** | Gating por suscripción | Middleware `requireActiveSubscription` en writes coach. | 402/403 coherente; test de integración. | M |
| **E5** | Monitoring/alertas | Sentry (o similar) sobre el audit log (A9): alertas auth-failures, 5xx, webhook failures. | Runbook en docs; alerta dispara en umbral. | M |
| **E6** | E2E seguridad | Playwright: login, cross-coach 403, ciclo sin leak — en CI nightly. | Suite verde en CI. | M |
| **E7** | **Runbook de incidente + brecha** *(NEW)* | `docs/INCIDENT-RESPONSE.md`: detect→contain→rotar sesiones/secretos→evaluar alcance (vía A9)→notificar. Postura de notificación de brecha para datos de salud (AR Ley 25.326). | Doc existe con procedimiento de revoke-masivo y árbol "¿es notificable?". | M |
| **E8** | **Región de datos / legal** *(NEW)* | Render US-Oregon hospeda datos de ciclo/wellness de usuarios AR/LatAm → transferencia transfronteriza (Ley 25.326). ADR con base legal o plan de mover región; nota en el aviso de privacidad. | ADR de residencia referenciado desde `DEPLOY.md`. | S |

---

## 4. Matriz de riesgos (inherente vs residual)

| Riesgo | Inherente | Residual HOY | Control objetivo | Oleada |
|--------|-----------|--------------|------------------|--------|
| Brute force login | Alta | **Alta** (sin rate-limit/lockout) | A1 + A1b | A |
| Adivinar invite code | Alta | **Alta** (40 bits, sin límite) | A1 + A6 (60 bits) | A |
| Credenciales/seed demo en prod | Alta | **Alta** (seed sin guard) | A2 + A3 | A |
| Pérdida de DB | Alta | **Alta** (free, sin backups, expira ~07-01) | A4a backups+restore | A |
| Fuga ciclo **vía API** | Media | **Baja** (mitigado: `redactCycle`) | mantener tests | ✅ |
| Fuga ciclo **vía dump/backup** | Alta | **Alta** (texto plano) | D1 cifrado at-rest (antes de A4a) | D |
| Borrado deja datos de salud | Alta | **Alta** (`SetNull`) | D4 | D |
| IDOR coach↔atleta | Media | **Baja** (mitigado en código; falta backstop+tests) | D6 + tests por endpoint | D |
| Sin recuperación de cuenta | Media | **Media** (lockout permanente del coach) | B0+B6 | B |
| Enumeración email | Media | **Media** (timing login + 409 signup) | B1+B2 | B |
| DoS por payload/conexión | Media | **Media** (default 1MiB, sin timeout) | A7 | A |
| Secreto commiteado (repo público) | Alta | **Media** (creds demo en docs) | A8 + A3 | A |
| Sin forense de incidente | Alta | **Alta** (sin audit log) | A9 + E5 + E7 | A/E |
| Webhook MP falsificado | Alta | **N/A** (futuro) | E3 | E |
| Dependencias vulnerables | Media | **Media** (sin CI/audit) | A5 | A |

---

## 5. Orden de implementación (consciente de dependencias)

```text
Semana 1 (P0 exploit/data-loss):
  A2 → A3 → A8 (cerrar seed/secretos antes que nada, repo público)
  A1 + A1b + A6 (rate-limit + lockout + entropía juntos — controles compensatorios)
  A5 (CI: habilita correr todo lo demás)
  A7 (límites body/timeout — barato)

Semana 2 (P0 datos + fundación auth):
  D1 (cifrar ciclo)  →  A4a (recién entonces, backups)   ⟵ secuencia clave
  A9 (audit log)  ·  D5 índice (one-liner)
  B1+B2 (anti-enumeración)  ·  B3 (revocación)  ·  B4 (TTL/cookie)  ·  B5 (passwords)

Semana 3 (privacidad + HTTP):
  C1 + C2 + C6 (helmet: CSP/HSTS, dueño único)  ·  C5 (logs)
  D3 export  ·  D4 borrado  ·  D7 movementId
  B0 (email) → B6 (recuperación/verificación)   ⟵ B6 bloqueado por B0

Paralelo / Fase 5–6:
  E3 (webhook MP) al arrancar pagos  ·  E1+anti-bot  ·  E5 monitoring  ·  D6 RLS
Pre-launch:
  E6 E2E seguridad  ·  E7 runbook  ·  E8 ADR región  ·  revisión security-reviewer ECC
```

Dependencias duras: **B0 → {B2, B6, E1}**; **D1 → A4a**; **A5/A8 → todo lo demás de CI**; **A9 → E5/E7**.

Cada ítem incluye: (1) spec corto si toca schema/contrato; (2) test de integración **antes o con** el fix (TDD); (3) entrada en CHANGELOG/HANDOFF.

---

## 6. Checklist de verificación pre-launch

### Autenticación
- [ ] Rate limit en login/signup/accept/rotate (A1) · lockout por cuenta (A1b)
- [ ] Seed imposible en prod sin flag (A2) · sin passwords hardcode (A3)
- [x] Logout invalida sesión en BD *(ya)*
- [ ] Revocación de otras sesiones al login (B3)
- [ ] Anti-enumeración login **y** signup (B1+B2)
- [ ] Recuperación de cuenta + verificación de email (B0+B6)

### Autorización
- [x] `/athletes/:id/*` por `guardAthlete` + Vínculo activo *(ya; verificado)*
- [ ] Test 403 cross-coach en **cada** endpoint write nuevo (falta `PUT …/prescription/:week/:idx`)
- [ ] Backstop DB (RLS o lint de CI) (D6)

### Privacidad
- [x] Respuesta coach de ciclo sin `state` crudo *(ya; test verde)*
- [ ] Cifrado en reposo de `CycleConsent` (D1) **antes** de backups
- [ ] Export (D3) y borrado real sin datos huérfanos (D4)
- [ ] Validación de `movementId` contra catálogo (D7)

### Infra / HTTP
- [ ] Postgres paid + backups + restore probado (A4a)
- [ ] CSP + HSTS vía helmet (C1/C2) · dueño único de headers (C6)
- [x] `X-Frame-Options: DENY` *(ya, `render.yaml:46-47`)*
- [x] Sourcemaps off *(ya, `vite.config.ts:34`)*
- [x] CORS fail-fast *(ya, `server.ts:40-42`)*
- [ ] Límites body/timeout (A7) · logs sin PII (C5)
- [x] Secretos en env Render *(ya; salvo defaults demo → A3)*

### Pagos (cuando aplique)
- [ ] Webhook MP: firma + ventana replay + idempotencia (E3)
- [ ] Claves MP solo server

### Operaciones
- [ ] CI con `pnpm audit` (A5) + gitleaks (A8)
- [ ] Audit log (A9) + monitoring/alertas (E5)
- [ ] Runbook de incidente (E7) · ADR región (E8)

---

## 7. Referencias en el repo

| Tema | Ubicación |
|------|-----------|
| Auth / cookies / sesión | `apps/api/src/auth/routes.ts`, `session.ts`, `password.ts`, `schemas.ts` |
| Guards / authz | `apps/api/src/auth/guards.ts` |
| Vínculo / invite | `apps/api/src/vinculo/routes.ts` |
| Redacción ciclo | `apps/api/src/cycle.ts`, `repo.ts` (`getCycle`) |
| Servidor / CORS / static / error handler | `apps/api/src/server.ts` |
| Prisma client | `apps/api/src/db/client.ts` |
| Schema / migraciones | `apps/api/prisma/schema.prisma`, `prisma/migrations/*` |
| Seed | `apps/api/prisma/seed.ts` |
| Tests authz | `apps/api/src/server.int.test.ts`, `writes.int.test.ts`, `me.int.test.ts`, `prescription.int.test.ts`, `vinculo/vinculo.int.test.ts` |
| Deploy | `docs/superpowers/DEPLOY.md`, `render.yaml` |
| Cliente / headers de borde | `apps/web/src/data/apiConfig.ts`, `apps/web/index.html`, `render.yaml` |
| Dominio / privacidad | `docs/domain/HOLY-OLY-DOMAIN.md` |
| Roadmap general | `docs/superpowers/specs/2026-06-01-production-readiness-roadmap.md` |

---

## 8. Métricas de éxito (consistentes)

| Métrica | Baseline (2026-06-07) | Objetivo launch |
|---------|------------------------|-----------------|
| Hallazgos P0 abiertos | **10** (A1,A1b,A2,A3,A4a,A5,A6,A7,A8,A9) | 0 |
| Cobertura tests authz (integración) | Rutas core cubiertas | + cada endpoint write (incl. `PUT …/prescription/:week/:idx`) |
| Tiempo detección incidente auth | N/A (sin audit log) | < 15 min (A9 + E5) |
| Dependencias critical/high | Por medir (sin CI) | 0 sin waiver |
| Datos sensibles en texto plano | Ciclo en plano | 0 (D1) |
| Postura: demo controlado | ~7/10 | — |
| Postura: SaaS público | **~4/10** | **≥8.5/10** |

---

## 9. Decisiones pendientes (producto / legal)

1. **¿Registro coach abierto o solo invitación?** — impacta E1 y la superficie de abuso. *(Recuperación/verificación ya NO son "pendientes": son B0/B6.)*
2. **Sesión:** larga sliding (hoy) vs access+refresh; TTL coach vs atleta (B4 ADR).
3. **Retención tras baja** — plazo, soft-delete vs hard-delete (D4).
4. **Región de datos / base legal** — Render US vs AR/LatAm datos de salud (E8 ADR).
5. **2FA coach** — ¿obligatorio o opcional? (B7).

Registrar cada decisión aquí o en un ADR al cerrarse.

---

## Apéndice A — Evidencia (hallazgos con `archivo:línea`)

| ID | Estado vs plan | Severidad | Evidencia |
|----|----------------|-----------|-----------|
| A1 | correcto | CRITICAL | sin `@fastify/rate-limit`; `auth/routes.ts:26,56`, `vinculo/routes.ts:17,32` |
| A2 | sub-especificado (lugar) | HIGH | reset incondicional `seed.ts:92-109`, invocado `:195`; `start:prod` no llama seed (`package.json:9`) |
| A3 | sub-especificado | HIGH | fallbacks `seed.ts:10-11` (`"holyoly-demo"`,`"HOLY-DEMO"`); tests hardcodean la pass |
| A4a | correcto | HIGH | `render.yaml:7` `plan: free`; `DEPLOY.md:49-51` sin backups/RPO/RTO |
| A5 | sub-especificado | MEDIUM | no existe `.github/`; sin script `audit` |
| A6 (E2) | sub-especificado | HIGH | `vinculo/routes.ts:7-12` 8×32 = **40 bits** (sin sesgo: 256%32=0); `AcceptCodeSchema` `min(1).max(64)` |
| A7 | omitido por plan | MEDIUM | `server.ts:32` sin `bodyLimit`/timeouts |
| A8 | omitido | HIGH | repo público; creds en `DEPLOY.md`; sin secret-scan |
| A9 | omitido | HIGH | sin tabla/stream de audit; `logger:true` solo (`server.ts:32`) |
| A1b | omitido | HIGH | `login()` sin contador de fallos por cuenta |
| B1 | sub-especificado (NO hecho) | HIGH | `auth/routes.ts:60-63`, comentario admite el gap en `:62` |
| B2 | correcto | MEDIUM | `auth/routes.ts:32-34` `409 "email already registered"` |
| B3 | correcto | MEDIUM | `auth/routes.ts:65` sin invalidar previas; no existe `invalidateByUserId` |
| B4 | sub-especificado + bug | LOW/MED | `session.ts:5-7` TTL fijo; cookie sin `maxAge` (`auth/routes.ts:9-18`); sliding no re-emite cookie |
| B5 | correcto | MEDIUM | `auth/schemas.ts:5` `min(8)`; params Argon2 implícitos (`password.ts:4-5`) |
| B6 | en §9 (debe subir) | HIGH | `authRoutes` solo signup/login/logout/me — sin reset ni verificación |
| C1 | correcto + matiz | MEDIUM | sin helmet/CSP; `@import` Google Fonts `theme.css:12` exige `style-src`/`font-src` |
| C2 | correcto | MEDIUM | sin HSTS en `server.ts`/`render.yaml` |
| C4 | **ya hecho** | — | `server.ts:38-45` fail-fast; path reflect-any inalcanzable en prod |
| C5 | correcto + NEW | MEDIUM | `logger:true` + `reply.log.error(err)`; `PrismaClient()` sin `log` (`db/client.ts:4`) |
| C6 | omitido (redundancia) | LOW | 4 headers en `render.yaml:44-53` + helmet → duplicados |
| Err-handler | **ya hecho** | — | `server.ts:47-50` 500 genérico, sin stack |
| D1 | sub-priorizado | HIGH | `CycleConsent.state` plano `schema.prisma:236-241`; `redactCycle` solo vía API `cycle.ts:9-15` |
| D2 | sobre-estimado | LOW | `Athlete.id @default(uuid())` `schema.prisma:93`; signup no pasa `id` |
| D4 | **bug de schema** | HIGH | `Athlete.user onDelete: SetNull` `schema.prisma:95` vs hijos en Cascade |
| D5 | correcto | LOW | sin `@@index([expiresAt])` `schema.prisma:70-77`; Render free sin cron |
| D6 | omitido | MEDIUM | aislamiento solo en app; un guard olvidado = fuga |
| D7 | omitido | LOW | `movementId` sin validar `me/routes.ts:61-73`, `repo.ts:240-261` |
| 403-tests | sub-especificado | MEDIUM | falta 403 cross-coach en `PUT …/prescription/:week/:idx` (`server.ts:186-197`) |
| Cliente | **ya hecho** | — | `credentials:"include"` en todos los clients; sin token en localStorage; 0 `console.*`; sin `VITE_*` secretos |
| Headers borde | **ya hecho** | — | `render.yaml:46-47` X-Frame-Options; `vite.config.ts:34` sourcemap off |

---

*v2 generada auditando el código real (rama `main` actual) con 6 revisores especializados en paralelo, 2026-06-07. Reemplaza la pasada read-only. Actualizar al cerrar cada oleada.*
