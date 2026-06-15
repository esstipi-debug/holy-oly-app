# Celebración + gamificación DERIVADA (atleta) — del mock 0110 a producción

_Fecha: 2026-06-15 · Estado: aprobado por el owner → implementación_

Porta las 3 pantallas de **Celebración** del mock 0110 (Día / Semana / Macro) a producción, con
**gamificación DERIVADA**: XP, niveles y racha se **calculan de los datos que ya existen** (sesiones,
recorrido, macro-history) — **sin tabla nueva ni backend**. Reemplaza/expande la Victoria post-sesión.

> Decisión del owner (2026-06-15): pivot a gamificación, **modo derivado** (no persistente), reglas
> propuestas y aprobadas abajo. Conscientemente se relaja el ADN "zero burnout" hacia engagement, PERO
> la racha se define para **no penalizar el descanso** (cuenta adherencia al plan, no días seguidos).

## 1. Reglas (aprobadas)

| Métrica | Fórmula derivada |
|---|---|
| **XP de la sesión** | `floor(tonelaje de TRABAJO / 50)` + `25` si completó todas las series. Calentamiento NO suma (regla de dominio). |
| **XP acumulado** | `floor(Σ trabajoKg de todo el historial / 50)` — de `MeRecorrido.semanas` + macros cerrados. |
| **Nivel** | Curva triangular: subir a L+1 cuesta `200·L` XP nuevos (Nv2@200, Nv3@600, Nv4@1.200…). Mostrar "X XP para Nivel N". |
| **Racha (semanas)** | Semanas consecutivas (hasta la última cerrada) con `sesionesHechas ≥ sesionesTotales`. El descanso del plan NO la rompe; **solo** la rompe faltar a una sesión planificada. |

## 2. Pantallas + disparadores

- **Día** — cada post-sesión (la `VictoriaScreen` se vuelve la celebración Día): confeti + check + título +
  racha + panal hexagonal (radar de bienestar + hexes de movimientos con kg/discos) + XP + resumen.
- **Semana** — cuando la sesión guardada **cierra la semana** (todas las planificadas hechas): stats reales
  (días X/Y · cumplimiento % · volumen) + XP de la semana.
- **Macro** — cuando **cierra el macro** (`currentWeek === totalWeeks` y semana cerrada): flor hexagonal
  (trofeo + semanas + volumen + fases + nivel + PRs si derivables).
- **Rotador** para revisitar; Semana/Macro **solo aparecen cuando de verdad se lograron** (nada falso).

## 3. "Reclamar" (derivado)
Celebra + navega a `/atleta` + marca la celebración como vista en localStorage (`ho:cel-seen:<week>-<idx>`)
para no re-confetear al reabrir. NO es moneda/recompensa persistente.

## 4. Huecos de datos (resueltos)
- **Radar de bienestar** (6 ítems del check-in): si el atleta no tiene ítems del día → **empty-state honesto**
  (mismo criterio que Bienestar en Mi Progreso), no un radar falso.
- **PRs** (hex del Macro): no hay detección de PR en el dominio. Derivar de RM-history si está disponible;
  si no → **omitir el hex de PRs** (cero PRs inventados).

## 5. Arquitectura
```
screens/atleta/entreno/
  VictoriaScreen.tsx        (container: carga sesión/plan/recorrido/macro-history; arma la celebración)
  celebracion/
    gamify.ts               (PURO: xpForSession, cumulativeXp, levelOf, weekStreak, celebrationState) + test
    Celebracion.tsx         (rotador Día/[Semana]/[Macro] + el render de cada una)
    Confetti.tsx            (confeti compositor-friendly)
    Radar.tsx               (radar poligonal de bienestar, o empty-state)
    celebracion.css         (et-/cel- portado; tokens --wl-*, los 6 skins)
```
Reusa `Disc.tsx`/`DiscRow` para los discos de los hexes de movimiento (intocable).

## 6. Intocables ✓
Discos SOLO vía `Disc.tsx`; hexes de movimiento con **kg + series×reps + %**; **sin RPE**; el calentamiento
**no entra al XP** (regla de dominio: tonelaje de calentamiento jamás al monitor).

## 7. Testing
- `gamify.test.ts`: xpForSession (con/sin completar), cumulativeXp, levelOf (curva + "para Nivel N"),
  weekStreak (rompe por sesión faltada, NO por descanso), celebrationState (día/semana/macro triggers).
- Celebración: render Día con datos; Semana sólo si semana cerrada; Macro sólo si macro cerrado; radar
  empty-state sin ítems; sin "RPE" en el render. No romper victoria.test.tsx (adaptar al nuevo render).
