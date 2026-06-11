# HANDOFF — Holy Oly: motor Prilepin core dormant (sesión 2026-06-10 d)

- **Fecha:** 2026-06-10 (cuarta entrega del día: heatmap+anclaje → SP5 → ciclo → motor)
- **Para:** retomar sin perder contexto. Complementa `HANDOFF-2026-06-10-ciclo.md` y la
  reconciliación del bundle.

---

## 0. Resumen en una línea

**SHIPPED (dormant):** el motor de prescripción Prilepin vive en core —
`phasePlan`/`wavePhase`/`generateWeek`/`athleteWeekView` + `readinessBand` — config pura +
funciones puras + 41 tests nuevos, **cero UI/API/migración/consumidores**. Es la pieza que hace
literal la tesis del owner: la compe anclada al calendario ordena las fases hacia atrás
(countdown), y sin compe corre la ola continua de 6 semanas. Dos reviews (TS + El Carnicero ×2
pasadas) con TODOS los CRITICAL/HIGH/MEDIUM resueltos.

## 1. Estado git

| Hecho | Detalle |
|---|---|
| Rama | `claude/wizardly-wiles-0da5ce` (worktree nuevo de hoy) |
| Commits del slice | `28fe669` spec · `8c3153d` plan · `ce05a48` tipos+config+phasePlan · `1eb7547` wavePhase · `6d96331` readinessBand · `8c22fbc` generateWeek · `dccb8b4` guards+anti-rpe · `7b70727` barrel · `f3c992d` fixes TS · `f4c5981` fixes El Carnicero (D13/D13b/D12/D14/D9 + rulebook) · `83e4797` verificación (D13c + rename) · (+ este handoff) |
| Migraciones | **Sin cambios** (0–14 + 16 + 17; el booking WIP sigue renumerando a 18) |
| Instancia `:8765` | **NO requiere rebuild** — el motor es dormant, cero superficie visible |

## 2. Qué se construyó

Spec: `docs/superpowers/specs/2026-06-10-motor-prilepin-design.md` (**decisiones D1–D14 — leerla
antes de cablear; varias SUPERAN al bundle, no re-litigar sin causa**) · Plan:
`docs/superpowers/plans/2026-06-10-motor-prilepin.md` (T0–T7, TDD).

- **`packages/core/src/logic/prilepin.ts`** — `PRILEPIN` (tabla canónica 18/15/4), `PHASE_PROFILE`
  (6 fases: taperFactor 1.0→0.25 mientras topPct 85→100), `phasePlan(countdownWeeks)` (countdown
  FIJADO AL ANCLAR, la compe siempre es la ÚLTIMA semana; n=3 → int→pico→comp_week sin taper
  aparte — caso canónico del owner; n<1/inválido → `[]`), `wavePhase` (ola 6 sem con mini-pico,
  cicla), `generateWeek` (fase → ajuste ACWR banda casa [0.8,1.3] → ajuste readiness → Prilepin
  por zona con piso en la zona top → sets×reps×%→kg a 1 kg + `audits[]` completos + eco
  `taper`/`inputs` + `heavySinglesAdvisory`), `athleteWeekView` (redacción HR-1 EN CORE, patrón
  `redactCycle`: solo phase/label/rationale/sets).
- **`readiness.ts` aditivo:** `readinessBand` (≥80 green · 70–79 amber · <70 red · sin dato →
  null — espejo de `recoveryState`). El semáforo worse-of NO se tocó.
- **Tipos** `Engine*` en `types/index.ts` + export en el barrel.
- **Rulebook §2:** nota ⚠️ motor dormant (su `taperFactor` NO reemplaza `volumeCurve`;
  `EnginePhase` ≠ fases del catálogo; conciliación = slice peaking).

## 3. Reviews (el corazón de esta sesión)

**typescript-reviewer** — 0 CRITICAL/HIGH; aplicados M1 (guard topZone→null), M2 (sin non-null
assertion), M3 (frente=sentadilla frontal documentado+testeado), L3/L4 (comentario n=3 + tests
envión/frente/advisory). No aplicados conscientes: L1 float (cubierto por toBeCloseTo), L2 doble
redondeo (inherente al diseño, dicho en D10/D11).

