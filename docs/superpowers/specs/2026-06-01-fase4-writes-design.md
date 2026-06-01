# Fase 4 — Escrituras + telemetría + app del atleta (design / slice plan)

**Fecha:** 2026-06-01 · **Depende de:** Fase 3 (auth + Vínculo, en `main`). · **Roadmap:** `2026-06-01-production-readiness-roadmap.md` §Fase 4.

Fase 4 convierte la API read-only en read/write y abre el **segundo productor de datos** (el atleta). Se parte en tres tiers de riesgo: **(A) escrituras coach→atleta** contenidas (espejo del patrón de lectura de Fase 1), **(B) UI de escritura M4c** (primer consumidor real de esas escrituras), y **(C) ingestión de telemetría + app del atleta** (greenfield, no-dimensionado — necesita sus propios design docs).

## Hallazgos que moldean el slicing

1. **Hoy ninguna UI llama writes** (grep `savePlan|addMedal|setComps` en `apps/web/src` → sólo las impls de `Repository` + tests). Los stubs `throw "writes arrive in Fase 4"` de `HttpRepository` (líneas 83-91) son **inalcanzables** desde la app. ⇒ Slice 1 sienta la *fundación* de escritura; M4c (Slice 3) es el primer consumidor.
2. **`LocalRepository` es el oráculo de comportamiento** de las escrituras de la API: `savePlan`=replace por `plan.atletaId` (L50), `addMedal`=append (L55-57), `setComps`=replace (L62).
3. **`vinculo/routes.ts` es el template** de mutación autorizada: guard → owner-check → Zod `safeParse` → Prisma.
4. **`Plan` y `Competencia` son dos stores del mismo concepto** (schema L131: "reconciled with Plan in M5"). `getPlan` (repo.ts L73) lee comps de la **tabla `Competencia`**, no de una columna en `Plan`. Decisión: **`setComps` es el único escritor de comps**; `savePlan` ignora `plan.comps` (reconciliación formal = M5).
5. **El reshape de escritura de series ya existe y está testeado**: `db/mapping.ts seriesToRows` (inverso de `rowsToSeries`), recomputa `recovery` vía `core.recoverySeries`. Listo para la ingestión (Slice 4).
6. **Migraciones:** las tablas `Plan`/`Medal`/`Competencia` ya existen ⇒ Slices 1-3/6 **sin migración**. Sólo la ingestión (Slice 4) puede requerir tabla nueva (vía `scripts/make-migration.ts`, no-interactivo).

## Slices (orden por dependencia + riesgo)

| # | Slice | Estado | Riesgo | Doc propio |
|---|-------|--------|--------|------------|
| **1** | **Escrituras coach autorizadas (API)** — `savePlan`/`addMedal`/`setComps` | **Especificado** (este doc) | Bajo | No |
| **2** | **`HttpRepository` writes** — reemplaza los 3 stubs | Especificado | Bajo | No |
| **3** | **UI de escritura M4c** (drill-down: sheets comp/medalla + MacroTimeline + luteal) | Especificado (`2026-06-01-m4c-drilldown-interactivity-design.md`) | Bajo-Medio | Ya existe |
| **6** | **M5 — asignar plan** (macro + startWeek + RMs → `savePlan`) | Mayormente espec. | Bajo-Medio | Nota corta |
| **4** | **Ingestión de telemetría del atleta** (endpoint) | **Parcial** — transform existe, contrato no | Medio-Alto | **Sí (pendiente)** |
| **5** | **App del atleta** (productor de telemetría) | **Greenfield** — riesgo top del roadmap | Alto (scope) | **Sí (brainstorm+doc)** |

**Este turno entrega Slices 1 + 2** (unidad completa y verificable: API de escritura + el cliente que la consume). Slices 3-6 quedan teed-up; 4-5 **gateados detrás de sus design docs** (nuevo eje de authz: escritura atleta-sobre-sí-mismo; el atleta es un escritor no-confiable).

