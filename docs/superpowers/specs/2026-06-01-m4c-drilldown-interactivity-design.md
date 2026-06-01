# M4c — Interactividad del Drill-down (timeline data-driven + sheets + luteal latente)

- **Fecha:** 2026-06-01
- **Hito:** M4c (cierra el drill-down del atleta `/coach/a/:id`)
- **Estado:** Diseño aprobado por el usuario · listo para plan de implementación
- **Repo:** holy-oly-app (monorepo pnpm) · rama de trabajo `claude/stupefied-greider-01c07c`
- **Predecesores:** M1 (core) · M2 (design system) · M3 (Equipo) · M4a+M4b (drill-down lectura, 7 charts + Palmarés). 62 tests verdes (core 27 + web 35).

---

## 1. Contexto y estado actual

El drill-down (`apps/web/src/screens/coach/Drilldown.tsx`) es hoy **solo lectura**: 7 charts (Acwr, Load, Recovery, ImrFase, Bienestar, Cumplimiento, Peso) + Palmarés, todos consumiendo `@holy-oly/core` vía `RepositoryProvider`. M4c lo vuelve **editable** y le agrega el 8º chart.

La **capa de datos ya existe**: `Repository` (en `packages/core/src/repository.ts`) y `LocalRepository` (en `apps/web/src/data/LocalRepository.ts`) ya implementan `getComps`/`setComps`/`addMedal`/`getPlan`/`savePlan`/`getCycleContext`. M4c es mayormente **cableado de UI + seeds + 2 hardening**, no construcción de backend nuevo.

El primitivo `BottomSheet` (`apps/web/src/ui/BottomSheet.tsx`) y el componente `MacroTimeline` (`apps/web/src/ui/charts/MacroTimeline.tsx`) ya existen pero **solo viven en `/gallery`** — no están cableados en una pantalla real.

### Hallazgo que corrige la planificación previa

La nota `m4-plan-inputs` (memoria) asumía que el macro de Mara `ruso-5d` era de 12 semanas, igual que su serie. **Es falso:** `ruso-5d` es de **16 semanas** (4 fases × 4: Hipertrofia [1–4], Fuerza básica [5–8], Fuerza/Potencia [9–12], Peaking [13–16]; `peakWeek: 16`), mientras que su `MonitorSeries` es de **12 semanas**. Esta diferencia define el diseño del timeline (§3).

---

## 2. Decisiones tomadas (forks resueltos con el usuario)

1. **Overlay luteal → construir + testear, latente.** Se arma el overlay neutral, gateado por `getCycleContext`, y se prueba con un `CycleContext` sintético. En la app real queda invisible (`inLutealNow=false`) hasta que exista el cycle-slice real. **No se fabrican** datos de ciclo de Mara.
2. **macroId → mapear todos.** Los 6 atletas con serie sin macro (Diego, Lucía, Sofía, Ana, Bruno, Caro) se mapean a macros reales del catálogo → les enciende IMR-vs-fase + timeline.
3. **Comps → `getComps`/`setComps` ahora.** El timeline y el sheet leen/escriben el store dedicado de comps. La reconciliación con `Plan.comps` queda para M5. Se siembra la comp de Mara (sem 16).
4. **Línea de intensidad del timeline → `imrPct` real** (punto medio de la banda por fase), reemplazando la curva sintética `intAt` del mockup. Aprobado por el usuario.

### Alcance

**Dentro:** timeline data-driven (8º chart) · sheet Asignar competencia · sheet Añadir medalla · overlay luteal latente · hardening #5+#6 · seeds (6 macroIds + comp Mara + bump versión).

**Fuera (explícito):** cómputo real de `inLutealNow` (necesita cycle-slice — otro hito) · M5 Asignar plan · app del atleta (`atleta.html`).

---

## 3. `MacroTimeline` data-driven (8º chart)

### Ejes
- **Eje X = duración del macro**, derivada de `phaseProfile` (fin de la última fase: `phaseProfile.at(-1).weeks[1]`). 16 para Mara/Diego (`ruso-5d`/`usa-intermedio`), 12 para el resto. Es la vista del **plan**.
- **HOY = semana actual = largo de la serie** (`series.weeks`, = 12). Para macros de 16 semanas, HOY queda en 12 con 4 semanas de plan por delante (camino a pico). Para macros de 12, HOY cae en la última semana (línea HOY a la derecha — válido).
- Los charts de monitoreo siguen en semanas observadas (12), sin cambios.

