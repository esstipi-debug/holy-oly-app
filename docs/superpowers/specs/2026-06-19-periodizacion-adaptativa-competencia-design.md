# Periodización adaptativa anclada a la fecha de competencia — Diseño

- **Fecha:** 2026-06-19
- **Estado:** diseño aprobado en brainstorming (pendiente revisión del owner sobre este doc) → siguiente paso `writing-plans`.
- **Revisión de dominio:** El Carnicero revisó el diseño contra `docs/domain/HOLY-OLY-DOMAIN.md` (1 CRITICAL + 3 HIGH + 3 MEDIUM); todos incorporados abajo.

---

## 1. Problema

Hoy, al asignar un macro con fecha de competencia:

- `anchorPlanToComp` ([schedule.ts](../../../packages/core/src/logic/schedule.ts)) calcula el `startDate` contando hacia atrás para que el `peakWeek` del macro caiga en la fecha. **Esto es real.**
- Pero la prescripción real (`instantiatePrescription`, [prescription.ts](../../../packages/core/src/logic/prescription.ts)) se genera del `phaseProfile` **FIJO** del macro (rangos de semanas fijos) + las recetas por escuela. **Ignora las competencias.**
- El taper por-compe (`volumeCurve`, [restructure.ts](../../../packages/core/src/logic/restructure.ts)) sólo alimenta el gráfico `MacroTimeline`, **no el entrenamiento**.
- El motor Prilepin (`phasePlan`/`generateWeek`, [prilepin.ts](../../../packages/core/src/logic/prilepin.ts)) ya comprime fases por semanas-hasta-compe, pero está **dormido** (preview coach-only).

**Consecuencia:** el largo del macro es fijo. Una compe más cerca que el macro trunca el arranque; una más lejos deja un hueco ocioso. El sistema **NO recrea los ciclos necesarios** para picar en la fecha. El cartel del CompSheet promete una reestructuración de volumen que no llega al entrenamiento.

## 2. Objetivo

Que al asignar/editar una fecha de competencia, el sistema **calcule de verdad la periodización** para llegar al pico en la fecha, **adaptándose a cualquier cantidad de semanas** (4, 7, 12…), **fiel al método de cada escuela**.

## 3. Decisiones (owner + El Carnicero)

| # | Decisión | Fuente |
|---|----------|--------|
| D1 | Adaptativo a N semanas, no una ventana fija. | owner |
| D2 | Periodización = **método de cada escuela** (reescalar su `phaseProfile`); `peaks:false` se queda **plano**. | owner |
| D3 | Poco tiempo → reescalado **proporcional + piso al pico + base cede primero**. | owner |
| D4 | Multi-compe → **multi-pico fiel**: re-pica sólo entre compes **pico**, sólo con fases que la escuela realmente declara, planas se quedan planas. | owner + Carnicero (HIGH) |
| D5 | **Una sola verdad de taper**: reusar la lógica de compresión de `phasePlan`; el volumen del gráfico se **deriva** del plan de fases. | owner + Carnicero (HIGH) |
| D6 | Piso al pico **relativo** a la proporción que la escuela ya le da, no un absoluto ≥2 sem. | Carnicero (MEDIUM) |
| D7 | Sólo compes **pico** anclan/re-pican; las de **paso** son banderas que se atraviesan. | Carnicero (MEDIUM) — reusa `competitions.ts` |
| D8 | Re-instanciación **sólo de hoy hacia adelante**, jamás pisando actuals/registros/ediciones del coach. | Carnicero (CRITICAL) |

## 4. El motor de periodización adaptativa (core, puro)

### 4.1 Función de compresión general (generaliza `phasePlan`)

Núcleo nuevo en core: `rescaleSchoolPhases(orderedPhases, availableWeeks, opts) → { week: number; phaseKey: string }[]`.

- `orderedPhases` = el `phaseProfile` de la escuela, en orden (la primera es la base más temprana; la última es el pico/realización).
- Aplica los **mismos principios ya probados** de `phasePlan` (la base se rellena/recorta adelante; el pico se protege; reglas de colapso para N chico), pero sobre las fases **propias de la escuela** en vez de la secuencia fija `EnginePhase`.
- **Piso al pico relativo (D6):** la fase de pico conserva al menos su **proporción natural** (`peakWeeks/macroWeeks × N`, mínimo 1); la base cede primero.
- **N muy chico:** si ni la proporción del pico entra, todo el bloque es la fase de pico (honesto, no inventa taper).
- **Determinismo (rulebook §2c):** sin aleatoriedad; salida auditable.
- `phasePlan` (Prilepin) queda como el caso especial sobre `EnginePhase`; se documenta la relación (o se refactoriza para delegar en el núcleo común — decisión del plan).

