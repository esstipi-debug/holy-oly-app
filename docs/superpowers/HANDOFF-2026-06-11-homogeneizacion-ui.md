# HANDOFF — Holy Oly: homogeneización UI (sesión 2026-06-11)

- **Pedido del owner:** «homogeniza la app. se debe ver igual; si hay más de un tema UI
  sepáralos. si faltan pantallas y botones por conectar conéctalos. si faltan pantallas créalas».
- **Para:** retomar sin perder contexto. Complementa `HANDOFF-2026-06-10-motor-prilepin.md`.

---

## 0. Resumen en una línea

**SHIPPED:** paleta semántica ÚNICA en tokens (el semáforo tenía 3 verdes/3 rojos/3 dorados según
la pantalla — ahora UN valor con guard de regresión), los 3 mundos de skin separados limpio
(auth=neon · coach=legend · atleta=elegible, sin fugas entre hojas), 6 trampas de navegación
muertas, error≠vacío con retry en 7 superficies, y las pantallas que faltaban: **404/AppError en
español, Cuenta real del coach, Cuenta de la atleta con «Tus datos» (export/borrado D3 por fin
cableados) y el estado REAL del vínculo vía `GET /me/vinculo` nuevo**.

## 1. Estado git

| Hecho | Detalle |
|---|---|
| Rama | `claude/wizardly-wiles-0da5ce` (la del motor Prilepin) → FF a main local, SIN push |
| Commits | `752f745` spec · `8e39eeb` W1+W2 tokens/sweep · `4628aa5` W3+W4 cableado/errores · `0beaf66` W5 pantallas+/me/vinculo · `c6b3836` W6+W7 polish/limpieza · `83967f6` W8 tests · `df683af` fixes reviews · (+ este handoff) |
| Migraciones | **Sin cambios** (el booking WIP sigue renumerando a 18) |
| Spec | `docs/superpowers/specs/2026-06-10-homogeneizacion-ui-design.md` (D1–D10 + diferidos) |
| Auditoría | workflow `wf_bca542f2-d87` (5 agentes: nav/tema/coach/atleta/bordes, ~70 hallazgos) |

## 2. Qué cambió (por decisión)

- **D1 · Paleta única:** `:root` en theme.css (`--ok/--warn/--alert/--gold/--mono`) espejo EXACTO
  de `ui/status.ts`, **con guard de regresión** (`ui/__tests__/status-tokens.test.ts` — si alguien
  toca uno solo de los dos, revienta el test). `atleta.css` ya no fuga `:root` global (los 3 oros
  del drill-down eran SU dorado filtrándose al coach).
- **D2 · `--wl-danger` en los 6 skins** + sweep: ~30 hex semánticos divergentes → tokens.
- **D3 · Mono = Space Mono** (JetBrains Mono jamás se cargaba → los charts caían a serif);
  display de charts por `var(--wl-display)` (Chakra Petch ya no se cuela en legend).
- **D4 · Skins separados y documentados:** auth/legal=neon (marca) · coach=legend fijo ·
  atleta=elegible. Gallery (dev) restaura la clase de `<html>` al salir.
- **D5 · Error≠vacío + retry** en Entreno, SessionsSection, AssignSheet-roster, Equipo,
  Drilldown, VincularSection (+ los previos). Cero `catch → setX([])`.
- **D6 · Promesas cumplidas:** Privacidad prometía export/borrado → **cableados** en Cuenta
  atleta (`GET /me/export` + `DELETE /me/account`, descarga JSON + borrado en 2 pasos);
  «Gestionar plan» ya no re-dispara checkout (estado activo → contacto). Coach sin endpoints de
  datos → línea de contacto honesta (endpoints coach = pendiente).
- **D7 · Pantallas nuevas:** `NotFound` (catch-all) + `AppError` (errorElement) en español con
  tokens; `CuentaCoach` real (identidad + badge verificación + reenvío + cambio de clave vía
  flujo reset) — renombrada desde CuentaStub; CuentaMin con identidad + footer legal + vínculo
  REAL en 3 estados (`GET /me/vinculo` nuevo en `vinculo/routes.ts`, **prioriza activo sobre
  pendiente** — M:N, hallazgo Carnicero — + `MeVinculoSchema` en core + espejo demo);
  `VerifyEmailBanner` compartido (Suscripción + Equipo).