### Render derivado de `phaseProfile` (reemplaza lo hardcodeado)
- **Cinta de fases:** un segmento por fase usando `phase.weeks`; label = `phase.name`; color = paleta fija indexada por orden de fase (reutiliza la rampa de 4 colores actual; cicla si hay >4 fases). Encoger/truncar fuente si el segmento es angosto.
- **Volumen base:** `phase.volRel` (escalón plano por fase; ruso = 100·4, 85·4, 65·4, 45·4). El **taper y las banderas** salen de los comps vía `volumeCurve`/`isTaperWeek` (ya data-driven en `packages/core/src/logic/restructure.ts`, sin tocar). `volumeCurve` recibe `baseAt(w) = phaseForWeek(macro, w).volRel`.
- **Línea de intensidad:** punto medio de `phase.imrPct` por semana (escalera ascendente, alineada con el chart IMR-vs-fase). Reemplaza la `intAt` sintética. Se escala al rango y del chart.

### API del componente
Cambia de `{ weeks, hoy, comps }` a `{ macro: Macrocycle, hoy: number, comps: Competencia[] }`. Deriva weeks/ribbon/base/intensity de `macro.phaseProfile`. El test `macro-timeline.test.tsx` se reescribe a la nueva firma (pasar un `Macrocycle` real del catálogo, p.ej. `ruso-5d`).

### Integración en el Drilldown
- Cargar `getComps(id)` además de athlete/series/medals.
- Renderizar `<MacroTimeline macro={macro} hoy={series.weeks} comps={comps} />` **solo si existe `macro`** (atleta con `macroId` resoluble). Sigue la disciplina existente "cada chart renderiza si su dato existe".
- Ubicación en el grid: primero del bloque de charts (el plan encuadra el monitoreo) o donde el usuario prefiera al verlo en vivo.

---

## 4. Seeds (bump `SEED_VERSION` v3 → v4)

En `apps/web/src/data/seeds.ts`:

- **Mapear `macroId`** en `SEED_ROSTER` (o vía una tabla `metodo→macroId` aplicada al sembrar):

  | Atleta | metodo | macroId |
  |---|---|---|
  | ds Diego | USA Intermedio | `usa-intermedio` |
  | lr Lucía | Coreano 5D | `coreano-5d` |
  | sm Sofía | Búlgaro 6D | `bulgaro-6d` (único Búlgaro; level elite vs atleta advanced — aceptable en proto) |
  | ap Ana | Cubano Int. | `cubano-int-5d` |
  | bg Bruno | Híbrido 5D | `hibrido-5d` |
  | cf Caro | Colombiano 5D | `colombiano-5d` |

  Mara conserva `ruso-5d`. `tl` (Tomás) sigue sin serie ni macro (exemplar no-data).

- **Sembrar comp de Mara:** `SEED_COMPS = { mv: [{ name: "Nacional", week: 16 }] }`, escrito en `KEYS.comps("mv")` durante `init()`. El resto arranca sin comps (estado "sin competencia" → se asigna desde el sheet).
- **Bump `SEED_VERSION = 4`** → re-siembra browsers ya sembrados (idempotente intra-versión).

---

## 5. Sheet · Asignar competencia

- **Disparador:** barra "Competencia(s) objetivo" en el drill-down con botón **Asignar** (estilo `objbar` del mockup `coach.html`). Muestra el resumen: "Sin competencia asignada" / "{name} · sem {week}" / "N competencias · sem a, b".
- **Contenido** (dentro de `BottomSheet`):
  - Lista de comps asignadas, ordenadas por semana, cada una con ✕ para quitar.
  - Input de nombre (placeholder "COMP B").
  - **Week-picker** horizontal scrolleable, semanas `1..weeks-del-macro`.
  - Botón "+ Agregar y reestructurar".
  - Nota de reestructura (copy del mockup: adelanta con 1 comp, repite con varias).
- **Comportamiento:** agregar → `setComps([...comps, { name, week }])`; quitar → `setComps(filtradas)`. Tras escribir, el Drilldown recarga `getComps` → el `MacroTimeline` **se reestructura solo** (volumeCurve ve los nuevos comps: taper adelantado/repetido + banderas).
- **Toast** de confirmación opcional (existe primitivo `Toast`).

---

## 6. Sheet · Añadir medalla

- **Disparador:** botón "+ Añadir medalla" en la sección Palmarés. **Gateado por `athlete.compite === true`** (igual que el mockup: "solo atletas que compiten"). Las medallas existentes se muestran siempre.
- **Contenido** (dentro de `BottomSheet`): picker de metal (oro/plata/bronce) · nombre comp · fecha · categoría (kg) · arranque `sn` (numérico) · envión `cj` (numérico) · **total = `sn+cj`** (recalculado en vivo) · `place` derivado del metal (oro→1º, plata→2º, bronce→3º).
- **Comportamiento:** guardar → `addMedal(id, medal)` → recarga `getMedals` → refresca Palmarés (lista + contadores oro/plata/bronce). Toast de confirmación.

---

## 7. Overlay luteal (latente)

