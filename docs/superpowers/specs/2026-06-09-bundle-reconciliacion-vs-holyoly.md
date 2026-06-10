# Reconciliación — bundle "MASTER SPEC" (chat de análisis, 2026-06-09) vs Holy Oly real

> El bundle (`2026-06-09-bundle-*.md`, 5 docs: master + app-viva + datos/fricción + peaking +
> motor) viene de un chat de claude.ai **sin acceso a este repo**: asume un producto hermano
> ("BECCTTOR") con stack y entidades que aquí no existen con esos nombres. Este doc es el mapa
> de aterrizaje: qué ya está construido, qué se adopta adaptado, qué choca con decisiones ya
> tomadas y qué queda en parking. **Ninguna spec del bundle se implementa as-is**: cada slice
> pasa por el workflow de la casa (brainstorming → spec propia → plan → subagentes → review).
>
> **Update 2026-06-10 (decisión del owner):** «borra lo del video; todo lo demás va» — el bundle
> queda **APROBADO como dirección salvo [1] video (DESCARTADO)**. Se agrega un requerimiento
> nuevo: **calendario granular con heat map de intensidad** (§5.6), dentro de la tarea mayor de
> navegación rica (app viva: casi todo elemento lleva y muestra información).

---

## 1. Supuestos de stack del bundle vs realidad del repo

| Bundle asume | Realidad Holy Oly | Veredicto |
|---|---|---|
| Node + **Express** | **Fastify 5** (`apps/api`), SPA+API same-origin | adaptar |
| **Tailwind v4** | Tailwind **v3** instalado + design system propio (tokens `theme.css`/`atleta.css`, skins Neon) | no migrar a v4 por una spec |
| **Motion** (`motion/react`) | sin lib de animación (CSS) | adoptarla sería decisión nueva, no default |
| **Phosphor icons** | sin lib de iconos | ídem |
| **Recharts** | charts SVG propios (drill-down M4, A2 «Mi progreso») | los componentes de viz del bundle se portan al sistema propio |
| **Zustand** (`peekStack`) | sin store global; Context (`AuthContext`, `RepositoryProvider`) | un context propio basta |
| PostgreSQL + **Prisma** | ✓ coincide (Prisma 6; local = `embedded-postgres`) | ok |
| **Stripe** (spec video §1.5) | **Mercado Pago Chile ya armado**: `apps/api/src/billing/` (mock + preapproval_plan), 5 tiers anual-first, gating 402 | Stripe descartado; cuotas de video serían add-on sobre `Subscription` |
| Render + **R2 + Redis/BullMQ + worker Python** | **Pivot LOCAL-ONLY (2026-06-08)**: Render congelado, máquina sin Docker, sin Python/Redis/R2 | video **DESCARTADO** (owner, 2026-06-10) |

## 2. Mapa de equivalencias (entidades del bundle → Holy Oly)

| Bundle | Holy Oly real |
|---|---|
| "Stress Engine" | `packages/core/src/logic/monitor.ts` (`acwr`, IMR, recovery) — ya server-side |
| Readiness/semáforo | `logic/readiness.ts`: score 0-100 = recovery − penalización ACWR fuera de [0.8, 1.3], + `readinessTrend`. Mapear a verde/ámbar/rojo = bandas sobre esto, no sistema nuevo |
| `ReadinessLog` propuesto | **`DayLog` ya existe** (A1: fatiga/dolor/estrés/humor/motivación/sueño + peso, 1 fila por atleta-día, privado del atleta) |
| "Arsenal / PerformanceRecord" | `Plan.rms` (Json de RMs por lift) + `Medal` + `Competencia`. **No existe historia de PRs con procedencia** — eso sí es nuevo |
| "skill tree DAG" | librería de movimientos SP1 (`logic/movements.ts`: `baseComplexity`, familias, sustituciones) |
| `Competition` propuesto | **`Competencia` ya existe** (name/week/date por atleta); sólo faltaría `school`/plantilla si se adopta peaking |
| `SetSequence.sets` | `SessionActual.sets` (Json por serie, migración 9) + `summarizeSets` (top set). **La edge `producedPrId` (RM ← secuencia) no existe** |
| "algoritmo de rounding / 21 templates" | `logic/discs.ts` (`DISCS` 25/20/15/10, `perSide`, `barKgForSexo`) + `resolveTargetKg` (redondeo a 1 kg). **El kg es la verdad; los discos aproximan** |
| Prescripción | `logic/prescription.ts`: `instantiatePrescription` desde **recetas estáticas del catálogo** + `buildSessionViews` (+ warmup server-side). El motor del bundle sería un **generador alternativo** de filas `PrescribedExercise` |
| Taper pre-compe | `logic/restructure.ts` **ya baja volumen antes de cada compe** (`volumeCurve`: caps 56/40/26 % a 3/2/≤1 semanas; `isTaperWeek`) — el bundle añade la dimensión intensidad y la generación de sets |

