# Fase 3 — Auth + multi-tenant + Vínculo

- **Fecha:** 2026-06-01
- **Hito:** Fase 3 del roadmap (`2026-06-01-production-readiness-roadmap.md`) — la más grande/sensible
- **Estado:** Diseño aprobado · build por slices (commit + verificación por slice)
- **Decisiones:** sesión-cookie propia (**@oslojs + Prisma `Session` + argon2 + @fastify/cookie**) · **flujo de Vínculo completo (coach + atleta)**

## 1. Contexto

Fase 1 dejó el authz por Vínculo activo y la redacción de ciclo **server-side**; los endpoints resuelven `req.coachId` desde un **stub** (`x-dev-coach`). Fase 3 reemplaza el stub por **sesión real** y construye el flujo de Vínculo end-to-end. Los endpoints read de Fase 1 no se reescriben.

## 2. Alcance

**Dentro:** auth real coach **y** atleta (signup/login/logout/me, sesión cookie httpOnly) · flujo `código → pendiente → confirma/deniega` end-to-end · reemplazo del stub por sesión · front: AuthContext + login/signup + guards + UI de invitación (coach) + ingresar-código (atleta, mínimo).
**Fuera:** la app de datos del atleta (sus pantallas) = **Fase 4** · pagos = Fase 5 · CSP/rate-limit/HSTS = Fase 6.

## 3. Modelo de datos (migración `1_auth`)

- **`User`**: `id`, `email` (unique), `passwordHash` (argon2), `role` (`coach`|`atleta`), `createdAt`; relaciones `sessions`, `coach?`, `athlete?`.
- **`Session`**: `id` (= SHA-256 hex del token; el token crudo nunca se guarda), `userId` → User, `expiresAt`.
- **`Coach`**: + `userId` (unique FK) + `inviteCode` (unique, rotatable); **pierde `email`** (va a User).
- **`Athlete`**: + `userId?` (nullable unique FK) — se setea cuando el atleta crea su login.
- Enum `UserRole { coach, atleta }`.

La migración es additiva salvo el drop de `Coach.email` (sin datos en prod aún). El seed se actualiza: crea Users (argon2) para coach + atletas demo, todos con Vínculo `activo`, `inviteCode` del coach, password demo.

## 4. Auth (API)

- Utils: `@oslojs/crypto`+`@oslojs/encoding` (generar token + `id = sha256(token)`), `argon2` (hash/verify password), `@fastify/cookie` (cookie `session` httpOnly, `secure` en prod, `SameSite=Lax`).
- Endpoints: `POST /auth/signup` (email/password/role → User + perfil Coach/Athlete + sesión) · `POST /auth/login` · `POST /auth/logout` · `GET /auth/me` (user + role + perfil).
- **Hook de sesión** (reemplaza el de `x-dev-coach`): lee cookie → valida Session (no expirada) → setea `req.userId`, `req.role`, y `req.coachId`/`req.athleteId` según el perfil. Endpoints coach-scoped siguen leyendo `req.coachId`. Sin sesión válida en rutas protegidas → 401.

## 5. Flujo de Vínculo (API)

- `POST /invite/rotate` (coach) → genera/rota `Coach.inviteCode`.
- `GET /invite` (coach) → el código actual.
- `POST /vinculos/accept` (atleta, `{code}`) → busca coach por código → crea/reusa `Vinculo(coach, atleta, pendiente)`.
- `POST /vinculos/:id/confirm` · `/deny` (coach, dueño del Vínculo) → `activo` / `rechazado`.
- `GET /vinculos` (coach) → pendientes + activos. (El authz de lectura por Vínculo activo ya existe.)

## 6. Front

- **AuthContext** (`/auth/me`, login/logout) + **guards de ruta** (sin sesión → `/login`).
- Pantallas: **Login/Signup** (selección de rol) · **Coach**: ver/rotar código + confirmar/denegar pendientes (`/coach/invitaciones` o sección en Equipo) · **Atleta**: signup + ingresar código + ver estado del vínculo (mínimo).
- `HttpRepository`: pasa a `credentials: "include"` (manda la cookie de sesión) en vez del header `x-dev-coach`.

## 7. Slices (build incremental, commit + verificación por slice)

1. **Modelo + deps + seed**: schema (User/Session/Coach/Athlete) + migración `1_auth` + instalar @oslojs/argon2/@fastify/cookie + actualizar seed (Users argon2). *(stub sigue activo; tests de Fase 1 pasan.)*
2. **Auth core (API)**: sesión util (@oslojs) + argon2 + signup/login/logout/me + hook de sesión (reemplaza stub) + actualizar int test/e2e a sesión.
3. **Vínculo (API)**: rotate/accept/confirm/deny/list + tests.
4. **Front auth**: AuthContext + login/signup + guards + `HttpRepository` credentials.
5. **Front Vínculo**: UI coach (código + confirmar) + atleta (ingresar código).
6. **e2e + review ECC + commit + FF**: e2e completo (signup coach+atleta → rota código → atleta acepta → coach confirma → atleta en `/roster` + reads autorizados; sin vínculo → 403/401) + code/security review + FF a main.

## 8. Verificación

Toda con el harness de **Postgres embebido** (sin Docker): unit (token/sesión, argon2, state-machine del vínculo, AuthContext/guards) + e2e (el flujo completo arriba). La corro yo.

## 9. Notas / riesgos

- **Seguridad** (lo más sensible): cookies httpOnly (nunca token en localStorage), sesiones revocables en DB, password argon2, validar inputs con Zod (core), no filtrar en errores (ya hay error handler genérico). Tests de fuga/aislamiento obligatorios.
- El drop de `Coach.email` requiere actualizar seed + cualquier referencia (solo el seed la usa).
- `x-dev-coach` se retira en slice 2 (queda solo sesión); el e2e/int test de Fase 1 se migran a sesión.
