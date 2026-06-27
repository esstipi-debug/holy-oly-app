# Handoff i18n — Fase 2 (superficie del coach) — 2026-06-27

> Continuación de la migración descrita en `docs/i18n/i18n-audit-2026-06-27.md`.
> Este doc registra el estado real (el handoff original no existía en el repo; se reconstruyó
> desde el audit + el historial de commits).

## Qué está hecho

| Fase | Área | Commit |
|---|---|---|
| 1 | common: nav/errores/estados + cuentas (CuentaCoach/CuentaMin) | `feat(i18n): Fase 1 … (#63)` |
| 2a | drill-down del coach (ns `coach`) | `feat(i18n): Fase 2a … (#64)` |
| 2b | competencias del coach | `feat(i18n): Fase 2b … (#65)` |
| **2c** | **calendario, sesiones, RM, Prilepin del coach** | **este PR** |

Con 2c, **la superficie del coach (Fase 2 del plan) queda completa**: competencias,
calendario, editor de sesiones, RM/PR, Prilepin preview, drill-down + sheets y cuenta del coach.

### Archivos migrados en 2c
- `calendar/PlanCalendar.tsx` — leyenda de fases, heatmap, desglose del día (loading/error/HOY/títulos).
- `sessions/SessionsSection.tsx` — header, navegación de semanas, estados, etiquetas de actual (desfasado/real/sustituido/no hecho).
- `sessions/SessionEditor.tsx` — título, arias de fila, validación, botones (reusa `common:saving`).
- `sessions/MovementPicker.tsx` — título, búsqueda, vacío, "mostrando 30".
- `sessions/ComplexAnalysis.tsx` — análisis de carga neural (SNC/Axial/Metab/Complej/Tope/eslabón débil).
- `rm/RmSection.tsx` — base del plan, vigencia, PRs por confirmar.
- `rm/RmEditSheet.tsx` — sheet manual/PR (reusa `common:cancel/save/saving`).
- `prilepin/PrilepinSection.tsx` — preview del motor, zonas, auditoría, ajuste por readiness.

### Decisiones de 2c (consistentes con el audit)
- **RM_LABELS centralizado**: el const exportado pasó a un hook `useRmLabels()` en `RmEditSheet.tsx`
  (ns `coach`, claves `rmLift{Arranque,Envion,Sentadilla,Frente}`). Lo reusan RmSection,
  PrilepinSection y ComplexAnalysis. EN: Snatch / Clean & Jerk / Back squat / Front squat.
- **Voseo como overlay**: la base `es-419` se escribió en neutro ("tú"); `es-AR` sólo overridea
  las claves con voseo (sesEmpty, sesEditorInvalid, mpTitle, mpShowing30, rmStaleHint, rmFinalNote, rmSaveError).
- **Reúso de `common:`** para cancel/save/saving (no se duplicaron en `coach`).
- **Reúso de claves `coach`** existentes: `compWeekLabel` ("sem {week}"), `compSaveError`, `editShort`, `secSessions`.
- **Intocables preservados**: kg (unidad fija), discos vía DiscRow, % y zonas Prilepin literales,
  el atleta nunca ve RPE (Prilepin es coach-only).
- Texto de dominio que llega de core (week.label/rationale, mod.headline/rationale, nombres de
  movimiento) **NO** se tocó — va a la Fase 5 (`domain`).

## Verificación
- `pnpm --filter @holy-oly/web test` → 590/590 ✓ (incluye `parity.test.ts`).
- `tsc --noEmit` ✓ · `eslint` (con `eslint-plugin-i18next`) ✓.

## Qué falta (orden del audit)
1. **Fase 3 — Plantel/invitaciones/ventas (`roster`) + catálogo de macros (`macros`)**:
   Equipo, InvitacionesScreen, SuscripcionScreen, atletas/*, macros/* (excepto CuentaCoach, ya hecho).
   Plurales ICU (atletas/coaches/meses) y formateo CLP/fecha → Intl con locale activo.
2. **Fase 4 — Atleta (`atleta`)**: home/hoy, check-in, entreno+celebración, ciclo, progreso, plan.
   Mucho `<Trans>` con `<b>/<br/>` y `toLocaleString('es-CL')` hardcodeado → Intl dinámico.
3. **Fase 5 — Dominio en core (`domain`)**: proyección id→t() en web, sin que core llame i18next
   (no romper `recipesAll.test.ts`). Falta agregar `aliasPt` a los movimientos.
4. **Fase 6 — Legal (`legal`)**: sólo chrome (Opción A) + decisión owner A/B.