## 3. Choques con reglas intocables (`docs/domain/HOLY-OLY-DOMAIN.md`)

1. **RPE.** El bundle mete `rpe?` en `SetSequence.sets`, y usa **sRPE** en readiness y en el motor.
   Aquí el RPE se eliminó de la prescripción (migración `8_rpe_out_sexo`) y **no va en ninguna
   superficie del atleta**. Adaptación: los inputs de carga del motor salen de `monitor.ts`
   (tonelaje/ACWR ya computados); **ningún schema nuevo reintroduce rpe**.
2. **Discos.** Cualquier visual de discos en cards/peeks/share usa `apps/web/src/ui/Disc.tsx`
   (`Disc`/`DiscRow`) — jamás redibujar. El `roundToLoadable` del spec (`Math.round(kg/2.5)*2.5`)
   se reemplaza por el redondeo real de la casa (kg a 1 kg, coherente con `resolveTargetKg`).
3. **kg + discos en toda fila del atleta; el kg manda.** La salida del motor es siempre kg.
4. **Ciclo.** Ninguna entidad/peek del grafo expone ciclo crudo al coach (sólo `redactCycle`).
5. La política de emojis del bundle (emoji = contenido, nunca icono de UI) es compatible con lo
   ya construido — se adopta como regla de revisión.

## 4. Ya construido — no rehacer

- **Check-in del día** → A1 `DayLog` + `wellness.ts` + `readiness.ts`. El delta real de la spec
  de datos NO es la pregunta (ya existe, con 6 ítems) sino que **el estado del día module la
  sesión de hoy con explicación visible y auditable** — hoy readiness es métrica del coach, no
  modula nada.
- **ACWR / monitor** server-side → `monitor.ts`.
- **Registro por serie** → `SessionActual.sets` + top-set.
- **Tonelaje / serie más pesada / cumplimiento** → `sessionStats.ts` (pantalla A4 victoria).
- **Calentamiento server-side** → `warmup.ts`.
- **Taper de volumen pre-compe** → `restructure.ts` (extender, no duplicar).
- **Celebración post-sesión** → A4 (sin partículas; el spring+🔥 del bundle = decisión de diseño aparte).
- **Charts del atleta vs su propia normal** → A2 «Mi progreso» (custom SVG).
- **Timeline del macro** → `MacroTimeline` (el "countdown FIFA" sería una evolución suya).
- **Monetización** → billing MP 5 tiers + gating 402 (supersede Starter/Coach/Gym + Stripe del bundle).

## 5. Genuinamente nuevo (en orden de encaje natural)

1. **Motor de prescripción (spec [5])** — `PRILEPIN`, `PHASE_PROFILE`, `phasePlan`,
   `generateWeek`: config pura + función pura → encaja 1:1 en `packages/core/src/logic`
   (patrón SP1: aterrizar **dormant**, core-only + tests, sin UI). Dependencias reales:
   - `currentE1RM` ⇒ **SP5 es prerequisito** (vigencia de RM — spec ya restaurada:
     `2026-06-05-sp5-autorregulacion-rm-design.md`, migración 15).
   - `recentACWR` ⇒ `monitor.ts` ya lo da.
   - `readiness` ⇒ bandas sobre `readiness.ts` (0-100 → verde/ámbar/rojo).
   - rounding ⇒ kg a 1 kg de la casa.
2. **Peaking / olas continuas (spec [4])** — capa de planificación sobre el motor. Decisión de
   producto grande: hoy el plan nace de un macro del catálogo elegido por el coach; el bundle
   propone semanas **generadas**. Recomendación: **el motor propone, el coach aprueba/edita**
   (consistente con "el sistema alerta, el coach decide" y con el `SessionEditor` de SP4).
   La reorganización a 3 semanas extiende `volumeCurve`.
3. **Readiness → modulación del día (spec [3] §2)** — cablear DayLog/readiness a un ajuste
   visible de la sesión de hoy + explicación auditable. Toca superficie del atleta ⇒
   brainstorming + spec propia primero.
4. **App viva (spec [2])** — patrón `EntityChip`/`PeekSheet`/`EntityPage` + `GET /api/entity`:
   adoptable sin Zustand ni Tailwind nuevo. Prerequisito de datos del Flujo A: **historia de
   PRs con procedencia** (hoy `Plan.rms` es un Json sin historia) = schema nuevo. Arrancar con
   2-3 entidades (Movimiento, RM, "por qué esta sesión").