> ⚠️ **No se fabrican `phaseKey` nuevas (Carnicero HIGH).** La salida sólo usa `phaseKey` que existan en el `phaseProfile` de ESA escuela (las recetas se indexan por `phaseKey`, `sessionTemplateFor`). Una fase ausente → empty-state honesto, jamás receta genérica inventada.

### 4.2 Segmentación por competencia (multi-pico fiel, D4 + D7)

1. Tomar sólo las compes **pico** (las de paso se ignoran para la forma; quedan como banderas que el atleta atraviesa con la fase en curso).
2. Ordenar por fecha → bloques: `[inicio → pico1]`, `[pico1 → pico2]`, …
3. **Primer bloque:** progresión completa de la escuela vía `rescaleSchoolPhases(phaseProfile, weeksDelBloque)`.
4. **Bloques siguientes (re-pico):** `rescaleSchoolPhases` sobre las **fases finales reales de la escuela** (se saltea la base — p.ej. Coreano: `transformacion→realizacion`). **No se inventa "descarga"/"re-intensificación"**; la disipación de fatiga vive en la última semana del pico (igual que `phasePlan` n=3).

### 4.3 Escuelas planas (`peaks:false`) — D2 + Carnicero HIGH

`if (!macro.peaks)` → la línea de tiempo entera es la fase plana reescalada, **sin** mini-ciclos de re-pico **aunque haya compes**. Una compe en medio de un Búlgaro no cambia la programación (Abadjiev: todos los días son máximos). Invariante chequeable.

### 4.4 Caso "sobra tiempo" (compe más lejos que el macro)

La base se **estira** proporcional (más semanas de la fase más temprana), con un **tope** sano (criterio del coach, documentado) para no inventar un macro absurdo.

### 4.5 Una sola verdad de taper (D5 + Carnicero HIGH)

El **volumen** que muestra `MacroTimeline` se **deriva del plan de fases** resultante (el `volRel` de la fase asignada a cada semana), no de los caps fijos `56/40/26` por separado. Así el atleta **entrena la curva que ve**. La sección de taper del rulebook (`§2 Reestructuración`) se **actualiza** para describir esta única fuente (parte del trabajo; el owner es dueño del rulebook y lo autorizó).

### 4.6 Instanciación

Cada semana → su `phaseKey` asignado → sesiones de la receta de esa escuela (`sessionTemplateFor`) → ejercicios. **kg sigue saliendo de `%×RM` por fase** (`resolveTargetKg`): preserva kg=verdad, discos 10/15/20/25, complejos contra el eslabón débil, sin-RPE, dosis en el corredor `imrPct` de la fase, sin-dato→`none`.

## 5. Arquitectura / flujo de datos

### 5.1 Dónde se calcula
- **Core puro:** `rescaleSchoolPhases` + un `buildAdaptivePlan({ macro, startWeek, picoComps, todayWeek }) → perWeekPhase[]`.
- **Instanciación (API):** `instantiateForPlan` ([repo.ts](../../../apps/api/src/repo.ts)) usa el plan adaptado en vez de `phaseForWeek` fijo. **Necesita las compes** → ver 5.3.

### 5.2 Invariante de re-instanciación (D8 — CRITICAL)
Re-periodizar al cambiar compes/fecha **NO** usa el `deleteMany` global actual. Reglas duras:
1. Sólo se borran/reescriben semanas **estrictamente futuras** (`week > weekOfDate(startDate, today)`).
2. Cualquier semana con ≥1 `SessionActual` o `SessionRegistro` es **inmutable** (los actuals pueden ser backdated, §2b).
3. Una sesión con **edición manual del coach** se **preserva** (o se marca conflicto explícito); jamás se pisa en silencio.

Coherente con la doctrina ya escrita en `updateRms` ("NO re-instancia; las ediciones sobreviven; el kg se deriva en lectura").

### 5.3 Orden comps ↔ plan (atómico)
Hoy `onAssign` ([MacroDetail.tsx](../../../apps/web/src/screens/coach/macros/MacroDetail.tsx)) hace `savePlan` (instancia) **antes** de `setComps`. Para periodizar con las compes, la asignación debe ser atómica: persistir compes + plan + instanciación adaptada en una transacción (o `savePlan` recibe las compes). `setComps` posterior dispara re-instanciación futura-only (5.2).

