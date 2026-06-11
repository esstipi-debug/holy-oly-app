# Spec: Homogeneización UI — un solo look, temas separados limpio, todo cableado

> Pedido del owner (2026-06-10): «homogeniza la app. se debe ver igual; si hay más de un tema UI
> sepáralos. si faltan pantallas y botones por conectar conéctalos. si faltan pantallas créalas».
> Base: auditoría de 5 agentes (nav, tema, coach, atleta, bordes) — hallazgos completos en el
> output del workflow `wf_bca542f2-d87`; acá van el diagnóstico, las DECISIONES y el worklist.

## Diagnóstico (lo que un usuario nota hoy)

1. **El semáforo — la tesis del producto — tiene 3 verdes** (`#1bc98a` status.ts · `#3FB55B`
   atleta.css · `#34d058` adherencia), **3 rojos** (`#ff3b46` · `#ff5e5e` · `--alert #E5484D`
   muerto) y **3 dorados** (`#E9C46A` legend · `#E8B23A` atleta.css filtrado · `#e9b365`
   fallback premium) conviviendo, varios en la MISMA pantalla.
2. **Conviven 5-6 sistemas de tema**: 6 skins `.wl--*` (el header de theme.css miente «4»),
   el `:root` global que atleta.css fuga a TODA la app, la paleta TS de `ui/status.ts`
   (duplicada a mano en Titular), ~694 `style={{}}` inline, y Tailwind importado con CERO usos.
3. **La mono del sistema (`JetBrains Mono`) jamás se carga** → los ejes de TODOS los charts caen
   a serif en cualquier máquina ajena; y los charts hardcodean `Chakra Petch` (display de neon)
   dentro del coach legend.
4. **Trampas de flujo**: rol cruzado → /login con sesión activa (loop), «Volver» legal → /login,
   Invitaciones linkeada en demo donde revienta, Cuenta del atleta nunca muestra su vínculo
   real, «Gestionar plan» re-dispara checkout, errores disfrazados de estados vacíos sin retry.
5. **Pantallas faltantes**: 404/error boundary (hoy: pantalla de React Router EN INGLÉS),
   Cuenta real del coach (perfil/verificación/clave), sección «Tus datos» que Privacidad
   PROMETE (export/borrado — los endpoints `GET /me/export` y `DELETE /me/account` YA existen),
   estado real del vínculo en Cuenta atleta.

## Decisiones (D1–D10)

- **D1 · Una sola paleta semántica, en tokens.** `theme.css` gana un bloque `:root` oficial:
  `--ok #1bc98a · --warn #ffab2e · --alert #ff3b46 · --gold #E8B23A · --mono 'Space Mono'…`
  (espejo EXACTO de `ui/status.ts`, que queda como fuente TS con comentario cruzado). Se borra
  el `:root` de atleta.css. Todos los hex semánticos divergentes se reemplazan por estos tokens.
  El verde de Victoria y la adherencia del coach pasan a SER el mismo verde.
- **D2 · `--wl-danger` en los 6 skins** (faltaba en plates/chalk/legend → por eso 18 archivos
  inventaron su rojo). Reemplazo masivo `#ff3b46`/`#ff5e5e` → `var(--wl-danger)`.
- **D3 · Mono = Space Mono** (ya cargada; JetBrains Mono no se carga en ningún lado).
  `--mono: 'Space Mono', ui-monospace, monospace` y los SVG usan `var(--mono)`. Display de
  charts → `var(--wl-display)` (nunca más Chakra Petch fija).
- **D4 · Los 3 mundos de skin quedan SEPARADOS y documentados** (esto ES «sepáralos»):
  auth/legal = `wl--neon` (skin de marca, decisión consciente en index.html) · coach =
  `wl--legend` fijo · atleta = elegible (5 skins de prefs). Nada de mezclas: lo que se filtraba
  entre mundos (atleta.css → coach) se corta; Gallery (dev) deja de pisar la clase de <html>.
- **D5 · Error ≠ vacío, siempre con retry.** Patrón único (el de RmSection): mensaje
  `role="alert"` + botón Reintentar. Nada de `catch → setX([])`.
- **D6 · Las promesas se cumplen o se dejan de prometer.** Privacidad promete export/borrado →
  se cablea en Cuenta atleta (endpoints existentes). Coach sin endpoints de export/borrado →
  línea de contacto honesta (endpoints coach = pendiente documentado). «Gestionar plan» deja de
  re-disparar checkout (estado activo → sin CTA falso).
