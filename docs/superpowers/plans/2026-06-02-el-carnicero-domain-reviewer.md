# El Carnicero — revisor de dominio · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear un agente revisor de dominio ("El Carnicero") respaldado por un rulebook canónico in-repo, que revise cambios de Holy Oly con lentes coach+atleta contra la lógica de halterofilia + las reglas de la app.

**Architecture:** Dos artefactos markdown — (1) `docs/domain/HOLY-OLY-DOMAIN.md` (rulebook de reglas chequeables, destilado de los specs+memory y cruzado contra `packages/core`); (2) `.claude/agents/el-carnicero.md` (subagente read-only que lee el rulebook y emite hallazgos con severidad). La verificación es por **dispatch del agente contra diffs-trampa** (no unit tests — el entregable es config/doc). Cierra con una **auditoría inaugural** de los 11 charts reales.

**Tech Stack:** Markdown; Claude Code project agents (`.claude/agents/*.md`); Agent tool (`subagent_type: el-carnicero`); git/Bash para diffs.

> **Commits:** el usuario pidió commitear sólo cuando lo pida. Los pasos `[GATED]` se ejecutan únicamente con su OK; default = **un commit final** del feature (rulebook + agente + spec + plan + audit). No empujar a `main` sin pedido explícito.

> **Nota sobre TDD:** el entregable es doc+agente, no código con unit tests. El equivalente a "test primero" es la **Task 4 (acceptance)**: los diffs-trampa con verdictos esperados se definen ANTES de dar por bueno el agente, y se itera rulebook/agente hasta que los acierte.

---

## File Structure

| Archivo | Crea/Modifica | Responsabilidad |
|---------|---------------|-----------------|
| `docs/domain/HOLY-OLY-DOMAIN.md` | Crear | Rulebook canónico: misión + 2 reglas duras + ciencia + privacidad + viz-first + invariantes + verdad-anclada-a-fecha + fuentes. |
| `.claude/agents/el-carnicero.md` | Crear | Subagente revisor de dominio (frontmatter + system prompt). Referencia el rulebook. |
| `docs/domain/charts-audit-2026-06-02.md` | Crear (Task 5) | Backlog de remediación de los 11 charts (salida de la corrida inaugural). |

Fuentes de grounding (solo lectura): `packages/core/src/logic/{monitor,restructure,discs,schedule}.ts`, `packages/core/src/repository.ts`, `apps/api/src/cycle.ts`, `apps/api/src/auth/guards.ts`, `apps/api/src/vinculo/routes.ts`, `apps/web/src/data/*`, `apps/web/src/ui/charts/*`, y el maestro `C:\Users\Gamer\Downloads\sistema-macrociclos-maestro.md` + `graficos-formato-movil.md`.

---

## Task 1: Grounding — confirmar las reglas contra el código real

**Objetivo:** que cada número/regla del rulebook matchee la implementación (evitar drift doc↔código). Solo lectura.

**Files:**
- Read: `packages/core/src/logic/monitor.ts` (+ `monitor.test.ts`)
- Read: `packages/core/src/logic/restructure.ts`, `discs.ts`, `schedule.ts`
- Read: `packages/core/src/repository.ts`
- Read: `apps/api/src/cycle.ts` (+ `cycle.test.ts`), `apps/api/src/auth/guards.ts`
- Read: `apps/web/src/data/` (LocalRepository + HttpRepository)
- Read (si existen): `C:\Users\Gamer\Downloads\sistema-macrociclos-maestro.md`, `C:\Users\Gamer\Downloads\graficos-formato-movil.md`

- [ ] **Step 1: Leer la lógica de monitor y extraer los números reales**

Run: `Read packages/core/src/logic/monitor.ts` y `monitor.test.ts`.
Extraer y anotar: banda ACWR exacta (esperado 0.8–1.3) + thresholds de flag (>1.3 / >1.5); modelo de banda IMR-por-fase (cómo se computa el corredor lo–hi); cómo se calcula recuperación vs baseline (HRV/RHR/sueño) y qué offsets usa (+3/+5 lpm).
Expected: tener los valores literales para citar en el rulebook §2.

- [ ] **Step 2: Leer restructure + discs + schedule**

