# Secuencia de días + anular (superficie atleta) — diseño

**Fecha:** 2026-06-13 · **Estado:** aprobado por el owner ("me cierra bien, deploy")

## Problema

Falta una restricción en la superficie del atleta: para **completar el día N (N ≥ 2)** de una
semana, los días anteriores de esa semana deben estar resueltos. Hoy el atleta puede registrar
el día 3 sin haber tocado el 1 y el 2. Como además **un entreno no puede caer el mismo día que
otro** (regla 1×fecha, spec 2026-06-12), la data de prueba de Mara/Kevin quedó inconsistente y
hay que corregirla.

El atleta necesita, por entreno, tres caminos: **completar**, **cambiar de fecha** (ya existe,
backdating) y **anular** (falló / canceló por razón desconocida).

## Reglas

- **Día** = agrupación de sesiones vía `dayLayoutFor` (mono-diario: día = idx+1; doble Búlgaro
  AM/PM comparten día). Helper existente: `sessionsByDay`.
- **Estado de una sesión**: `pendiente` (sin registro) · `hecho` (registro + filas done) ·
  `anulado` (registro marcado, sin volumen).
- **Día resuelto** = TODAS sus sesiones resueltas (cada una `hecho` o `anulado`).
- **Gate (solo dentro de la semana)**: para **completar o anular** una sesión cuyo día es D, todo
  día `< D` de esa semana debe estar resuelto. Las semanas son independientes entre sí. Anular
  cuenta como resuelto → destraba los días siguientes.
- **Resuelto (operativo)** = la sesión tiene registro (estado `hecho`, lleva `fecha`) **o** está
  `anulado`. `pendiente` = sin registro. Coincide byte a byte entre backend y demo offline.
- **Reversible**: des-anular borra el registro → el día vuelve a `pendiente`.
- El gate es sobre **orden de días**, NO sobre fechas. Backdating ("cambiar de fecha") queda
  intacto. Editar el propio día o un día ya resuelto nunca bloquea (el gate solo mira días `< D`).

## Modelo de datos

`SessionRegistro` gana `estado: "hecho" | "anulado"` (default `"hecho"`) → **migración 21**.
Antes el registro existía solo para días hechos; ahora también marca los anulados.

- Un día `anulado` **no ocupa fecha**: `fechaConflict` ignora los registros `anulado`; tampoco
  suma a volumen/heat/recorrido (no tiene filas `SessionActual`).
- Al anular se borran las filas `SessionActual` de esa sesión (sin volumen) y se upserta el
  registro con `estado="anulado"` (la `fecha` de la columna = hoy, irrelevante para la vista).

## Core (puro, `logic/registro.ts`)

```ts
priorDaysResolved(allIdxs, resolved, dayOf, targetSessionIdx) → boolean
```
El día objetivo se destraba solo si toda sesión de días anteriores (`dayOf(idx) < dayOf(target)`)
está resuelta. `allIdxs` = todos los sessionIdx de la semana; `resolved(idx)` = ¿tiene registro?
Reusada por backend y `LocalMeClient`. `fechaConflict` se actualiza para saltar `estado==="anulado"`.

Tipos: `SessionRegistro.estado?` (opcional, ausente ⇒ hecho), `SessionView.anulado?: boolean`.

## Enforcement (3 capas, misma semántica)

1. **Backend** `repo.setSessionActuals` (al completar) + helper `assertDayUnlocked` → `DiaBloqueadoError`.
   Endpoints nuevos `POST /me/session/:week/:idx/anular` y `DELETE …/anular`. La ruta de completar
   y la de anular traducen `DiaBloqueadoError` → `409 { error: "dia_bloqueado", faltan }`.
2. **`LocalMeClient`** (demo offline): espejo idéntico vía la misma fn core.
3. **Front**:
   - `SessionView.anulado` viaja en el wire (`SessionViewSchema`).
   - `SemanaCard`: días bloqueados con 🔒 ("Completá el día anterior"), no navegables; estado
     `anulado` pintado; el botón "Registrar entreno" apunta al primer día accionable.
   - `EntrenoScreen` + `ResumenDia`: botón **"Anular entreno"** + manejo de `DiaBloqueadoError`;
     si se entra a un día bloqueado → mensaje, sin iniciar; si el día está anulado → "Reactivar".

## Fix de datos Mara/Kevin (local demo + prod)

El seed no crea sesiones completadas → lo que hay salió de pruebas. Script que, para `mv`/`kv` en
ambas Postgres: lee registros/actuals, **muestra** el estado, y limpia violaciones (completaciones
fuera de orden → se deja el prefijo válido en orden por semana; dupes de misma fecha). Es data de
prueba; se muestra antes de borrar.

## Tests

- **core**: `priorDaysResolved` (mono / doble AM/PM / anulado resuelve / within-week); `fechaConflict`
  ignora anulado.
- **api int** (`registro.int`): gate 409 al completar fuera de orden; anular 200 + destraba; des-anular;
  anulado libera la fecha; editar día resuelto no bloquea.
- **web**: `SemanaCard` día bloqueado renderiza 🔒 y no navega; flujo anular; espejo `LocalMeClient`
  (gate + anular + des-anular).

## Despliegue

Push a `origin/main` → autoDeploy (Render). `start:prod` = `prisma migrate deploy` aplica la mig 21.
Verificar `/health` + deploy `live`. Correr el fix de datos contra prod tras el deploy.
