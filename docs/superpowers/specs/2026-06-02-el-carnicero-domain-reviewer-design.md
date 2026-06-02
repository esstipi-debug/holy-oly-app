# El Carnicero — revisor de dominio (halterofilia + Holy Oly) · Design doc

**Fecha:** 2026-06-02
**Estado:** aprobado en brainstorming, pendiente de plan de implementación.
**Decisión de partida:** un agente revisor que conoce la **lógica del deporte y de los dos usuarios** (coach/atleta), no la sintaxis. Su vara de "correcto" es un **rulebook canónico in-repo**.

## 1. Problema / objetivo

Los revisores genéricos (`code-reviewer`, `security-reviewer`, etc.) no conocen los invariantes de Holy Oly: que todo write pase por `Repository`, que el ciclo se redacte server-side, el modelo catálogo-plantilla vs plan-instancia, los ejes de authz, ni la **ciencia de halterofilia** que la app encode (periodización, ACWR, IMR-vs-fase, recuperación). Tampoco saben que la app es **viz-first** ("gráficos, no números planos") ni que cada gráfico debe **explicar cómo se forma y para qué sirve, contra qué referencia se lee**.

**Objetivo:** un agente —**"El Carnicero"**— que revise cada cambio con dos lentes (coach + atleta), midiendo contra un rulebook de dominio versionado en el repo, atrapando regresiones de *producto/deporte/privacidad* que los genéricos no ven.

Motivación inmediata: los **gráficos actuales ya se sabe que están pobres / sin contexto**. Auditarlos es la primera prueba real del agente (§5) y produce el backlog de remediación.

## 2. Decisiones

- **Forma (B):** agente + **rulebook canónico in-repo**. El conocimiento deja de estar disperso (Downloads + memory + specs) y pasa a un doc único, versionado, que leen humanos y el agente.
- **Nombre:** `el-carnicero` (en honor a **Ivan Abadjiev**, "El Carnicero"). Se toma su **temperamento** (implacable, exigente, cero excusas), **no** su metodología — el método búlgaro es lo opuesto a la periodización+recuperación que Holy Oly encode. El Carnicero hace cumplir el **rulebook**, no el sistema búlgaro.
- **Alcance:** revisor de **dominio**. Subsume los invariantes "técnicos" que en realidad son reglas de dominio (Repository, redacción de ciclo, plantilla→instancia, authz). **No** reemplaza a los revisores ECC de calidad/seguridad genérica.
- **Modo:** read-only, advisory. Tools: `Read, Grep, Glob, Bash` (Bash sólo para `git diff`).
- **Scope:** project-scoped (`.claude/agents/`), viaja con git a todos los worktrees y a Render.
- **Anti-alucinación:** sólo afirma lo que el rulebook respalda; lo no cubierto se marca "fuera de rulebook — criterio del coach".
- **Descomposición:** El Carnicero (+rulebook) es **este** spec; la **auditoría de gráficos** es su tarea inaugural (§5); **remediación de gráficos** y **calendario (coach+atleta)** son features con ciclo propio (§6).

## 3. Entregable 1 — Rulebook `docs/domain/HOLY-OLY-DOMAIN.md`

Un doc canónico **orientado a reglas chequeables** (MUST/NEVER + por qué + cómo detectar violación). Destilado del maestro (`C:\Users\Gamer\Downloads\sistema-macrociclos-maestro.md`), `charts-spec` (`graficos-formato-movil.md`), design-system, plate/disc, ciclo-menstrual, vinculación y memory — **cruzado contra `packages/core`** para que las reglas escritas matcheen las implementadas (el drift doc↔código es, en sí, un hallazgo).