**El Carnicero (1ª pasada)** — cazó **1 HIGH de fondo**: `phasePlan` estático y la secuencia
vivida re-derivando `[0]` semana a semana eran inconsistentes — el caso n=3 del owner perdía su
forma en vivo (el taper reaparecía). Fix **D13**: countdown fijado al anclar + `weekIdx`; la
semana vivida = `phasePlan(n)[weekIdx]` POR CONSTRUCCIÓN, con test de regresión. +4 MEDIUM
aplicados: D13b (sin default waveWeek — fabricaba la semana más pesada desde dato ausente), D12
(redactor `athleteWeekView` EN CORE, no disciplina del consumidor), D14 (unidad = SESIÓN
principal del lift, la tabla Prilepin es por sesión — `withinRange` se lee contra ESA unidad),
D9 enmendada (doble conteo ACWR deliberado-conservador) + nota rulebook. +LOW test propiedad
pct≤95.

**El Carnicero (2ª pasada, verificación)** — todo RESUELTO de fondo; cazó 2 MEDIUM nuevos del
mismo gen, aplicados: **D13c** (`weekIdx` REQUERIDO en countdown — con default 0 el bug original
compilaba limpio) y **rename `weeksToComp` → `countdownWeeks`** (la semántica cambió de
distancia a largo; el nombre viejo invitaba al off-by-one que corre el peak; gratis con cero
consumidores). **Abierto consciente (LOW):** warn≈alert aplanados (ACWR 1.35 y 1.8 reciben el
mismo ×0.9) → candidato a calibración con coaches piloto, junto con los valores de
`PHASE_PROFILE` y los factores 0.9/0.75.

## 4. Verificación

core **243** (200 baseline + 43 del slice) · `pnpm -r typecheck` ✓ (recordar `prisma generate`
en worktree nuevo) · lint 0 errors (warning preexistente de email/index.ts). Sin smoke en
`:8765`: no hay superficie que tocar (dormant de verdad — verificado por El Carnicero: cero
referencias fuera de core/docs).

## 5. Obligaciones que esta spec le deja al CABLEADO (§9 de la spec — no improvisar)

1. `countdownWeeks` + `weekIdx` se computan **UNA vez al anclar/re-anclar** desde
   `Competencia.date` vía `schedule.ts` y se PERSISTEN — jamás re-derivar semana a semana (D13).
2. `waveWeek` también es estado persistido (D13b). El motor devuelve null ante ausencia — no
   "arreglarlo" con defaults.
3. El atleta consume `athleteWeekView`; `audits`/`taper`/`inputs` (ACWR crudo) van SOLO al peek
   del coach (D12/HR-1).
4. **Decisión pendiente:** ¿el atleta ve `pct` o solo kg+discos? (`pct`+`weightKg` juntos hacen
   el RM derivable por división; el precedente SP1-5 empuja a solo-kg). Decidir explícito.
5. Resolver el reparto sesión-vs-semana (D14) ANTES de poner `withinRange` en superficie
   (si llega con la unidad rota es HIGH por HR-2).
6. Fraseo del "por qué null" (sin RM vigente ≠ compe pasada ≠ ola sin posición): el cableado
   pre-valida y frasea.

## 6. Qué NO es este slice

- NO genera planes ni toca `instantiatePrescription`/`volumeCurve`/`restructure.ts` — convive
  dormant; la conciliación es del slice **peaking**.
- NO decide genera-vs-propone (decisión abierta del owner; recomendación vigente: propone).
- NO recibe ciclo menstrual como input (regla §3) — el ciclo entrará como contexto en
  readiness→modulación (Capa 3).
- NO mapea movimientos del catálogo: prescribe por lift (`RmLift`); el mapeo movimiento→lift es
  del cableado.

## 7. Roadmap vigente

1. Bugs que reporte el owner sobre `:8765` (sigue corriendo SP5+ciclo, sin cambios hoy).
2. **Readiness→modulación del día** (spec corta propia ANTES; consume `readinessBand` +
   `generateWeek` + el patrón SP4 propuesta→tap→actuals; ahí entra el ciclo como Capa 3).
3. Peaking/olas sobre `volumeCurve` + `Competencia` (concilia las dos nociones de taper).
4. App viva incremental · calendario granular ∥ (independiente).
5. Pendientes previos: recetas 23 macros, adapter MP real, email real, legal, i18n, booking
   (mig → 18), borrar `C:\HolyOlyDemo-sp5-smoke`.