- **Marcador/etiqueta neutral** sobre la columna de la **semana actual** del **RecoveryChart** (no una banda de color de estado), indicando contexto "fase lútea". **Paleta neutra (no semáforo)** — per el módulo de ciclo: contextualiza la recuperación, nunca dispara estado.
- **Gate:** `getCycleContext(id)` devuelve `{ share, inLutealNow, health, reliable }`; mostrar solo si `ctx && ctx.inLutealNow === true && ctx.health !== "referral"`. (`inLutealNow === true` ya implica `share === "full"`: para `min` es `null`, para `none` el context es `undefined`; el guard de `health` excluye amenorrea.) El Drilldown carga `getCycleContext(id)` y pasa el flag al RecoveryChart (prop opcional `luteal?: boolean`).
- **Latente:** en la app real `inLutealNow=false` (placeholder honesto en `LocalRepository.getCycleContext`), así que no se ve. **No se fabrican** datos de ciclo de Mara.
- **Prueba:** test unitario que renderiza el RecoveryChart con `luteal={true}` (o el overlay aislado con un `CycleContext` sintético `inLutealNow:true`) y verifica que el marcador neutral aparece. Queda construido + cableado + verificado, listo para encender cuando llegue el cycle-slice real.

---

## 8. Hardening del review M3 (TDD, temprano)

- **#5 Length-invariant.** En el borde del repo (`LocalRepository.getSeries`), normalizar/asertar que `acute/hrv/rhr/wellness/recovery` (y los opcionales `compliance/rpe/bodyweight/wellnessItems`) tengan `length === weeks`. En `apps/web/src/screens/coach/roster.ts`, indexar `acwr`/`rec` en `weeks-1` (para coincidir con `rosterStatus = seriesState(s, s.weeks)`) en vez de `.at(-1)`. Test que construye una serie irregular/corta (inalcanzable con los seeds M3) y verifica que posición y color del punto del cuadrante coinciden.
- **#6 Guard de finitud de `rec`.** En `roster.ts`, espejar el guard de `acwr` (`Number.isFinite`) para `r.rec = s.recovery.at(-1)` (tras el fix de #5, `s.recovery[weeks-1]`), para que un `NaN` no llegue a `<circle cy={NaN}>`. Test con recovery no-finito.

---

## 9. Estrategia de testing

- **TDD** en lógica (hardening, derivaciones del timeline). Cada tarea deja sus tests verdes antes de la siguiente.
- **Render tests** (vitest + testing-library) para timeline data-driven, sheets (apertura, submit, refresh) y overlay luteal (con context sintético).
- **Cierre:** `pnpm -r test` completo verde + verificación en vivo del drill-down:
  - Mara: 8 charts (incl. timeline con bandera sem 16 + 4 semanas por delante) + sheet Asignar competencia (agregar/quitar → reestructura) + sheet Añadir medalla.
  - Un atleta mapeado (p.ej. Diego/`usa-intermedio`): IMR-vs-fase + timeline encendidos.
  - Overlay luteal: verificado por test (no visible en vivo, esperado).

---

## 10. Secuencia de tareas (subagent-driven, review por tarea)

Hardening primero (cheap, desbloquea confianza), luego data, luego UI:

1. **Hardening #5** — length-invariant en repo + fix índice en `roster.ts` + test serie irregular.
2. **Hardening #6** — guard de finitud de `rec` en `roster.ts` + test.
3. **`MacroTimeline` data-driven** — reescritura phaseProfile-driven (ribbon + base volRel + intensidad imrPct) + nueva API + reescribir test.
4. **Seeds** — mapeo `metodo→macroId` (6 atletas) + `SEED_COMPS` (Mara sem 16) + bump `SEED_VERSION=4`.
5. **Timeline en el Drilldown** — cargar `getComps`, render `<MacroTimeline>` gateado por `macro`.
6. **Sheet Asignar competencia** — BottomSheet + form + week-picker + `setComps` + refresh/reestructura.
7. **Sheet Añadir medalla** — BottomSheet + form + total en vivo + `addMedal` (gateado por `compite`) + refresh.
8. **Overlay luteal** — marcador neutral en RecoveryChart + gate por `getCycleContext` + test sintético.

---

## 11. Riesgos / notas

- **Serie ≠ duración del macro** es ahora un caso general (no solo Mara): Diego también tiene macro 16wk / serie 12wk. El timeline debe tolerar `series.weeks < macroWeeks` (HOY interior) y `series.weeks === macroWeeks` (HOY al borde). Cubrir ambos en tests.
- **Colores de fase:** `phaseProfile` no trae color; la paleta indexada por orden es una decisión de render (no de datos). Documentar en el componente.
- **`bulgaro-6d` es level elite** y Sofía es advanced: el `level` del macro es "mínimo recomendado", advisory; no bloquea el render. Nota de realismo, no defecto.
- **Actualizar memoria** al cierre: corregir `m4-plan-inputs` (16≠12) y marcar M4c done.
- `inLutealNow` real y M5 quedan fuera; el overlay y `getComps` están diseñados para reconciliar después sin retrabajo.
