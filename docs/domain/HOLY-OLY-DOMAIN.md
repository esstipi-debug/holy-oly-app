# Holy Oly — Rulebook de dominio

> **Qué es esto.** La definición canónica de *"correcto"* para Holy Oly: halterofilia olímpica + la lógica de los dos usuarios (coach / atleta) + las reglas de producto, privacidad y arquitectura que la app encode. Es la **vara del agente revisor "El Carnicero"** (`.claude/agents/el-carnicero.md`) y la referencia para humanos.
>
> **Cómo se lee.** Cada regla es una aserción chequeable: **MUST** / **NEVER**, con *por qué* (razón de dominio) y, cuando ayuda, *se ve como* (señal detectable en un diff) y un ancla a código (`archivo:línea`) para verificar drift doc↔código.
>
> **Severidad sugerida** (la final la pone el revisor): **CRITICAL** = privacidad/datos del atleta, IDOR/authz, bypass de `Repository`, falso-verde sobre dato faltante. **HIGH** = regla de deporte rota o HR-1/HR-2 en superficie clave. **MEDIUM** = mantenibilidad de dominio. **LOW** = matiz.
>
> Última verificación contra código: 2026-06-02.

---

## §0 · Misión + las dos reglas duras

**Misión.** Holy Oly es una app **coach⇄atleta** de halterofilia que gestiona **macrociclos** cruzando **carga** con **recuperación**, y construye el plan **hacia atrás desde la competencia objetivo** ("el calendario manda"). Es **viz-first** y **mobile-first**: las señales se leen **contra una referencia**, no como números sueltos.

Dos reglas gobiernan toda superficie de datos. Son las más citadas por El Carnicero.

### HR-1 · Viz-first (gráficos, no números planos)
- **NEVER** mostrar un número plano donde corresponde una **señal-contra-referencia** (valor dentro de su banda/corredor). *Por qué:* el valor suelto no informa una decisión; el valor-en-su-corredor sí. *Se ve como:* un `{n}`, `.toFixed()`, `%`, o `<Text>{value}</Text>` sin banda/gráfico alrededor en una superficie de monitoreo.
- **NEVER** mostrarle al **atleta** un número que pueda *gamear*. En particular: el atleta ve **carga**, **NUNCA el ratio ACWR** ni cifras clínicas en primer plano. *Por qué:* un número optimizable corrompe el auto-reporte y la conducta. *Se ve como:* ACWR/HRV/recovery numérico crudo en una vista de atleta.

### HR-2 · Siempre explicado, con contexto
- **MUST**: todo gráfico/señal trae las tres cosas — **cómo se forma** (qué inputs, qué cálculo), **para qué sirve** (qué decisión informa) y **contra qué se lee** (su banda/referencia). *Por qué:* un gráfico sin contexto es ruido; el coach/atleta no sabe qué hacer con él. *Se ve como:* un chart sin leyenda de derivación, sin banda de referencia, o sin copy de "qué significa / qué hago".
- Un gráfico sin contexto es **defecto**, no adorno. El mecanismo canónico del contexto es **detail-on-tap** + *action phrase* + **banda visible** (ver §4).

---

## §1 · Las dos personas (lentes obligatorios)

El Carnicero pasa **cada** cambio por los dos lentes. Coach y atleta tienen distinta propiedad de datos, authz y privacidad.

### 🏋️ Coach (análisis + triage + planificación)
- Ve el **plantel** (heatmap de riesgo, cuadrante) y el **drill-down** por atleta (los 8 gráficos), planifica competencias, asigna planes del catálogo.
- **MUST** operar siempre sobre atletas con **Vínculo activo** (ver §5 authz). Nunca ve datos de un atleta que no es suyo.
- Ve el ciclo **sólo redactado** (§3). Nunca el dato crudo.