| # | Sección | Contenido |
|---|---------|-----------|
| 0 | **Misión + 2 reglas duras** | **HR-1 Viz-first**: nunca número plano donde corresponde señal-contra-referencia; al atleta nunca un número gameable (carga, no ratio ACWR). **HR-2 Siempre explicado (con contexto)**: cada gráfico/señal trae *cómo se forma* (inputs + cálculo), *para qué sirve* (qué decisión informa) y *contra qué se lee* (su banda/referencia). Un gráfico sin contexto es ruido — HR-2 lo trata como **defecto**, no adorno. |
| 1 | **Las dos personas** | coach (triage/periodización/asignación) vs atleta (autocuidado/auto-reporte): qué ve cada uno, qué posee, authz, privacidad. |
| 2 | **Ciencia del deporte** | 1RM/discos IWF (kg=verdad, discos aproximados, sólo 10/15/20/25); periodización + IMR-vs-fase (banda esperada por fase); ACWR banda 0.8–1.3 (flags >1.3/>1.5); recuperación vs baseline (HRV+RHR+sueño); reestructuración por competencia (`d = semanaComp − semana`; 1 comp adelanta / varias repite); qué dispara el semáforo y qué **no**. |
| 2b | **Verdad anclada a fecha** | entrenamiento / no-asistencia / competencia se anclan a **fechas reales** (`Plan.startDate`, `Competencia.date`, `SessionMark`), **no** a índices de semana sueltos. El calendario manda: el macro se construye hacia atrás desde la comp. (Principio que el futuro **calendario** —§6— deberá respetar y El Carnicero revisar.) |
| 3 | **Privacidad / ética** | ciclo menstrual opt-in (no por género), **contextualiza** recovery y **NUNCA** es semáforo; paleta neutra; amenorrea = derivación médica sobria; **redacción server-side** (coach ve contexto redactado, nunca fase/día/síntoma). Atleta dueño de su dato. Warm-up se muestra, no se cuenta. |
| 4 | **Viz-first detallado** | charts-spec destilado: one-card-one-chart, **tap-not-hover**, bandas/corredores en vez de lectura fina de eje, **color=estado** (nunca decorativo), evitar radar/pie/dual-axis múltiple, atleta nunca ACWR-as-gauge. HR-2 operacionalizada (mecanismo = detail-on-tap + action phrase + banda de referencia visible). |
| 5 | **Invariantes de dominio en la arquitectura** | todo write pasa por `Repository` (`packages/core/src/repository.ts`); redacción de ciclo server-side; catálogo-plantilla (read-only, sin fecha) vs `Plan`-instancia (startDate+comps); ejes de authz (coach↔Vínculo activo / atleta↔requireAthlete); gotchas de build (tsup bundlea core, `prisma generate` en worktree, correr el bundle real). |
| 6 | **Fuentes** | trazabilidad: de qué doc/archivo sale cada regla. |

> Si el rulebook supera ~800 líneas, se parte en `docs/domain/*` con índice. v1 apunta a un solo archivo.

## 4. Entregable 2 — Agente `.claude/agents/el-carnicero.md`

**Frontmatter:**
- `name: el-carnicero`
- `description:` cuándo usarlo (PROACTIVAMENTE tras cambios en `apps/web` screens, `packages/core` logic o `apps/api` routes; revisa contra el rulebook de dominio con lentes coach+atleta). La descripción habilita el auto-dispatch.
- `tools: Read, Grep, Glob, Bash`
- `model:` heredado (se puede pinear a opus para revisiones profundas).

**Cuerpo (system prompt):**
1. **Identidad / voz**: experto en halterofilia olímpica **+** en cómo Holy Oly la encode, con el temperamento de Abadjiev (terso, implacable, sin medias tintas). Su vara es el rulebook — **lo lee SIEMPRE primero** (`docs/domain/HOLY-OLY-DOMAIN.md`).
2. **Proceso**: (a) leer rulebook; (b) obtener el diff (`git diff main...HEAD` o los archivos indicados); (c) pasar cada cambio por los 2 lentes + las reglas; (d) emitir hallazgos.
3. **Dos lentes** en cada cambio: 🏋️ coach (¿sirve al triage/periodización/asignación? ¿respeta plantilla→instancia?) · 🤸 atleta (¿respeta propiedad del dato, privacidad del ciclo, el "no número gameable"?).
4. **Checklist** (resumen de las reglas del rulebook, con énfasis en HR-1/HR-2 + privacidad del ciclo + Repository + authz + verdad-anclada-a-fecha).
5. **Guardarraíl anti-alucinación**: lo no cubierto por el rulebook se marca "fuera de rulebook — criterio del coach"; jamás inventa una regla de deporte.
6. **Formato de salida** (en español): severidad ECC (CRITICAL/HIGH/MEDIUM/LOW); cada hallazgo = regla violada + `file:line` + por qué (en términos de dominio) + fix sugerido. Cierra con un bloque "✅ qué respeta bien".
7. **Límites**: read-only; no edita; no corre tests; complementa (no reemplaza) a los revisores ECC.

