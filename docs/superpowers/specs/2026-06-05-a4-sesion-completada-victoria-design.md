# A4 «Sesión completada» — pantalla de victoria del atleta (datos reales)

> **Fecha:** 2026-06-05 · **Estado:** diseño aprobado, listo para plan.
> **Origen:** handoff de diseño claude.ai/design (bundle `pkql-ho-victoria-screen`, "Neon Bloom").
> Esta es la **primera** de tres pantallas de celebración (A4 sesión / A4b semana / A5 macrociclo).
> Aquí sólo se especa **A4**, cableada a **datos reales** y con **discos oficiales**.

## Objetivo

Tras finalizar y guardar un entreno, el atleta ve una pantalla de cierre del día: sobria,
celebratoria del **acto de entrenar** (no del número), con sus datos reales del día. Reemplaza la
redirección actual directa a `/atleta`.

## Alcance

**Dentro:**
- Una pantalla A4 nueva, montada en ruta propia, tras guardar el entreno.
- Una función de agregación **en core** (tonelaje del día, serie más pesada, cumplimiento).
- Discos vía el componente oficial `Disc.tsx` (`DiscRow`), nunca redibujados.
- Tokens de estado (`--ok/--warn/--alert/--gold`) agregados una vez a `theme.css`.

**Fuera (explícito, no construir):**
- A4b (semana) y A5 (macrociclo).
- Badge «Descenso honrado» (su detección honesta no existe aún — diferido).
- Volumen por movimiento, 1RM inicio→final, resultado de competencia, IMR del día.

## 🔴 Reglas no-negociables que aplican

1. **Discos INTOCABLES:** reusar SIEMPRE `apps/web/src/ui/Disc.tsx` (`DiscRow`) + `perSide`/
   `DISC_COLORS`/`barKgForSexo` de core. Sólo 10/15/20/25; barra 20♂/15♀. Nunca el `DiscoSet` del
   mockup (que además incluye discos de 5/2.5 inexistentes en la app).
2. **kg = verdad**, discos aproximan.
3. **Sin RPE, sin ACWR, sin rachas** en ninguna superficie del atleta.
4. **"N series × M repeticiones"** explícito donde aparezca.
5. **Honestidad de dato:** sin-dato → ocultar/«—», nunca fingir un número. El calentamiento
   **nunca** cuenta como carga.
6. No premiar el número: la serie más pesada y la carga son **info neutra**, no trofeo.

## Decisiones cerradas (brainstorming)

- **Trigger/navegación:** ruta propia `/atleta/entreno/:week/:idx/victoria`. La pantalla re-lee la
  sesión guardada (robusta ante refresh). Botón «Listo» → `/atleta`.
- **Badge «Descenso honrado»:** diferido (no se renderiza en A4 v1).
- **Titular adaptativo según trabajo real:**
  - ≥1 ejercicio hecho → «Sesión completada» + todas las tarjetas.
  - 0 hechos → «Sesión registrada» (neutro), **sin** carga total ni serie más pesada; sólo
    cumplimiento (0/Y) + posición en el macro + CTA bienestar.

## Arquitectura

### 1. Core (nuevo) — `packages/core/src/logic/sessionStats.ts`

Puro, sin IO, testeado. Reutilizable luego para A4b/A5 (sumar sobre sesiones).

Input mínimo (no acopla a la vista; subconjunto de `SessionView["exercises"]`):

```ts
type ExerciseActualLike = {
  movementName: string;
  actual?: { done: boolean; sets?: SetActual[] };
};
```

Funciones:

- `setTonnage(set: SetActual): number`
  → `set.done && set.kg != null && set.reps != null ? set.kg * set.reps : 0`.
- `sessionTonnage(exercises: ExerciseActualLike[]): number`
  → suma de `setTonnage` sobre `exercise.actual?.sets ?? []` de todos los ejercicios.
  El calentamiento **no** entra (vive en `exercise.warmup`, no en `actual.sets`).
- `heaviestSet(exercises: ExerciseActualLike[]): { movementName: string; kg: number } | null`
  → el set **hecho** de mayor `kg` (kg != null); empate → el primero; `null` si ninguno.
- `completion(exercises: ExerciseActualLike[]): { done: number; total: number }`
  → `total = exercises.length`; `done = ` cantidad de ejercicios con `actual?.sets?.some(s => s.done)`
  (fallback `actual?.done === true`).

Exportar desde `packages/core/src/index.ts`.

### 2. Web — flujo de montaje

- `apps/web/src/screens/atleta/EntrenoScreen.tsx` · `save()`:
  tras `putMeSession` OK, en vez de `navigate("/atleta")` →
  `navigate(\`/atleta/entreno/${week}/${idx}/victoria\`)`.
- `apps/web/src/app/router.tsx`: nueva ruta
  `/atleta/entreno/:week/:idx/victoria` → `VictoriaScreen`.