### 🤸 Atleta (autocuidado + auto-reporte)
- Ve su **propio feed** (estado de hoy, constancia, su carga, su recuperación vs su normal, su camino a la competencia).
- **Es dueño de su dato.** **MUST** poder activar/editar/ocultar/borrar lo sensible (especialmente el ciclo).
- **NEVER** se le muestran números gameables (HR-1). Su recuperación se muestra como tendencia **vs su propia normal**, no como cifra clínica.

> Regla de lente: si un cambio toca una superficie de atleta con lógica/copy/umbral de coach (o viceversa), es sospechoso. El triage es del coach; el autocuidado es del atleta.

---

## §2 · Ciencia del deporte (halterofilia)

Valores **verificados contra `packages/core/src/logic/`**. Si el código cambió y esto no, es drift → hallazgo.

### Carga y ACWR
- **ACWR** = aguda / crónica; **crónica** = media móvil de 4 semanas (incluye la semana actual). `monitor.ts:12,20`.
- **Banda segura = [0.8, 1.3].** Fuera de banda → `warn`; **> 1.5 → `alert`**. `monitor.ts:7`. *MUST* leerse contra esa banda (HR-1), no como número.
- *Por qué:* picos agudos sobre la base crónica predicen riesgo de lesión/sobrecarga.

### IMR vs fase (el gráfico propio del sistema)
- Cada fase del macro define una **banda de IMR esperada** (`phaseProfile.imrPct`). El estado se evalúa **con margen ±2**: `imr > hi+2 || imr < lo−2 → warn`. `monitor.ts:26,103`.
- *Por qué:* el IMR (intensidad media relativa) tiene un corredor esperado por fase; salirse marca desajuste del plan vs la realidad. **MUST** graficarse como **línea + banda escalonada por fase** (la banda se mueve por fase).

### Recuperación
- `recoveryState`: **< 70 → `alert`**, **< 80 → `warn`**, si no `ok`. `monitor.ts:67`. Se lee **vs baseline propio** (HRV/RHR/sueño), no en absoluto.
- ⚠️ La **fórmula** de `recoveryScore` es **PLACEHOLDER explícito** (`monitor.ts:30`) — derivación clínica/coaching real pendiente (decisión de producto). *Se ve como:* tratar ese número como verdad clínica fina → al menos MEDIUM.

### Disciplina de "sin dato" (regla dura, CRITICAL)
- **NEVER** renderizar un **falso verde** sobre dato faltante/degenerado. Dato ausente → estado **`"none"`**, jamás `"ok"`. `monitor.ts:43,68,73,81`.
- `worseOf` propaga `"none"` si cualquier eje falta; `recoveryScore` devuelve `NaN` (no 100) ante input degenerado. *Por qué:* un verde falso le dice al coach "todo bien" donde hay un agujero de datos — peligroso. *Se ve como:* `?? 0`, `|| 100`, default a `ok`, o pintar celda sin chequear `none`.

### Reestructuración por competencia (taper)
- Motor: para cada semana `w` y comp en semana `c.week`, **`d = c.week − w`**; taper si `d ∈ [0,3]` con caps de volumen **d≤1→26, d≤2→40, d≤3→56**; tras la última comp, semanas a **~55%**. `restructure.ts:8`.
- **Semana de taper** = `c.week−2 .. c.week`. `restructure.ts:30`.
- *Por qué:* se baja volumen para **picar** en la competencia. **1 comp → adelanta** la bajada; **varias comps → se repite** el taper antes de cada una. **MUST** resaltarse el segmento reestructurado en el timeline (🚩 por comp).
- ⚠️ **Motor Prilepin (dormant, 2026-06-10):** existe `prilepin.ts` (`PHASE_PROFILE`/`phasePlan`/`generateWeek`) **sin consumidores**. Su `taperFactor` (1.0→0.25) es la dosis de sets del motor, **NO reemplaza** la curva de volumen de `restructure.ts` (los caps 56/40/26 siguen siendo LA verdad del taper instanciado); `EnginePhase` ≠ las fases del catálogo (`phaseProfile.imrPct` del IMR-vs-fase). La conciliación motor↔`volumeCurve` es del slice **peaking**. La cara de atleta del motor es `athleteWeekView` (redacción en core; los audits/ACWR son coach-only, HR-1). Spec: `2026-06-10-motor-prilepin-design.md` (D1–D14).

