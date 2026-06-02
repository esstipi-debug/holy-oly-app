# Slice A — Macrociclos (catálogo + detalle) + cáscara de bottom-nav

- **Fecha:** 2026-06-01
- **Estado:** Diseño aprobado (brainstorm) · pendiente de plan de implementación
- **Rama:** `claude/sad-greider-92789a`
- **Origen:** sesión de brainstorm sobre la arquitectura de la pantalla del coach, derivada del pedido de reusar los gráficos de periodización del `_mockup` para coach y atleta.

> Primer slice de la iniciativa "pantalla del coach con bottom-nav". Read-only, bajo riesgo. Capitaliza el componente `MacroPeriodization` ya construido ([apps/web/src/ui/charts/MacroPeriodization.tsx](../../../apps/web/src/ui/charts/MacroPeriodization.tsx)).

---

## 1. Contexto y objetivo

La app React del coach hoy tiene `Equipo` (heatmap + cuadrante), `Drilldown` e `InvitacionesScreen`, sin barra de navegación y sin ninguna pantalla de macrociclos (esa vista solo existe en `_mockup/index.html`). El catálogo de 24 programas vive en `packages/core` (`MACROCYCLES`).

**Objetivo del Slice A:** estrenar la **barra inferior del coach** y la **sección Macrociclos** (catálogo con buscador → detalle de programa con los gráficos de periodización). Todo **read-only** y leyendo dato de referencia de `core` — sin escrituras, sin auth-scoping, sin tocar el backend.

## 2. IA del coach acordada (contexto, no todo es de este slice)

Barra inferior de **3 tabs**: **Atletas · Macrociclos · Cuenta**.

- **Atletas** = el `Equipo` actual (el rediseño "lista triage-first" es **Slice B**).
- **Macrociclos** = catálogo + buscador → detalle (**este slice**).
- **Cuenta** = perfil + Invitaciones + suscripción/cobro (**Slice D**; en A es un stub).

Modelo de dos niveles (acordado): la **plantilla** del catálogo (`phaseProfile`) es read-only; lo que se reestructura con competencias es el **plan del atleta** (instancia), vía el `CompSheet` del drill-down. Este slice solo toca la plantilla read-only.

## 3. Alcance

**Incluye:**
- Cáscara de navegación con bottom-nav de 3 tabs, persistente en las pantallas del coach.
- Pantalla **Catálogo** (`/coach/macros`): grid de los 24 programas + filtros (escuela, días) + búsqueda por texto.
- Pantalla **Detalle** (`/coach/macros/:id`): cabecera + stats + meters de carga + `MacroPeriodization` + "ideal para", read-only.
- Tab **Cuenta** como stub (placeholder + logout).

**No incluye (slices siguientes):**
- Botón "Asignar a un atleta" en el detalle → **Slice C (M5)**.
- Rediseño del inicio a lista triage-first → **Slice B**.
- Cuenta real (perfil, mover Invitaciones acá, suscripción) → **Slice D / Fase 5**.
- Reuso del catálogo/detalle en la app del atleta → cuando exista esa app (Fase 4 · slice 5). El detalle ya es role-agnostic.

## 4. Arquitectura

### 4.1 Navegación (cáscara)
Un **layout route** `CoachShell` (bajo `RequireAuth role="coach"`) que renderiza `<Outlet/>` + `<BottomNav/>`. Las rutas del coach pasan a ser hijas de ese layout:

```
/coach                 → index → Equipo            (tab Atletas)
/coach/macros          → MacroCatalog              (tab Macrociclos)
/coach/macros/:id      → MacroDetail
/coach/a/:id           → Drilldown                 (detalle, barra persistente)
/coach/invitaciones    → InvitacionesScreen        (se reubica en Cuenta en Slice D)
/coach/cuenta          → CuentaStub                (tab Cuenta)
```

La barra es **persistente** en todas las pantallas del coach (incluye detalles como Drilldown/MacroDetail). El tab activo se deriva de la ruta (Atletas para `/coach` y `/coach/a/*`; Macrociclos para `/coach/macros*`; Cuenta para `/coach/cuenta` e `/coach/invitaciones`).

### 4.2 Datos
El catálogo es **dato de referencia compartido**, no per-tenant. Las dos pantallas importan `MACROCYCLES` de `@holy-oly/core` **directo** (mismo patrón que `Gallery`/`MacroTimeline`/tests). **No** usan el `Repository` ni la API → cero auth-scoping, cero fetch, cero estados de carga/error. Riesgo mínimo.

## 5. Pantallas

### 5.1 Catálogo (`/coach/macros`)
- **Búsqueda**: dos filas de chips — **Escuela** (`Todos` + las 10 `MacrocycleFamily`) y **Días** (`Todos` + `2d`..`6d`) — **más una caja de texto** que filtra por `name`/`family` (case/acento-insensible). Los tres filtros se combinan (AND).
- **Grid** de `MacroCard` (2 columnas), una por programa que pasa el filtro.
- **Cabecera**: contador "N macrociclos" (concuerda con el filtro). **Estado vacío**: "Ningún programa con esos filtros."
- Tap en una card → `/coach/macros/:id`.

