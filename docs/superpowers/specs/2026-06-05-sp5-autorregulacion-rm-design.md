# SP5 — Autorregulación / vigencia de RM — diseño

> **Fecha:** 2026-06-05 · **Estado:** aprobado (brainstorming) → listo para `writing-plans`
> **Pilar:** ejecución del atleta (cierra SP1→SP4 + Entreno guiado).

> ## 🔄 Update 2026-06-08 (deltas al retomar)
> El spec sigue 100% válido (verifiqué contra el código actual: `RM = {arranque,envion,sentadilla,frente}`, `RmRef`, `getMovement().rmRef`, `savePlan`/`instantiateForPlan`/`getPrescriptionWeek`/`resolveTargetKg` existen). Tres ajustes:
> 1. **Migración: `15_rm_history`** (NO `10`). Las migraciones de lanzamiento llegaron a `14` (0→14); la `10` ya está tomada (`10_session_expiry_index`). El `RmUpdate` va en la **15**.
> 2. **Verificación = LOCAL-only** (pivot del owner: se cortó el deploy a Render, `autoDeploy=no`). Reemplazar "deploy → smoke live holy-oly.onrender.com" por: `pnpm --filter @holy-oly/api verify` + smoke con `node apps/api/scripts/local-app.mjs` (:8765). NO pushear `main`.
> 3. **Preguntas abiertas de §8 RESUELTAS con los defaults propuestos:**
>    - **PR detection: flaggear TODO** (lifts base y variantes), mostrando el movimiento; el coach juzga y entra el valor final del RM. (No restringir a lifts base.)
>    - **Vigencia: mostrar la edad sin umbral duro**, con hint sutil si ≥ **12 semanas** ("fijado hace N sem").

## 1. Objetivo

El RM (1RM) de un atleta cambia durante el ciclo: se pone más fuerte (un **PR**) o el RM cargado al
asignar quedó **viejo/desactualizado**. SP5 permite **actualizar `Plan.rms` a mitad de ciclo** —
que **recae automáticamente** en todos los kg prescritos (el kg se deriva de `rms × pct`) — sin
re-instanciar la prescripción (preservando las ediciones de sesión del coach). Captura el **historial**
de RMs (la curva del 1RM, vigencia, y base de datos para A2) y **detecta PRs** del atleta para que el
coach los confirme.

**Decisiones de brainstorming (cerradas):**
- **Quién actualiza el RM:** el **coach confirma** (el PR del atleta surge como sugerencia; el coach
  sube el RM). El coach también edita RMs a mano cuando quiera (base).
- **Qué se guarda:** **historial completo** (tabla append-only `RmUpdate`), no sólo el actual.

## 2. Alcance

**Dentro:**
- Editar `Plan.rms` a mitad de ciclo (1+ RMs) **sin re-instanciar** → cascada de kg.
- Tabla `RmUpdate` (append-only) = historial + vigencia.
- Detección de PR (set hecho ≥ RM vigente) → sugerencia al coach → confirmar sube el RM.
- Vigencia (cada RM: "fijado hace N sem").
- Todo en el **drill-down del coach** (coach-only).

**Fuera (otros specs / features):**
- **Apareo-por-identidad** del `mergeActuals` posicional → **spec propio separado** (thread
  independiente; no toca RMs).
- UI del PR para el atleta / gamificación → A2 ("Mi progreso").
- Auto-cálculo del 1RM por reps (fórmulas rep-max) → NO (el coach entra el valor con criterio).
- "Descartar" un PR → no en v1 (los candidatos se **auto-resuelven** al subir el RM).

## 3. Diseño

### 3.1 Modelo de datos

- **`Plan.rms` sigue siendo el RM vigente** (Json `{arranque,envion,sentadilla,frente}`); `kg` se
  deriva de ahí en lectura (`resolveTargetKg`) — **sin cambios**.
- **Nueva tabla `RmUpdate`** (migración **`10_rm_history`**, append-only):
  ```prisma
  model RmUpdate {
    id        String  @id @default(uuid())
    athleteId String
    athlete   Athlete @relation(fields: [athleteId], references: [id], onDelete: Cascade)
    lift      String  // "arranque" | "envion" | "sentadilla" | "frente"
    kg        Float
    setAt     String  // ISO YYYY-MM-DD
    reason    String  // "assign" | "manual" | "pr"
    @@index([athleteId])
  }
  ```
- **Consistencia:** cada cambio escribe `Plan.rms[lift]` **y** una fila `RmUpdate` (mismo valor) →
  la última `RmUpdate` por lift coincide con `Plan.rms`. Al **asignar** (`savePlan`) se siembran 4
  filas baseline (`reason:"assign"`, `setAt` = `plan.startDate ?? today`).