### 1RM, discos y verdad del kg
- **El kg es la verdad; los discos son aproximados.** Sólo existen discos **10/15/20/25** (colores IWF: 10 verde, 15 amarillo, 20 azul, 25 rojo). `discs.ts:1`.
- Barra 20 (hombre) / 15 (mujer); resto < 5 kg/lado → **sin discos** (no hay fraccionarios). `discs.ts:13`.
- **Vista del disco (owner 2026-06-12):** el dibujo canónico vive SOLO en `apps/web/src/ui/Disc.tsx` con dos vistas — la **¾ (default)**, portada del ícono `holyOlyIconSvg`, es el disco de **todas las filas de entrenamiento**; la frontal ajustada queda como `view="front"`. El **número va SIEMPRE en blanco** (el 15 amarillo incluido — ya no existe el número oscuro). **Nunca** redibujar el disco fuera de `Disc.tsx` ni como barras/otra forma.
- *Se ve como:* inventar discos de 2.5/5, o tratar la suma de discos como la verdad en vez del kg.
- **Cada fila de prescripción del atleta muestra SIEMPRE las tres: `% intensidad` + `kg` + `series×reps` — NUNCA un kg solo (owner 2026-06-13).** El % y el kg conviven aunque eso haga el RM deducible (kg÷%): decisión explícita del owner que **supera** el viejo "atleta cero RM / ¿ve pct?". Superficies: sesión en vivo (`SessionAccordion`), día del calendario (`PlanDayDetail`), preview/money-shot (`AtletaPreview`), detalle de fase del macro (`PhaseAtletaDetail`). El % de la **fase** (banda, p.ej. 65–72%) sigue además a nivel meso. *Se ve como:* una fila con kg sin su % al lado, o un toggle que esconde uno de los tres.

### Semáforo — qué lo dispara y qué NO
- El estado (ok/warn/alert) sale de **worse-of(carga ACWR, recuperación)** — `seriesState`, `monitor.ts:86`. Bienestar e IMR se leen en sus propios charts (contexto), no entran al cálculo hoy.
- La **vigencia del 1RM** (SP5) es **señal coach-only del drill-down** ("fijado hace N sem", hint a ≥12 sem): **NO entra al semáforo hoy**; cablearla sería un diseño aparte (tocaría la disciplina de `none`), no un "de pasada".
- El **ciclo menstrual NUNCA es señal del semáforo** (§3). *Se ve como:* meter el ciclo (o cualquier señal nueva) al cálculo del semáforo sin diseño explícito.

---

## §2b · Verdad anclada a fecha

- **MUST** anclar *cuándo se entrenó / no se entrenó / cuándo es la competencia* a **fechas reales**, **NEVER** a índices de semana sueltos. Piezas: `Plan.startDate`, `Competencia.date`, `SessionMark`. `schedule.ts`.
- El **catálogo es date-less** (semanas 1..N); el **Plan del atleta carga `startDate` real** → una competencia se elige por **fecha** y cae en la semana correcta (`weekOfDate`). `schedule.ts:5,13`. (Esto ES la distinción plantilla↔instancia de §5.)
- Fechas ISO `YYYY-MM-DD` parseadas a **UTC-midnight** (day-diff timezone-estable). `schedule.ts:9`. *Se ve como:* `new Date(str)` local, o derivar "HOY"/semana actual del **largo de la serie** en vez de `startDate` + fecha.
- *Por qué:* la estructura (adherencia, picos, countdown) sólo es exacta si el tiempo es real. El futuro **calendario** (coach+atleta) se revisa contra esta regla.

