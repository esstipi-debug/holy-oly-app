# Mi progreso (A2) — gráficos del atleta — design

Fecha: 2026-06-07 · Branch: `claude/atleta-mi-progreso`

## Problema

La pestaña «Mi progreso» del atleta es un placeholder (`ProgresoPlaceholder`, "Llega
pronto"). El atleta no ve sus tendencias. El dato existe (`getMeSeries` → `MonitorSeries`
con acute/hrv/rhr/imr/wellness/recovery/bodyweight) y hay charts (en `ui/charts/`), pero
están copiados en voz de coach (LoadChart enseña **ACWR**; WeightChart dice "el atleta")
y con drill de triage (`onPointClick` → WeekDetailSheet).

## Solución

`ProgresoScreen` reemplaza al placeholder en `/atleta/progreso`. Trae `getMeSeries`
(mismo patrón `meClient` que HomeScreen) y muestra 4 gráficos en **voz de atleta**, sin
ACWR, sin triage, sin RPE — cada uno con la «i» de cómo leerlo (el `explain` del ChartCard).

### Gráficos (en orden)

1. **Tu carga** — carga semanal (barras) + tu tendencia 4 sem (línea). Reusa `LoadChart`
   con copy SIN ACWR.
2. **Tu recuperación vs tu normal** — HRV / FC reposo + banda baseline. Reusa `RecoveryChart`.
3. **Tu bienestar vs tu normal** — score 0–100 + ítems. Reusa `WellnessChart`.
4. **Tu peso** — vs banda de categoría, **sólo si** hay `bodyweight`. Reusa `WeightChart`.

### Estados

- **loading**: "Cargando tu progreso…".
- **sin serie** (atleta sin monitoreo, p.ej. principiante): vacío honesto — "Cuando registres
  HRV, FC y carga, tus tendencias aparecen acá." (mismo tono que el drilldown sin datos).
- **error**: mensaje honesto.

## Reuse: copy override (DRY + voz correcta)

Los 4 charts ganan props opcionales `title?`/`sub?`/`explain?` (default = copy de coach actual
→ el drilldown del coach NO cambia). `ProgresoScreen` les pasa copy de atleta (2da persona, sin
ACWR) y **omite `onPointClick`** (sin week-detail/triage de coach). Una sola renderización, dos
encuadres.

Copy de atleta:
- Carga: title "Tu carga", sub "carga semanal · tu tendencia (4 sem)", explain sin ACWR
  (forma = barras semanales + promedio móvil; sirve = ver cómo viene tu carga; lectura = picos
  sostenidos sobre tu tendencia → cuidá el descanso).
- Recuperación: title "Tu recuperación", sub "HRV y FC reposo vs tu normal", explain en 2da persona.
- Bienestar: title "Tu bienestar", sub "score 0–100 vs tu normal · ítems".
- Peso: title "Tu peso", sub "vs la banda de tu categoría".

## Reglas intocables

- **Sin RPE** en ninguna superficie del atleta.
- **Sin ACWR**: el chart de ratio (`AcwrChart`) nunca se usa; `LoadChart` sólo muestra barras +
  tendencia (no el ratio), con copy de atleta. ACWR/triage es del coach.
- **Calma, no semáforo de alarma**: encuadre "vs tu normal" (bandas baseline), sin lenguaje de
  alerta agresivo. (El punto de estado de recuperación es coherente con el "estado de hoy" del Home.)
- Sin discos (es data-viz, no una sesión).

## Componentes / archivos

- `apps/web/src/screens/atleta/ProgresoScreen.tsx` (nuevo) — `{ client?: MeClient }` (default
  `meClient`, como HomeScreen, para consistencia/futuro toggle). Fetch + estados + los 4 charts.
- `apps/web/src/ui/charts/{LoadChart,RecoveryChart,WellnessChart,WeightChart}.tsx` — props opcionales
  de copy.
- `apps/web/src/app/router.tsx` — `/atleta/progreso` → `ProgresoScreen` (saca `ProgresoPlaceholder`).
- Borrar `ProgresoPlaceholder.tsx` (o dejarlo si algo más lo usa — grep; nada más lo usa → borrar).

## Tests

- `apps/web/src/screens/atleta/__tests__/progreso.test.tsx` (nuevo): con serie → renderiza los 4
  títulos de atleta ("Tu carga", "Tu recuperación", "Tu bienestar", "Tu peso"); **no** muestra el
  título de coach "Carga aguda vs crónica"; abrir la «i» de carga → el explain **no** contiene
  "ACWR"; ningún texto "RPE". Sin serie → vacío honesto. Peso ausente si no hay bodyweight.
- chart override: cubierto por el test de ProgresoScreen (títulos de atleta) + los tests de coach
  existentes siguen verdes (defaults).

## Alcance / no-alcance

- **En alcance:** ProgresoScreen, override de copy en 4 charts, ruta, tests.
- **Fuera:** IMR/«preparación» del atleta (coach signature), edición, el toggle del coach mostrando
  Mi progreso (hoy sólo muestra Home), micro/sesiones (ya en Entreno).

## Verificación

core+web tests, ambos typecheck, eslint en tocados, build; Playwright (Mi progreso en `/atleta`
real: 4 charts, «i» de carga sin ACWR, sin RPE, mobile 430). Refrescar el demo de escritorio.