Run: `Read` de `restructure.ts` (motor `d = semanaComp − semana`, 1 comp adelanta / varias repite), `discs.ts` (colores IWF, sólo 10/15/20/25, kg=verdad), `schedule.ts` (adherencia de sesiones / fechas).
Expected: confirmar las reglas de §2 + §2b (verdad anclada a fecha) contra el código.

- [ ] **Step 3: Leer la redacción de ciclo y los guards de authz**

Run: `Read apps/api/src/cycle.ts`, `apps/api/src/auth/guards.ts`, `apps/api/src/vinculo/routes.ts`.
Extraer: qué campos del ciclo se redactan server-side (qué NUNCA viaja al coach); nombres reales de los guards (p.ej. `requireCoach`/`guardAthlete`/`requireAthlete`) y cómo aplican Vínculo activo vs atleta-sobre-sí.
Expected: §3 (privacidad) y §5 (authz) citan nombres/campos reales.

- [ ] **Step 4: Confirmar el contrato Repository y el flujo de datos del front**

Run: `Read packages/core/src/repository.ts` y `apps/web/src/data/*`.
Extraer: que las screens nunca tocan storage/fetch directo (todo vía `Repository`); el JSDoc de `savePlan` (ignora `comps`); cómo `HttpRepository` valida con schemas Zod.
Expected: §5 (invariante Repository) preciso.

- [ ] **Step 5: Verificar las fuentes externas (Downloads)**

Run: `Glob C:/Users/Gamer/Downloads/sistema-macrociclos-maestro.md` y `.../graficos-formato-movil.md`.
Expected: si existen, se citan como fuente; si NO, el rulebook se apoya en specs in-repo + memory (el usuario ya autorizó confiar) y se anota la ausencia en §6 Fuentes.

> Sin commit (research). El output vive en contexto para la Task 2.

---

## Task 2: Escribir el rulebook `docs/domain/HOLY-OLY-DOMAIN.md`

**Files:**
- Create: `docs/domain/HOLY-OLY-DOMAIN.md`

Cada sección lista **reglas chequeables** con el formato: `**MUST/NEVER** <regla>. *Por qué:* <razón de dominio>. *Violación se ve como:* <señal detectable>.` Contenido por sección (usar los valores reales de Task 1):

- **§0 Misión + reglas duras**
  - HR-1 Viz-first: NEVER un número plano donde corresponde señal-contra-referencia; NEVER mostrarle al atleta un número gameable (ve **carga**, no el ratio ACWR).
  - HR-2 Explicado-con-contexto: MUST cada gráfico/señal traer *cómo se forma* (inputs+cálculo), *para qué sirve* (qué decisión informa) y *contra qué banda se lee*. Sin contexto = defecto.
- **§1 Dos personas:** coach (triage/periodización/asignación; ve el plantel y el drill-down) vs atleta (autocuidado/auto-reporte; ve su propio feed). Qué posee cada uno, authz, privacidad.
- **§2 Ciencia del deporte** (valores de Task 1): 1RM/discos IWF (kg=verdad; sólo 10/15/20/25); periodización + IMR-vs-fase (banda por fase); ACWR banda 0.8–1.3 (flags >1.3/>1.5); recuperación vs baseline; reestructuración `d=semanaComp−semana`; qué dispara/NO dispara el semáforo.
- **§2b Verdad anclada a fecha:** MUST anclar entrena/no-entrena/comp a fechas reales (`Plan.startDate`, `Competencia.date`, `SessionMark`), NEVER a índices de semana sueltos. El calendario manda (macro hacia atrás desde la comp).
- **§3 Privacidad/ética:** ciclo opt-in (no por género); contextualiza recovery; NEVER semáforo; paleta neutra; amenorrea→derivación médica sobria; redacción server-side (coach NEVER ve fase/día/síntoma — campos reales de Task 1). Atleta dueño de su dato. Warm-up se muestra, no se cuenta.
- **§4 Viz-first detallado:** one-card-one-chart; tap-not-hover; bandas/corredores; color=estado (NEVER decorativo); evitar radar/pie/dual-axis múltiple; atleta NEVER ACWR-as-gauge. HR-2 operacionalizada (detail-on-tap + action phrase + banda visible).
- **§5 Invariantes de dominio en arquitectura:** todo read/write por `Repository` (screens NEVER fetch/localStorage directo); redacción de ciclo server-side; catálogo-plantilla (read-only, sin fecha) vs `Plan`-instancia (startDate+comps); authz (coach↔Vínculo activo / atleta↔requireAthlete — nombres reales de Task 1); gotchas de build (tsup bundlea core, `prisma generate` en worktree, correr el bundle real).
- **§6 Fuentes:** trazabilidad por regla (maestro, charts-spec, memory, specs, código).

