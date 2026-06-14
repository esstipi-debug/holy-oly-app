# Rediseño de "Mi Progreso" (atleta) — del mock 0110 a producción

_Fecha: 2026-06-14 · Estado: spec para revisión → plan de implementación_

Porta el rediseño del mock **0110 / Mi Progreso** (Claude Design handoff) a la app de producción
(`apps/web`, React+TS). Reemplaza las pills estáticas + charts apilados por un **carrusel de señales**
con **hero (valor grande + delta vs tu normal) + mini-stats**, agrega una card **"Camino a la
competencia"** como primer slide, y mantiene "Tu recorrido" + ciclo intactos. Hereda el skin del
atleta (incl. el nuevo **Neon Bloom · Noche**, ya shippeado en este branch).

> Reemplaza visualmente la pantalla definida en `2026-06-07-atleta-mi-progreso-design.md` (A2). La
> lógica de datos y las reglas HR-2 / no-RPE de ese spec siguen vigentes.

---

## 1. Decisiones (cerradas con el owner)

| Eje | Decisión | Razón |
|---|---|---|
| **Charts** | Reusar los charts de línea actuales (`LoadChart/RecoveryChart/WellnessChart/WeightChart`) dentro del nuevo shell. **NO** heatmaps. | Los heatmaps del mock necesitan datos POR DÍA (no existen; la serie es semanal) y el de Carga filtra **RPE** (viola intocable). Los charts de línea ya tienen datos reales + "ⓘ cómo se lee". |
| **Camino** | Incluir, **reusando la `CaminoCard` que ya existe** (`screens/atleta/hoy/CaminoCard.tsx`). Versión sin readiness ni RM. | La card ya maneja plan null / sin compe / compe pasada. `readiness` es coach-only; el atleta nunca ve RM. |
| **Peso** | Slide **condicional** (gate `hasWeight`, como hoy). | Ningún atleta real tiene peso/banda cargados; el slide simplemente no aparece hasta que exista una vía de carga. v1 frontend-only. |
| **Bienestar — ítems** | **Empty-state honesto** cuando no hay `wellnessItems`. | El autorreporte diario va a `DayLog`, sin rollup a ítems semanales → grilla vacía para casi todos. Frontend-only. |
| **Carrusel** | Una sola presentación: **flechas infinito + dots + swipe**. Las otras 4 del mock no se portan. | YAGNI: producción necesita una decisión, no un panel de Tweaks. |
| **Skin** | `bloomnight` (Neon Bloom · Noche) ya shippeado + completado en este branch. | Era el delta explícito del handoff. |

### Fuera de v1
Heatmaps diarios · readiness al atleta · las 5 variantes de carrusel · el calendario ciclo+competencias
del mock (chat2/3 — otra feature) · el rediseño de Entreno (track aparte) · cargar peso/banda · rollup
`DayLog→wellnessItems` (backend).

---

## 2. Arquitectura (archivos chicos, testeables)

```
screens/atleta/
  ProgresoScreen.tsx          (container: getMeSeries + getMePlan; arma el carrusel; PRESERVA !series)
  progreso/
    ProgresoCarousel.tsx      (shell: flechas infinito + dots + swipe; recuerda última señal en localStorage)
    SignalCard.tsx            (hero + delta + mini-stats + chart reusado en modo `bare` + read-line + ⓘ)
    signalData.ts             (PURO: deriva hero/delta/mini-stats/read-line de MonitorSeries — con guards)
    signalData.test.ts
ui/charts/chartkit.tsx        (+ prop `bare` en ChartCard → renderiza solo el SVG, sin chrome)
```

- **Camino**: se reusa `screens/atleta/hoy/CaminoCard.tsx` tal cual (recibe `plan` + `sexo`).
- **Recorrido / Ciclo**: `RecorridoCard` y `MisCiclosCard` se mantienen sin cambios.

### Reuso de charts (no reimplementar)
Cada chart hoy rinde `<ChartCard title sub chip explain>{svg}</ChartCard>`, y `ChartCard` ya provee la
"ⓘ → BottomSheet" con el HR-2 (forma/sirve/lectura). Se agrega `bare?: boolean` a `ChartCard`: en modo
`bare` aporta **solo el SVG**; el `SignalCard` provee nombre + hero + ⓘ (reusando el mismo `BottomSheet`
+ tipo `Explain`). Cero cambios a la lógica de cada chart.

---

## 3. Flujo de datos y conectividad (verificado contra el código — audit 2026-06-14)

Auditoría de 8 dimensiones + verificación adversarial. **El mecanismo está conectado** (endpoints +
componentes reusan datos reales). Los puntos a manejar:

### 🔴 Blockers (si no se manejan → vacío/crash)
1. **`getMePlan` faltante.** `ProgresoScreen` hoy solo hace `getMeSeries`. La Camino card necesita
   `MePlanView.plan`. → Agregar `getMePlan()` al fetch, **con `.catch` propio** para que un fallo de
   plan no tumbe Recorrido/Ciclo (en demo, `getMePlan` puede tirar `"no athlete"`).
2. **Guard `!series`.** Atleta nuevo sin monitoreo (común): `getMeSeries → undefined`. El carrusel/hero
   debe quedar **dentro** del branch que hoy rinde "Todavía sin datos"; si el hero lee `acute.at(-1)` de
   `undefined` → crash. Preservar el estado vacío + `RecorridoCard` + `MisCiclosCard` debajo.
