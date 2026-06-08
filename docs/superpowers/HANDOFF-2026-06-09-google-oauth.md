# HANDOFF — Google OAuth

**Fecha:** 2026-06-09 · **Alcance:** solo login/registro con Google · **Sin commit/push** salvo orden del owner.

## Resumen

Login con Google implementado (API + web + migración `14_google_oauth`). Misma cookie `session` que email/password. `pnpm --filter @holy-oly/api verify` y `pnpm -r typecheck` OK.

## Git

Working tree sin commit (incluye launch-readiness previo + Google). Rama `main`, ~21 commits ahead de `origin`. **No push** → dispara Render.

## Archivos Google (nuevos / tocados)

| Capa | Paths |
|------|--------|
| DB | `prisma/migrations/14_google_oauth/`, `schema.prisma` (`OAuthAccount`, `User.passwordHash` nullable) |
| API | `auth/google.ts`, `google-routes.ts`, `signed-cookie.ts`, `provision-user.ts`, `routes.ts` (login OAuth-only), `server.ts`, `.env.example` |
| Web | `AuthScreen.tsx`, `GoogleCompleteScreen.tsx`, `authClient.ts`, `router.tsx` (`/login/google-complete`) |
| Tests | `signed-cookie.test.ts`, `google.test.ts` |

## Config (.env API)

```env
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
APP_ORIGIN="http://localhost:8765"
# Si API ≠ web: API_ORIGIN="http://localhost:3000"
# GOOGLE_OAUTH_STATE_SECRET=""  # opcional; default = client secret
```

**Redirect URI en Google Cloud:** `{API_ORIGIN o APP_ORIGIN}/auth/google/callback`

Migración: `pnpm --filter @holy-oly/api exec prisma migrate deploy`

## Flujo

1. **Registro** → botón Google con `role` + `name` → callback crea user + OAuthAccount → `/`
2. **Login, cuenta existe** → enlaza por email si hace falta → `/`
3. **Login, cuenta nueva** → cookie `oauth_pending` → `/login/google-complete` → `POST /auth/google/complete`
4. Coach: `emailVerified` si Google marcó el email; si no, mail verify como signup normal
5. Sin credenciales: `GET /auth/google/config` → `enabled: false`, botón oculto

## Pendiente / no hecho

- Rate limit en rutas Google (review: medium)
- Apple / GitHub OAuth
- Commit cuando el owner pida (idealmente junto o después del slice launch)

## Comandos

```bash
pnpm --filter @holy-oly/api verify
pnpm -r typecheck
```