- `apps/web/src/screens/atleta/entreno/VictoriaScreen.tsx` (container):
  - lee `week`, `idx` de params (valida enteros; si no, redirige a `/atleta`).
  - `Promise.all([getMePlan(), getMeSessions(week)])`.
  - encuentra la sesión `sessionIdx === idx`; computa stats con las fns de core.
  - `barKg = barKgForSexo(plan?.athlete.sexo ?? "M")`.
  - renderiza A4. «Listo» → `/atleta`. Maneja carga/error (la API puede fallar) con estados honestos.

### 3. Tarjetas (datos reales)

Orden vertical, una tarjeta = un dato:

1. **Encabezado:** titular adaptativo + "Día {idx+1} — {1–2 primeros movimientos}" + fecha (cliente,
   `new Date()`, día de cierre) + chip de fase (`plan.currentPhase`).
2. **Carga total del día** — hero number = `sessionTonnage` kg. *(omitida si 0 hechos)*
3. **Serie más pesada hoy** — `heaviestSet.movementName` + kg + `<DiscRow kg barKg />`. Caption
   "Discos IWF por lado · aproximan al kg". *(omitida si `heaviestSet` es null o 0 hechos)*
4. **Cumplimiento** — `completion` "X/Y ejercicios" + "sesión N de M esta semana"
   (N = idx+1, M = `sessions.length`) con segmentos.
5. **Posición en el macro** — strip de fases con colores de `phasePalette.ts` `PHASE_RAMP` **por
   orden** (neutra, no semáforo) + marcador HOY (`currentWeek/totalWeeks`) + countdown
   "faltan **N sem** · {próxima comp}" (próxima `comp.week >= currentWeek`; en **semanas**, no días
   falsos — `MePlanView` no expone fecha de comp). Si no hay próxima comp, se omite el countdown.
   Reusar el ribbon de macro existente del atleta si calza (`atleta.css .ho-ribbon__seg` /
   componente equivalente); si no, portar el `MacroStrip` del mockup con tokens de la app.
6. **CTA «Registrar bienestar»** — navega al check-in de bienestar del atleta (la superficie donde
   hoy se hace `putDayLog`). Botón secundario; «Listo» es el primario → `/atleta`.

### 4. Tokens / estilo

- `apps/web/src/styles/theme.css`: agregar a `:root` (compartido por todos los skins):
  `--ok: #3FB55B; --warn: #E0A23B; --alert: #E5484D; --gold: #E8B23A;`
- Fases: colores desde `apps/web/src/ui/charts/phasePalette.ts` (`PHASE_RAMP`), aplicados inline; no
  duplicar en CSS.
- Reusar `--wl-bg/--wl-surface/--wl-text/--wl-muted`, `--ho-mono` (datos), `--wl-display` (Saira,
  titulares y números grandes).
- `apps/web/src/screens/atleta/entreno/victoria.css` acotado a la pantalla (clases prefijadas).
- Mantener archivos < 400 líneas; separar presentational (`MacroStrip` reusable, tarjeta de serie)
  del container si crece.

## Manejo de errores / estados

- **Cargando:** placeholder mono (patrón existente de `EntrenoScreen`).
- **API falla / sesión no encontrada:** mensaje honesto + botón «Volver al inicio»; nunca números
  inventados.
- **0 ejercicios en la sesión:** no debería llegarse aquí (el player no se inicia), pero si pasa →
  redirigir a `/atleta`.
- **Sustituciones / sin kg:** `sessionTonnage` suma 0 por esos sets; `heaviestSet` los ignora; la
  tarjeta de serie más pesada se oculta si no hay ningún kg. Honesto.

## Testing

- **Core** (`sessionStats.test.ts`, vitest):
  - tonelaje suma sólo sets hechos con kg&reps; ignora no-hechos, sin-kg, sin-reps; warmup nunca entra.
  - `heaviestSet`: elige el mayor kg hecho; empate → primero; `null` cuando no hay kg.
  - `completion`: cuenta ejercicios con ≥1 set hecho; total = cantidad de ejercicios.
- **Web** (`VictoriaScreen.test.tsx`, @testing-library/react + `fireEvent`, `meClient` mockeado):
  - ≥1 hecho → titular «Sesión completada», carga total visible, `DiscRow` presente.
  - 0 hechos → «Sesión registrada», sin carga total ni serie más pesada, cumplimiento 0/Y visible.
  - sin kg en ninguna serie → tarjeta de serie más pesada ausente.
  - «Listo» navega a `/atleta`.

## Descomposición sugerida (para writing-plans)

1. Core `sessionStats.ts` + tests + export.
2. Tokens en `theme.css`.
3. `VictoriaScreen.tsx` (container + tarjetas) + `victoria.css` + (port/reuso) `MacroStrip`.
4. Cableado del trigger en `EntrenoScreen.save()` + ruta en `router.tsx`.
5. Tests web + verificación (tsc/eslint/build) + smoke.
