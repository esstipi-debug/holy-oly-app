# Re-skin del coach "Legend/FUT" — B1: skin + pantalla Atletas · Design doc

**Fecha:** 2026-06-02
**Estado:** aprobado (handoff de Claude Design + decisiones del user), pendiente de plan.
**Origen:** handoff de Claude Design (bundle `pkql-ho`, dirección **#4 FUT hero**). El user eligió: implementar **Atletas = FUT hero**, **re-skinear TODO el panel del coach** al look nuevo, y mantener **Macrociclos** como está (sólo cambia el skin). Es el **primer slice (B1)** del proyecto de re-skin; el atleta (bienestar) es un proyecto aparte.

## 1. Alcance de B1
- Crear la **skin nueva `legend`** (tokens + fonts) dentro del sistema `.wl--<skin>` existente.
- Aplicarla al **shell del coach** → como cada pantalla del coach lee `var(--wl-*)`, el swap de tokens re-skinea **todo el coach** de una (bg/text/accent/fonts). 
- Rehacer la pantalla **Atletas** (`Equipo`) con el layout **FUT hero** (carta dorada del mejor readiness + grilla de mini-cards), **cableada a datos reales** (`getRosterRows`).
- **Fuera de B1 (→ B2):** pulir el layout FUT-específico del resto de pantallas (drill-down, Macrociclos, Invitaciones, Cuenta). En B1 esas heredan los tokens legend pero conservan su layout actual.

## 2. La skin `legend` (§ token system)
El skin se activa hoy con `<html class="wl wl--neon">` ([apps/web/index.html](apps/web/index.html)). **No** se cambia el default global (el atleta/auth siguen Neon); se aplica **`wl--legend` en el wrapper del `CoachShell`** → sólo el coach usa legend.

**Tokens `.wl--legend`** (de la dirección FUT, `dirs34.jsx`/`frame.jsx`):
- `--wl-bg:#0A0B0E` (el screen real usa el radial `radial-gradient(130% 50% at 50% -5%, #1A1813, #0A0B0E)` como fondo de pantalla) · `--wl-surface:#11151A` · `--wl-surface-2:#20262E`
- `--wl-text:#EEF2F6` · `--wl-muted:#6B7480`
- `--wl-accent:#E9C46A` (oro — identidad legend) · `--wl-accent-2:#2EE6A0`
- `--wl-display:'Saira'` · `--wl-body:'Archivo'` · `--wl-radius:16px`
- nuevos para legend: `--wl-cond:'Saira Condensed'` (nombres) · el mono pasa a `'Space Mono'`.

**Fonts a sumar** al `@import` de `theme.css`: **Saira** (regular, pesos 600/700/800/900) y **Space Mono** (400/700). *Saira Condensed* y *Archivo* ya están cargadas.

**Color = estado (intacto):** los semáforos siguen saliendo del `CellState` del dominio vía `STATUS`/`Badge`. El **oro NO es un color de estado** — es identidad/“modo leyenda” decorativo (la carta del mejor readiness). Los estados se muestran con rojo/ámbar/verde/gris como siempre.

## 3. Pantalla Atletas (FUT hero)
Port fiel de `DirFUT` (`dirs34.jsx`), mobile ≈390px. **Adaptaciones honestas:** se **omite** la `StatusBar` iOS y el `HomeBar` (eran chrome de mockup; la app real corre en browser/PWA). El **bottom-nav es real** (ya existe en `CoachShell`).

Estructura:
- **Header:** ícono pesa (chip oro) + “Plantel” (Saira 800) + “{N} ATLETAS” (Space Mono, derecha).
- **HERO CARD** (196px, radius 22): el atleta de **mayor readiness con dato** (los `sindatos` no son elegibles). Fondo oro metálico (`linear-gradient(135deg,#6E561F,#C7A14C,#F8E7AE,#C49A41,#8A6E2C)`) + capa **holo** (overlay pink/blue/green) + highlight radial + **noise** (SVG fractalNoise). Texto oscuro `#241A04`: chip “★ MEJOR READINESS” + programa; readiness grande (Saira 900, 62px) + “READINESS” + categoría; divisor; nombre (Saira Condensed 800, 30px upper) + 3 stats (ACWR / RECUP / RACHA).
- **Grilla “El plantel”:** 2 columnas de **MiniCard** (el resto de atletas). MiniCard: card gradiente oscuro + noise + barra superior color-estado; initials chip (color-estado) + readiness (Saira 800, 28px); nombre (Saira Condensed) + `programa · cat` (mono); **HeatStrip** (últimas 7 semanas de estado).
- Tap en hero/mini-card → navega al drill-down `/coach/a/:id` (igual que hoy).

## 4. Reconciliación de datos (lo que el diseño pide vs lo que el modelo tiene)
Fuente real: `getRosterRows(repo) → RosterRow{ id, nombre, iniciales, metodo, compite, acwr?, rec?, cell, history[] }` ([roster.ts](apps/web/src/screens/coach/roster.ts)).

| Campo del diseño | Mapeo real |
|---|---|
| name / ini / prog | `nombre` / `iniciales` / `metodo` ✓ |
| status | `cell` (`ok/warn/alert/none`) ✓ |
| acwr / recovery | `acwr` / `rec` (undefined → “—”, **sin-dato**) ✓ |
| hist (heat) | `history` (estados por semana; HeatStrip toma las últimas 7) ✓ |
| **readiness** (0-100) | **NO existe** → se deriva en `core` (§4a) |
| **trend** (Δ) | **NO existe** → se deriva en `core` (§4a) |
| **cat** (categoría kg) | `series.weightBand?.[1]` → “{hi} kg”; si no, se omite |

### 4a. `readiness` y `trend` (nuevos helpers puros en `core`, **heurística — criterio del coach, ajustable**)
- **`readiness(series) → number | undefined`**: base = última `recovery` (si no hay → `undefined`, **sin-dato**). Penalización si el último ACWR sale de la banda segura `[0.8,1.3]` (proporcional a la distancia, tope 20). `clamp(round(base − penalty), 0, 100)`. → un número de “preparación general” distinto de sus componentes (recuperación + adecuación de carga). Documentado como heurística (como `recoveryScore` ya es placeholder); El Carnicero/el coach lo pueden afinar.
- **`readinessTrend(series) → number | undefined`**: Δ del readiness entre la última semana y ~3 atrás (o el window disponible); `undefined` si <2 semanas. Se muestra “+n/−n”, o se omite sin-dato.
- `getRosterRows` se extiende para incluir `readiness` y `trend` (computados del `series` que ya tiene en mano).

**Disciplina de sin-dato:** atleta `none` → readiness/acwr/recup = “—”, mini-card con barra gris y heat en dashed; **nunca** un falso número. El hero **no** elige a un `sindatos`.

## 5. Reglas de dominio preservadas
- **HR-1**: es superficie de **coach** → readiness/ACWR/recup son correctos acá (no es la vista gameable del atleta).
- **Color = estado**: semáforos semánticos vía `STATUS`; el oro/holo es decorativo (identidad legend), no estado.
- **Sin-dato honesto**: §4a.
- **Authz/Repository**: sin cambios — reusa `getRosterRows`/`Repository`; no toca `fetch` directo.

## 6. Archivos
- **Modifica** `apps/web/src/styles/theme.css`: + `@import` Saira & Space Mono; + bloque `.wl--legend{…}`.
- **Crea** `packages/core/src/logic/readiness.ts` (+ test): `readiness`, `readinessTrend`.
- **Modifica** `apps/web/src/screens/coach/roster.ts`: + `readiness`, `trend` en `RosterRow` (y `cat` vía weightBand si aplica).
- **Crea** `apps/web/src/screens/coach/atletas/` : `AtletasHero.tsx`, `AtletaMiniCard.tsx`, `legendNoise.ts` (el data-URI), + tests.
- **Reescribe** `apps/web/src/screens/coach/Equipo.tsx` → layout FUT hero (header + hero + grilla); conserva carga/error/loading + navegación al drill-down. (El `Heatmap`/`RiskQuadrant` actuales quedan para B2 — o se mueven a una pestaña/secundario; en B1 la vista primaria es FUT.)
- **Modifica** `CoachShell` (`apps/web/src/screens/coach/macros/CoachShell.tsx`): wrapper con `className="wl wl--legend"` (+ bg radial legend).

## 7. Verificación (TDD)
- **core**: `readiness` (rec base, penalización ACWR fuera de banda, clamp, `undefined` sin rec); `readinessTrend` (Δ, `undefined` <2 sem).
- **web**: `AtletaMiniCard`/`AtletasHero` render (nombre/initials/readiness/heat; sin-dato → “—” + dashed; hero NO toma `sindatos`); `Equipo` arma hero=mejor-readiness + grilla, navega al drill-down; estados loading/error/sin-roster.
- **El Carnicero**: color=estado intacto, oro decorativo no-estado, sin-dato honesto, readiness=heurística-flagged, superficie coach.
- web build + tsc + eslint + tests verdes; deploy.

## 8. Fuera de scope
- **B2**: pulir el layout legend de drill-down / Macrociclos / Invitaciones / Cuenta (heredan tokens en B1).
- **Proyecto A** (app del atleta bienestar) — aparte.
- Las otras 5 direcciones del bundle (Roster/Heat/Triage/Editorial/Risk radar).

## 9. Próximo paso
Invocar **writing-plans** (orden: fonts+skin `legend` → `readiness`/`trend` core TDD → `roster.ts` extiende → `AtletaMiniCard`/`AtletasHero` TDD → reescribir `Equipo` + `CoachShell` wrapper → verificación + El Carnicero + deploy).