### §Registro con fecha (spec 2026-06-12)
- Todo registro de sesión lleva **fecha real del entreno** (`SessionRegistro`): default hoy,
  jamás futura, backdating libre. La fecha la declara la atleta; `doneAt` por-ejercicio es
  copia estampada en la misma transacción (procedencia de PRs estable ante ediciones — el
  `week` ancla la elegibilidad del PR, no la fecha).
- **Máx. 1 entreno por fecha** por atleta (server, 409). Excepción única: turnos AM/PM del
  mismo día de receta de la MISMA semana (pueden compartir fecha, no están obligados).
- El layout día/turno es ADN de la receta (`dayLayoutFor`), NO se persiste ni se edita por
  atleta. `sessionsByDay()` es el ÚNICO agrupador — jamás re-derivar «sesión i = día i» a mano.
- Fecha fuera del rango calendario de la semana del plan → aviso suave, JAMÁS bloqueo.
- **Día doble (AM/PM):** cuenta como UN día. Cuando se construya el ACWR/monitor dinámico,
  los dos turnos del día deben agregarse como una sola jornada (no doble-contar) — hoy el
  ACWR es estático del seed y no se ve afectado. El calentamiento sigue fuera del monitor.

### §Re-periodización por cambio de competencia (futura-only, D8 — CRITICAL)
Al **asignar** un macro con compe, la prescripción se instancia con la periodización adaptativa
(`instantiateForPlan` → `buildAdaptivePlan`). Al **cambiar/agregar** la compe con el atleta YA en
marcha (`setComps`), la prescripción se **re-periodiza a la forma nueva**, pero con un invariante duro:
- **Sólo semanas estrictamente futuras** (`week > weekIndexUnclamped(startDate, hoy)`) — jamás la
  semana en curso ni el pasado. El índice **NO se recorta** al largo nuevo del plan (si la compe se
  acercó, recortar ocultaría semanas ya vividas y re-escribiría el pasado). `repo.ts reperiodizeFuture`.
- **NUNCA** una semana con rastro inmutable: ≥1 `SessionActual` (pueden ser **backdated**, §2b), ≥1
  `SessionRegistro`, o una **edición manual del coach** (`coachEdited` → se preserva la semana entera;
  jamás se pisa en silencio). Núcleo puro auditable: `core reinstantiableWeeks`.
- **Jamás un `deleteMany` global** de la prescripción — el pasado y lo tocado se preservan byte a byte.
- **La fase de cada semana es ESTADO PERSISTIDO** (`PrescribedExercise.phaseKey`) = **única fuente de
  verdad** del read-path (heat/dayLayout). Una semana del pasado preservada conserva SU fase aunque la
  compe cambie; el read-path **NO recalcula** la fase del pasado desde las compes actuales.
- Coherente con la doctrina de `updateRms` (no re-instancia; las ediciones sobreviven; el kg se deriva
  en lectura). Quitar todas las compes **estira** el futuro de vuelta al largo natural del macro.

---

## §2c · Contenido programático — escuelas, scores y complejos (2026-06-11)

Valores **verificados contra `data/schools.ts`, `data/complexes.ts`, `logic/recipeGen.ts`, `logic/complexes.ts`**.

### Scores de carga (4 dimensiones — JAMÁS derivan kg)
- Cada movimiento lleva **4 dimensiones SEPARADAS**: `tecnica` (= `complexity` 1..12, demanda coordinativa), y `loads` 1..10: **`snc`** (demanda neural), **`axial`** (compresión de columna / costo estructural), **`metabolica`** (volumen×músculo). `movements.ts` (`computeLoads` espejo de `computeComplexity`).
- *Por qué:* un tirón pesado cobra axial aunque su técnica sea baja; un complejo cobra neural aunque su metabólica sea media. **Mezclar dos dimensiones en una (p.ej. usar técnica como proxy de SNC) = HIGH.**
- Los scores informan **secuencia y presupuesto** del generador. **El kg sale SIEMPRE de %×RM** (`resolveTargetKg`) — un score que toque kg es HIGH.

