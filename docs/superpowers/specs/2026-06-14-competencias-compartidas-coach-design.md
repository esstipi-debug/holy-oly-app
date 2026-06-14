# Competencias compartidas del coach — diseño

> Fecha: 2026-06-14 · Estado: aprobado para plan · Worktree: `crazy-shaw-80c133`

## Problema

Hoy "competencia" significa **dos cosas distintas**, y ambas son **por-atleta**:

1. **Objetivo del ciclo** — modelo `Competencia` (athlete-scoped, `schema.prisma:239`). El coach carga nombre + fecha y eso ancla el pico del macro del atleta (`weekOfDate`, `peakWeek`, countdown, PhaseTrack). UI: `CompSheet.tsx` y `AssignSheet.tsx`. Se carga **uno por uno**.
2. **Palmarés / resultados** — modelo `Medal` (athlete-scoped, `schema.prisma:332`). Resultados pasados (medalla, categoría, Arr/Env/Total, puesto). `comp` es **texto libre**. UI: `MedalSheet.tsx`.

Si Mara, Kevin y Diego van al mismo Nacional, el coach hoy repite el nombre+fecha tres veces, y si los tres medallan son tres registros sueltos con el string repetido. **No existe** crear la competencia una vez y acoplarle varios atletas.

## Decisiones tomadas (owner, 2026-06-14)

1. **Propósito:** una sola entidad que sirve de **objetivo** (ancla el pico) y, cuando pasa, guarda los **resultados** (cierra el círculo planificar → competir → resultado).
2. **Al acoplar:** rol por atleta — **`pico`** (ancla el macro a la fecha) o **`paso`** (compe de preparación; registra que va, NO toca el plan).
3. **Arquitectura:** entidad nueva compartida + **reutilizar** la maquinaria de peaking existente (sincronizar la fila `Competencia` por-atleta). Migración **aditiva**, bajo riesgo en prod.
4. **Ubicación UI:** acceso a "Competencias" **desde el Plantel** (no se agrega ítem al menú inferior; queda en 4).
5. **Visibilidad atleta:** el atleta ve **solo su pico** (como hoy). Las compes de **paso** son visibles únicamente para el coach hasta que se cargue el resultado. El atleta **nunca** ve el roster de los demás acoplados.

## Modelo de datos

Todo aditivo. Dos tablas nuevas, un enum nuevo, dos columnas opcionales en tablas existentes. Reusa el enum `Metal` (oro/plata/bronce).

```prisma
enum CompRole {
  pico
  paso
}

/// Competencia COMPARTIDA, propiedad del coach (catálogo del coach). El coach la crea una vez y
/// acopla a varios atletas de su plantel (vínculo activo). Si dos coaches van al mismo torneo,
/// son dos registros distintos (sin catálogo global → sin moderación/dedup cross-coach).
model Competition {
  id        String             @id @default(uuid())
  coachId   String
  coach     Coach              @relation(fields: [coachId], references: [id], onDelete: Cascade)
  name      String
  date      String             // ISO YYYY-MM-DD
  place     String?
  createdAt DateTime           @default(now())
  entries   CompetitionEntry[]

  @@index([coachId])
}

/// El ACOPLE atleta ↔ competencia. `role` define si ancla el pico (pico) o no (paso). Los campos
/// de resultado son opcionales y se llenan DESPUÉS de la compe (Fase 2). Un atleta, una vez por compe.
model CompetitionEntry {
  id            String      @id @default(uuid())
  competitionId String
  competition   Competition @relation(fields: [competitionId], references: [id], onDelete: Cascade)
  athleteId     String
  athlete       Athlete     @relation(fields: [athleteId], references: [id], onDelete: Cascade)
  role          CompRole
  // Resultado (Fase 2) — null hasta que el coach lo cargue:
  medal         Metal?
  cat           String?
  sn            Int?        // arranque (kg)
  cj            Int?        // envión (kg)
  place         String?     // puesto, ej "1º"
  createdAt     DateTime    @default(now())

  @@unique([competitionId, athleteId])
  @@index([competitionId])
  @@index([athleteId])
}
```

