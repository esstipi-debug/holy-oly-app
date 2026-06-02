# Remediación de gráficos — Fase 1: capa de contexto sistémica + bugs de integridad · Design doc

**Fecha:** 2026-06-02
**Estado:** aprobado en brainstorming, pendiente de plan.
**Origen:** backlog de la auditoría inaugural de El Carnicero (`docs/domain/charts-audit-2026-06-02.md`).

## 1. Problema / objetivo

La auditoría encontró que **ningún chart cumple HR-2** ("cómo se forma / para qué sirve / contra qué se lee") de forma completa: el único contexto es el `sub` de `ChartCard` (un string de una línea), y **ningún chart es tappable** pese a que §4 manda **tap-not-hover** como vehículo del detalle. Es un defecto **transversal**.

**Objetivo (Fase 1):** dar contexto HR-2 a **toda la flota de una** vía un cambio sistémico en `ChartCard`, y matar de paso los **2 bugs de falso-verde** (integridad de señal) más peligrosos. Los upgrades visuales por chart quedan para Fase 2.

## 2. Decisiones

- **Mecanismo de detalle:** reutilizar el **`BottomSheet` existente** (`apps/web/src/ui/BottomSheet.tsx`) — la app ya lo usa para todos los sheets; consistente, mobile, tap-not-hover (§4). No se inventa un componente nuevo.
- **Contrato HR-2 como tipo:** `ChartCard` gana un prop **requerido** `explain: { forma: string; sirve: string; lectura: string }`. Al ser **requerido**, ningún chart compila sin responder las 3 preguntas de HR-2 → **el rulebook se vuelve ley de TypeScript** (HR-2 pasa a ser compile-time; El Carnicero ya no necesita chequearlo, sólo revisar que la copy sea correcta).
- **Big-bang controlado:** como `explain` es requerido, los **11 charts** se actualizan en este slice (el build lo fuerza — que es justo lo que queremos: que ninguno se escape). Cada cambio por chart es chico.
- **Scope = Fase 1.** Los cambios profundos de SVG (bandas faltantes, líneas state-colored, tokens) son **Fase 2** (ciclo propio).

## 3. El cambio sistémico — `ChartCard`

`apps/web/src/ui/charts/chartkit.tsx`:
- Firma nueva: `ChartCard({ title, sub?, chip?, chipState?, explain, children })` con `explain: Explain` **requerido**.
- `type Explain = { forma: string; sirve: string; lectura: string }` (exportado desde `chartkit`).
- `ChartCard` pasa a tener estado local (`useState` para `open` del sheet) — sigue siendo presentacional salvo ese estado de UI propio.
- Render: junto al `chip`, un **botón affordance "ⓘ"** (real `<button>`, `aria-label="Cómo se lee este gráfico"`) que abre el `BottomSheet`.
- El sheet muestra 3 secciones rotuladas: **Cómo se forma** (`forma`), **Para qué sirve** (`sirve`), **Contra qué se lee** (`lectura`) + el título del chart.
- El `sub` de una línea se mantiene (resumen rápido); el detalle completo vive en el tap.

## 4. Retrofit de los 11 charts

Cada chart (`apps/web/src/ui/charts/*.tsx`) pasa su `explain`, redactado desde el rulebook/dominio. La **copy la redacto yo**; el **tono de coach lo revisa el usuario**. Charts: `AcwrChart`, `CompChart`, `Heatmap`, `ImrFaseChart`, `LoadChart`, `MacroPeriodization`, `MacroTimeline`, `RecoveryChart`, `RiskQuadrant`, `WeightChart`, `WellnessChart`.

> Ejemplo (ACWR): `forma: "Carga aguda ÷ media móvil de 4 semanas (incluye la actual)."` · `sirve: "Detecta picos de carga que anticipan riesgo; fuera de banda → considerar descarga."` · `lectura: "Banda segura 0,8–1,3; >1,3 precaución, >1,5 alerta. El atleta no ve este número."`

## 5. Dos bugs de integridad (viajan en este slice)

- **`WeightChart` — falso-verde** (`WeightChart.tsx:46-53`): el punto del último peso es `STATUS.ok` **siempre**. Fix: nuevo helper puro **`weightBandState(weight, band)`** en `packages/core/src/logic/monitor.ts` → dentro de banda→`ok`, fuera→`alert`, **sin banda o sin dato→`none`** (neutro, no verde). *Nota de disciplina: un estado intermedio "cerca del borde→`warn`" exigiría un margen que el rulebook **no** define → se difiere hasta que el coach lo fije (El Carnicero marcaría inventarlo como "fuera de rulebook"). Fase 1 va binaria `ok`/`alert`/`none`.*
- **`ImrFaseChart` — sin guarda de sin-dato** (`ImrFaseChart.tsx:17-18,46-54`): colorea el dot/chip sin chequear finitud. Fix: guarda `Number.isFinite` (espejo de `acwrStateSafe`) → IMR no-finito = `none`, nunca falso-verde.

## 6. Fuera de scope (Fase 2 — ciclo propio)

Cambios de SVG por chart, más profundos: banda de score en `WellnessChart` + sacar números planos 1–5; banda de RPE en `CompChart`; línea **state-colored** en `RecoveryChart` (hoy color fijo) + reemplazar el cian hardcodeado; tokens de estado en `MacroTimeline` (hoy `RAMP`/hex decorativos) + envolver el timeline en `ChartCard`; banda IMR con margen ±2 visible. (El `ChartCard` de Fase 1 ya le dará contexto a estos cuando se envuelvan.)

## 7. Verificación

- **TDD por unidad (vitest + RTL):** (a) `ChartCard` renderiza el affordance, el tap abre el sheet, el sheet muestra las 3 secciones; (b) `weightBandState` (core) → `ok` dentro de banda, `alert` fuera, `none` sin-banda/sin-dato; (c) la guarda de `ImrFaseChart` → `none` ante NaN.
- **El Carnicero revisa** el diff final (rol-adoptado en esta sesión, o por nombre en sesión nueva) contra HR-2 + disciplina de sin-dato → debe confirmar que los charts ahora satisfacen HR-2 y que el falso-verde murió.
- web build + typecheck + lint limpios; los 102 web tests + los nuevos verdes.

## 8. Fuentes

- Backlog: `docs/domain/charts-audit-2026-06-02.md`
- Rulebook (HR-1/HR-2/§4, valores): `docs/domain/HOLY-OLY-DOMAIN.md`
- Componentes: `apps/web/src/ui/charts/chartkit.tsx`, `apps/web/src/ui/BottomSheet.tsx`, `apps/web/src/ui/charts/*.tsx`

## 9. Próximo paso

Invocar **writing-plans** (orden: helper `weightBandState` (core) + guarda Imr con tests → `ChartCard` explain+tap con test → retrofit de los 11 explains → review de El Carnicero → verificación).