- **Planes pre-SP5** (sin historial): la vigencia cae a `plan.startDate` (= "fijado al asignar").
  Sin migración de datos.

### 3.2 Core (puro)

Tipos (`core/src/types/index.ts`):
```ts
export type RmLift = "arranque" | "envion" | "sentadilla" | "frente"; // = keyof RM
export type RmReason = "assign" | "manual" | "pr";
export interface RmUpdate { lift: RmLift; kg: number; setAt: string; reason: RmReason; }
export interface PrCandidate { lift: RmLift; movementId: string; movementName: string; kg: number; week: number; sessionIdx: number; }
```

`core/src/logic/rm.ts` (+ `rm.test.ts`):
- **`prCandidates(actuals: SessionActual[], rms: RM): PrCandidate[]`** — por cada actual **hecho**
  con `actualKg` definido, resuelve `getMovement(movementId).rmRef`; si `rmRef !== "none"` y
  `actualKg >= rms[rmRef]`, es candidato para ese lift. **Por lift, devuelve sólo el de mayor kg**
  (≤ 4 candidatos). Usa el resumen `actualKg` (= top set, ya derivado de `sets`). El movimiento se
  muestra (un PR de variante es informativo; el coach juzga).
- **`rmVigencia(history: RmUpdate[], fallbackDate: string | undefined, today: string): Record<RmLift, { setAt?: string; weeksAgo?: number }>`**
  — por lift, el `setAt` de la última `RmUpdate`; si no hay, cae a `fallbackDate` (plan.startDate);
  `weeksAgo` = floor(días/7). Puro.

Schemas Zod (`core/src/schemas.ts`):
- `RmUpdateSchema`, `PrCandidateSchema`.
- `UpdateRmsInputSchema = z.object({ updates: z.array(z.object({ lift: RmLiftEnum, kg: KgSchema })).min(1).max(4), reason: z.enum(["manual","pr"]) })` (input del coach, acotado; `assign` no es input — sólo lo escribe `savePlan`).

### 3.3 API

- **Migración 10** (`RmUpdate`) vía `make-migration.ts`.
- **`updateRms(prisma, athleteId, updates, reason, today)`** (repo): **transaccional** — lee
  `Plan.rms` (getPlan), mergea los lifts cambiados → `prisma.plan.update({ where:{athleteId},
  data:{ rms: merged } })` (**NO** `instantiateForPlan` → prescripción intacta) + `rmUpdate.createMany`
  (una fila por lift cambiado, `setAt: today`). Como el kg se deriva, la próxima `getPrescriptionWeek`
  recalcula todos los targets — **el "repercute" es automático y las ediciones del coach se preservan**.
- **`getPrCandidates(prisma, athleteId)`**: lee `Plan.rms` + **todas** las `SessionActual` del atleta
  → `prCandidates(actuals, rms)` de core. (Sin plan → `[]`.)
- **`getRmHistory(prisma, athleteId)`**: lee las `RmUpdate` del atleta (orden `setAt` desc) → `RmUpdate[]`.
- **`savePlan` / `instantiateForPlan`**: agrega el insert de las 4 filas baseline `RmUpdate`
  (`reason:"assign"`) en la misma transacción (cada asignación = un baseline; honesto).
- **Endpoints** (coach-only bajo `guardAthlete` — sesión + Vínculo activo; atleta→401, coach-sin-Vínculo→403):
  - `PUT /athletes/:id/rms` (body `UpdateRmsInputSchema`) → `updateRms`.
  - `GET /athletes/:id/pr-candidates` → `getPrCandidates`.
  - `GET /athletes/:id/rm-history` → `getRmHistory`.

### 3.4 Repository (web)

`Repository` (interface en `core/src/repository.ts`) gana:
```ts
updateRms(id: string, updates: { lift: RmLift; kg: number }[], reason: "manual" | "pr"): Promise<void>;
getPrCandidates(id: string): Promise<PrCandidate[]>;
getRmHistory(id: string): Promise<RmUpdate[]>;
```
- **`HttpRepository`**: PUT/GET contra los endpoints, validando con los schemas Zod de core.
- **`LocalRepository`** (demo standalone): actualiza el `Plan.rms` local + una lista `rmUpdates` en
  memoria; `getPrCandidates` computa desde sus actuals locales (o `[]` si no hay). Honesto.

### 3.5 Web — sección "RMs" en el drill-down del coach

