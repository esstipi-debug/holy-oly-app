# App del atleta (bienestar) — A1: shell + Hoy + check-in · Design doc

**Fecha:** 2026-06-02
**Estado:** aprobado (handoff de Claude Design `pk-ql-hoho` + decisiones del user), pendiente de plan.
**Origen:** handoff de Claude Design (bundle `pk-ql-hoho`, "Holy Oly — App del atleta"). El user pidió implementar **su diseño de bienestar**, fiel. Beta SIN cobro. Este es el **primer slice (A1)** del Proyecto A; Mi progreso (A2) y ciclo + Cuenta rica (A3) son slices siguientes.

## 1. Alcance de A1
El **loop diario del atleta**, fiel al diseño + cableado a backend real:
- **Shell** del atleta (brand bar + scroll + bottom-nav Hoy/Mi progreso/Cuenta).
- **Hoy**: saludo + estado-de-hoy (Titular) + CTA de check-in + Constancia (racha + heatmap) + Camino a la competencia (countdown + cinta de fases).
- **Check-in** (overlay full-screen, 2 variantes **Toque**/**Dial** + paso de peso + pantalla "listo") → escribe el día.
- **Cuenta (mínima)**: logout + vincular-con-coach (lo que hoy hace `AtletaScreen`) + selector de skin.
- **Backend atleta-sobre-sí**: tabla `DayLog` + `core/wellnessScore` + endpoints `/me/*` bajo `requireAthlete`.

**Fuera de A1** (slices siguientes): **que el coach VEA el bienestar** (requiere modelo de dato parcial, §5) · Mi progreso/charts (A2) · módulo de ciclo + Cuenta rica export/borrar (A3) · el chrome de mockup (status-bar iOS, marco de teléfono 390px, panel de Tweaks — NO se portan).

## 2. UI fiel (port del diseño)
- Port de los estilos `ho-*` a **`apps/web/src/screens/atleta/atleta.css`** (leen `var(--wl-*)` → andan en cualquier skin; default **neon**). Se **omiten** `.ho-status` (status-bar iOS), el marco/borde del "teléfono" (la app real es full-screen) y el TweaksPanel (dev).
- Primitivas del diseño portadas: **`Face`** (carita 1-5 monocroma), `NavIcon`, `Check`, `goodness(val, highBad)` (sonrisa = buen día sin importar la polaridad del ítem).
- Componentes: `AthleteShell`, `HomeScreen` (+ `Titular`, `CheckinCTA`, `ConstanciaCard`+`CalendarHeatmap`, `CaminoCard`+`MacroRibbon`), `CheckIn` (+ `FaceRow`/`FaceDial`/`WeightStep`), `CuentaMin`.

## 3. Pantallas (qué dato real consume cada una)
- **Saludo**: `Hola {nombre} · {plan} · semana {w} de {N} · {fase}` ← el **plan del atleta** + macro (`/me/plan`). Sin plan asignado → "tu coach todavía no te asignó un plan".
- **Titular (estado de hoy)**: ← `seriesState` de **su** serie (`/me/series`). Sin serie → variante vacía honesta ("Sin datos aún… tu primer check-in empieza a construir tu normal"). Color = estado (warn/alert/ok), nunca inventado.
- **CheckinCTA**: estado "listo" si ya hay `DayLog` de hoy; si no, botón primario.
- **Constancia**: racha (días consecutivos con check-in) + heatmap de días logueados ← `/me/daylog` (historial). Atleta nuevo → "tu racha empieza hoy".
- **Camino**: countdown a la próxima `Competencia` + cinta de fases (`macro.phaseProfile`, semana actual marcada) ← `/me/plan`. Sin comp/plan → estado vacío.
- **Check-in**: 6 ítems de bienestar (1-5, caritas) + peso → `PUT /me/daylog`.

## 4. Backend (atleta-sobre-sí · `requireAthlete`, scope `req.athleteId`)
- **Tabla `DayLog`** (privada del atleta, anclada a fecha): `athleteId, date (ISO), fatiga, dolor, estres, humor, motivacion, sueno (Int 1-5), weight (Float?)`, `@@unique([athleteId, date])`. Migración `4_day_log`.
- **`core/logic/wellness.ts`**: `WELLNESS_ITEMS` (6, con polaridad `highBad`) + `wellnessScore(items) → 0-100` (normaliza cada ítem a "bueno" 0-1 invirtiendo los `highBad`, promedio ×100). Puro, testeable, **única fuente de la polaridad** (compartida con el form + futuros rollups).
- **Endpoints** (`/me/*`, `req.athleteId` de la sesión — **jamás del body/path** → sin IDOR):
  - `GET /me/plan` → el plan + macro del atleta (para saludo/camino).
  - `GET /me/series` → su `MonitorSeries` (para Titular). Sin serie → 404/undefined.
  - `GET /me/daylog?date=` → entry de hoy (o null) + `streak` + días logueados (heatmap).
  - `PUT /me/daylog` → upsert (Zod: ítems 1-5, peso acotado) → `{entry, streak}`.
- **`meClient`** (web, patrón `authClient`/`vinculoClient`; valida con Zod de core). Las pantallas no tocan `fetch`.

## 5. Reconciliación clave — que el coach vea el bienestar está DIFERIDO
El check-in es **wellness-only** (6 ítems + peso). Pero hoy `MonitorWeek` exige `acute/hrv/hrvBase/rhr/rhrBase/imr/recovery` **non-null**, y `MonitorSeries` los tiene **requeridos** — un día de bienestar **no** los provee. Entonces **no se puede** materializar el bienestar del atleta en la serie que el coach lee, sin antes **volver opcionales las señales fisiológicas** (core types + columnas nullable + `mapping` + consumidores). Eso es un refactor acotado pero real → **slice siguiente** ("dato parcial + rollup DayLog→MonitorWeek"). En **A1** el `DayLog` se guarda (el atleta ve su racha/historial); el atleta nuevo ve su serie como "sin datos" (honesto). La integración coach se hace después. *(Esto NO bloquea el loop del atleta, que es el valor de A1 para la beta.)*

## 6. Dominio
- **HR-1**: el atleta ve **su bienestar + racha**, nunca ACWR/cifra gameable. A1 no tiene charts (Mi progreso = A2, ahí la recuperación se mostrará **vs su normal**). Las **caritas son monocromas** (no paleta de estado); `color=estado` sólo en el Titular.
- **Sin-dato honesto**: Titular/Constancia/Camino tienen variante vacía explícita para el atleta nuevo — nunca falso-verde.
- **Ciclo**: oculto en A1 (`cycleState='off'` → la card no se renderiza). Su módulo (opt-in, sensible, paleta neutra) = A3.
- **Authz/Repository**: `requireAthlete` scope-self (sin Vínculo — el atleta es dueño de su dato); el `meClient` encapsula `fetch`.

## 7. Routing
`/atleta` → `AthleteShell` (la app). Reemplaza la `AtletaScreen` actual (pantalla de código); el flujo de **vincular-con-coach** se mueve a **Cuenta (mínima)**. Modo API (sesión real de atleta).

## 8. Verificación (TDD)
- **core**: `wellnessScore` (todo-bueno→100, todo-malo→0, mixto, polaridad `highBad`).
- **api**: `PUT /me/daylog` (upsert + streak), `GET /me/daylog` (entry+streak), `/me/series`/`/me/plan` scope a `req.athleteId` (un atleta no lee lo de otro); integración con PG embebido (`verify`/`e2e`).
- **web**: `meClient` (fetch mockeado), `HomeScreen` (saludo/Titular/CTA/Constancia/Camino + estados vacíos), `CheckIn` (ambas variantes: avanza, guarda, "listo"; caritas).
- **e2e**: atleta loguea → check-in (6 ítems + peso) → `DayLog` persistido + racha sube.
- **El Carnicero**: HR-1 (sin cifras gameables), sin-dato honesto, caritas no-semáforo, ciclo ausente, authz scope-self.

## 9. Fuera de scope (futuro)
Coach-ve-bienestar (dato parcial + rollup) · Mi progreso/charts (A2) · ciclo + Cuenta rica (A3) · chrome de mockup (status-bar/marco/tweaks).

## 10. Próximo paso
Invocar **writing-plans**. A1 es grande → probable sub-orden: backend (`DayLog`+`wellnessScore`+`/me/*`+`meClient`) → primitivas+`atleta.css` → `CheckIn` → `Hoy` → `Cuenta` mínima + routing → verificación + El Carnicero + deploy.