### Complejos (cx.*)
- Un complejo = **eslabones ordenados en UNA serie con UNA barra** (`ComplexDef.links`, notación `1+1+2` en el nombre). `complexes.ts`.
- **El % se programa contra el eslabón MÁS DÉBIL** (menor RM vigente de los `rmRef` de los eslabones — `complexWeakRmRef`). *Se ve como (CRITICAL):* calcular el kg contra el eslabón fuerte → el débil falla.
- Techos (D7): reps por eslabón ≤ `repsMax.enComplejo` de su base; **total ≤ 6 reps/serie**; **% máximo inverso al largo** — 2 eslabones ≤90 · 3 ≤85 · 4+ ≤80 (`complexPctCeiling`). Violar cualquiera = HIGH.
- Sustitución de atleta sobre un complejo: **no existe en v1** (se marca no-hecho o el coach edita) — `simplerVariants("cx.*") = []` es honesto, no un bug.

### Generador de recetas (lo "no standard y no random" hecho sistema)
- Las 23 recetas no-curadas salen de `generateRecipe(SchoolDNA, macro)` — **determinístico** (hash djb2 de macro/fase/arquetipo/slot; **cero `Math.random`** = CRITICAL si aparece). `recipeGen.ts`.
- **Curaduría manda:** receta curada en `recipes.ts` (Ruso 5D) gana SIEMPRE sobre la generada (`ALL_RECIPES`). La curada conserva sus 96/97% (decisión del coach); el generador capa clásicos a **95** (precedente D4 del motor).
- Dosis en corredor: **clásicos dentro del `imrPct` de la fase (cap 95)**; **tirones 90–110%** de su lift; **sentadillas ≤ hi+5 (cap 100)** contra su propio RM; volumen de clásicos auditado contra la **tabla Prilepin** por zona (70-80→[12,24] · 80-90→[10,20] · 90+→[1,10]; descarga exenta).
- Estructura: **≤3 técnicos por sesión** (clásicos + complejos; el 4º = HIGH); sesión ordenada por **demanda neural descendente** (arranques después del culturismo = HIGH salvo justificación de escuela); **presupuesto SNC por sesión** (`sncBudget[rol]`); **especificidad del pico**: en peaking el slot olímpico sólo admite lo que se compite (arranque / envión completo / 2° tiempo) y la pierna sólo sentadillas de fuerza.
- Sin-dato honesto: macro sin ADN/arquetipos → **receta ausente** (empty-state), jamás una receta genérica inventada.

### §Escuelas — la firma de cada familia (fuentes en `schools.ts`)
| Familia | Firma (inconfundible) | Prohibiciones |
|---|---|---|
| Búlgaro | sólo SN/CJ/FS/BS, singles ≥90% diarios, cero variedad (Abadjiev) | tirones, bisagras, presses, accesorios, complejos |
| Ruso | waviness, GPP ancha, tirones 90–110, complejos en base (Medvedev/Roman) | — |
| Chino | técnica×fuerza, squat-dominante, sots/balance, **bloque metabólico cierra la sesión** | — |
| Cubano | complejos de velocidad, potencias/colgados, % moderados, calidad>cantidad | — |
| Colombiano | prioridad C&J, volumen extremo de piernas, **peaking con piernas a cero** (Urrutia) | — |
| Coreano | tirones pesados omnipresentes (también bloques), posiciones, OHS | — |
| Polaco | singles/series cortas a % alto temprano, pulls desde bloques | — |
| Ucraniano | densidad EMOM, 2-3 piezas por sesión, dobles/triples | accesorios lentos (bisagras, remos) |
| Híbrido | bloques A/T/R (Issurin), complejos por eficiencia de tiempo | — |
| USA | lineal 50:50 fuerza:oly, powers dominantes, complejos en desarrollo | — |

