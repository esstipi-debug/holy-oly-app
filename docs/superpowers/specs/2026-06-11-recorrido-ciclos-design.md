# Spec: «Lo que se hace» a lo largo de los ciclos (sesión → micro → macro)

> Pedido del owner (2026-06-11, tras los fixes del calentamiento/resumen): «debemos informar a lo
> largo de los ciclos, micro, macro, de lo que se hace». Hoy la app informa LO HECHO sólo a
> nivel sesión (Victoria + «Tu entrenamiento»); la semana y el macro no acumulan nada.

## Decisiones

- **D1 · Tres alturas, una historia.** Sesión (ya existe) → **microciclo** = línea de semana en
  la SemanaCard de Hoy + cierre en Victoria («con esta llevás X kg en la semana») → **macro** =
  card «Tu recorrido» en Mi progreso (acumulado del plan + barras por semana de lo HECHO). El
  meso/fase ya tiene contexto en CaminoCard; las barras del recorrido pueden teñirse por fase
  con `phasePalette` si está a mano (opcional, no bloquea).
- **D2 · Core puro:** `weekDoneSummary(views: SessionView[])` → `{ trabajoKg, calentamientoKg,
  totalKg, sesionesHechas, sesionesTotales }` reusando `sessionTonnage`/`warmupTonnage`/
  `completion` (sesión hecha = ≥1 ejercicio hecho). TDD.
- **D3 · API:** `GET /me/recorrido` (requireAthlete) → `{ semanas: [{ week, trabajoKg,
  calentamientoKg, sesionesHechas, sesionesTotales }] }` calculado server-side reusando el MISMO
  builder de vistas que `/me/sessions` semana a semana (con warmup server-side — coherencia con
  la regla nueva del calentamiento). Sólo LO HECHO (done): nada de planificado-vs-hecho en v1.
  Schema zod en core. Int test.
- **D4 · HR-1 intacto:** todo es CARGA PROPIA en kg (permitida al atleta); cero ACWR/RM/% nuevos.
  El calentamiento sigue la regla 06-11: suma visible y separado, JAMÁS al monitor. Coach: sin
  endpoint nuevo (su lente ya tiene adherencia+charts; extensión coach = slice aparte).
- **D5 · Demo espejo obligatorio** (LocalMeClient/LocalRepository) — el demo es la herramienta
  de venta.
- **D6 · Copy es-CL sobrio:** «Tu recorrido» · «Esta semana: N kg · X/Y sesiones» · sin
  gamificación nueva (informa, no premia).

## Superficies

1. **SemanaCard (Hoy):** línea micro bajo la grilla: «Esta semana: {total} kg movidos ·
   {hechas}/{total} sesiones» (sólo si hay algo hecho; 0 → nada, sin culpa).
2. **VictoriaScreen:** línea de cierre micro tras la carga del día: «Con esta, llevás {X} kg en
   la semana.»
3. **ProgresoScreen:** card «Tu recorrido» (macro): total kg del plan hasta hoy (trabajo +
   calentamiento desglosado en sub), semanas con registro, y barras por semana (alto ∝ kg
   hecho; semanas sin registro = barra vacía muted; semana actual marcada).
