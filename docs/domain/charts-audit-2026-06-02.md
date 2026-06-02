# Auditoría inaugural de gráficos — por El Carnicero

> **Generado:** 2026-06-02 · **Revisor:** El Carnicero (corrida inaugural, primer trabajo real del agente) · **Vara:** `docs/domain/HOLY-OLY-DOMAIN.md` (HR-1, HR-2, §4).
> **Alcance:** los 11 charts de `apps/web/src/ui/charts/` + `chartkit.tsx`.
> **Contexto importante:** hoy **todas** estas superficies son del **coach** (`/coach/a/:id` drill-down y `/coach` Equipo). El atleta todavía no consume estos charts → la prohibición HR-1 "número gameable al atleta" está **latente** (riesgo cuando la app del atleta reuse estos componentes), no activa hoy.
> **Para qué sirve este doc:** es el **backlog de remediación de gráficos** — el insumo del ciclo de arreglo (§6 del spec de El Carnicero). No se arregla nada acá; sólo se diagnostica.

---

## Tabla resumen (peor → mejor)

| Chart | Veredicto (1 línea) | Peor hallazgo |
|---|---|---|
| **WellnessChart** | Score sin banda + ítems como **números planos 1–5** sin referencia → HR-1 + HR-2 ×2 | HIGH |
| **WeightChart** | Punto **siempre verde** aunque el peso esté fuera de banda → falso-verde; sin banda → sin referencia | HIGH |
| **MacroTimeline** | Sin `ChartCard` → **cero contexto HR-2**; colores hardcodeados decorativos | HIGH |
| **CompChart** | Línea RPE **sin banda/referencia**; umbrales de barra invisibles | HIGH |
| **RecoveryChart** | Color de línea **fijo** (no estado) → línea en alerta se ve "sana"; cian decorativo | HIGH |
| **LoadChart** | Barras color decorativo; chip número crudo; sin banda crónica explicada | MEDIUM |
| **ImrFaseChart** | Banda correcta, pero chip sin guarda de sin-dato + número crudo | MEDIUM |
| **chartkit / sistémico** | **Ningún chart tiene detail-on-tap**; el "contexto" es sólo `sub` estático | HIGH (transversal) |
| **MacroPeriodization** | Buen HR-2 (banda+línea+barras+leyenda); acento decorativo borderline | LOW |
| **AcwrChart** | Banda + umbrales + dots por estado + guarda de sin-dato. **Modelo a seguir** | LOW |
| **Heatmap** | `none` punteado, color=estado, h-scroll permitido. Correcto | LOW |
| **RiskQuadrant** | Banda + zona de riesgo + lista "sin datos". Correcto | LOW |

**Sistémico (aplica a casi todos):** §4 exige **TAP, no hover** como vehículo de HR-2 (cómo se forma / para qué / contra qué). **Hoy ningún chart es tappable** — todo el contexto vive en el `sub` de una línea. Defecto HR-2 transversal, no de un chart suelto.

---

## Por chart (peor → mejor)

### WellnessChart — `apps/web/src/ui/charts/WellnessChart.tsx`

- **[HIGH]** `WellnessChart.tsx:69-77` — **HR-1** (número plano). Cada ítem (Fatiga/Dolor/Estrés/Humor/Motivación/Sueño) se renderiza como `{arr.at(-1)}` — número plano 1–5 sin banda ni referencia. Si migra al atleta, son seis números optimizables. **Fix:** sacar el número crudo; dejar sólo el sparkline con su normal/banda (o un punto coloreado por estado vs baseline).
- **[HIGH]** `WellnessChart.tsx:31-39` — **HR-2 #3** + **§4 color=estado**. La línea de score 0–100 no dibuja banda/umbral; usa `var(--wl-accent)` decorativo. El coach no tiene contra qué leerla. **Fix:** banda sombreada (zona ok / vigilar), color por estado, umbral en el `sub`.
- **[MEDIUM]** `WellnessChart.tsx:50-92` — **§4 alineación por semana**. Los sparklines usan su propio eje (`arr.length`), no el eje semanal del score. **Fix:** alinear al mismo eje, o aclarar al tap que son resúmenes.

