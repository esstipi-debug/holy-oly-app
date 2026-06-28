# Diseño — Atleta autoentrenado (self-coach) · v1

**Fecha:** 2026-06-28
**Estado:** Aprobado (brainstorming) — pendiente plan de implementación.
**Autor:** owner + Claude (brainstorming).
**Revisor de dominio sugerido antes de mergear:** `el-carnicero`.

---

## 1. Objetivo

Hoy Holy Oly es coach-céntrico: el plan del atleta lo asigna un coach; un atleta sin
coach ve *"tu coach todavía no te asignó un plan"*. Este diseño habilita que un **atleta
sin coach** cree su **propio macrociclo** —eligiendo escuela + fecha de competencia + sus
4 RMs— reusando el motor de periodización existente. Es la visión "el sistema funciona con
atletas, con o sin coach".

**No-objetivo:** la landing page de atletas. Se difiere hasta que este flujo funcione
(decisión del owner: "primero el producto, landing al final").

## 2. Hallazgo central

El **90% ya existe**. El motor es puro y no conoce el concepto de coach; el modelo de
datos no acopla el `Plan` a un coach; la transacción que arma todo (`savePlan`) no
referencia coach. El net-new es chico: **1 endpoint + 1 schema + 1 método de cliente + 1
pantalla**. No hacen falta tablas nuevas.

## 3. Decisiones cerradas

| Tema | Decisión |
|------|----------|
| Audiencia | Atleta autoentrenado (sin coach). |
| Alcance de esta tarea | Construir el producto primero; la landing de atletas se difiere. |
| Handoff cuando llega coach | El coach puede **re-asignar** (reemplaza el self-plan), **con aviso previo** al atleta. Semántica del `Plan` único (upsert). |
| Monetización | **Gratis** (embudo de captación). `/me/plan` no pasa por el gate de billing. |
| Escuelas disponibles | **Las 24 para todos.** No hay macros female-only en el catálogo hoy; el sexo solo define la barra (15 kg F / 20 kg M), que el motor ya aplica. El "gate de sexo" queda como validación futura — hoy es no-op. |
| Punto de entrada | **Empty state de "Hoy"** (donde hoy dice "tu coach no te asignó plan"). Sin tabs nuevos. |
| RMs | **4 obligatorios al crear** (si no, el plan nace roto). Input-only. |
| Competencia | **1** en v1. Multi-pico diferido. |
| Consentimiento | **Disclaimer liviano** de auto-prescripción al crear (paralelo al consent del ciclo). |

## 4. Arquitectura

Capas tocadas: `packages/core` (schema), `apps/api` (endpoint), `apps/web` (cliente + UI).
El motor, la persistencia y la validación se **reusan verbatim**.

### 4.1 Backend — `POST /me/plan`
Archivo: `apps/api/src/me/routes.ts` (clonar el patrón `requireAthlete` ya existente).

- **Auth:** `requireAthlete`. Principal = `req.athleteId` (de la cookie de sesión, **nunca**
  del body/path). Sin `Vinculo`. **Sin** gate de billing (`requireCoachWrite` aplica solo a
  escrituras de coach).
- **Validación:** `SelfPlanSchema` (ver 4.2).
- **Sexo:** el motor ya usa `Athlete.sexo` para la barra (15 kg F / 20 kg M) vía
  `barKgForSexo` (`packages/core/src/logic/discs.ts`), de donde salen warmup y discos. **No hay
  macros female-only en el catálogo hoy**, así que no se necesita gate de selección por sexo; si
  en el futuro se marca algún macro female-only, validarlo acá (espejo de `CycleNotEligibleError`).
- **Orden crítico (no negociable):** `repo.setComps(athleteId, comps)` **ANTES** de
  `repo.savePlan(athleteId, plan, today)` — mismo orden que `MacroDetail.onAssign`
  (`apps/web/src/screens/coach/macros/MacroDetail.tsx:74-90`); si se invierte,
  `instantiateForPlan` lee comps viejas.