- **D8 · Radius/anclaje:** BottomSheet `position:fixed` + scroll-lock **con contador** (sheets
  anidados, hallazgo react) + radius por token; flujo entreno con `var(--wl-radius)` (chalk
  vuelve a ser chalk adentro del entreno); anillo HOY por `color-mix` del texto (visible en
  skins claras); `color-scheme: light` en chalk/neonlight.
- **D9 · Limpieza:** `charts/Heatmap` y `charts/RiskQuadrant` borrados (superados por
  PlanHeatMap; solo sus tests los importaban); `Toast` adoptado en MacroDetail; `BackButton`
  compartido en 5 superficies.
- **D10 · Intocables intactos** (verificado por El Carnicero): Disc/IWF, medallas, carta dorada,
  paleta neutra del ciclo, cero números gameables nuevos al atleta.

## 3. Reviews

**El Carnicero: APROBADO** (0 CRITICAL/HIGH). Sus 5 MEDIUM, todos aplicados: `/me/vinculo`
prioriza activo (una `pendiente` más nueva ocultaba quién VE los datos), guard de regresión del
espejo D1, VincularSection al patrón D5, LoadMeters con paleta de plantilla SEPARADA del semáforo
(§4 color=estado), drift del rulebook §4 saldado (inventario sin los charts borrados + nota de la
paleta canónica). LOW aplicados: Entreno ya no degrada a barra de 20 kg en silencio si el plan
FALLA (rechazo → loadError; null resuelto = sin plan, legítimo); MedalSheet mes LOCAL (no UTC).
**react-reviewer:** 4 HIGH, todos aplicados — scroll-lock anidado (contador a nivel módulo),
cancelación `let on` en SessionsSection (carrera al cambiar semana rápido), labels asociados en
AuthScreen (htmlFor/id + group del selector de rol), `refresh` de Suscripción en useCallback +
URL de checkout validada con `new URL` (bloquea `javascript:`). MEDIUM aplicados: aria-labels en
TODOS los sheets, role=status del «Enviado ✓», document.title en 404/error, tests de
TusDatosSection (export/borrado — gap GDPR). No aplicado consciente: `key={i}` en ejercicios
(lista no reordenable), drag handlers de CheckIn (sin leak real), eslint-plugin-jsx-a11y
(decisión de tooling aparte).

## 4. Verificación

Web **326** (era 306: +33 nuevos, −13 con los huérfanos) · core **243** · api **50 unit + 76 int**
(+1 de prioridad activo>pendiente) · `pnpm -r typecheck` ✓ · lint 0 errors (warning preexistente).
**La instancia `:8765` quedó CORRIENDO el build VIEJO** — para ver la homogeneización hay que
rebuildear desde este worktree (`wizardly-wiles-0da5ce`; receta de siempre, matar instancia antes
de `prisma generate` por el lock del DLL).

## 5. Diferidos conscientes (spec §Diferidos — NO perdidos)

Tailwind muerto (preflight: remover es riesgo visual masivo — decisión aparte) · extracción del
coach inline → legend.css (~694 style={{}}; se hizo solo la pasada de tokens) · @import de 9
fuentes (perf) · SheetFooter/SegmentedToggle unificados · emojis vs SVG icons · endpoints
export/borrado del COACH · cobertura de las ramas API de identidad · nombre real del user en
`/auth/me` (hoy las Cuentas muestran email — el endpoint no devuelve nombre).

## 6. Roadmap vigente

1. Bugs del owner sobre `:8765` (tras rebuild).
2. **Readiness→modulación del día** (consume `readinessBand` + motor Prilepin dormant; spec corta
   propia ANTES; ciclo entra como Capa 3).
3. Peaking → app-viva → calendario granular ∥.
4. Pendientes previos: recetas 23 macros, adapter MP real, email real, legal, i18n, booking
   (mig → 18), `C:\HolyOlyDemo-sp5-smoke` borrable.
