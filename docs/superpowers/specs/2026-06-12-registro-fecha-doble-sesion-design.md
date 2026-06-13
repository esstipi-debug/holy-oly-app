# Registro con fecha + regla 1×fecha + doble sesión AM/PM — Design

**Fecha:** 2026-06-12 · **Estado:** aprobado por el owner (brainstorming en sesión) · **Rama:** `claude/elated-taussig-31ab69`

## 1. Problema (reportado por el owner probando como Mara)

1. El sistema no restringe completar más de un entrenamiento por día: Mara puede registrar
   los 5 días de la semana en una tarde, y la SemanaCard hasta la empuja con el CTA
   «Registrar entreno · Día N».
2. El registro no tiene fecha visible. Existe `doneAt` por ejercicio, pero es una estampa
   del server («cuándo lo registraste», no «cuándo entrenaste»), invisible en la UI, y una
   edición posterior la re-estampa al día de la edición (la procedencia deriva).
3. Hay entrenamientos con **dos sesiones en el mismo día** (AM/PM) y el programa no lo
   plasma. El shape ya existe dormido en core (`SessionTemplate.day`/`turno`, decisión D9
   del slice entrenamientos-distintivos) pero ninguna receta lo emite y la UI quedó
   diferida (D14 de aquel slice — los D# de la tabla §2 son de ESTE spec).

Los tres son un solo diseño: si cada registro lleva *fecha del entreno*, la regla
«máximo 1 por día» se deriva de la fecha, y la excepción natural son los días de doble
sesión del plan.

## 2. Decisiones (cerradas con el owner — no re-litigar)

| # | Decisión |
|---|----------|
| D1 | **La fecha manda.** Cada registro lleva fecha del entreno (default hoy). Máx 1 entreno por fecha por atleta. Excepción única: turnos AM/PM del mismo `day` de la receta. |
| D2 | **Backdating ilimitado hacia atrás** (el owner revirtió la ventana de 7 días). Nunca futuro. Fecha fuera del rango calendario de esa semana del plan → aviso suave informativo, jamás bloqueo. |
| D3 | **Arquitectura B: tabla `SessionRegistro`** como fuente de verdad de la fecha. `doneAt` queda como copia denormalizada: en la misma transacción del replace, filas done se estampan `doneAt = fecha`. Nunca divergen; las ediciones dejan de re-estampar. |
| D4 | Body de `PUT /me/session/:week/:idx` pasa de array pelado a envelope `{ fecha?, actuals: [...] }`, **sin retrocompat** (pre-launch, cliente y server se despliegan juntos). |
| D5 | La regla vive en el **server** (409 en la transacción). La UX la anticipa: si hoy ya está ocupada, el selector de fecha aparece **al entrar al player**, no al guardar. El 409 queda como red de seguridad (carrera entre dispositivos). |
| D6 | **Doble sesión completa en este slice**: el Búlgaro pasa a `sessionsPerDay: 2`; el generador emite `day`/`turno` — AM arranque-céntrico, PM envión-céntrico (especificidad Abadjiev), ambos lifts garantizados en el día, sentadilla repartida zone-aware. |
| D7 | Guard nuevo del generador: el presupuesto SNC/Prilepin se valida **también por día** (los dos turnos suman), además de por sesión. |
| D8 | Helper único `sessionsByDay()` en core agrupa sesiones por día real (`day` ausente = histórico: sesión n = día n). Toda superficie consume el helper; la suposición «sesión i = día i» muere en un solo lugar. |
| D9 | AM y PM del mismo día **pueden** compartir fecha, no están obligadas (partir el día doble en dos fechas reales es legítimo, sin aviso). |
| D10 | Migración **18_session_registro** (el booking WIP sin commitear renumera a 19, costumbre establecida). Backfill: `fecha = min(doneAt)` de las filas done de cada sesión registrada. Actuals históricos intactos (verdad histórica). |
| D11 | Payload `actuals: []` (des-registrar) borra el `SessionRegistro` y libera la fecha. |
| D12 | Editar una sesión registrada **conserva su fecha** (el cliente reenvía la almacenada). Cambiarla pasa por el mismo selector y re-valida la regla. |
| D13 | `SessionMark` (adherencia coach) **no migra** — sigue posicional; sólo cambia presentación (agrupado por día). El drill-down del coach muestra la fecha de cada registro del atleta. |
| D14 | Reviews obligatorias antes de merge: **El Carnicero** (dominio) + typescript-reviewer. Suite completa core+web+api en verde. |

## 3. Modelo de datos

```prisma
/// Fecha real del entreno por sesión registrada (fuente de verdad; doneAt es copia).
model SessionRegistro {
  id         String  @id @default(uuid())
  athleteId  String
  athlete    Athlete @relation(fields: [athleteId], references: [id], onDelete: Cascade)
  week       Int
  sessionIdx Int
  fecha      String  // ISO YYYY-MM-DD (IsoDateSchema)

  @@unique([athleteId, week, sessionIdx])
  @@index([athleteId, fecha])
}
```

La regla 1×fecha **no** puede ser unique de DB (la excepción AM/PM la rompe): se valida en
la transacción del endpoint.

## 4. API

`PUT /me/session/:week/:idx` ([me/routes.ts:95](../../../apps/api/src/me/routes.ts)):

- Body: `{ fecha?: string, actuals: SessionActualWrite[] }`. `fecha` ausente → hoy (server).
- Validación: `IsoDateSchema` (core, con el refine anti-NaN) + `fecha ≤ hoy`. Futuro → 400.
- Regla en transacción: existe `SessionRegistro` del atleta con la misma `fecha` y otra
  `(week, sessionIdx)` → **409** `{ error: "fecha_ocupada", conflicto: { week, sessionIdx, fecha } }`,
  **salvo** que la receta declare ambas sesiones con el mismo `day` (turnos distintos).
- Con ≥1 actual done: upsert del registro con la fecha; estampa `doneAt = fecha` en filas
  done (reemplaza el `today` actual de [repo.ts:356](../../../apps/api/src/repo.ts)).
- Con 0 filas done (incluye `actuals: []`): borra actuals reemplazados **y** el registro —
  la fecha se libera (D11). Una sesión sin nada hecho no ocupa fecha.
- `GET /me/sessions` (mismo builder que usa el coach): `SessionView` gana `fecha?: string`,
  `day?: number`, `turno?: "AM" | "PM"` (passthrough de la receta instanciada).

## 5. Core

- `SessionRegistroSchema` (zod): week/idx con los límites de `SessionMarkSchema`, `fecha`
  con `IsoDateSchema`.
- Helpers puros testeables sin DB:
  - `validateFechaEntreno(fecha, hoy)` → ok | futuro.
  - `fechaConflict(registros, week, idx, fecha, dayOf)` → null | conflicto (encapsula la
    excepción AM/PM y la edición-de-sí-misma).
  - `sessionsByDay(sessions)` (D8) → `{ day, sesiones: [{ session, turno? }] }[]`.
  - `fueraDeSemana(fecha, weekRange)` → boolean (alimenta el aviso suave D2).
- Generador (`recipeGen.ts` + `schools.ts`): Búlgaro `sessionsPerDay: 2`; emisión de
  `day`/`turno` en los `SessionTemplate` de los días bi-diarios; guard de presupuesto
  SNC/Prilepin **por día** (D7). Regenerar `recipes-gen.snap`; distintividad pareada y
  auditoría Prilepin deben seguir pasando. **Qué días del micro son dobles** lo decide el
  generador bajo el guard D7 y el carácter Abadjiev (mínimo 1 día doble por semana en el
  Búlgaro); el resultado queda auditable en el snapshot y lo revisa El Carnicero.

## 6. Web

- **Camino feliz sin fricción**: terminar player → guardar, fecha=hoy implícita, cero UI nueva.
- **Hoy ocupada** → al entrar al player, BottomSheet «Ya registraste un entreno hoy —
  ¿cuándo hiciste este?» con [Ayer] [Elegir fecha] (cualquier pasada, nunca futura). Fecha
  elegida también ocupada → el sheet lo dice y sigue. Fuera de la semana del plan → aviso
  suave en el mismo sheet (no bloquea).
- **Resumen del player**: «Entreno del mié 11 ▾» — tap abre el mismo selector (D12).
- **SemanaCard**: agrupa con `sessionsByDay`; día doble = filas «Día 3 · AM» / «Día 3 · PM»;
  CTA «Registrar entreno · Día 3 · PM»; cada día hecho muestra su fecha («Día 1 · 3/3 ·
  hecho · lun 9»).
- **Player header**: «Día 3 · PM».
- **Heat maps** (atleta y coach, `planHeat`): `WeekHeat` deja de asumir sesión i → día i
  ([types/index.ts:251](../../../packages/core/src/types/index.ts)); la celda del día
  agrega ambos turnos (lifts suma, topPct máx). El eje semana-offset del macro no cambia.
- **Coach drill-down**: agrupado por día + fecha de cada registro del atleta (D13).
- Sheet = `BottomSheet` existente (tap, jamás hover; reduced-motion ya resuelto). Filas de
  ejercicio intactas: **kg+discos** siempre, **RPE jamás**.

## 7. Migración y seeds

- `18_session_registro`: tabla + backfill (`fecha = min(doneAt)` por sesión con filas done —
  aproximación honesta a «primera vez registrada»; se documenta en la migración).
- Booking WIP (checkout principal, sin commitear): renumerar su migración a **19**.
- Seeds demo (mv/kv): semana con fechas reales variadas + un plan Búlgaro con día doble
  visible para probar a ojo.

## 8. Testing

- **core**: validadores de fecha (futuro, conflicto, excepción AM/PM, edición-de-sí-misma),
  `sessionsByDay` (con y sin `day`), generador bi-diario (presupuesto diario, ambos turnos
  con lift principal, snapshot regenerado), `fueraDeSemana`.
- **api** (int): 409 con conflicto identificado; AM/PM comparten fecha sin 409; editar
  conserva fecha y no re-estampa `doneAt`; `actuals: []` libera la fecha; backfill de la
  migración; futuro → 400; envelope nuevo (el array pelado viejo → 400).
- **web**: selector aparece al entrar sólo si hoy está ocupada; fechas en SemanaCard; filas
  AM/PM; cambio de fecha desde el resumen; cero RPE en el DOM del atleta.

## 9. Riesgos para la review de El Carnicero

1. **Fecha auto-declarada alimenta procedencia de PR** (doneAt = fecha del entreno): el kg
   ya lo escribe la atleta; la fecha sólo ordena la procedencia. Verificar que el PR
   estricto `>` con `doneAt` (SP5) no se rompa con fechas hacia atrás.
2. **Doble conteo diario en monitor/ACWR** con dos sesiones el mismo día: el monitor agrega
   semanal, debería estar bien — verificar explícitamente.
3. **Presupuesto SNC del día doble** (D7): que el guard diario realmente impida que AM+PM
   sumen por encima del techo de la escuela.
4. Backfill `min(doneAt)`: aproximación — confirmar que no fabrica adherencia falsa.

## 10. Fuera de alcance

- Rediseño de la **Constancia/infografías** del Home (conversación pausada aparte).
- Bi-diario para otras familias (sólo Búlgaro en este slice; el resto cuando su ADN lo pida).
- i18n (parqueado, prioridad propia).
- Cambios a `SessionMark`/flujo del coach más allá de presentación + fecha visible.