- *Se ve como (HIGH):* un búlgaro con accesorios, un chino sin bloque metabólico, un ucraniano con peso muerto rumano — la escuela deja de ser reconocible.
- Afirmación metodológica sin respaldo acá ni en `sources` del ADN → **"fuera de rulebook — criterio del coach"**, no inventar.

---

## §3 · Privacidad y ética — el ciclo menstrual (la zona más sensible)

Fuente autoritativa: `modulo-ciclo-menstrual.md`. **Tres decisiones innegociables que gobiernan todo el módulo.** Violar cualquiera = **CRITICAL/HIGH**.

1. **Opt-in por elección, NO por género.** Se activa sólo si la atleta lo decide (desde su perfil); **NEVER** se enciende a partir de un campo de sexo/género. Quien no lo usa, **no ve nada** (`activo=false`/ausente → el módulo no existe para ella).
2. **Contextualiza, NO dispara.** El ciclo **NEVER** produce un estado ok/warn/alert propio ni es señal del semáforo. A lo sumo añade una **nota de contexto** a la recomendación cuando recuperación entra en precaución/alerta **y** la fase estimada es lútea tardía/premenstrual — **no cambia el color**; el coach decide. **NEVER** prescribe cargas/porcentajes por fase de forma rígida.
3. **Fuera de la gamificación.** **NEVER** se premia, ni es racha/logro, ni se compara entre atletas. (Registrar puede sumar a "constancia de registro" sólo como *acto de registrar*, jamás por su contenido.)

### Redacción server-side (verificada en código)
- El coach **SÓLO** recibe la proyección redactada `{ share, inLutealNow, health, reliable }`. **NEVER** el `state` crudo, ni fase/día/síntoma. `redactCycle` vive en core (`packages/core/src/logic/cycle.ts`) y lo consumen API (`apps/api/src/repo.ts` `getCycle`) y LocalRepository — una sola fuente, sin drift. `inLutealNow` se computa SOLO bajo `share:"full"` + estado regular + datos; si no, `null` honesto.
- `share==="none" → undefined` (el coach no ve nada). `amenorrhea → health:"referral"`. `reliable = state==="regular"`. *Se ve como:* una ruta/serializer de coach que devuelva el row crudo del ciclo, o que filtre client-side en vez de server-side → **CRITICAL**.
- **MUST**: la redacción ocurre **server-side**; el coach API nunca devuelve el row crudo.

### Estimación con incertidumbre
- La fase es **siempre aproximada**; si `regular=false` o usa anticonceptivo → marcada **poco fiable** (peso interpretativo menor). `reliable` en la proyección. *Se ve como:* mostrar la fase como dato exacto/determinante.

### Amenorrea — señal médica, NUNCA un logro
- Ausencia sostenida del ciclo (cuadro RED-S / baja disponibilidad energética) es señal de salud seria. **NEVER** tratarla como racha "limpia"/positiva/número a optimizar. El sistema **sugiere de forma sobria consultar a un profesional** (`health:"referral"`); **deriva, no diagnostica**.

### Visibilidad, tono y color
- **Acceso mínimo:** sólo la atleta + su coach asignado. **NEVER** aparece en vistas de equipo agregadas ni en exportaciones compartidas salvo decisión explícita de la atleta.
- **Lenguaje clínico y neutro**, sin eufemismos ni tono invasivo.
- **Regla de color:** la fase **NEVER** usa la paleta de estado (verde/amarillo/rojo) — usa su **paleta neutra** propia, para no confundirse con una alerta. *Se ve como:* pintar el ciclo con `STATUS`/semáforo.