3. **`signalData.ts` sin guards.** No existen `pctVs/mean/std` en core → se crean acá. Deben blindar
   (ver §4). Atleta con **1 sola semana** es un caso real en prod.
4. **Reusar `CaminoCard`** (no reimplementar el countdown) → ya maneja `plan=null`, `comps=[]`, y compe
   pasada (`Math.max(0, faltan)` + rama "ya pasó").

### ⚠️ Vacíos esperados (conectado, pero se vacía en prod real → rama honesta)
- **Peso**: slide condicional `hasWeight` (hoy no aparece para nadie real). Manejado por diseño.
- **Bienestar ítems**: `wellnessItems` ausente para casi todos → **empty-state** en la subsección.
- **Camino sin compe**: la mayoría tiene plan sin competencia → solo se ve la cinta de fases (sin el
  número grande de countdown). Sin crash (la `CaminoCard` lo maneja).
- **i18n**: el rediseño agrega strings → deben ir a los namespaces i18next (`charts`/`common`), no
  hardcodeados en español, o EN/PT los ven en español. (El patrón actual ya tiene esta deuda; no
  agravarla.)

### 📝 Notas (no bloquean)
`weightBand` sin validar orden (hoy imposible) · demo offline muestra ciclo a un hombre (override
deliberado de demo; en prod el gate female-only funciona, server 403 + UI) · "Tus ciclos" (macro) vs
"Tu ciclo" (menstrual) — ambigüedad de copy.

---

## 4. `signalData.ts` — guards obligatorios (de los vacíos confirmados)

Funciones puras sobre `MonitorSeries`. Replicar la disciplina de `recoveryScore` (degrada a `NaN`, no a
falso-verde) y de `weekSignals.fin()` (finito-o-undefined). Reglas:

- **delta vs normal** = `(last - base) / base`: si `base <= 0` o `!Number.isFinite` → **sin delta**
  (`—`), NUNCA `Infinity%`/`NaN%`.
- **base sin previas** (`arr.length < 2`) → base ausente → sin delta (no `mean([]) = 0`, que esconde el
  div/0). Con 1 semana: mostrar el valor sin delta ("tu primera semana").
- **pico** = `Math.max(...arr)`: sembrar (`Math.max(...arr, ...)`) o guard `arr.length === 0` para evitar
  `-Infinity`.
- **"tendencia 4 sem"**: con `weeks < 4` la etiqueta MIENTE → degradar copy / ocultar el "4 sem".
- **opcionales** (`bodyweight`, `compliance`, `wellnessItems`): vienen `undefined` (no `[]`) → acceso con
  `?.` (patrón `weekSignals.ts`).
- **recovery hero**: solo con `Number.isFinite`; si no → `—`, nunca `NaN` (base 0 → `recoveryScore` NaN).
- **std/banda**: con `< 2` muestras, `std = 0` → **ocultar la banda**, no dibujar una de ancho 0.

---

## 5. Reglas intocables (verificadas)

- ✅ **RPE nunca**: los heatmaps (única fuente del leak) no se portan; `signalData.ts` no toca
  `series.rpe`. **Test-guardia**: falla si "RPE" aparece en el render de Progreso.
- ✅ **RM / readiness nunca al atleta**: Camino sin readiness ni marcas de objetivo/RM.
- ✅ **Ciclo female-only**: no se toca; `MisCiclosCard` y el ciclo quedan igual (gate server + UI).
- ✅ **Discos**: Mi Progreso no muestra discos → no aplica.

---

## 6. Testing (vitest + RTL)

- `signalData.test.ts`: cada guard (base 0, 1 semana, array vacío, weeks<4, opcionales ausentes) → sin
  `NaN/Infinity/-Infinity`.
- Carrusel: navegación infinita, persistencia de última señal, swipe.
- `!series` → "Todavía sin datos" + Recorrido + Ciclo (regresión preservada).
- Camino: countdown con compe / sin compe / sin plan (reusa los casos de `CaminoCard`).
- Peso: slide ausente sin `hasWeight`; presente con datos.
- Bienestar: empty-state de ítems cuando falta `wellnessItems`.
- **Guardia anti-RPE** en el render del Progreso.
- No romper los tests actuales del Progreso ni de `cuenta`/`shell`.

---

## 7. Entrega por partes (checkpoints)

- **A.** `signalData.ts` + tests (guards). _(núcleo de riesgo, primero)_
- **B.** `ChartCard` modo `bare` + `SignalCard` (hero + mini-stats + chart + ⓘ + empty-states).
- **C.** `ProgresoCarousel` + cableado en `ProgresoScreen` (`getMeSeries` + `getMePlan` con catch; guard
  `!series`).
- **D.** Integrar `CaminoCard` como primer slide.
- **E.** CSS `pg-*` portado a `atleta.css` + claves i18n + revisión visual.

Cada checkpoint: tests verdes + sin romper la suite + revisión.

---

## 8. Ya hecho en este branch (skin)

`bloomnight` (Neon Bloom · Noche): tokens + gradiente `.wls` + **bloque de firma completo** (botones
`.wl-btn`/`--primary`/`--ghost`, back/skip, badges/radio/field/step, seg bar) sobre lienzo oscuro +
mayúsculas de marca/títulos, en `theme.css` + `atleta.css`; entrada en `CuentaMin` (picker), `prefs.ts`
(allowlist), `Gallery.tsx` (showcase). Selector → persistencia → shell verificado.
