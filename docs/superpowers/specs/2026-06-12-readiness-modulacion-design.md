# readiness → modulación (visible en el preview Prilepin) — spec corta

**Fecha:** 2026-06-12
**Estado:** SHIPPED (rama de trabajo, sin push)
**Alcance:** acotado y seguro. COACH-ONLY, read-only, dentro del preview Prilepin que ya existe.

---

## 1. Decisión (NO re-litigar)

- **COACH-ONLY, read-only, dentro del preview Prilepin** (`PrilepinSection`). NO altera el plan
  prescrito real (las recetas). NO se muestra al atleta. NO toca el ciclo (Capa 3 = DIFERIDO).
- El objetivo es hacer la modulación por readiness **EXPLÍCITA y VISIBLE con su rationale** —
  no construir autorregulación del plan real.
- **No entra al semáforo.** El semáforo de la casa (ACWR + recuperación, `seriesState`) NO se toca.
  Esto es *display* del preview: redacta lo que el motor ya hizo con la banda del día.
- **Sin dato → none honesto.** Sin readiness disponible (sin serie de monitoreo) el preview lo
  muestra como "sin señal de readiness" — jamás se fabrica una banda ni un ajuste.

## 2. Qué hace HOY el motor (hallazgo de la investigación)

**El motor YA modula por readiness.** No es parcial: la modulación está completa y testeada.

- `packages/core/src/logic/prilepin.ts:111-113` — `generateWeek` consume `input.readiness`
  (`ReadinessBand | null`) y deriva `readinessFactor`:
  - `green` / `null` → `1.0` (se permite lo planificado)
  - `amber` → `0.9` (dosis sostenida, recorte leve)
  - `red` → `0.75` (dosis recortada)
  Ese factor multiplica `taperFinal = profile.taperFactor * acwrFactor * readinessFactor`, que
  escala las reps objetivo de cada zona (`prilepin.ts:126`). Menos readiness → menos volumen.
- `packages/core/src/logic/prilepin.ts:150` — `heavySinglesAdvisory = readiness === "red" &&
  sets.some(90+)`: con la banda roja y zona 90+ presente, el motor sugiere **mover** los singles
  pesados (no borrarlos).
- `EngineWeek` ya **expone el rastro auditable**: `taper.readinessFactor`, `inputs.readiness`,
  `heavySinglesAdvisory` (`packages/core/src/types/index.ts:417-430`).
- El mapper ya **alimenta la banda real**: `prilepinPlan.ts:54-60` deriva la banda de la última
  semana de la serie (`readinessBand(readiness(recovery, acwr))`) y la pasa en `buildPrilepinInput`
  (`prilepinPlan.ts:74,85,92`). Sin serie → `null` (sin ajuste).
- **Doble conteo deliberado** (D9, ya documentado en `prilepin.ts:107-110`): readiness ya viene
  penalizado por ACWR, y el `acwrFactor` vuelve a pegar — "venir cargado" y "venir poco recuperado"
  son dos razones distintas para bajar volumen. Conservador, candidato a calibración con coaches.

**Conclusión:** como el motor YA modula, la tarea es la **capa de rationale** (Option A del brief):
una función PURA que, dada la banda + el `EngineWeek`, produce el texto legible del ajuste, sin
volver a calcular nada. La modulación deja de ser invisible (escondida en un factor numérico) y se
vuelve explícita en la cara del coach.

## 3. Regla de modulación elegida (la que se redacta)

`readinessModulation(week: EngineWeek): ReadinessModulation` — PURA, en core
(`packages/core/src/logic/readinessModulation.ts`). Lee `week.inputs.readiness`,
`week.taper.readinessFactor` y `week.heavySinglesAdvisory`; NO recalcula la dosis.

| Banda del día | `factor` | `directive` | `headline` | rationale |
|---|---|---|---|---|
| `green` | 1.0 | `allow` | "Readiness verde" | "Buena recuperación: se permite lo planificado." |
| `amber` | 0.9 | `hold` | "Readiness ámbar" | "Recuperación parcial: intensidad sostenida, sin subir el tope; volumen recortado al ~90%." |
| `red` | 0.75 | `cut` | "Readiness roja" | "Poca recuperación: dosis recortada (~75% del volumen)." + si hay 90+: "Mové los singles pesados, no los borres." |
| `null` (sin dato) | — | `none` | "Sin señal de readiness" | "No hay monitoreo reciente para modular esta semana." |

- La directiva NO es nueva física: es el **nombre legible del `readinessFactor` que el motor ya
  aplicó**. Por eso `readinessModulation` deriva todo de `week` (única fuente, sin drift).
- `cut` adjunta la advertencia de singles SOLO cuando `week.heavySinglesAdvisory === true` (red +
  zona 90+ presente) — coherente con `prilepin.ts:150`.
- `none` cuando `inputs.readiness === null`: sin dato honesto, el preview lo rotula explícito.
- Cero RPE en el shape (regla intocable D1).

`ReadinessModulation` (tipo nuevo en `types/index.ts`):
```ts
type ReadinessDirective = "allow" | "hold" | "cut" | "none";
interface ReadinessModulation {
  band: ReadinessBand | null;       // eco de inputs.readiness
  directive: ReadinessDirective;
  factor: number | null;            // taper.readinessFactor; null si none
  headline: string;                 // título corto coach-only
  rationale: string;                // explicación legible
  moveHeavySingles: boolean;        // refleja week.heavySinglesAdvisory (solo cut)
}
```

## 4. Surface (coach-only, read-only)

`apps/web/src/screens/coach/prilepin/PrilepinSection.tsx`: bloque **"Ajuste por readiness"**
dentro de la card del preview ya existente, debajo del rationale de fase. Muestra el `headline`
(banda) + el `rationale`. Coherente con el encuadre del preview ("es del motor, no el plan
asignado"). El chip "mover singles" preexistente se mantiene; el bloque lo reitera en palabras
cuando `directive === "cut"` y `moveHeavySingles`.

- Sin señal (`directive === "none"`): el bloque renderiza el fallback "Sin señal de readiness".
- Sigue siendo superficie COACH: % y zonas ya se muestran; readiness NO va al atleta (HR-1).

## 5. DIFERIDO (NO en este slice)

- **Autorregulación del plan real:** que la modulación por readiness modifique el plan basado en
  recetas que el atleta efectivamente ejecuta (no solo el preview). Requiere persistencia, revisión
  del coach y decisiones de seguridad. Fuera de alcance.
- **Superficie del atleta + decisión "¿el atleta ve `pct`?":** hoy el atleta jamás ve este ajuste
  (HR-1). Si algún día la modulación llega a su cara, primero hay que decidir si ve `pct` o solo
  kg+discos (decisión abierta del spec del motor §9). DIFERIDO.
- **Ciclo Capa 3 (modulación por ciclo menstrual):** la señal de ciclo NO entra a esta modulación.
  Es readiness post-motor; el ciclo *contextualiza* la recuperación, nunca dispara semáforo
  (ver `ciclo-menstrual-module`). DIFERIDO explícito.

## 6. Tests

- **core** (`packages/core/src/logic/readinessModulation.test.ts`): cada banda → directiva/factor/
  rationale correctos; `red` + 90+ → `moveHeavySingles` true con la frase; `red` sin 90+ →
  `moveHeavySingles` false; sin readiness → `none`; cero "rpe" en el JSON; deriva del `week` real
  de `generateWeek` (integración con el motor).
- **web** (`PrilepinSection.test.tsx`): renderiza el bloque "Ajuste por readiness" con el headline
  y rationale de la banda; sin señal → fallback "Sin señal de readiness".