### Más allá del ciclo
- **El atleta es dueño de todos sus datos** (activar/editar/ocultar/borrar).
- **Warm-up CUENTA como volumen visible (decisión owner 2026-06-11):** la rampa es volumen de
  base (hipertrofia) + afinación técnica — suma al tonelaje de la sesión del ATLETA como
  componente SEPARADO y estimado (`warmupTonnage`: rampa prescrita de ejercicios hechos sin
  sustituir; copy con «~»). El copy jamás la desestima («no cuenta» prohibido). **NEVER** entra a
  ACWR/IMR/`MonitorSeries`/semáforo: la rampa es casi-constante por sesión → inflaría aguda Y
  crónica por un sumando parejo → comprime el ratio → falso-ok estructural. Sigue salteable y
  fuera de la gamificación. Si el calentamiento gana registro editable que alimente el titular →
  re-review HR-1 explícito. `sessionStats.ts` (guard de regresión en su test).

---

## §4 · Viz-first detallado (charts móviles)

Fuente: `graficos-formato-movil.md` (charts-spec). Charts reales en `apps/web/src/ui/charts/`.

### Reglas de todos los charts
- **MUST**: una card = un chart, vertical apilado, full-width, plot ~150–220px.
- **MUST**: **TAP, no hover** (el detalle/explicación aparece al tocar — es el vehículo de HR-2). **NEVER** tooltips de hover ni leyendas densas.
- **MUST**: **bandas/corredores sombreados** en vez de lectura fina de eje; label inline al final de la línea (sin cajas de leyenda); ≤3–4 labels X, 2–3 gridlines.
- **MUST**: **color = estado** (verde/amarillo/rojo) y nada más. **NEVER** color decorativo. (Excepción: el ciclo usa su paleta neutra, §3.)
- Series temporales **alineadas por semana**.

### Prohibido (avoid-list)
- **NEVER**: radar/spider para tendencias (usar sparklines); pie/donut para series temporales; múltiples dual-axis (el único dual-axis aceptable es volumen-barras + intensidad-línea del macro timeline); ACWR-as-gauge para el atleta (HR-1); h-scroll salvo el heatmap del plantel y el macro timeline; pinch-zoom.

### Contexto obligatorio por chart (HR-2 operacionalizado)
Para **cada** chart, El Carnicero exige las tres respuestas:
1. **¿Cómo se forma?** — input + cálculo visibles o explicados al tap (p.ej. "ACWR = carga aguda / media 4 sem").
2. **¿Para qué sirve?** — qué decisión informa (p.ej. "si sale de la banda, considerar descarga").
3. **¿Contra qué se lee?** — su banda/referencia dibujada (banda ACWR 0.8–1.3; banda IMR por fase; normal de HRV; banda de categoría de peso).
Falta cualquiera de las tres → **defecto HR-2** (HIGH si es superficie clave).

### Inventario de charts (objetivo de la auditoría inaugural)
`AcwrChart`, `CompChart`, `ImrFaseChart`, `LoadChart`, `MacroPeriodization`, `MacroTimeline`, `RecoveryChart`, `WeightChart`, `WellnessChart` + `chartkit.tsx` (primitivos).

Paleta de estado canónica: tokens `:root` de `styles/theme.css` (--ok/--warn/--alert/--gold) espejados con `ui/status.ts` — guard de regresión en `ui/__tests__/status-tokens.test.ts`.

---

## §5 · Invariantes de dominio en la arquitectura

Estos invariantes "técnicos" **son reglas de dominio** (privacidad, modelo de coaching, propiedad del dato).

### Patrón Repository (CRITICAL si se viola)
- **NEVER** una screen toca `fetch`/`localStorage`/Prisma directo. **MUST** todo lectura/escritura pasa por la interfaz `Repository` (`packages/core/src/repository.ts`). Implementaciones: `LocalRepository` / `HttpRepository` (`apps/web/src/data/`).
- *Por qué:* el front es 100% intercambiable Local↔Http; saltearse `Repository` rompe ese contrato y suele saltear validación Zod. *Se ve como:* `fetch(`/api/...`)` o `localStorage.*` dentro de `screens/` o componentes de UI.
- Nota de contrato: `savePlan` **ignora `plan.comps`** (los comps los posee `setComps`). `repository.ts:11`.