### 5.2 Detalle (`/coach/macros/:id`)
- Busca el programa por `id` en `MACROCYCLES`. **Id inválido** → redirect a `/coach/macros` (los ids solo llegan desde las cards; un id a mano es el único caso).
- Composición (de arriba a abajo):
  1. Cabecera: `name` + tags (`family`, `level` traducido, `▲ pico sem N` si `peaks`, o "sin pico").
  2. Descripción (`desc`).
  3. Stats (3): `duration` · `frequency` · `phaseProfile.length` fases.
  4. **Carga**: `LoadMeters` (INTENSIDAD `intensity`, VOLUMEN `volume`, RECOVERY derivado).
  5. **`MacroPeriodization macro={...}`** (el bloque ya construido: chart + reparto + fases en detalle).
  6. "Ideal para": `bestFor`.
- **Read-only** (sin botón de asignar en A). Back → catálogo.

## 6. Componentes (nuevos, chicos y enfocados)

| Componente | Responsabilidad | Depende de |
|---|---|---|
| `BottomNav` | Barra de 3 tabs, marca activa por ruta, navega. | react-router (`useLocation`/`NavLink`) |
| `CoachShell` | Layout route: `<Outlet/>` + `<BottomNav/>`. | BottomNav |
| `MacroCatalog` | Pantalla catálogo: estado de filtros + render del grid. | `macroFilter`, `MacroCard`, `Chip` |
| `MacroCard` | Card de un `Macrocycle` (meta + meters + tag). | `LoadMeters`, `Card` |
| `MacroDetail` | Pantalla detalle. | `MacroPeriodization`, `LoadMeters`, `Badge` |
| `LoadMeters` | Los 3 meters (5 segmentos c/u) intensidad/volumen/recovery. | tokens |
| `CuentaStub` | Placeholder + logout (usa `AuthContext`). | AuthContext |

**Lógica pura** (sin React, testeable aislada), en `apps/web/src/screens/coach/macros/macroFilter.ts` (y vecinos en la misma carpeta):
- `macroFilter(list, { family, days, query }) → Macrocycle[]`.
- `deriveRecovery(m) = clamp(6 − max(m.intensity, m.volume), 1, 5)`.
- `focusTag(m)` → `'volumen' | 'peaking' | 'intensidad' | 'fuerza' | 'técnico'` (port de `focusW` del mockup, usando `intensity`/`volume`/`peaks`).
- `levelLabel(level)` → `Principiante|Intermedio|Avanzado|Elite`.

## 7. Datos: campos usados y desvíos respecto del mockup

Campos de `Macrocycle` (core) usados: `id, name, family, desc, duration, frequency, intensity, volume, level, peaks, peakWeek, bestFor, phaseProfile`.

- **Días** para el filtro: se parsea el dígito de `frequency` (ej. `"5d/sem"` → contiene `"5"`); un rango tipo `"4-5d/sem"` matchea `4d` y `5d` (deseado).
- **Semanas/días en la card**: se muestran los strings ya formateados `duration` y `frequency` (más simple que el mockup, que recomponía números).
- **Dificultad:** el mockup mostraba `dificultad X/5`, pero `Macrocycle` en core **no** tiene ese campo → **se omite** en Slice A. La card muestra nivel + familia + tag de foco en su lugar. (Si se quiere recuperar, es una adición de dato a `core`, fuera de scope.)

## 8. Testing (TDD, vitest + RTL; convención `apps/web/src/.../__tests__/`)

- `macroFilter`: filtra por familia, por días, por texto, y combinado; `Todos`/query vacía = no filtra; sin match = `[]`; texto acento-insensible.
- `deriveRecovery`: casos `i/v` altos → recovery bajo; clamp a `[1,5]`.
- `MacroCard`: renderiza meters (5 segmentos, N llenos) y meta (`duration`/`frequency`/level) desde un `Macrocycle` real.
- `MacroDetail`: renderiza cabecera/stats + `MacroPeriodization` para un id válido; id inválido → redirect a `/coach/macros` (no crashea).
- `BottomNav`: 3 tabs presentes; marca activa correcta para `/coach`, `/coach/macros`, `/coach/cuenta`.

Cobertura objetivo: lógica pura ≥90%, componentes ≥80% (comportamiento).

## 9. Decisiones resueltas (defaults aprobados)

- Buscador = **chips + texto**.
- Detalle = **read-only** (asignar → Slice C).
- `Equipo` = **intacto** (triage → Slice B).
- Cuenta = **stub** con logout.
- Rutas bajo **`/coach/macros`**.
- Data de **`core` directo** (sin Repository/API).
- Barra **persistente** en pantallas del coach.

## 10. Riesgos

- **Refactor del router** a layout route: bajo, pero toca `router.tsx` y el montaje de las rutas del coach → un test de humo de navegación cubre que cada tab resuelve su pantalla.
- **Filtro de días por string**: frágil si `frequency` no sigue `"Nd/sem"`. Mitigación: `macroFilter` parsea dígitos de forma defensiva + test con los 24 programas reales.
- Resto (catálogo/detalle): sin estado servidor → riesgo mínimo.

## 11. Slices siguientes (fuera de este spec)

- **B** — Inicio = lista triage-first (rediseño de `Equipo`).
- **C** — Asignar plan (M5): botón "asignar a un atleta" en el detalle + flujo `savePlan`.
- **D** — Cuenta: perfil + reubicar Invitaciones + gancho de suscripción (Fase 5).
- **Atleta** — reuso de `MacroDetail`/`MacroPeriodization` como "mi programa" en la app del atleta.
