# Holy Oly — Brief de diseño para Claude Design · App del atleta

> **Para qué es esto.** Brief autocontenido para diseñar en **Claude Design** la UI de la **app del atleta** de Holy Oly, manteniendo el sistema visual que ya existe en producción. Pegá/subí este doc como contexto. Repo público de referencia: **https://github.com/esstipi-debug/holy-oly-app**

---

## 1. El producto en una línea

App **coach ⇄ atleta** de **halterofilia olímpica** que gestiona **macrociclos** cruzando **carga** con **recuperación**, y arma el plan **hacia atrás desde la competencia** ("el calendario manda"). **Mobile-first** (≈390px) y **viz-first**: las señales se leen **contra una banda/referencia**, no como números sueltos.

## 2. Dos superficies (personas distintas)

- **🏋️ Coach** — *ya existe y está live*: ve el plantel (heatmap/cuadrante) y el drill-down por atleta (8 gráficos + adherencia + calendario). Análisis/triage/planificación. **No** lo diseñamos acá.
- **🤸 Atleta** — *lo que vamos a diseñar (greenfield)*: hoy sólo existe una pantalla para ingresar el código del coach. Falta TODA su app: home/feed + el check-in diario + navegación. Autocuidado + auto-reporte.

## 3. Qué diseñar ahora (alcance de este brief)

Mobile, persona **atleta**. Tres piezas:

1. **Home / feed del atleta** — su estado de hoy, su constancia (racha de registro), **su carga** (no el ratio), su **recuperación como tendencia vs su propia normal**, y su camino a la próxima competencia (countdown / semana del macro). Es la primera pantalla tras login.
2. **Check-in diario** — formulario rápido (mobile, una mano): **6 ítems de bienestar 1–5** (Fatiga, Dolor, Estrés, Humor, Motivación, Sueño) + **peso corporal**. Cadencia **diaria** → el sistema promedia a la semana. Tiene que ser de 10 segundos: tap-tap-tap, listo.
3. **Shell / navegación del atleta** — barra inferior o equivalente (Hoy / Mi progreso / Cuenta). Simple.

> El atleta es **dueño de su dato** (puede editar/ocultar/borrar). Tono cálido y de autocuidado, NO clínico-frío, NO gamificado-agresivo.

## 4. Sistema visual (la marca) — "Neon Bloom"

La app es **multi-skin** (5 temas, el usuario puede cambiar), pero **diseñá para el default**:

### Skin default = **Neon PR (oscuro, electric night-gym)**
- bg `#07070f` · surface `#11111f` · surface-2 `#171728`
- text `#eafff4` · muted `#5f6b7a`
- **accent (marca) = lime eléctrico `#c8ff2d`** · accent-2 = cyan `#1fe7ff`
- danger/acción fuerte = hot magenta `#ff2e7e`
- Personalidad: **glow + pulse** (sombras de neón, el CTA primario pulsa), press = flash/scale. Radius chico (5px). Tipografía **Chakra Petch** (display y body), mayúsculas + tracking en labels.

### Skin alterno = **Neon Bloom (claro, fucsia/violeta/coral)** — la "hermana de día"
- bg `#fdeef6` (con un radial-gradient blush) · surface `#fff` · text `#3a1c40` · muted `#a47c98`
- **fucsia `#ff2e9a` = marca** · violeta `#8a5cff` = secundario/target · coral `#ff4d76` = CTA/acción · ámbar `#ff9d3d` = intensidad (%1RM)
- Mismo ADN (Chakra Petch, glow suave, pulse) sobre lienzo luminoso.

### Roles de color fijos (NO intercambiar)
- **Marca/primario** (logo, crono, foco): lime (PR) / fucsia (Bloom)
- **Secundario/target/links**: cyan (PR) / violeta (Bloom)
- **CTA/acción ("Empezar sesión", "Guardar")**: magenta (PR) / coral (Bloom)
- **Intensidad (%1RM, warning suave)**: ámbar
- **Semánticos de ESTADO** (sólo para estado, ver §6): success `#1bc98a` · warning `#ffab2e` · error `#ff3b46` · info `#2ec5ff`

### Otras skins disponibles (contexto, no diseñes para estas)
`plates` (industrial, discos olímpicos, Saira Condensed) · `chalk` (brutalista claro, naranja seguridad, Anton, sombras duras) · `premium` (glass oscuro, oro+teal, Sora).