### WeightChart — `apps/web/src/ui/charts/WeightChart.tsx`

- **[HIGH]** `WeightChart.tsx:46-53` — **§2/§4 color=estado** + **disciplina de falso-verde**. El punto del último peso es `STATUS.ok` (verde) **siempre**, esté dentro o fuera de la banda de categoría. Un atleta por encima de su categoría (riesgo de no dar el peso) se pinta verde tranquilizador. **Fix:** color del punto derivado de la posición vs `weightBand` (dentro→ok, borde→warn, fuera→alert); sin banda → no verde.
- **[HIGH]** `WeightChart.tsx:30-38` — **HR-2 #3**. La banda sólo se dibuja `if (band)`; sin banda la línea flota sin referencia y el punto sigue verde. **Fix:** si falta `weightBand`, decirlo ("sin categoría asignada") y no pintar verde.

### MacroTimeline — `apps/web/src/ui/charts/MacroTimeline.tsx`

- **[HIGH]** `MacroTimeline.tsx:110-118` — **HR-2 (las tres)** + **§4 una card = un chart**. Es el 8.º gráfico del drill-down y el más denso (ribbon de fases + barras de volumen + línea de intensidad + flags + HOY) y **no está envuelto en `ChartCard`** — sin título, sin `sub`, sin leyenda. Nada explica cómo se forma / para qué / contra qué. **Fix:** envolver en `ChartCard` + leyenda de swatches (barras=volumen, línea=intensidad, 🚩=comp, HOY).
- **[HIGH]** `MacroTimeline.tsx:12,76,93,103,105` — **§4 color decorativo**. `RAMP = ["#6f86ff",...]` colorea fases por orden (decoración; el comentario lo admite) y `#ff3b46` hardcodea `STATUS.alert` por fuera del token. **Fix:** tokens; fases con paleta **neutra** (no semáforo), taper/flags vía `STATUS.alert`; documentar la excepción "ribbon de fase" si se decide categórica.
- **[MEDIUM]** `MacroTimeline.tsx:99-108,89-96` — **§2b verdad anclada a fecha**. La flag muestra `c.name` pero **no la fecha**, aunque `Competencia.date` existe. **Fix:** mostrar la fecha de la comp al tap/label cuando `c.date` está. *(Relacionado: el `hoy={series.weeks}` del consumidor sigue derivando HOY del largo de serie — anti-patrón §2b, ítem de otro ciclo.)*

### CompChart — `apps/web/src/ui/charts/CompChart.tsx`

- **[HIGH]** `CompChart.tsx:40-46` — **HR-2 #3**. La línea de RPE medio (5–10) se dibuja **sin banda ni referencia**; dual-axis (barras % + línea RPE) sin leyenda de qué eje es cuál. **Fix:** banda de RPE esperado (o líneas 7/9), etiqueta inline del eje RPE, explicación al tap.
- **[MEDIUM]** `CompChart.tsx:28` — **§4 banda visible**. Los cortes de color de barra (≥85 ok, ≥70 warn) son lógica invisible. **Fix:** sombrear zonas 85/70 o anotar umbrales; criterio de color en el `sub`. *(Los valores 85/70 son criterio del coach — ver "Fuera de rulebook".)*

### RecoveryChart — `apps/web/src/ui/charts/RecoveryChart.tsx`

- **[HIGH]** `RecoveryChart.tsx:41,68-69` — **§4 color=estado** + **§2 recuperación vs baseline**. El color de línea es **fijo**: HRV siempre verde, RHR siempre cian (`#2dd4e6` hardcodeado). Una HRV desplomada se sigue viendo verde; el estado vive sólo en el chip. **Fix:** colorear línea/último punto por estado vs baseline; reemplazar el cian por token. (La banda alrededor del baseline está bien.)
- **[LOW]** `RecoveryChart.tsx:13-55` — **§4 TAP/HR-2 #1**. Sin tap para "cómo se forma" (qué es baseline, qué ventana). **Fix:** detail-on-tap con la regla HRV↓/RHR↑.

### LoadChart — `apps/web/src/ui/charts/LoadChart.tsx`