- **D7 · Pantallas nuevas mínimas y del sistema**: `NotFound` (404 catch-all) + `AppError`
  (errorElement) con tokens del DS, en español. Cuenta coach real (identidad + verificación +
  clave vía flujo reset). `GET /me/vinculo` nuevo (API + meClient + Local espejo) → Cuenta
  atleta muestra sin-vínculo / pendiente / activo (nombre del coach).
- **D8 · Radius por token donde hay tarjeta** (`var(--wl-radius)`, pills 999 se quedan):
  BottomSheet (que además pasa a `position:fixed` — hoy el modal se comporta distinto según la
  pantalla), flujo entreno, inputs. Los skins con personalidad (chalk radius 0) vuelven a
  aplicar dentro de Entreno.
- **D9 · Huérfanos fuera**: `charts/Heatmap.tsx` y `charts/RiskQuadrant.tsx` (superados, solo
  sus tests los importan) se borran con sus tests; `ui/Toast` se adopta en MacroDetail (que lo
  re-implementaba inline).
- **D10 · Intocables intactos**: `Disc.tsx`/IWF, medallas, carta dorada del hero, paleta neutra
  del ciclo. Cero RPE/ACWR nuevos en superficie de atleta (el sweep de colores no toca datos).

## Diferidos conscientes (NO en este slice — anotados para no perderlos)

Tailwind: remover la dep/preflight (riesgo de regresión visual masiva — decisión aparte) ·
extracción del coach inline → `legend.css` (solo pasada de tokens ahora) · optimización del
@import de 9 fuentes (perf, no look) · `SheetFooter`/`SegmentedToggle` unificados · set de
íconos vs emojis · endpoints export/borrado del COACH · `--wl-on-accent` · skin del login
elegible.

## Worklist por olas (cada ola termina con suite web verde)

- **W1 Tokens**: theme.css (:root semántico + --wl-danger×6 + header «6 personalities» + decl
  muerta wl-badge--intensity), index.css (--mono), atleta.css (sin :root global, sin `*`),
  status.ts↔tokens comentados, Titular importa STATUS.
- **W2 Sweep de color/fuente**: #34d058/#ff5e5e/#eab308/#ff3b46/#2dd4e6 → tokens/STATUS;
  var(--gold) sin fallbacks mentirosos; charts → var(--mono)/var(--wl-display).
- **W3 Cableado auth/nav**: RequireAuth mismatch→"/", AuthScreen redirect logueado, LegalPages
  navigate(-1), gates de Invitaciones por API_ENABLED, logout gateado+catch, GoogleComplete
  navigate(), VerifyEmail copy neutro, ResetPassword (color CTA + display + rama !token +
  resetOk), ForgotPassword catch, Gallery restaura className.
- **W4 Error≠vacío + consistencia coach**: EntrenoScreen/SessionsSection/MacroDetail-roster/
  Equipo/Drilldown con retry; HomeScreen empty-state con CTA a Cuenta; Suscripción (display
  font, busy/disabled visibles, reenvío con feedback, estado activo honesto); maxWidth 390;
  paddingBottom 26.
- **W5 Pantallas**: NotFound + AppError + router; CuentaStub→Cuenta real coach; CuentaMin +
  identidad + legal footer + «Tus datos» (export/borrado D3) + VincularSection 3 estados;
  `GET /me/vinculo` + meClient + LocalMeClient + int test; VerifyEmailBanner en Equipo.
- **W6 Polish**: BottomSheet fixed+radius token, anillo HOY contrastante, color-scheme por
  skin claro, SemanaCard copy duplicado, .ho-plan__flag, CheckIn segmentos <button> + peso
  inicial = último bodyweight, MedalSheet type=month, MacroTemplateMap copy neutro, BackButton
  compartido, radius del flujo entreno, AtletaMiniCard/Equipo fondos por token.
- **W7 Limpieza**: borrar Heatmap/RiskQuadrant+tests, Toast adoptado.
- **W8 Verificación**: tests nuevos (404, RequireAuth, AuthScreen redirect, vínculo 3 estados,
  gates demo, Entreno error), suite completa, typecheck, lint.
- **W9 Reviews** (react + El Carnicero) → fixes → handoff → FF main local.