Columnas nuevas en modelos existentes (ambas opcionales, las filas viejas quedan en `null`):

```prisma
// model Competencia  (schema.prisma:239) — link a la compe maestra que la sincronizó.
//   competitionId String?   + @@index([competitionId])
// model Medal       (schema.prisma:332) — link opcional cuando el Medal nace de una compe gestionada.
//   competitionId String?
```

Relaciones inversas a agregar: `Coach.competitions Competition[]` y `Athlete.competitionEntries CompetitionEntry[]`.

## Sincronización con el peaking existente (el corazón)

La fila `Competencia` por-atleta sigue siendo la fuente que alimenta countdown/`peakWeek`/PhaseTrack. La compe compartida es la capa "crear una vez, repartir":

- **Acoplar/editar entry con `role = pico`:** `upsert` de `Competencia` para ese atleta con
  `{ athleteId, competitionId, name: competition.name, date: competition.date, week: weekOfDate(plan.startDate, competition.date, totalWeeks) }`.
  Es exactamente lo que hoy hace `MacroDetail.onAssign` / `CompSheet`, pero disparado en lote. `totalWeeks` sale del macro del atleta (igual que hoy).
- **Acoplar con `role = paso`:** NO escribe `Competencia`. No toca el plan.
- **Cambiar `pico → paso` o desacoplar:** borra la fila `Competencia` donde `competitionId` = la compe (el link hace el match exacto, sin frágil match por string).
- **Editar fecha de la `Competition`:** recomputar `week` de todas las filas `Competencia` linkeadas (mismo recálculo que ya existe al re-anclar un plan).

### Caso borde: atleta sin macro / sin `startDate`
No se puede calcular `week`. El acople se crea igual (queda el `CompetitionEntry`), pero **no** se escribe la fila `Competencia` todavía. La UI marca "se anclará al asignar macro". Al asignar el macro (`savePlan` con `startDate`), se materializa la fila `Competencia` de las entries `pico` pendientes del atleta.

## Resultados → palmarés (Fase 2)

El resultado vive en `CompetitionEntry` (single source of truth, sin duplicar en `Medal`). El palmarés del atleta pasa a leer **dos fuentes mergeadas**:

- `Medal` (manual / texto libre) — el "+ Añadir medalla" actual sigue intacto para compes viejas o fuera del sistema.
- `CompetitionEntry` con `medal != null` — resultados de compes gestionadas, mapeados a la misma forma `{ comp: competition.name, date: competition.date, cat, medal, sn, cj, place }`.

Nueva función de lectura `getPalmares(athleteId)` que une ambas y ordena por fecha desc. Sin dedup automática entre fuentes (manual = off-system; gestionada = vía compe) — es intencional.

## Autorización y privacidad

- Todas las rutas de competencia: `requireCoach` + la `Competition.coachId` debe ser del coach autenticado.
- Al acoplar: cada `athleteId` debe tener **vínculo activo** con el coach (`hasActiveLink`, `repo.ts:14`).
- El atleta **nunca** ve el roster de la compe ni los datos de otros atletas. Solo su propia participación (y solo el pico).
- Sin RPE ni RM en ninguna superficie nueva (ver intocables).

## API (coach)

| Método | Ruta | Acción |
|--------|------|--------|
| GET | `/competitions` | Lista las competencias del coach (con conteo de acoplados + countdown). |
| POST | `/competitions` | Crea (name, date, place?). |
| GET | `/competitions/:id` | Detalle + entries (roster con rol y resultado). |
| PATCH | `/competitions/:id` | Edita name/date/place (date → recomputa weeks linkeados). |
| DELETE | `/competitions/:id` | Borra la compe (cascade entries; limpia filas `Competencia` linkeadas). |
| POST | `/competitions/:id/entries` | Acople en lote: `[{ athleteId, role }]`. Crea entries + sincroniza picos. |
| PATCH | `/competitions/:id/entries/:entryId` | Cambia rol y/o carga resultado (medal/cat/sn/cj/place). |
| DELETE | `/competitions/:id/entries/:entryId` | Desacopla (borra fila `Competencia` linkeada si era pico). |