- [ ] **Step 1: Escribir el archivo** con todas las secciones arriba, valores reales de Task 1, formato regla-chequeable.

- [ ] **Step 2: Auto-chequeo de grounding**

Verificar manualmente: cada número de §2 coincide con `monitor.ts`/`restructure.ts`; los nombres de guards de §5 coinciden con `guards.ts`; los campos redactados de §3 coinciden con `cycle.ts`. Corregir cualquier drift.
Expected: cero discrepancias doc↔código.

- [ ] **Step 3: Chequeo de tamaño**

Run: contar líneas. Si > 800, partir en `docs/domain/*` con un índice en `HOLY-OLY-DOMAIN.md`. Si ≤ 800, dejar como un archivo.

- [ ] **Step 4: `[GATED]` Commit**

```bash
git add docs/domain/HOLY-OLY-DOMAIN.md
git commit -m "docs(domain): rulebook canónico de Holy Oly (vara de El Carnicero)"
```

---

## Task 3: Escribir el agente `.claude/agents/el-carnicero.md`

**Files:**
- Create: `.claude/agents/el-carnicero.md`

- [ ] **Step 1: Escribir el archivo con este contenido exacto**

```markdown
---
name: el-carnicero
description: Revisor de DOMINIO de Holy Oly (halterofilia + lógica coach/atleta). Úsalo PROACTIVAMENTE tras cambios en apps/web (screens, charts), packages/core (logic) o apps/api (routes). Revisa contra docs/domain/HOLY-OLY-DOMAIN.md con dos lentes (coach + atleta): viz-first, explicación-con-contexto, privacidad del ciclo, Repository, authz, verdad-anclada-a-fecha. Read-only, advisory. NO reemplaza a code-reviewer/security-reviewer.
tools: Read, Grep, Glob, Bash
---

Sos **El Carnicero** — revisor de dominio de Holy Oly. Conocés halterofilia olímpica a fondo Y cómo esta app la encode. Tu temperamento es el de Ivan Abadjiev: implacable, terso, cero trofeos de participación. IMPORTANTE: hacés cumplir el **rulebook de la app** (periodización + recuperación + privacidad), NO el método búlgaro. Abadjiev es tu actitud, no tu metodología.

## Tu vara de "correcto"
El único árbitro es `docs/domain/HOLY-OLY-DOMAIN.md`. **Leelo SIEMPRE primero, completo**, antes de juzgar. Si una afirmación tuya no está respaldada por el rulebook, no la hagas: marcala "fuera de rulebook — criterio del coach". JAMÁS inventás una regla de deporte.

## Proceso
1. Leé `docs/domain/HOLY-OLY-DOMAIN.md` entero.
2. Obtené el cambio: si te dan archivos/snippet, usalos; si no, `git diff main...HEAD` (o `git show <sha>`, o leé los archivos indicados).
3. Pasá CADA cambio por los dos lentes y por las reglas del rulebook.
4. Emití hallazgos.

## Los dos lentes (ambos, a cada cambio)
- 🏋️ **Coach**: ¿sirve al triage/periodización/asignación? ¿respeta catálogo-plantilla → plan-instancia? ¿la verdad está anclada a fecha real, no a semana suelta?
- 🤸 **Atleta**: ¿respeta que el atleta es dueño de su dato? ¿la privacidad del ciclo (redacción server-side, NUNCA semáforo)? ¿NO le muestra un número gameable (carga, no ratio ACWR)?

## Reglas que más mirás (el detalle está en el rulebook)
- **HR-1 Viz-first**: número plano donde va señal-contra-referencia = defecto. Atleta NUNCA ve ACWR-as-gauge.
- **HR-2 Explicado-con-contexto**: todo gráfico trae *cómo se forma* + *para qué sirve* + *contra qué banda se lee*. Sin eso = defecto, no adorno.
- **Privacidad del ciclo**: opt-in; contextualiza recovery; NUNCA semáforo; coach ve contexto redactado server-side (nunca fase/día/síntoma).
- **Repository**: las screens NUNCA tocan fetch/localStorage directo; todo pasa por la interfaz `Repository`.
- **Authz**: coach sobre atleta sólo vía Vínculo activo; atleta sólo sobre sí (requireAthlete).
- **Verdad anclada a fecha**: entrena/no-entrena/comp en fechas reales, no índices de semana.
- **Ciencia**: ACWR 0.8–1.3; IMR-vs-fase banda por fase; kg=verdad; reestructuración d=semanaComp−semana.

## Formato de salida (en español)
Para cada hallazgo:
> **[SEVERIDAD]** `archivo:línea` — <regla violada>
> *Por qué (dominio):* <en términos de coaching/atleta/privacidad>
> *Fix:* <qué cambiar>

Severidades: **CRITICAL** (privacidad/datos, IDOR, bypass de Repository), **HIGH** (regla de deporte rota; HR-1/HR-2 en superficie clave), **MEDIUM** (mantenibilidad de dominio), **LOW** (matiz).

Cerrá SIEMPRE con:
> **✅ Qué respeta bien:** <2–4 puntos>
> **Fuera de rulebook:** <lo que no pudiste juzgar con el rulebook, si hubo>

No edites código. No corras tests. No construyas features. Sos un revisor.
```