`Drilldown.tsx` agrega a su `Promise.all` `repo.getPrCandidates(id)` + `repo.getRmHistory(id)` y
renderiza una sección nueva **`RmSection`** (`apps/web/src/screens/coach/rm/`):
- **Los 4 RMs** (de `plan.rms`): valor + **"fijado hace N sem"** (de `rmVigencia(history, plan.startDate, today)`) + botón **"editar"** → `RmEditSheet` (editar 1+ RMs → `updateRms(updates, "manual")`).
- **"PRs por confirmar"** — los `pr-candidates`: cada card "**{movementName} · levantó {kg} kg · sem {week}**" + **"confirmar → subir RM"** → sheet **pre-cargado con `kg`** (el coach entra el valor final) → `updateRms([{lift, kg}], "pr")`. Se **auto-resuelve** (al subir el RM ≥ kg, el candidato deja de aparecer).
- Tras cualquier update: refetch (pr-candidates + rm-history + plan), y el resto del drill-down
  (sesiones/charts) ya re-deriva el kg con el RM nuevo.
- Tokens `--wl-*`; reusa `BottomSheet`. Sin discos acá (es panel de números del coach), pero los kg
  derivados que el atleta ve sí llevan discos (sin cambios).

## 4. Casos borde / errores

- **Sin plan** → sin RMs ni PRs (la sección no se muestra o muestra "asigná un plan primero").
- **PR de variante** (p.ej. `arranque.potencia.colgado` ≥ RM de arranque): es candidato, muestra el
  movimiento, el coach juzga si subir el RM base (NO se auto-sube). El kg de confirmación lo entra el
  coach (si levantó 95×3 el 1RM es más alto).
- **Update sin cambios reales** (mismo kg): igual escribe `RmUpdate` (honesto: el coach reconfirmó);
  aceptable. (Opcional: no-op si igual — decisión de implementación menor.)
- **`updateRms` falla** → la transacción revierte; la UI muestra error, no refetch.
- **Authz:** atleta→401, coach sin Vínculo activo→403 (reusa `guardAthlete`). Input acotado por Zod.

## 5. Tests

- **core** `rm.test.ts`: `prCandidates` (por-lift el mayor ≥ RM; ignora no-hechos/sin-kg/`rmRef:"none"`;
  ≤4; variante cuenta); `rmVigencia` (último por lift, fallback a startDate, weeksAgo).
- **core/schemas**: bounds de `UpdateRmsInput` (1..4 updates, KgSchema).
- **api int**: `updateRms` **NO toca `PrescribedExercise`** (una sesión editada por el coach sobrevive)
  **+ cascada** (el kg derivado cambia tras subir el RM) **+ append `RmUpdate`**; `pr-candidates`
  (atleta que levantó ≥ RM aparece, ≤4); `rm-history`; **authz** (atleta 401, coach-sin-Vínculo 403);
  `savePlan` siembra 4 baseline.
- **web**: `RmSection` renderiza los 4 RMs + vigencia + cards de PR; "confirmar" → `updateRms(...,"pr")`
  con el kg; "editar" → `updateRms(...,"manual")`.

## 6. No-negociables honrados

- **kg = verdad** (el kg sigue derivándose de `rms × pct`; subir el RM recae solo). **Sin RPE.**
- **El atleta no ve RMs** (coach-territory; HR-1). Los discos del atleta no cambian (kg derivado).
- **Sin-dato honesto** (sin plan → sin sección; sin historial → fallback a startDate, nunca inventar).

## 7. Decomposición tentativa (para `writing-plans`)

1. **F1 — core:** tipos (`RmLift`/`RmReason`/`RmUpdate`/`PrCandidate`) + `logic/rm.ts`
   (`prCandidates`, `rmVigencia`) + schemas + tests.
2. **F2 — api:** migración 10 (`RmUpdate`) + `updateRms` (sin re-instanciar) + `getPrCandidates` +
   `getRmHistory` + endpoints `guardAthlete` + `savePlan` siembra baseline + int tests.
3. **F3 — web:** `Repository` (interface + Http + Local) + `Drilldown` carga PR/historial +
   `RmSection`/`RmEditSheet` + confirmar PR + tests.
4. **F4 — verificación integral** + prod-bundle sanity.

Después: **El Carnicero** (valida la regla de PR + que el RM no se auto-calcule por reps + que subir
el RM no infle artificialmente nada) → deploy → smoke live → memoria. **Y** el spec separado del
**apareo-por-identidad**.

## 8. A confirmar con El Carnicero (no bloquean)

- **PR = set hecho ≥ RM vigente del `rmRef` del movimiento**, mostrando el movimiento (variante
  incluida) y dejando el valor final al coach. ¿Restringir a lifts base, o flaggear todo y que el
  coach juzgue? (default: flaggear todo, el coach juzga.)
- **Umbral de "staleness"** para el hint de vigencia (default: mostrar la edad sin umbral duro; hint
  sutil si ≥ ~12 sem).