### 5.4 D13 — countdown fijado al anclar
La posición de cada semana en el plan comprimido es **estado fijado al anclar**; re-anclar lo recomputa **entero**. Jamás re-derivar la fase por distancia cruda semana a semana (HIGH histórico del Carnicero sobre Prilepin).

### 5.5 `totalWeeks` adaptativo consistente (Carnicero LOW)
El `totalWeeks` efectivo lo manda la fecha de compe (vía `anchorPlanToComp`), no el catálogo. Una sola fuente, pasada a `instantiatePrescription`, al clamp de `weekOfDate` y a `dayLayoutFor`.

### 5.6 Consumidores a alinear
Prescripción (atleta + coach), `getPlanHeat` (deriva de la prescripción → automático), `MacroTimeline` (consume el plan adaptado, 4.5), mePlan, `dayLayoutFor`.

## 6. Intocables (verificar intactas en review)
kg=verdad (%×RM por fase) · discos canónicos vía `DiscRow` · sin-RPE en ninguna superficie de atleta · sin-dato→`none` (jamás falso-verde) · % de complejos contra el eslabón débil · dosis en el corredor `imrPct`. La feature **no toca** ninguna de estas; sólo cambia **qué fase** corresponde a cada semana.

## 7. Testing (TDD)
Casos núcleo de `rescaleSchoolPhases`/`buildAdaptivePlan`:
- Compresión: Coreano 12 → 7 / 4 / 3 semanas (la base cede, el pico se protege relativo).
- Estiramiento: 12 → 16 (base se estira, con tope).
- Escuela de pico corto: Ucraniano `test`[12,12] / Chino `choque`[3,3] comprimidos → el pico no se infla artificialmente (D6).
- `peaks:false`: Búlgaro con una compe en el medio → curva **plana**, sin re-pico (4.3).
- Multi-pico: 2 compes **pico** → re-pico fiel entre ellas, sólo fases reales de la escuela.
- Paso vs pico: compe **paso** no dispara re-pico (D7).
- Reconciliación: el volumen de `MacroTimeline` coincide semana a semana con el `volRel` del plan instanciado (D5).
- Invariante D8: re-instanciar preserva semanas pasadas, con actuals/registros y con ediciones del coach.

## 8. Fases de implementación (sugeridas para el plan)
1. **Core engine + tests** (`rescaleSchoolPhases`, `buildAdaptivePlan`, reconciliación con `phasePlan`). Sin tocar persistencia. ← entrega la lógica probada.
2. **Wiring API** (instanciación adaptada + invariante D8 + orden atómico comps↔plan).
3. **UI/Timeline** (MacroTimeline deriva del plan; actualizar copy del CompSheet; actualizar §2 del rulebook).
4. **Gate El Carnicero** sobre el código antes de merge.

## 9. Fuera de rulebook (criterio del coach — documentar, no tratar como regla de deporte)
- El **valor exacto** del piso al pico y la **mecánica precisa** de "base cede primero" (qué % cede, en qué orden). El rulebook fija los caps de taper absolutos, no una fórmula de reescalado proporcional.
- Si conviene un mini-ciclo de re-pico entre compes de bloque (vs. sostener la fase) — el rulebook sólo dice que el taper se repite antes de cada compe, no que haya re-acumulación.
- El **tope** del caso "sobra tiempo" (4.4).

## 10. Archivos afectados (estimado)
- `packages/core/src/logic/` — nuevo `adaptivePlan.ts` (+ test); posible refactor de `prilepin.ts`/`restructure.ts` para la fuente única de volumen.
- `packages/core/src/logic/prescription.ts` — `instantiatePrescription` acepta un resolutor de fase por semana.
- `apps/api/src/repo.ts` — `instantiateForPlan` adaptado + invariante de re-instanciación + `setComps` dispara re-instanciación futura-only.
- `apps/web/src/screens/coach/macros/MacroDetail.tsx` — orden atómico comps↔plan.
- `apps/web/src/ui/charts/MacroTimeline.tsx` — deriva del plan adaptado.
- `docs/domain/HOLY-OLY-DOMAIN.md` — §2 taper como fuente única.
- `apps/web/src/screens/coach/CompSheet.tsx` — copy alineado a lo que realmente hace.
