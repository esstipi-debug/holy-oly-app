# Charts Fase 2 — polish visual por chart · Design doc

**Fecha:** 2026-06-02
**Estado:** aprobado en brainstorming, pendiente de plan.
**Origen:** los ítems "Fase 2" del backlog de la auditoría inaugural de El Carnicero (`docs/domain/charts-audit-2026-06-02.md`) — los upgrades de SVG profundos que quedaron fuera de la Fase 1 (que entregó el contexto HR-2 vía `ChartCard.explain`).

## 1. Problema / objetivo

La Fase 1 dio contexto HR-2 (tap → explicación) a los charts de `ChartCard`. Quedaron los **arreglos visuales por chart** que la auditoría documentó: un chart sin `ChartCard`, líneas con color fijo (no estado), bandas sin dibujar, números planos. Objetivo: cerrarlos, anclado al rulebook; lo que el rulebook no define se resuelve "vs su propia normal" (no se inventan umbrales).

## 2. Decisiones

- **Bienestar y RPE — referencia (el único fork):** el rulebook no define banda para el score de Bienestar (0–100) ni para el RPE. **Decisión (coach):** el Bienestar se lee **vs su propia normal** (línea/banda de referencia = promedio del atleta de la serie — derivado, consistente con "vs su normal", sin umbral inventado); el **RPE queda como tendencia** (sin banda) hasta que el coach defina un rango esperado.
- **MacroTimeline va a `ChartCard`** — es el cambio mayor (gana contexto HR-2 + la ⓘ que tienen los demás).
- **Color = estado, con tokens** — se eliminan los hex decorativos/hardcodeados; las fases usan **paleta neutra** (no semáforo), estados usan `STATUS`.
- Resto: mecánico, anclado a valores del rulebook (±2 de IMR, 85/70 de cumplimiento ya en código).

## 3. Cambios por chart

| Chart | Cambio |
|---|---|
| **MacroTimeline** (`MacroTimeline.tsx`) | Envolver el SVG en `ChartCard` con su `explain` (forma/sirve/lectura del timeline). Reemplazar `RAMP` (hex decorativo por fase) por **paleta neutra** y `#ff3b46` hardcodeado por `STATUS.alert` (taper/🚩). |
| **RecoveryChart** (`RecoveryChart.tsx`) | La línea/último punto se colorea por **estado** (`recoveryState` por semana, que ya existe) en vez de color fijo; reemplazar el cian `#2dd4e6` hardcodeado por token. Una HRV desplomada deja de verse "sana". |
| **ImrFaseChart** (`ImrFaseChart.tsx`) | Dibujar la banda de fase con el **margen ±2** (hoy dibuja `imrPct` cruda; el estado ya evalúa con ±2 — `monitor.ts:26`), para que la banda visible matchee el estado del dot. |
| **WellnessChart** (`WellnessChart.tsx`) | **Sacar los números planos 1–5** de los ítems (HR-1) — dejar sólo los sparklines. **Score 0–100**: agregar **línea de referencia = promedio propio** ("vs su normal"); colorear el último punto del score por su posición vs ese promedio. |
| **CompChart** (`CompChart.tsx`) | Hacer **visibles** las zonas 85/70 de cumplimiento (líneas/bandas de referencia en el eje %) — hoy el umbral de color de las barras es lógica invisible. RPE: sin cambio (tendencia, sin banda). |

> **Nota:** la paleta neutra de fases del `MacroTimeline` es criterio de **diseño** (El Carnicero: "fuera de rulebook") — la única regla dura es **no colisionar con `STATUS`** (verde/amarillo/rojo = estado; lavanda neutra = ciclo). Se usa una secuencia neutra propia.

## 4. Verificación

Cambios mayormente **visuales** (SVG) → se verifican por **El Carnicero** (color=estado, sin-dato, no número plano, no hex decorativo) + el **deploy en vivo**. Tests estructurales donde dan señal real (no aserciones frágiles de SVG):
- **MacroTimeline** ahora en `ChartCard` → test: renderiza título + el botón ⓘ (`getByRole("button", {name:/cómo se lee/i})`).
- **WellnessChart** → test: ya **no** renderiza el número plano del ítem como elemento suelto (sólo label + sparkline).
- Lo demás (bandas ±2, línea state-colored, zonas 85/70, referencia de Bienestar) → revisión de El Carnicero + verificación visual en el deploy (el preview local está trabado; se confirma en vivo).
- web build + tsc + eslint limpios; los 109 web tests + nuevos verdes.

## 5. Fuera de scope

- Banda absoluta de Bienestar/RPE por umbral de coach (diferido hasta que el coach los defina; hoy = vs-su-normal / tendencia).
- Detail-on-tap por-señal dentro del panel de semana (LOW de la review anterior; el contexto está en la ⓘ de cada chart).
- A11y de las zonas de tap (genérico, fuera del rulebook de dominio).

## 6. Próximo paso

Invocar **writing-plans** (orden sugerido: WellnessChart [sacar números + referencia] → ImrFase ±2 → CompChart zonas → RecoveryChart state-line → MacroTimeline a ChartCard [el mayor] → review de El Carnicero → verificación + deploy).