- [ ] **Step 2: Verificar que el agente carga**

Run: `Glob .claude/agents/el-carnicero.md` (existe) y revisar que el frontmatter tenga `name`, `description`, `tools` válidos.
Expected: archivo presente, frontmatter bien formado.

- [ ] **Step 3: `[GATED]` Commit**

```bash
git add .claude/agents/el-carnicero.md
git commit -m "feat(agents): El Carnicero — revisor de dominio (halterofilia + coach/atleta)"
```

---

## Task 4: Verificación (acceptance) — dispatch contra diffs-trampa

El "test" del agente. Dispatchar `el-carnicero` (Agent tool, `subagent_type: el-carnicero`) con cada escenario y comparar el verdicto contra lo esperado. Si falla, ajustar rulebook/agente y re-dispatchar.

- [ ] **Trap 1 — Privacidad/HR-1 (atleta ve ACWR crudo).** Prompt al agente: *"Revisá este cambio propuesto en la vista del atleta: `<Stat label=\"Tu ACWR\" value={acwr.toFixed(2)} /> // 1.42`"*.
  Esperado: **CRITICAL/HIGH** — viola HR-1 (número gameable al atleta) + privacidad (el atleta ve carga, no el ratio). Debe citar la HARD RULE del charts-spec.

- [ ] **Trap 2 — Número plano sin contexto (HR-1/HR-2).** Prompt: *"Revisá: `<div>Cumplimiento: 73%</div>` en el drill-down del coach, sin gráfico ni explicación."*
  Esperado: **HIGH/MEDIUM** — HR-1 (número plano donde va viz) + HR-2 (sin cómo-se-forma/para-qué/banda).

- [ ] **Trap 3 — Bypass de Repository.** Prompt: *"Revisá: en `apps/web/src/screens/coach/Equipo.tsx`, `const res = await fetch(\`${API}/roster\`)` directo."*
  Esperado: **CRITICAL** — viola el invariante Repository (las screens nunca fetch directo).

- [ ] **Trap 4 — Código sano (sin falsos positivos).** Run: `git show 534a1bc --stat` para ubicar el commit M5; dispatch: *"Revisá el cambio de `git show 534a1bc`."*
  Esperado: **sin CRITICAL fabricados**; a lo sumo notas menores; debe incluir el bloque "✅ qué respeta bien".

- [ ] **Trap 5 — Fuera de scope (anti-alucinación).** Prompt: *"¿Está bien el reparto de macros de proteína/carbohidrato del atleta?"*
  Esperado: responde **"fuera de rulebook — criterio del coach"**; NO inventa una regla nutricional.

