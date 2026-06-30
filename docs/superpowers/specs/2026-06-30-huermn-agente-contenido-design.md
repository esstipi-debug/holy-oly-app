# Diseño — huermn como agente de contenido independiente (plataforma multi-producto)

**Fecha:** 2026-06-30 · **Estado:** brainstorming aprobado · **Sub-proyecto:** SP-0 (prerequisito).
**Repos involucrados:** `volta-atlas` (donde vive huermn hoy), repo nuevo de `huermn`, `Holy Oly 0017`.

---

## Visión de plataforma (contexto)

Convertir **huermn** —hoy enterrado en `volta-atlas/packages/huermn`— en un **agente de contenido
independiente y compartido** que alimenta a **los dos productos que administramos**:

- **Volta** (CrossFit) — usa huermn completo.
- **Holy Oly** (halterofilia) — usa solo el cerebro de contenido + coach.

La misma ciencia (sueño, recuperación, nutrición, foco) sirve a ambos deportes; lo que cambia es la
**aplicación por deporte**. De ahí nace una plataforma de contenido con varias salidas:

```
            huermn (agente independiente, repo propio)
            ├─ Cerebro de contenido (sport-agnostic): /huberman/search · /ask · cards · chroma
            └─ Motor CrossFit (de Volta):              /wod /mayhem /rpg /trees · volta_bridge
                        │  corpus publicada (fuente única en huermn)
            ┌───────────┴────────────┐
            ▼                         ▼
     VOLTA (CrossFit)        HOLY OLY (halterofilia)
   blog · in-app · coach   blog · in-app · coach   + holy_oly_bridge.py
   (usa TODO)              (usa solo contenido+coach; core de macrociclos INTACTO)
```

### Decomposición (cada pieza = su propio ciclo spec → plan → implementación)

- **SP-0 · huermn independiente + contrato** *(este doc; prerequisito)*.
- **SP-1 · corpus** — cards de ciencia → `ContentDoc` publicados, con aplicación crossfit *y* halterofilia.
- **SP-2 · Blog Holy Oly** (Astro) · **SP-3 · Blog Volta** — consumen la misma corpus con su marca.
- **Después:** in-app por app (HO ya tiene `WELLNESS_TIPS`) y base de conocimiento del coach.

---

## SP-0 — Objetivo

Sacar huermn a su propio repo como **agente independiente compartido**, y definir el **contrato de
salida** (`ContentDoc`) que ambas apps consumen — diseñado **offline-first hoy, service-ready mañana**
sin reescribir.

## Qué es huermn hoy (hallazgo)

No es "el motor de tips de Huberman": es el **cerebro de CrossFit de Volta**, con dos capas pegadas.

- **Capa 1 — Contenido científico (sport-agnostic):** `ingest/` (transcripts → Chroma), `data/huberman/`
  (~9.6k cards + vectores), `agent/` (coach LLM vía Ollama, `search_huberman`), endpoint
  `GET /huberman/search`. Único acople a CrossFit: el campo `crossfit_application` en las cards.
- **Capa 2 — Programación CrossFit (de Volta):** `/wod/parse`, `/mayhem/*` (scaling de movimientos),
  `/rpg/*` (skill trees), `/trees/*`, `engine/volta_bridge.py` (mapea Volta JSON ↔ huermn). Metodología
  CompTrain/Mayhem. **Holy Oly no usa nada de esto** — halterofilia ya tiene su motor en `packages/core`.

## Decisiones de diseño (aprobadas en brainstorming)

1. **Naturaleza:** offline ahora (motor de autoría que el owner dispara), con contrato service-ready
   para exponerlo como API online después sin reescribir.
2. **Frontera:** "todo huermn compartido" pero **à la carte** — el paquete/servicio es uno solo;
   **cada app consume lo que le sirve**. Volta usa todo; Holy Oly llama al cerebro de contenido + coach
   y deja dormida la Capa 2. El `core` de HO **sigue soberano** (reglas intocables intactas).
3. **Fuentes (salida pública):** se cita **ciencia primaria** (estudios peer-reviewed). **Huberman
   nunca se nombra** en ningún producto; huermn es herramienta de autoría interna.
4. **Corpus compartida:** vive en el repo de huermn (`content/published/*`) = **fuente única**; las dos
   apps la consumen en build-time.

## Arquitectura

### 1. Extracción
huermn → **repo propio** (completo: `agent/ engine/ ingest/ api/ data/ rules/`). Volta lo apunta como
dependencia/servicio en vez de tenerlo embebido. El método de extracción (git subtree / filter-repo
para preservar historia, coordinando con los worktrees activos en `.claude/worktrees/`) es detalle del
plan, no del diseño.