### Authz — dos ejes (CRITICAL si se viola)
- **Coach → atleta:** requiere sesión de coach **+ Vínculo activo** (`estado:"activo"`) → si no, **403**. Gate único `guardAthlete` para **reads y writes**. `apps/api/src/server.ts:74`. Un coach sin Vínculo a un atleta **MUST** recibir 403 (aislamiento de tenant).
- **Atleta → sí mismo:** `requireAthlete` (scope `req.athleteId`), **sin** Vínculo. `apps/api/src/auth/guards.ts:13`. *(Eje de la futura app del atleta: atleta-sobre-sí, no requiere Vínculo.)*
- Escrituras de coach **MUST** chequear `body.atletaId === :id` (anti cross-write). *Se ve como:* una ruta athlete-scoped sin `guardAthlete`, o confiar en un id del body sin gate.

### Modelo de dos niveles (catálogo ↔ plan)
- **Catálogo = PLANTILLA read-only**, sin fecha (24 programas / 10 escuelas). **Plan del atleta = INSTANCIA** con `startDate` + comps — es lo que se reestructura. *Se ve como:* escribirle fecha/estado al catálogo, o reestructurar la plantilla en vez de la instancia.

### Redacción de ciclo server-side
- Ver §3. **MUST** ocurrir en la API, nunca confiar en filtrado client-side. `packages/core/src/logic/cycle.ts` (`redactCycle`) + `apps/api/src/repo.ts` (`getCycle`).

### Gotchas de build (no son de revisión de PR, pero el revisor los conoce)
- `tsup` **debe** bundlear `@holy-oly/core` (`noExternal`) — `node dist/main.js` no carga `.ts`. Correr **el bundle real**, no sólo tests (tsx sí entiende `.ts` y enmascara el bug).
- En worktree: `prisma generate` antes de typecheck/test de la api (pnpm ignora el build script).

---

## §6 · Fuentes (trazabilidad)

| Regla / sección | Fuente |
|---|---|
| Misión, "calendario manda", periodización, monitor §8 | `C:\Users\Gamer\Downloads\sistema-macrociclos-maestro.md` |
| Viz-first, charts móviles (§0 HR-1/HR-2, §4) | `C:\Users\Gamer\Downloads\graficos-formato-movil.md` |
| Ciclo menstrual / ética / amenorrea (§3) | `C:\Users\Gamer\Downloads\modulo-ciclo-menstrual.md` |
| ACWR/IMR/recovery/no-data (§2) | `packages/core/src/logic/monitor.ts` |
| Taper/reestructuración (§2) | `packages/core/src/logic/restructure.ts` |
| Discos/IWF/kg (§2) | `packages/core/src/logic/discs.ts` |
| Verdad anclada a fecha (§2b) | `packages/core/src/logic/schedule.ts` |
| Redacción de ciclo server-side (§3) | `packages/core/src/logic/cycle.ts` (`redactCycle`) vía `apps/api/src/repo.ts` |
| Authz / Vínculo (§5) | `apps/api/src/server.ts`, `apps/api/src/auth/guards.ts` |
| Repository (§5) | `packages/core/src/repository.ts`, `apps/web/src/data/` |
| Memory del proyecto | `charts-spec`, `ciclo-menstrual-module`, `plate-disc-system`, `design-system`, `vinculacion-coach-atleta`, `catalog-source-of-truth`, `coach-screen-slices` |
| Specs in-repo | `docs/superpowers/specs/*` |

> **Nota:** `holy-oly-resumen-ejecutivo.md` (2026-05-04) está **obsoleto** (describe otra encarnación: 28 temas, FastAPI, marcas Volta/Axon). **No** es fuente de este rulebook.