- [ ] **Step final: Veredicto.** Pasa si: lee el rulebook, acierta Trap 1–3 con severidad correcta, no fabrica en Trap 4, y se abstiene en Trap 5. Si algún trap falla → ajustar `HOLY-OLY-DOMAIN.md` y/o el agente, re-dispatchar el trap que falló. (Sin commit hasta que pase todo.)

---

## Task 5: Corrida inaugural — auditoría de los 11 charts

Primer trabajo real. Dispatch `el-carnicero` para auditar los charts existentes (lee los archivos, no un diff).

**Files:**
- Create: `docs/domain/charts-audit-2026-06-02.md`
- Audita: `apps/web/src/ui/charts/{AcwrChart,CompChart,Heatmap,ImrFaseChart,LoadChart,MacroPeriodization,MacroTimeline,RecoveryChart,RiskQuadrant,WeightChart,WellnessChart}.tsx` + `chartkit.tsx`

- [ ] **Step 1: Dispatch de auditoría.** Prompt al agente: *"Auditá CADA uno de estos 11 charts (`apps/web/src/ui/charts/*.tsx`) contra HR-1, HR-2 y §4 del rulebook. Para cada chart: ¿tiene explicación de cómo se forma? ¿para qué sirve? ¿muestra su banda/referencia? ¿color=estado? ¿algún número plano o gameable? Devolvé un backlog por chart con severidad y el fix concreto."*

- [ ] **Step 2: Guardar el backlog** en `docs/domain/charts-audit-2026-06-02.md` (una entrada por chart: hallazgos + severidad + fix). Este doc es el insumo del ciclo de remediación (§6 del spec).

- [ ] **Step 3: `[GATED]` Commit** (junto al feature):

```bash
git add docs/domain/charts-audit-2026-06-02.md
git commit -m "docs(domain): auditoría inaugural de charts por El Carnicero"
```

---

## Task 6: `[GATED]` Commit final del feature + cierre

- [ ] **Step 1:** Con OK del usuario, un commit del feature completo si no se commiteó por tasks:

```bash
git add docs/domain/ .claude/agents/el-carnicero.md docs/superpowers/specs/2026-06-02-el-carnicero-domain-reviewer-design.md docs/superpowers/plans/2026-06-02-el-carnicero-domain-reviewer.md
git commit -m "feat: El Carnicero (revisor de dominio) + rulebook + auditoría inaugural de charts"
```

- [ ] **Step 2:** Reportar al usuario: agente listo (cómo invocarlo), rulebook en `docs/domain/`, y el backlog de remediación de charts como próximo ciclo. NO empujar a `main` sin pedido.

---

## Self-Review

**1. Spec coverage:**
- Rulebook (spec §3) → Task 2. ✓
- Agente (spec §4) → Task 3. ✓
- Verificación con 5 traps (spec §5) → Task 4. ✓
- Corrida inaugural / auditoría de charts (spec §5) → Task 5. ✓
- Principio "verdad anclada a fecha" (spec §3·2b) → Task 2 §2b. ✓
- HR-2 con contexto (spec §0) → Task 2 §0 + Task 4 Trap 2. ✓
- Anti-alucinación (spec §4.5) → Task 3 body + Task 4 Trap 5. ✓
- Grounding contra core (spec §3 "cruzado contra packages/core") → Task 1. ✓
- Trabajo derivado calendario/remediación (spec §6) → fuera de este plan por diseño (ciclos propios); el backlog (Task 5) es el handoff. ✓

**2. Placeholder scan:** El contenido del agente está completo (Task 3). El rulebook se especifica por reglas concretas por sección + valores reales de Task 1 (no "TBD"). Traps con snippets literales. Sin placeholders de ejecución.

**3. Type/nombre consistency:** `el-carnicero` (name), `docs/domain/HOLY-OLY-DOMAIN.md` (path del rulebook) y `subagent_type: el-carnicero` usados consistentemente en Tasks 3–5. Charts referidos por su nombre real de archivo (de Glob). ✓

---

## Execution Handoff

Ver pasos al final (offer Subagent-Driven vs Inline).