### Tipografía
Display + body = **Chakra Petch** (default). Números tabulares para crono/kg. Mono para metadatos pequeños.

## 5. Vocabulario de componentes (reusá el lenguaje)

Los componentes leen **tokens CSS** (`--wl-bg/-surface/-text/-muted/-accent/-accent-2/-display/-body/-radius`) y la skin es una clase `.wl--<name>` en un ancestro. Inventario existente:
- **Botones**: `PrimaryButton` (CTA "Fin", con loading), `GhostButton` (secundario "Ant"), `SkipButton`, `BackButton` (circular).
- **Badge** (variantes: intensity / progress / scheme / target), **SetRadio**, **NumberField** (steppers hold-to-repeat), **ProgressSegments**, press háptico (vibra).
- **Disc** (disco olímpico por color de kg: 10 verde/15 amarillo/20 azul/25 rojo) · **Medal** (oro/plata/bronce).
- **ChartCard** (card de un gráfico, con tap → BottomSheet que explica *cómo se forma / para qué sirve / contra qué banda se lee*) · **BottomSheet** (panel inferior, mobile).
- **MacroTimeline** (línea de tiempo del macro: cinta de fases + barras de volumen + línea de intensidad + 🚩 comps).

## 6. Reglas de dominio que CONDICIONAN lo visual (no son opcionales)

Estas hacen que la app del atleta se sienta correcta y ética. Romperlas = diseño malo, no sólo feo.

- **HR-1 Viz-first / no-gameable (CRÍTICA para el atleta):** el atleta **NUNCA** ve un ratio ACWR ni cifras clínicas crudas que pueda *optimizar*. Ve **su carga** (volumen/tonelaje) y su **recuperación como TENDENCIA vs su propia normal** (banda alrededor de su baseline), no un número absoluto. Un número gameable corrompe el auto-reporte.
- **HR-2 Explicado-con-contexto:** todo gráfico trae *cómo se forma + para qué sirve + contra qué banda se lee*; el mecanismo es **tap (no hover)** → panel que explica. Bandas/corredores sombreados, no lectura fina de eje.
- **Color = estado, y nada más:** verde/amarillo/rojo SÓLO para semáforo de estado. Nada de color decorativo arbitrario. (La marca lime/fucsia es identidad, no estado.)
- **Disciplina de "sin dato":** si falta un dato, se muestra **"sin dato"** explícito — **NUNCA** un falso verde / valor inventado. (El atleta nuevo sin historial verá muchos "sin dato": eso es honesto y está bien.)
- **Módulo de ciclo menstrual (futuro, sensible):** opt-in por elección (no por género); usa **paleta NEUTRA propia**, **nunca** la de estado (no es una alerta); contextualiza, nunca dispara semáforo. Si lo tocás, tratalo con cuidado clínico y sobrio.
- **Warm-up se muestra, no se cuenta** (ramp-up técnico visible pero fuera del cómputo de carga).

## 7. Referencias en el repo (público)

- **Tokens + las 5 skins (fuente de verdad del look):** `apps/web/src/styles/theme.css`
- **Mockups originales (HTML):** `_mockup/` (incluye el home del atleta "Inicio" y la pantalla de ejecución "Entreno")
- **Reglas de dominio / viz completas:** `docs/domain/HOLY-OLY-DOMAIN.md` (§0 HR-1/HR-2, §3 ciclo, §4 charts)
- **App icon (identidad):** disco rojo 25KG en ¾ con "HOLY/OLY" curvo en Saira Condensed — `apps/web/src/ui/holyOlyIconSvg.ts`, `public/icon.svg`
- **Pantallas de coach ya construidas (para igualar el lenguaje):** `apps/web/src/screens/coach/` y `apps/web/src/ui/charts/`

## 8. Constraints técnicos (para que el handoff a código sea directo)

- **React 18 + Vite**, estilos inline + CSS custom properties (no Tailwind). Los componentes leen tokens → un componente sirve en cualquier skin.
- **Mobile-first**, ancho objetivo ≈390px, una columna, cards apiladas full-width.
- Animación sólo en `transform`/`opacity`/`box-shadow` (compositor-friendly); glow/pulse vía box-shadow.
- Cuando vuelva el diseño, se porta a componentes `.wl-*` que ya leen los tokens de arriba (igual que el app icon que ya se portó fiel).
