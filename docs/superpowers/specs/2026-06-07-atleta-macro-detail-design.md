# Detalle del macro para el atleta (mesos/ciclos) — design

Fecha: 2026-06-07 · Branch: `claude/atleta-macro-detail`

## Problema

En el Home del atleta, la card **«Camino a la competencia»** (`CaminoCard`) muestra una
cinta de fases plana: nombre + semanas + un fill por intensidad. El atleta no puede
**entrar al detalle** de cada meso (fase) ni ver la estructura del macro. El dato existe
en el modelo (`MacrocyclePhase`: `focus`, `weeks`, `imrPct`, `volRel`) pero la vista del
atleta (`MePlanView`) lo recorta.

## Solución

Tocar la card «Camino» abre un **bottom-sheet «Detalle del plan»** (read-only) con la
estructura del macro a nivel **meso**. Reusa el `BottomSheet` de la app (focus-trap,
`role="dialog"`, backdrop/Esc para cerrar). Funciona igual en el toggle «ver como atleta»
del coach, porque vive dentro de `CaminoCard`.

### Profundidad = meso (fase)

Macro → **mesos** (fases) es justo la estructura que el atleta no ve hoy. El **micro**
(sesiones por semana) ya está en `SemanaCard` → `Entreno`, y como las recetas son plantillas
por-fase, un detalle por-semana repetiría las mismas sesiones. Así que el sheet llega a
nivel meso y referencia la semana actual como puente al detalle semanal existente.

### Qué muestra el sheet (arriba → abajo)

1. **Header** — nombre del macro · «semana X de N» · cuenta regresiva a la próxima comp.
2. **Periodización** — tira por-meso: cada fase ancha por sus semanas, con dos indicadores
   legibles — **intensidad** (corredor `imrPct`, p.ej. «70–78%») y **volumen** (`volRel`
   como barra). La meso «hoy» resaltada.
3. **Mesos** — una card por fase: **nombre**, **semanas** (desde–hasta + cantidad),
   **foco** (`focus`), **intensidad** (% de tus marcas), **volumen** (alto/medio/bajo desde
   `volRel`), **🚩 comp** si cae una en la fase, **• hoy** en la fase actual.

### Regla no-negociable: sin RPE

Intensidad = % de las marcas de competencia (el mismo % que ya aparece en la prescripción).
Volumen = relativo. **Nunca RPE.** No hay discos acá (es estructura de plan, no una sesión).

## Data flow

`MePlanView.plan.phases` hoy: `{ name, from, to, imr }`. Se enriquece cada fase con:
- `focus: string` ← `phase.focus`
- `volRel: number` ← `phase.volRel`
- `imrLo: number` ← `phase.imrPct[0]`
- `imrHi: number` ← `phase.imrPct[1]` (se mantiene `imr` = `imrPct[1]` para el fill de la cinta)

Cambios en `core`:
- `packages/core/src/types/index.ts` — tipo `MePlanView.plan.phases`.
- `packages/core/src/schemas.ts` — `MePlanViewSchema.plan.phases` (lo parsea `httpMeClient`).
- `packages/core/src/logic/mePlan.ts` — `buildMePlanView` mapea los campos nuevos.

Principio de redacción server-side intacto: la vista lleva lo que el atleta necesita,
nada coach-only. `LocalMeClient` (demo) y la API comparten `buildMePlanView`.

## Componentes

- **`apps/web/src/screens/atleta/PlanDetailSheet.tsx`** (nuevo) — `{ plan, onClose }`, monta
  `BottomSheet`. Header + periodización + cards de meso. Deriva: cuenta regresiva (próxima
  comp ≥ semana actual), label de volumen (alto/medio/bajo por umbrales de `volRel`), flag
  de comp por fase, highlight «hoy».
- **`apps/web/src/screens/atleta/hoy/CaminoCard.tsx`** — la card gana un disparador
  («ver detalle ›», `role="button"`/`<button>`, ≥44px) que abre el sheet con `useState`.
  La cinta queda como vistazo; el sheet es el drill-in. Sin plan → estado vacío (igual que hoy,
  sin disparador).
- CSS en `atleta.css` para las cards de meso + la tira de periodización (tokens `--wl-*`).

## Tests

- core `mePlan.test.ts`: `buildMePlanView` → cada fase lleva `focus/volRel/imrLo/imrHi`
  coherentes con el `phaseProfile` del macro.
- web `planDetailSheet.test.tsx` (nuevo): renderiza las mesos (nombre/semanas/foco), la cuenta
  regresiva, el highlight «hoy», el flag de comp, y **assert de no-RPE** (ningún texto «RPE»).
- web `semana`/`home`/`CaminoCard`: tocar la card abre el sheet; sin plan no hay disparador.

## Alcance / no-alcance

- **En alcance:** enriquecer `MePlanView`, `PlanDetailSheet`, `CaminoCard` interactivo, CSS, tests.
- **Fuera:** micro/semana (ya existe en Entreno); editar el plan (lo fija el coach); curva de
  periodización con librería (la tira basta); pantalla/ruta nueva (se eligió bottom-sheet).

## Verificación

core + web tests, ambos typecheck, eslint en tocados; build; Playwright (abrir sheet desde
Home del atleta y desde el toggle del coach, no-RPE, mobile 430). Refrescar el demo de escritorio.