5. **Lenguaje visual FIFA-card** — dirección visual nueva vs skins Neon actuales. Decisión del
   owner, no técnica.
6. **Calendario granular + heat map de intensidad (requerimiento del owner, 2026-06-10)** —
   evolución de `PlanCalendar` (hoy: lista de semanas plegable → `WeekDetailSheet`; el grano día
   NO existe): celda = **día**, **color = intensidad** del día (derivada de los `pct` de
   `PrescribedExercise`), tap en el día → **desglose: el entrenamiento, qué tipo de fase es y su
   objetivo**; todo lo de adentro es chip y sigue el grafo (app viva). Datos ya existentes:
   `pct` por sesión/día + fases del catálogo (`phaseForWeek`). Falta: microcopy de objetivo por
   fase, escala de color, sheet de día. **No depende del motor** → adelantable como primer slice
   visible; cuando el motor exista, el desglose muestra además su `rationale`.
7. **Video (spec [1])** — **DESCARTADO** (decisión del owner, 2026-06-10). La spec importada
   queda sólo como referencia histórica; no entra al roadmap.

### 5.1 Stats, motores y ventanas nuevas (lo que se integra, en concreto)

**Motores (4 + prerequisito):** SP5 vigencia de RM (prerequisito) · motor Prilepin
(`phasePlan`/`generateWeek`) · olas continuas (`wavePhase`) · reorganización compe-a-3-semanas ·
modulación diaria por readiness.

**Stats derivadas nuevas (cero input extra del atleta):** conteo de levantamientos ≥90 % ·
reps por zona de intensidad vs óptimo Prilepin (`withinRange`) · e1RM vigente ·
`taperFactor`/`topPct` por semana (auditoría) · semáforo del día (bandas sobre `readiness`
0-100) · intensidad por día (alimenta el heat map) · fase + objetivo por semana/día.

**Ventanas/gráficos nuevos:** barra de zonas Prilepin (volumen vs óptimo) · heat map de
intensidad del calendario · timeline countdown a la compe (evolución `MacroTimeline`) · curva
de supercompensación · indicador de madurez de datos · [opcionales, decisión FIFA pendiente]
radar de atleta + sparklines en cards.

## 6. Notas sobre el código de referencia del bundle (no copy-paste)

El código del spec [5] es **pseudocódigo con bugs** — reimplementar con TDD contra sus 9
criterios de aceptación, no pegarlo:

- `pctForZone` usa `Math.min(base, topPct)` → la zona 90+ queda clavada en 92 % y **nunca
  alcanza el `topPct` (100)** pese al comentario y al ejemplo de salida (singles @95 %).
- `phasePlan(7)` cae en la rama `>= 6` y devuelve 6 fases para 7 semanas (hueco).
- `roundToLoadable` es un placeholder (lo dice la propia spec).
- `generateWeek` retorna `audits[0]` y descarta el resto de zonas.
- Sin sRPE (regla §3): los inputs de carga vienen de `monitor.ts`.

## 7. Decisiones abiertas (owner)

1. Las 3 del master §7: indicador de madurez de datos ¿siempre visible?; mini-pico de la ola
   ¿test obligatorio u opcional?; calibración de `taperFactor`/`zoneMix` con coaches piloto.
2. ¿El motor **genera** el plan o **propone** y el coach aprueba? (recomendación: propone).
3. ¿Condensar el check-in A1 (6 ítems, shipped) a 1 pregunta como pide el bundle, o dejarlo y
   sólo añadir la modulación + explicación?
4. Dirección visual FIFA-card vs Neon actual.
5. El master §8 referencia `spec-pantallas-claude-design.md` — **no venía en el bundle**.

**Resueltas (2026-06-10, owner):** alcance general APROBADO («todo lo demás va»); video
DESCARTADO (ya no hay "cuándo despicarlo" — está fuera).

## 8. Orden recomendado

```
0) SP5 (ya speceado; prerequisito: e1RM vigente)
1) Motor core dormant (spec [5] adaptada: TDD, sin sRPE, rounding real, bandas readiness)
2) Readiness → modulación del día con explicación (spec corta propia)
3) Peaking/olas sobre volumeCurve + Competencia (+ campo plantilla)
4) App viva incremental (PRs con procedencia → /api/entity → chips/peeks)
∥) Calendario granular + heat map de intensidad — independiente del motor, paralelizable
   desde ya (primer slice visible)
✗) Video: DESCARTADO (owner 2026-06-10)
```

Los esfuerzos estimados del bundle asumen el otro codebase; aquí el paso 1 es más corto
(patrón core+tests establecido) y el 4 más largo (la edge de datos no existe).