- **Reuso:** `repo.savePlan` (`apps/api/src/repo.ts:186-202`) hace upsert del `Plan` +
  `instantiateForPlan` (`repo.ts:341-362`: deriva `compWeeks` de `startDate`+`Competencia.date`,
  `buildAdaptivePlan`, `instantiatePrescription`, persiste `prescribedExercise` con `phaseKey`)
  + baseline `RmUpdate` (`reason='assign'`). No referencia coach → se llama tal cual.
- **Auditoría:** `recordAudit('plan.self_assign')`.
- **Anti-abuso:** rate-limit por atleta (cada POST borra+recrea todas las filas de
  prescripción → write amplification).

### 4.2 Core — `SelfPlanInput`
Archivo: `packages/core/src/schemas.ts`.

Reusa lo existente (`packages/core/src/schemas.ts:77-90`):
- `rms`: `RMSchema` (`{arranque, envion, sentadilla, frente}`, cada uno `KgSchema` `>0, <=500`).
- `comp?`: `CompetenciaSchema` (`{ name, date }`), opcional.
- `macroId`: slug del catálogo (`MACROCYCLES`), validado contra la lista.
- `startDate?`: ISO `YYYY-MM-DD`. Ancla del calendario si no hay competencia.

**Regla de anclaje:** debe haber **fecha de competencia O `startDate`**; sin ancla,
`HomeScreen` no puede calcular la semana actual.

### 4.3 Cliente — `createMyPlan(input)`
Archivo: `apps/web/src/data/meClient.ts` (interface `MeClient`, hoy de **solo lectura** en
cuanto a plan — esto agrega el primer método de *escritura* de plan).

Implementar en **las tres** impls o rompe TS/build:
1. `HttpRepository` (real).
2. `LocalMeClient` (usado por el preview de coach "ver como atleta").
3. Demo runner offline (`C:\HolyOlyDemo`). → **refrescar el demo** al cerrar la sesión
   (build web + robocopy), por la regla de demo permanente.

### 4.4 UI — "Crear mi ciclo"
Carpeta: `apps/web/src/screens/atleta/`.

- **Entrada:** desde el empty state de `HomeScreen` (`apps/web/src/screens/atleta/HomeScreen.tsx:78-86`),
  donde hoy se muestra "tu coach todavía no te asignó un plan". Reemplaza/acompaña ese texto
  con un CTA "Crear mi ciclo". Cero tabs nuevos en `AthleteShell`.
- **Pasos:**
  1. **Escuela/macro:** picker sobre `MACROCYCLES` (filtrable por familia). Todas las escuelas
     disponibles (no hay female-only que ocultar hoy).
  2. **Fecha de competencia** (opcional) — o `startDate` que ancla el calendario.
  3. **4 RMs** (port de los campos de `AssignSheet.tsx`) + **disclaimer** de auto-prescripción.
- **Submit:** `createMyPlan(input)` → al volver, `getMePlan`/`buildMePlanView`
  (`packages/core/src/logic/mePlan.ts`) encienden solos Hoy / entreno / recorrido / heatmaps
  (ya renderizan el plan **sin exponer RM**).
- **Regla dura de dominio:** el form **capta** RMs pero **NUNCA** los devuelve como lectura
  (no-RM-display). Es superficie de *input*, distinta de las superficies prohibidas de
  *display* de RM.

### 4.5 Handoff coach
Cuando el atleta usa el flujo de vínculo existente (código → request → coach confirma):
- Mostrar **aviso explícito** al atleta de que vincular un coach permite que el coach
  **reemplace** su plan.
- Al asignar el coach, el upsert del `Plan` único **pisa** el self-plan. Queda registrado en
  audit. Sin merge en v1.

## 5. Reuso verbatim (sin cambios)

- Motor: `buildAdaptivePlan`, `rescaleSchoolPhases`, `effectiveTotalWeeks`,
  `reinstantiableWeeks` (`packages/core/src/logic/adaptivePlan.ts`).
- Prescripción: `instantiatePrescription`, `resolveTargetKg`
  (`packages/core/src/logic/prescription.ts`).