Patrón: nuevo `apps/api/src/competitions/routes.ts` registrado en `server.ts`, lógica de datos en `repo.ts`, validación Zod en `@holy-oly/core`.

## UI (web)

- **Acceso:** botón/sección "Competencias" en el header del Plantel (`Equipo.tsx`). Nueva ruta `/coach/competencias` (lista) y `/coach/competencias/:id` (detalle), agregadas en `router.tsx` bajo `/coach`.
- **Lista:** próximas arriba (con countdown "faltan N sem") y pasadas abajo; cada una: nombre, fecha, lugar, # acoplados. Botón "+ Nueva competencia" (sheet: nombre + fecha + lugar opcional).
- **Detalle:** header (nombre/fecha/lugar/countdown) + roster acoplado con badge de rol (pico dorado / paso neutro) y, si ya pasó, el resultado. Botón "Acoplar atletas" → sheet con checkboxes del plantel (vínculo activo) y toggle pico/paso por atleta. Atletas sin RM se muestran deshabilitados o con aviso (reusar señal `needsRm` del roster).
- **Carga de resultado (Fase 2):** desde el detalle de una compe pasada, por atleta acoplado.
- Reusar tokens/paleta y componentes existentes (BottomSheet, SegmentedToggle, badges de estado). El diseño sigue el sistema actual; el mockup de brainstorming era solo estructura.

## Migración (segura para prod)

Aditiva pura, igual que la mig 22 (`MacroHistory`): dos tablas nuevas + un enum + dos columnas `String?`. Cero borrado, cero backfill obligatorio. Aplica con `prisma migrate deploy` (start:prod). Próxima migración (~23).

## Fases de implementación

- **Fase 1 — el pedido:** modelo + endpoints crear/listar/detalle + acople en lote con rol + sincronización del pico + pantalla Competencias (lista/detalle/acoplar). Esto ya resuelve "acoplar atletas a una misma competencia".
- **Fase 2 — cierra el círculo:** carga de resultados en entries + `getPalmares` mergeado + UI de resultado (coach) y palmarés (atleta).

## Reglas intocables (verificadas)

- **Discos:** no hay prescripción de entrenamiento en esta superficie; los resultados son marcas (Arr/Env/Total en kg), sin discos. El sistema de discos (`Disc.tsx`) no se toca.
- **RPE:** no aparece en ninguna superficie nueva.
- **El atleta nunca ve RM:** los resultados de competencia son marcas logradas del propio atleta (que ya ve en su palmarés), NO el RM de prescripción del coach. No se expone RM en ningún punto nuevo.

## Casos borde

- Atleta sin macro/`startDate` al acoplar como pico → entry creada, fila `Competencia` diferida hasta asignar macro.
- Cambiar la fecha de la compe → recomputa `week` de todas las filas linkeadas.
- Atleta acoplado a dos compes como `pico` el mismo ciclo → es válido a nivel datos, pero el peaking real se ancla a cada fecha; advertencia de UX (no bloqueo) si hay dos picos en el mismo macro. (A confirmar en plan; por defecto: permitir, avisar.)
- Borrar la compe → cascade de entries + limpieza de filas `Competencia` linkeadas.

## Fuera de alcance (YAGNI)

- Catálogo global de competencias compartido entre coaches.
- Inscripción/pago a la competencia, categorías oficiales, tandas/horarios.
- Migrar los `Medal` legacy de texto libre a FK (se quedan como están, conviven).
- Que el atleta se auto-acople o proponga competencias.

## Testing

- Core (puro): `weekOfDate` ya cubierto; agregar tests de la sincronización pico↔`Competencia` (upsert/borrado por `competitionId`) y del merge de palmarés.
- API (Postgres embebido): acople en lote, guards (coach ajeno → 403, atleta sin vínculo → rechazo), recompute al editar fecha, cascade al borrar.
- Web: pantalla lista/detalle, sheet de acople con roles, estados error/vacío.
