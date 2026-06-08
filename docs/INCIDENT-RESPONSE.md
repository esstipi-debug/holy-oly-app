# Runbook de respuesta a incidentes — Holy Oly (E7)

> Datos sensibles en juego: credenciales, ciclo menstrual (`CycleConsent`), daylogs de bienestar.
> Mercado objetivo LatAm (Argentina **Ley 25.326 / habeas data**). Tratar cualquier acceso no
> autorizado a datos de salud como potencialmente notificable.

## 0. Roles
- **On-call / owner:** la persona con acceso al dashboard de Render y a este repo.
- Sin equipo formal aún → el owner ejecuta todos los pasos.

## 1. Detectar
Señales de alerta (revisar logs de Render del servicio `holy-oly`):
- Pico de `429` en `/auth/login`, `/vinculos/accept` (brute force — el rate-limit A1 ya frena, pero el pico indica intento).
- Pico de `401` de login para muchas cuentas (credential stuffing).
- `500` repetidos o el error handler logueando errores inesperados.
- Acceso anómalo a `/athletes/:id/cycle` (cuando exista el audit log A9, filtrar por `action=cycle.read`).

> ⚠️ Hoy el audit log (A9) está pendiente. Hasta entonces la detección se apoya en los logs de
> request de Fastify (sin PII por C5) + el monitoring de Render. Priorizar A9 + E5 (Sentry).

## 2. Contener
1. **Rotar sesiones de una cuenta comprometida:** el usuario (o el owner vía DB) llama
   `POST /auth/sessions/revoke-all` → borra todas sus sesiones (B3). Por DB:
   ```sql
   DELETE FROM "Session" WHERE "userId" = '<userId>';
   ```
2. **Revocar un código de invitación filtrado:** el coach hace `POST /invite/rotate` (genera uno
   nuevo de 60 bits, A6) — el viejo deja de funcionar.
3. **Forzar logout global (incidente amplio):**
   ```sql
   DELETE FROM "Session";   -- todos vuelven a loguearse
   ```
4. **Bloquear registro temporalmente** si hay abuso de signup: bajar los límites de A1 o desplegar
   con signup deshabilitado (feature flag — pendiente).

## 3. Erradicar / rotar secretos
- Si se sospecha exposición de secretos de entorno (Render env vars): rotarlos en el dashboard
  (`DATABASE_URL` se rota recreando/rotando credenciales de la DB; `SEED_*`, futura
  `CYCLE_ENCRYPTION_KEY` (D1), claves de Mercado Pago (E3)).
- Si se filtró algo en el repo (público): rotar la credencial **y** purgar del historial; gitleaks
  (A8) debería haberlo cazado en CI — revisar por qué no.

## 4. Evaluar alcance
- ¿Qué datos pudieron leerse/modificarse? Con audit log (A9): reconstruir por `actorUserId` /
  `targetAthleteId` / `action` / `ts`. Sin él: alcance estimado por los logs disponibles.
- **Árbol de decisión "¿es notificable?":**
  - ¿Se accedió a datos de salud (ciclo, daylog) de terceros sin autorización? → **probablemente sí**.
  - ¿Sólo metadatos / datos no sensibles? → evaluar caso a caso.
  - Ante la duda con datos de salud LatAm: asumir notificable y consultar asesoría legal.

## 5. Notificar
- Determinar obligación bajo Ley 25.326 (AR) y normativa local del usuario afectado.
- Notificar a los usuarios afectados con: qué pasó, qué dato, qué hacer (cambiar contraseña, etc.).
- Registrar el incidente (fecha, alcance, acciones) en este repo o un tracker.

## 6. Post-mortem
- Causa raíz, línea de tiempo, qué control faltó, acción correctiva (idealmente un ítem del
  [plan de seguridad](./superpowers/specs/2026-06-07-security-improvement-plan.md)).

---
*Pendiente para cerrar este runbook al 100%: A9 (audit log) y E5 (monitoring/alertas) — sin ellos
la detección y el cálculo de alcance son manuales.*