- Persistencia: `repo.savePlan`, `instantiateForPlan`, `setComps` (`apps/api/src/repo.ts`).
- Vista atleta: `buildMePlanView` (`packages/core/src/logic/mePlan.ts`).
- Catálogo: `MACROCYCLES` (24 macros / 10 familias) + `ALL_RECIPES` + `SCHOOL_DNA`.
- Validación: `RMSchema`, `CompetenciaSchema`, `PlanSchema`.
- Modelo de datos: **cero tablas nuevas** (el `Plan` self-coach es una fila escrita por el
  atleta en vez del coach; reusa la `Competencia` athlete-private).

## 6. Reglas de dominio que respeta (rulebook `HOLY-OLY-DOMAIN.md`)

- **RM nunca crudo al atleta** — el form es input-only; jamás se devuelve el RM como lectura.
- **RPE no va en ninguna superficie del atleta.**
- **Discos:** solo vía `ui/Disc.tsx` (reusar `Disc`/`DiscRow` + `perSide`/`DISC_COLORS`).
- **% intensidad + kg + series×reps + discos en TODA fila** — el kg manda, los discos aproximan.
- **Ciclo female-only:** gate por `sexo==="F"`; los tips/contexto nunca disparan semáforo.

## 7. Fuera de alcance (v1) — diferidos

- Multi-pico (varias fechas de competencia) — el motor lo soporta (`peaks=true`), pero suma
  complejidad.
- Cambiar de escuela a mitad de ciclo.
- Editar la fecha de competencia post-inicio — necesitaría endpoint `/me/comps` que rutee por
  `reperiodizeFuture` (`repo.ts:236-275`, invariante D8 future-only ya garantizada en core).
- Tier de atleta pago.
- Gate de escuelas por `nivel`.

## 8. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| `Plan` único se pisa sin merge (self-assign ↔ coach-assign) | Aviso explícito en el handoff (decisión cerrada). |
| `MeClient` pasa a tener escritura → toca 3 impls + demo | Implementar las 3 + refrescar demo; TS rompe si falta una (red de seguridad). |
| Violar "RM nunca crudo" al sumar el form | Capturar sin re-renderizar RM como progreso. Revisión `el-carnicero`. |
| Sin ancla de fecha, `HomeScreen` no calcula semana | La UI exige fecha de competencia o `startDate`. |
| Self-coach saltea billing | Decisión cerrada: es gratis (embudo). Consciente, no accidental. |
| Un atleta elige una escuela inadecuada | v1: confiamos en el atleta; solo gate de sexo. Gate por nivel diferido. |
| Re-instanciación cara por POST repetido | Rate-limit por atleta. |

## 9. Testing

- **Unit (core):** `SelfPlanSchema` (válido / RM fuera de rango / sin ancla de fecha); barra
  correcta por sexo (atleta F → barra 15 kg en discos/warmup; M → 20 kg).
- **Integración (api):** atleta crea plan → `Plan` upserted, `prescribedExercise`
  instanciadas, baseline `RmUpdate` escrita, audit `plan.self_assign`; orden setComps→savePlan;
  sin sesión de atleta → 401; rate-limit.
- **UI (web):** flujo "Crear mi ciclo" (elegir escuela → fecha → RMs → submit → Hoy enciende);
  female-only oculta para no-F; RM nunca se muestra de vuelta.
- **E2E:** atleta sin coach se registra → crea ciclo → ve "Hoy" con %+kg+discos.
- Cobertura objetivo ≥80% en lo nuevo.

## 10. Workstream B (spec separado) — Capa de wellness pre-cocinada (huermn)

Independiente de este spec; se documenta aparte. Resumen: usar la API local de Huberman
(`C:\volta-atlas\packages\huermn`, RAG de 9.661 cards) **como motor de autoría offline** para
generar un catálogo **estático** de tips de wellness (parafraseados + con cita), disparados por
las señales diarias del atleta (sueño/estrés/fatiga…). Cero dependencia viva en producción
(la API es localhost-only y el contenido Huberman es legal-sensible). Reemplaza los tips
estáticos genéricos de "Mi Progreso" por algo señal-dirigido y fundado.
