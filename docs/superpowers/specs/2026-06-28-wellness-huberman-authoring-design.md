# Diseño — Workstream B: tips de wellness desde huermn (autoría offline)

**Fecha:** 2026-06-28 · **Estado:** aprobado (enfoque "pre-cocinar") · spec separado del self-coach.

## Objetivo

Enriquecer los tips de "Mi estado de hoy" del atleta usando la **API local de Huberman** (`huermn`,
RAG de 9.661 protocol cards en `C:\volta-atlas\packages\huermn`) como **motor de autoría offline**.
Holy Oly NO consulta huermn en runtime: sigue embarcando el catálogo estático `WELLNESS_TIPS`.

## Hallazgo: la superficie ya existe

`packages/core/src/data/wellnessTips.ts` ya define `WELLNESS_TIPS` (`{id, topic, title, body, source,
states[], items[]}`) + `pickWellnessTip({state, item, seed})` + `lowestWellnessItem`; `EstadoTip.tsx`
los renderiza en Hoy, enrutados por estado de recuperación (ok/warn/alert) + ítem más flojo del
check-in. **Workstream B = expandir ese catálogo**, no construir uno nuevo.

## 🔴 Restricción intocable (corrige el "con cita real" anterior)

`wellnessTips.test.ts` blinda, para TODO tip: ningún `title`/`body`/`source` matchea `/huberman/i`
ni `/\brpe\b/i`, y la atribución (`source`) es **genérica** (`SRC`). O sea: **la fuente real NUNCA
se nombra en el producto** (regla del owner). Los tips son hechos parafraseados, no texto citado.
→ La procedencia de huermn (URL/episodio) es **interna de autoría**, jamás se embarca.

## Arquitectura

- **Bridge de autoría** (`scripts/wellness/huberman-tips-draft.mjs`, Node ≥18, cero-dep): mapea las
  señales del atleta (sueño/estrés/fatiga/dolor/humor/motivación) a queries Huberman, consulta
  `GET /huermn /huberman/search?q=…&top_k=5`, y emite `docs/wellness/huberman-drafts.md` con, por
  topic: hechos candidatos + procedencia interna + un **stub** `WellnessTip` (con `states`/`items`
  prellenados y `source: SRC`). **No escribe `wellnessTips.ts`** (protege el invariante no-name).
- **Parafraseo manual** (owner): convierte los hechos del borrador en entradas nuevas de
  `WELLNESS_TIPS`, fuente genérica, sin nombrar la fuente, sin RPE.
- **Consumo (ya existe):** `pickWellnessTip` en `EstadoTip` — sin cambios.

## Fuera de alcance

Llamada en vivo a huermn desde prod (localhost + legal) · desplegar huermn como servicio · auto-
escribir tips (riesgo de copiar/nombrar la fuente) · UI nueva (la superficie ya existe).

## Verificación

- `node scripts/wellness/huberman-tips-draft.mjs --dry-run` corre sin huermn (valida estructura).
- Tras parafrasear: `pnpm --filter @holy-oly/core test wellnessTips` (regresión del no-name + RPE).

## Estado de huermn (2026-06-28)

Data presente (9.661 cards + Chroma), pero **no runnable en la sesión actual**: sin venv, faltan
`chromadb`/`fastapi` en el Python del sistema, y el repo es "WIP ajeno — no tocar a ciegas". El owner
levanta huermn en su máquina y corre el bridge cuando quiera generar/expandir tips.