- **[MEDIUM]** `LoadChart.tsx:23-32,20` — **§4 color=estado** + **HR-1 chip**. Barras con `var(--wl-accent)` (decorativo, sólo la máxima por opacidad); chip = carga aguda cruda (aceptable al coach, no es ratio). **Fix:** el `sub` ya dice "barras=semanal · línea=crónica (4 sem)" (bien); agregar tap con la definición de crónica = media móvil 4 sem y su rol como base del ACWR; decidir si las barras van por estado o se rotulan como informativas.

### ImrFaseChart — `apps/web/src/ui/charts/ImrFaseChart.tsx`

- **[MEDIUM]** `ImrFaseChart.tsx:17-18,46-54` — **disciplina de sin-dato** + **HR-1 chip**. A diferencia de `AcwrChart` (`acwrStateSafe`), acá `imrStateForWeek` no tiene guarda de sin-dato → un IMR 0/NaN pintaría estado en vez de `none` (falso-verde). Chip = número crudo. **Fix:** guarda `Number.isFinite` antes de colorear el dot/calcular el chip; sin dato → `none`. (La banda por fase escalonada ya respeta §2.)
- **[LOW]** `ImrFaseChart.tsx:9` — **§2 margen ±2 no visible**. El estado usa margen ±2 (`monitor.ts:26`) pero la banda dibujada es la `imrPct` cruda → un dot puede caer "fuera" de la banda visible y aún ser `ok`. **Fix:** dibujar la banda con el ±2, o explicarlo al tap.

---

## ✅ Qué respeta bien (modelos a seguir)

- **AcwrChart** — **el modelo**: corredor 0,8–1,3 sombreado, umbrales 1,3/1,5 dibujados, dots por estado, **guarda de sin-dato** (`acwrStateSafe`, NaN→`none`). El `sub` aclara "el atleta no ve este número" (HR-1 consciente). Las tres preguntas de HR-2 casi resueltas (le falta el tap).
- **RiskQuadrant** — banda ok + zona de riesgo + ejes rotulados + **disciplina de sin-dato impecable** (los `none` se excluyen del plot y se listan aparte). Color por `STATUS[cell]`.
- **Heatmap** — `none` punteado/transparente (no verde), color=estado, h-scroll es la excepción permitida por §4.
- **MacroPeriodization** — el mejor HR-2 de los de programa: banda-corredor IMR por fase + línea de media + barras de volumen + **leyenda de swatches**. Es plantilla (no semáforo), el acento no-estado es defendible.
- **chartkit** — `ChartCard` maneja el chip de `none` correctamente (no Badge verde) y centraliza título/sub. Buena base; sólo le falta el slot de detail-on-tap.

## Fuera de rulebook (criterio del coach / diseño — no lo juzga el revisor)

- **Diseño concreto del detail-on-tap:** §4 *manda* TAP (eso es hallazgo, marcado HIGH transversal), pero el copy exacto y la microinteracción del panel son criterio de producto/diseño.
- **Umbrales de % cumplimiento (85/70) y de bienestar (0–100):** el rulebook fija bandas para ACWR, recuperación e IMR, pero **no** para cumplimiento ni bienestar. Que existan está bien; **los valores son criterio del coach** — el revisor sólo exige que sean *visibles* (HR-2).
- **Qué paleta neutra usar para el ribbon de fases:** distinguir fases es legítimo; cuál paleta neutra es criterio de diseño — pero **no** puede ser hex suelto que colisione con `STATUS.alert` (eso sí es hallazgo).

---

## Próximo paso (ciclo de remediación, §6)

Priorización sugerida para el ciclo de arreglo:
1. **Sistémico:** agregar el slot **detail-on-tap** en `chartkit.ChartCard` (destraba HR-2 en toda la flota de una).
2. **Falso-verde** en `WeightChart` (color del punto vs banda) y **guarda de sin-dato** en `ImrFaseChart` (integridad de señal).
3. **Bandas faltantes:** WellnessChart (score), CompChart (RPE), y sacar los números planos 1–5 de Wellness.
4. **Color=estado:** RecoveryChart (línea reactiva), MacroTimeline (tokens + `ChartCard`).
5. Patrón de referencia: clonar el enfoque de **AcwrChart** al resto.