---

## Slice 1 — Escrituras coach autorizadas (API) — ESTE TURNO

Espejo del patrón de lectura de Fase 1; reusa `guardAthlete` (coach session 401 + Vínculo activo 403). Sin cambio de schema.

**`apps/api/src/repo.ts`** (inverso de `getPlan`/`getMedals`/`getComps`):
- `savePlan(prisma, athleteId, plan)` → `prisma.plan.upsert({ where:{athleteId}, create/update: { macroId, startWeek, rms } })`. **Ignora `plan.comps`** (los comps los posee `setComps`). `rms` va al column Json.
- `addMedal(prisma, athleteId, medal)` → `prisma.medal.create({ data:{ athleteId, ...medal } })`. Append por fila (sin read-modify-write — divergencia *más segura* que el oráculo `LocalRepository`).
- `setComps(prisma, athleteId, comps)` → `prisma.$transaction([ deleteMany({athleteId}), createMany(comps) ])`. **Replace transaccional** (roadmap: "comps = replace transaccional") — un fallo parcial no trunca la lista.

**`apps/api/src/server.ts`** (rutas bajo `guardAthlete`):
- `PUT /athletes/:id/plan` — body `PlanSchema`; **enforce `plan.atletaId === params.id`** (400 si no) — único agujero de authz sin análogo en las lecturas. → `repo.savePlan`.
- `POST /athletes/:id/medals` — body `MedalSchema` → `repo.addMedal` (201).
- `PUT /athletes/:id/comps` — body `CompsSchema` → `repo.setComps`.

**Authz (sensible — pasa por `security-reviewer`):** coach session + Vínculo activo (heredado, ya testeado por el test de aislamiento). El check `body.atletaId === :id` evita que un coach autorizado para A escriba un Plan con `atletaId=B`. `setComps` transaccional = sin pérdida de datos parcial.

**TDD (`apps/api/src/writes.int.test.ts`, corre bajo `verify`):** coach fresco + atleta fresco + Vínculo `activo` (aislado del coach demo cuyo roster `server.int` fija en 8). Casos: plan upsert→GET refleja; medal append (count +1); comps replace (sólo los nuevos, viejos fuera); **401** sin sesión; **403** coach sin Vínculo; **400** atletaId≠path.

## Slice 2 — `HttpRepository` writes — ESTE TURNO

Reemplaza los 3 `throw` (L83-91) por POST/PUT reales (`credentials:"include"`), helper `mutate(path, method, body)` paralelo a `fetchJson`. `savePlan` deriva el path de `plan.atletaId` (la firma del `Repository` es `savePlan(plan)` sin id aparte). Flip de `HttpRepository.test.ts` (el test que hoy asegura que tiran `/Fase 4/`) a aseverar el request correcto (fetch mockeado). Cierra la abstracción: las dos impls de `Repository` quedan 100% intercambiables.

---

## Diferido (con su propio doc) — NO en este turno

- **Slice 4 (ingestión):** decisiones abiertas — granularidad (diaria vs serie semanal), quién computa el rollup, ¿requiere Vínculo? (No: "el atleta es dueño de sus datos" → authz atleta-sobre-sí-mismo vía `requireAthlete`, scope a `req.athleteId`, **nunca** id de path/body). Validación de rangos fisiológicos en el borde Zod. Reusa `seriesToRows` + `recoverySeries`.
- **Slice 5 (app del atleta):** greenfield, el esfuerzo no-dimensionado más grande. Necesita brainstorm + design doc (qué loguea, con qué frecuencia, qué ve). Reusa el design system + charts puros + `Repository`. Considerar una versión mínima primero.

**Secuencia:** 1 → 2 → 3 → (6/M5) → [doc] 4 → [brainstorm+doc] 5. Slices 1-3/6 = los dos tercios contenidos y especificados; 4-5 = el tercio greenfield, gateado por design docs + review de seguridad del modelo de escritura atleta-self.