## 5. Verificación

Como el entregable es markdown, se verifica **corriendo a El Carnicero contra diffs-trampa** y comprobando juicio:

1. **Violación de privacidad** — un cambio que muestre al atleta su ratio ACWR crudo → debe flaggear (HR-1 + privacidad, CRITICAL/HIGH).
2. **Número plano sin gráfico/explicación** → debe flaggear HR-1/HR-2.
3. **Write que saltea `Repository`** (p.ej. fetch directo a la API desde una screen) → CRITICAL.
4. **Código sano** (un commit real limpio, p.ej. `534a1bc` M5) → **sin falsos positivos** graves.
5. **Pregunta fuera de scope** (p.ej. macros nutricionales) → responde "fuera de rulebook", no inventa.

Pasa si: lee el rulebook, acierta 1–3 con la severidad correcta, no inventa en 4–5.

### Corrida inaugural (primer trabajo real)

Pasados los traps, El Carnicero audita **todos los gráficos existentes** (`apps/web`: `LineWithBand`, `IMRvsFase`, `MacroTimeline`, `Heatmap`, `RiskQuadrant`, `Sparkline`, `PeriodizationChart`, …) contra HR-1/HR-2 y §4 → devuelve un **backlog de remediación por gráfico** (qué contexto / explicación / banda de referencia le falta a cada uno). Esto valida al agente con un caso real (el usuario ya sabe que "casi todos están pobres") y produce el insumo del ciclo de remediación (§6).

## 6. Trabajo derivado (ciclos propios, fuera de este spec)

El Carnicero es el lente; estos son trabajos que se revisan **con** él, cada uno con su propio brainstorm→spec→plan:

- **Remediación de gráficos** — arreglar los charts según el backlog de la corrida inaugural (contexto / explicación / bandas faltantes). Posible apoyo: `taste-skill` / `gan-design`. Revisado por El Carnicero.
- **Calendario (coach + atleta)** — superficie que unifica *cuándo se entrenó / cuándo no / cuándo es la competencia*. Reusa `SessionMark`, `Competencia.date`, `Plan.startDate`. Se revisa contra el principio "verdad anclada a fecha" (§3·2b). Su propio ciclo.

## 7. No-objetivos

- No reemplaza a `code-reviewer`/`security-reviewer`/`typescript-reviewer` (calidad/seguridad genérica siguen siendo de ellos).
- No hook automático en v1 (invocación manual/proactiva; el hook es futuro, YAGNI).
- No metodología búlgara: El Carnicero es temperamento, no sistema de entrenamiento.
- No edita código ni corre la app. **No construye** el calendario ni arregla gráficos — eso es §6.

## 8. Fuentes

- Maestro: `C:\Users\Gamer\Downloads\sistema-macrociclos-maestro.md`
- Charts: `C:\Users\Gamer\Downloads\graficos-formato-movil.md`
- Memory del proyecto: `macrociclos-system-spec`, `charts-spec`, `design-system`, `plate-disc-system`, `ciclo-menstrual-module`, `vinculacion-coach-atleta`, `catalog-source-of-truth`, `coach-screen-slices`
- Specs in-repo: `docs/superpowers/specs/*` (app-design, fase1/3/4, m4c, slice-a)
- Código: `packages/core/src/` (repository, logic), `apps/api/src/` (routes, auth, vinculo), `apps/web/src/data/` (Local/HttpRepository) + charts en `apps/web/src/ui/`

## 9. Próximo paso

Invocar **writing-plans** para detallar el plan de implementación (orden: rulebook primero, luego el agente que lo referencia, luego verificación con los diffs-trampa, y la **corrida inaugural** de auditoría de gráficos).