### 2. Capa de contenido sport-agnostic
Las cards generalizan su bloque de aplicación:
```diff
- crossfit_application: [ ... ]
+ applications:
+   crossfit:      [ metcons, AMRAP, recuperación entre WODs ]
+   weightlifting: [ fuerza, picos de fuerza, técnica olímpica ]
```
`/huberman/search` y `/ask` aceptan un parámetro `sport` (`crossfit` | `weightlifting`).

### 3. Contrato de salida — `ContentDoc`
Unidad que huermn emite y ambas apps consumen:
```yaml
id: sleep-morning-light
slug: luz-matinal-y-rendimiento        # por locale
lang: es                               # es | en | pt
title: ...
summary: ...                           # meta description
topic: circadian_rhythm
tags: [sleep, recovery, energy]
states: [warn, alert]                  # ruteo in-app (estado de recuperación HO)
items:  [sueño]                        # ítem más flojo del check-in
body: |                                # markdown parafraseado — NUNCA nombra a Huberman
  ...
primary_sources:                       # estudios peer-reviewed → se citan en PÚBLICO
  - { title, authors, journal, year, doi }
applications:
  crossfit:      [ ... ]
  weightlifting: [ ... ]
contraindications: [ ... ]
_provenance:                           # 🔒 INTERNO — NUNCA se embarca
  huermn_card: huberman_sleep_morning_sunlight
  episode_or_newsletter: ...
```

**Reglas del contrato:**
- **Un solo doc, dos superficies.** Blog público = `body` + `primary_sources` + la `application` del
  deporte. In-app = derivación corta ruteada por `states`/`items` (lo que ya hace `WELLNESS_TIPS`).
- **`_provenance` es de autoría interna** (el rastro Huberman). Se **elimina** de todo lo publicado →
  blinda la regla no-name *por construcción*.
- **Dos caras del flujo:** huermn emite **borradores** (con `_provenance` + fuentes primarias) → el
  owner parafrasea a la **corpus publicada** (sin `_provenance`). Hoy manual (igual que el bridge
  actual). Mañana huermn podría emitir el `ContentDoc` publicado vía API con un guard de no-name —
  **mismo shape**.

### 4. `holy_oly_bridge.py`
Espejo de `volta_bridge.py`: mapea el dominio de Holy Oly ↔ huermn cuando haga falta (ej.: pasar
`sport=weightlifting` y el estado de recuperación del atleta al coach). El `core` de HO no se toca.

## Restricciones intocables (preservadas)

- Huberman **nunca** nombrado en ninguna superficie de producto (la procedencia es interna de autoría).
- Ciencia primaria citada **solo** en la salida pública.
- Transcripts premium **nunca** commiteados ni publicados (ya en `.gitignore`).
- Reglas de dominio de Holy Oly intactas (discos, % + kg por fila, RPE-nunca): el `core` no se toca.

## Verificación

- **Test de contrato** (lado consumidor): un `ContentDoc` válido parsea; un doc publicado **no** contiene
  `_provenance` ni matchea `/huberman/i` ni `/\brpe\b/i`. Reusa el patrón de `wellnessTips.test.ts`.
- **Regresión existente:** `pnpm --filter @holy-oly/core test wellnessTips` sigue verde.
- **huermn:** su pytest (`tests/test_huberman.py`, etc.) sigue verde tras la extracción + el parámetro
  `sport`.

## Fuera de alcance del SP-0

- Los blogs (SP-2/SP-3), el in-app, la base de conocimiento del coach.
- Desplegar huermn como servicio online (queda habilitado por el contrato, no se hace acá).
- Fusionar la lógica de halterofilia dentro de huermn (se rechazó: riesgo alto sobre el `core` vivo).
- Auto-escribir la corpus publicada (riesgo de copiar/nombrar la fuente) — el parafraseo es manual.

## Riesgos

- **huermn es WIP activo** (worktrees en `.claude/worktrees/`). La extracción debe coordinarse para no
  pisar trabajo en vuelo; hacerla en una ventana acordada.
- **Cross-repo:** el SP-0 toca `volta-atlas` (origen), el repo nuevo de huermn, y `Holy Oly` (bridge +
  test de contrato). Para implementarlo hay que sumar `volta-atlas` a la sesión.
- **Acople de datos:** Chroma + cards viajan con el repo de huermn (no son livianos); confirmar tamaño
  y `.gitignore` antes de la extracción.
