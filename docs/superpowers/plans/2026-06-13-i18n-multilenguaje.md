# Plan — Internacionalización (i18n) multilenguaje de Holy Oly

> **Alcance:** Plan ejecutable. Implementación en PRs por fase.
> **Origen:** El owner quiere llevar la app a un mercado global (atletas/coaches de todo el mundo, grado adquisición). Hoy la app está 100% en **español rioplatense** salvo los documentos legales, que ya son bilingües ES/EN.
> **Objetivo:** Pasar de "español hardcodeado inline, cero infraestructura i18n" a un **sistema multilenguaje real** (ES + EN hoy, escalable a PT-BR / IT / FR / DE… agregando sólo catálogos).
> **Fundamento:** inventario completo de cada superficie (workflow `wf_c70de643-7dc`, 6 agentes). Los números de abajo son reales.

---

## 1. El hallazgo central

Dos cosas, una mala y una muy buena:

- 🔴 **~360 strings de display viven en `packages/core`** (nombres de movimientos, "character" de escuelas, nombres/descripciones de macros, fases, labels de Prilepin, ítems de wellness, modulación de readiness, planes de billing). Core hoy **redacta texto** en vez de exponer claves — y ese texto llega crudo al atleta y al coach (y por la API en `/billing/plans`). **Externalizar sólo `apps/web` deja media app en español.** Éste es el refactor más grande del proyecto.
- 🟢 **Pero las CLAVES ya existen.** Los IDs del dominio ya son estables y agnósticos de idioma, y están pensados para no traducirse: `movement baseId` (`"arranque"`), `variant id` (`"arranque.potencia.colgado"`), `phaseKey` (`"hipertrofia"`), `EnginePhase` (`"accumulation"`), `ReadinessBand` (`"green/amber/red"`), `RmLift`, `school family`, `plan id`, `wellness field`, `complex id`. **Falta el catálogo, no la clave.** Es la base perfecta.

Y una tercera, oportuna: **la i18n de los documentos legales que ya construí es la base reutilizable** — `useLegalLocale()` (detección por navegador + persistencia en localStorage + override manual) y el toggle ES/EN. Se escala el tipo `Lang` y se reusa la detección; sólo cambia que para cadenas cortas usamos claves+ICU en vez del split por-archivo (que sólo conviene para prosa larga como el legal).

---

## 2. Inventario por superficie (números reales)

| Superficie | Archivos | Strings ≈ | El grueso es… | Trampa principal |
|---|---|---|---|---|
| **core (dominio)** | ~10 | **~420** (360 son labels) | `macrocycles.ts` (~190), `schools.ts` (~60), `movements.ts` (~50) | display en core + nombres compuestos en runtime |
| **Coach (pantallas)** | 33 | **~340** | catálogo de macros, drill-down, sessions, billing | ~30% del texto se redacta en core y llega armado |
| **Atleta (pantallas)** | 28 | **~320** | entreno, progreso, ciclo, cuenta | voz coloquial CL + voseo + femenino por defecto |
| **UI compartida + charts** | 19 | **~150** | `charts/*` (~110: 9 charts × explain HR-2) | ensamblado con template literals + ternarios |
| **API (server)** | 9 | **~75** | emails + error codes + passthrough de plans | falta `User.locale`; emails hardcodeados ES |
| **Auth + onboarding** | 8 | **~62** | login/signup, errores, tour | interpolación + `<Link>` embebido |

**Total bruto ≈ 1.370 strings**; con el solapamiento (los ~360 de core se vuelven a contar donde se muestran) el universo único es **~1.000–1.200 mensajes traducibles**. Es un esfuerzo de varias semanas en slices — pero la mayor parte es mecánica una vez que la fundación está.

**Hoy: CERO infraestructura.** No hay i18next/react-intl/formatjs, ni carpeta de locales, ni helper `t()`. Todo es literal español inline.

---

## 3. Trampas transversales (aplican a casi todas las superficies)

1. **Interpolación everywhere.** Casi toda fila arma frases con template strings (`` `${sets}×${reps} · ${pct}% · ${kg} kg` ``, `` `Sem ${week} · día ${day}` ``). → claves con **placeholders nombrados** (`t('entreno.fila', {sets, reps, pct})`), nunca concatenar — el orden de los tokens cambia entre idiomas.
2. **Pluralización ad-hoc con ternarios** (`n===1 ? "semana" : "semanas"`, día/días, coach/coaches, competencia(s)). Los ternarios binarios **no cubren** las reglas de plural de otros idiomas (PL/RU tienen one/few/many) ni el caso 0. → **ICU MessageFormat `plural{}`**.
3. **Registro "vos" rioplatense incrustado** en web Y en core (`tenés`, `registrás`, `Mové los singles`, `para que llegues afilado`). EN no tiene vos; PT/IT/FR/DE tienen su propio formal/informal. **No es traducción mecánica: es transcreación por locale.** (Ver decisión 4.1.)
4. **Género gramatical femenino asumido** (la atleta: "cansada", "Segura", "Agotada"). EN neutraliza; IT/PT/FR/DE marcan género. → variantes por género (`select{}` de ICU) o reescritura neutra.
5. **`<Link>`/`<b>` embebidos en oraciones** ("Leí y acepto los `<Link>`términos`</Link>`…", "entrás con `<b>`N semanas`</b>`"). → **`<Trans>`** de react-i18next (interpolación de componentes), no string plano.
6. **Fechas/números hardcodeados a `es-CL`** (`toLocaleString('es-CL')`, arrays `DOW`/`MES` en `planDates.ts`, `formatClp` con `Intl('es-CL', CLP)`, coma decimal `0,8–1,3`). → **`Intl` con el locale activo**; mover `formatClp` a parametrizar locale+moneda.
7. **Nombres de movimiento COMPUESTOS en runtime** (`movementDisplayName` = base + "de potencia" + "desde colgado" + flags). El orden gramatical cambia ("hang power snatch"). → **builder gramatical por idioma** (ICU o función por locale), no swap de tokens. (Ya existe un `aliasEn`/`enTokens` parcial, sólo para búsqueda.)
8. **Errores backend → copy cliente:** `authErrorMessage` mapea códigos en inglés estable a copy ES (semi-listo). Pero hay **un error con prosa-ES cruda** (`local-demo-login.ts`: "base de datos local no disponible…") que hay que convertir a `code`. → estandarizar **todos** los errores como `code` estable + clave i18n en el cliente.
9. **`User` no tiene `locale`** → el server no puede mandar emails en el idioma del usuario. Gap estructural (ver Fase 4).
10. **Strings repetidos** ("Cargando…", "No se pudo cargar…", "Reintentar") aparecen ~12–15× → **`common.*` compartido** = el quick-win #1. Ídem labels duplicados (Alerta/Vigilar/OK en 3 archivos).
11. **aria-labels** son user-facing y fáciles de olvidar en un barrido.
12. **Glosario de halterofilia:** "discos/barra", y nombres de movimiento **region-specific** ("Envión" = C&J completo en Chile, "Segundo tiempo" = jerk). Cada idioma necesita su decisión de nomenclatura curada, no traducción literal.

---

## 4. Decisiones de arquitectura (fijadas)

### 4.0 Stack
- **`i18next` + `react-i18next` + `i18next-icu`** (ICU MessageFormat de formatjs) + `i18next-browser-languagedetector` + `i18next-http-backend` (lazy-load por idioma).
  - Por qué: estándar de la industria (un comprador lo reconoce), **plurales ICU** (one/few/many/other), **`select{}` para género**, **`<Trans>`** para componentes embebidos, **namespaces**, **lazy-load**. Cubre las 12 trampas de arriba.
  - Alternativa considerada: **Lingui** (ICU nativo, compile-time, bundle más chico) o **react-intl/formatjs**. Se elige i18next por ubicuidad + ecosistema de TMS.
- **Formato:** `Intl.DateTimeFormat` / `Intl.NumberFormat` con el locale activo, vía helpers en `lib/format.ts`. Reemplaza todo `es-CL`/`formatClp` fijo.

### 4.1 Idiomas y registro
- **Locales objetivo (orden recomendado, reordenable por el owner):** `es-419` (español neutro) + `es-AR` (variante voseo) · `en` · luego `pt-BR` · `it` · `fr` · `de`.
- 🟡 **Decisión del owner — registro del español:** hoy es **rioplatense ("vos")**. Recomendación: **`es-419` neutro ("tú"/imperativos neutros) como default global** + conservar la **voz Rioplatense actual como `es-AR`** (es valiosa para la marca en AR). Así Holy Oly mantiene su carácter para AR y suena natural para el resto. Afecta *cada* string en español, así que conviene decidirlo en Fase 0.
- 🟡 **Decisión del owner — género:** la app trata a la atleta en femenino. Para EN es indistinto; para IT/PT/FR/DE hay que elegir entre variantes por género (`select{}`) o copy neutro. Recomendación: copy neutro donde se pueda + `select{}` donde el femenino sea parte de la voz.
- 🟡 **Decisión del owner — glosario de halterofilia:** nombres de movimiento por idioma (transcreación curada, no literal) + términos a NO traducir (EMOM, GPP, C&J, nombres propios de bibliografía en `schools.ts`). Se arma un **glosario** (`packages/core/src/i18n/glossary.md`) antes de traducir el dominio.
- 🟡 **Motto/branding** ("smart training · zero burnout", nombres de skin "Neon PR"): decidir si se traduce o queda como marca. Recomendación: marca (no traducir), pero centralizado.

### 4.2 Estructura de claves
- **Namespaces:** `common` (loading/error/retry/acciones), `auth`, `onboarding`, `atleta`, `coach`, `charts`, `legal`, `domain`, `email`.
- **`domain`** es el namespace especial: indexado por los **IDs estables de core** (movement baseId, macroId, phaseKey, EnginePhase, ReadinessBand, school family, plan id, wellness field, complex id). Core deja de redactar; expone IDs; el catálogo `domain` traduce.
- Archivos: `apps/web/src/i18n/locales/<lang>/<namespace>.json`. Lazy-load del idioma activo (no se cargan los 6).
- **Documentos legales:** se mantienen como contenido por-archivo (`privacyContent[.en].tsx`) — la prosa larga no va a key-value — pero el **switch de idioma pasa a leer el locale GLOBAL** (se elimina `useLegalLocale`, se reemplaza por el hook global).

### 4.3 Capa de dominio en core (la pieza grande)
- Core **deja de exponer strings de display**: `getMovement(id)` ya no devuelve `.name` redactado; devuelve el `id` + sus modificadores (variant, flags, tipo). El display name se arma en el web con un **builder por idioma** (ICU/función) sobre esos IDs.
- `macrocycles`/`schools`/`prilepin`/`wellness`/`readinessModulation`/`plans`: core expone `id` + parámetros numéricos (kg, pct, sets, semanas, fechas ISO); el texto (`name`, `desc`, `character`, `label`, `rationale`, `features`) se mueve a `domain.json` por idioma.
- ⚠️ **Intocables preservadas:** los **IDs de movimiento quedan congelados** (verdad histórica; la memoria lo marca como regla). Sólo se agrega la capa de traducción del label visible. Discos, `% + kg + series×reps`, no-RPE y el §3 del ciclo **no se tocan** — son lógica/visual/keys, no copy.

### 4.4 Server (apps/api)
- **`User.locale String? @default("es")`** (migración nueva) — guardado en signup (del navegador o la elección del usuario), propagado a `provisionUserRecords` y a `sendEmail`/`sendCoachVerificationEmail`.
- **Plantillas de email por idioma** en `apps/api/src/email/` (catálogo `templates/<lang>.ts`), `renderEmail(to, template, data, locale)`. (`renderEmail` ya está separado de `sendViaGoogle` → cambio acotado.)
- **Errores como `code` estable** en todos los endpoints (generalizar el patrón `code: "subscription_required"` que ya existe); el cliente mapea `code → clave i18n`. Convertir la única prosa-ES (`local-demo-login`) a code.
- El server manda **ISO + números crudos**; el cliente formatea con `Intl`. (Excepción: el email, que sí formatea server-side con el `locale` del usuario.)

---

## 5. Fases de ejecución

### Fase 0 — Fundación (~2–3 días) · habilita todo lo demás
- [ ] Instalar `i18next react-i18next i18next-icu i18next-browser-languagedetector i18next-http-backend`.
- [ ] `apps/web/src/i18n/index.ts`: init con ICU, detección (reusar la lógica de `detectLang`), persistencia (`ho:lang`), namespaces, lazy backend, fallback `es-419`.
- [ ] **Hook/contexto de idioma GLOBAL** (`useLocale`) que reemplaza `useLegalLocale`; migrar `LegalPages` a leerlo. El toggle ES/EN de legal se vuelve el **toggle global** (en Cuenta + un lugar accesible).
- [ ] `lib/format.ts`: `formatDate/formatNumber/formatCurrency` locale-aware (reemplazo de `es-CL`/`formatClp`/`planDates`).
- [ ] Namespace **`common`**: extraer los ~15 strings repetidos (loading/error/retry/acciones). Quick win.
- [ ] **Glosario** + decisiones del owner (4.1) firmadas.
- [ ] **Tooling de QA:** lint que prohíbe texto español hardcodeado en JSX nuevo (regla ESLint custom o `eslint-plugin-i18next`), y **pseudo-localización** (locale `en-XA` que alarga y acentúa el texto) para detectar strings sin extraer y overflow de layout.
- **Gate:** `common` + legal migrados al locale global; cambiar idioma persiste; pseudo-loc corre.

### Fase 1 — Web sin dependencia de core (~2–3 días) · prueba la tubería end-to-end + EN
- [ ] **Auth + onboarding** (~62): `authErrorMessage` → mapa `code → clave`; `<Trans>` para el copy con `<Link>`; ICU para `MIN_PASSWORD` (y arreglar el `'8'` suelto de `ResetPasswordScreen`); `steps.ts` (ya separado) → claves; título de onboarding compartido (una clave, no dos).
- [ ] **UI compartida + charts** (~150): los primitivos ya son presentacionales (reciben texto por props) → traducir en los callers; `charts/*` (las 27 frases `explain` HR-2 + `weekSignals` + `planDates`); ICU para aria-labels ensambladas.
- [ ] Traducir estos 2 paquetes a **EN** (valida ICU/`<Trans>`/plural/Intl en un caso real).
- **Gate:** auth + charts + UI compartida funcionan en ES y EN; pseudo-loc sin fugas.

### Fase 2 — Refactor de dominio en core (~4–6 días) · LA pieza grande y delicada
- [ ] core deja de redactar: `getMovement` y el builder de display name → IDs + modificadores; **builder gramatical por idioma** en web (lo más difícil: orden de palabras EN/DE).
- [ ] Mover a `domain.json` por idioma: `movements`, `macrocycles` (el más pesado, ~190), `schools` (`character` + marcar `sources` como no-translate), `complexes`, `prilepin` (label+rationale), `wellness` (con decisión de género), `readinessModulation`, `billing/plans`.
- [ ] Unificar el `aliasEn`/`enTokens` parcial con el sistema real. Resolver la doble fuente `macrocycles.ts` (core vs ¿web?).
- [ ] Tests: el dominio se renderiza igual en ES (regresión) y aparece en EN.
- **Gate:** El Carnicero — IDs congelados intactos, intocables intactas, el dominio se traduce sin duplicar catálogo; core no emite display.

### Fase 3 — Atleta + Coach (~5–7 días) · consumen el catálogo de Fase 2
- [ ] **Atleta** (~320): entreno/progreso/ciclo/cuenta. ICU para las filas de prescripción, plurales reales, `select{}` para género donde aplique, transcreación de la voz coloquial.
- [ ] **Coach** (~340): catálogo/drill-down/sessions/billing/vínculos. Factorizar la terna `Alerta/Vigilar/OK/Sin-datos` (duplicada en 3 archivos) a una clave; mailto subjects traducibles; `formatClp` → `lib/format`.
- [ ] Traducir ambos a EN.
- **Gate:** app completa navegable en ES y EN; pseudo-loc sin fugas; intocables verificadas.

### Fase 4 — Server (~2 días)
- [ ] Migración **`User.locale`** + propagar a signup/provision/sendEmail.
- [ ] **Email templates por idioma** (ES + EN) + `renderEmail(..., locale)`.
- [ ] Estandarizar **error codes** estables en todos los endpoints; convertir la prosa-ES a code; `/billing/plans` sirve IDs/claves, el web traduce.
- **Gate:** emails llegan en el idioma del usuario; ningún endpoint emite prosa traducible.

### Fase 5 — Idiomas adicionales (por idioma: ~1–2 días de traducción + review)
- [ ] **PT-BR** primero (mercado Brasil; LGPD ya cubierto), luego IT/FR/DE.
- [ ] **Por idioma sólo se agregan catálogos** — la infra ya está. Workflow: borrador asistido por IA → **review de hablante nativo / transcreación** (especialmente la voz y el glosario de halterofilia) → pseudo-loc/QA visual.
- [ ] Documentos legales: traducir `privacyContent.<lang>.tsx` + `termsContent.<lang>.tsx` (prosa, no claves).

---

## 6. Cómo se agrega un idioma nuevo (el payoff)
1. `apps/web/src/i18n/locales/<lang>/` con los namespaces (`common`, `auth`, `atleta`, `coach`, `charts`, `domain`, …) — copiar de `en` y traducir.
2. Agregar `<lang>` al union `Lang`, al detector y al toggle.
3. Plantillas de email `apps/api/src/email/templates/<lang>.ts`.
4. Documentos legales `*.<lang>.tsx`.
5. Glosario de halterofilia revisado para ese idioma.
6. Pseudo-loc + review nativo. **No se toca código** — sólo contenido.

---

## 7. Tooling y gestión de traducciones
- **Extracción:** `i18next-parser` para escanear el código y mantener los JSON sincronizados (detecta claves nuevas/huérfanas).
- **TMS (cuando escale a 4+ idiomas):** **Locize** (integración nativa con i18next) o **Tolgee** (open-source, self-hostable — preferible para no atar el dato a un SaaS de cara a una adquisición). Permite a traductores trabajar sin tocar el repo.
- **Borrador IA + review nativo:** para arrancar, un script que traduce los JSON con un LLM, marcado como "draft", y un hablante nativo revisa (la voz/transcreación NO se delega 100% a la IA).
- **CI:** lint anti-hardcoded-Spanish + check de claves faltantes por idioma + pseudo-loc en el build de QA.

---

## 8. Criterios de aceptación
1. **Sin español hardcodeado** en JSX/TSX de producción (lint en CI lo bloquea).
2. **Cambiar idioma** afecta TODA la app (web + emails) y persiste; detección automática por navegador en la primera visita.
3. **Pseudo-localización** no muestra strings sin extraer ni rompe el layout.
4. **Dominio:** core no emite display; los IDs históricos (movimientos) quedan congelados; el catálogo `domain` traduce sin duplicar.
5. **Formato locale-aware** (fechas, números, moneda) en todas las superficies.
6. **Emails** en el idioma del usuario (`User.locale`).
7. **Intocables intactas:** discos, `% + kg + series×reps`, no-RPE, §3 del ciclo — El Carnicero 0 CRITICAL/HIGH en el diff.
8. Agregar un idioma nuevo = sólo contenido, sin cambios de código.

---

## 9. Riesgos
| Riesgo | Mitigación |
|---|---|
| El refactor de core toca la "verdad histórica" de los nombres de movimiento | IDs congelados; sólo se agrega capa de traducción del label; tests de regresión + El Carnicero |
| Transcreación de la voz coloquial (CL/voseo/femenino) se hace mal por traducción literal | Glosario + review de hablante nativo; la IA sólo borronea |
| Nombres compuestos de movimiento (gramática por idioma) | builder por idioma con tests; empezar por EN/DE (el orden más distinto) |
| Strings que se pierden en el barrido (aria-labels, ternarios, core) | pseudo-loc + i18next-parser + lint en CI |
| Bundle crece con i18next + catálogos | lazy-load del idioma activo; namespaces; sólo se carga lo visible |
| Doble fuente `macrocycles` (core vs web) | unificar antes de traducir |

---

## 10. Estimación
| Fase | Dev | Nota |
|---|---|---|
| 0 — Fundación | 2–3 días | desbloquea todo |
| 1 — Auth + UI/charts (+EN) | 2–3 días | prueba la tubería |
| 2 — core (dominio) | 4–6 días | la pieza grande y delicada |
| 3 — Atleta + Coach (+EN) | 5–7 días | el grueso del volumen |
| 4 — Server (email + locale) | 2 días | gap estructural |
| 5 — Por idioma adicional | 1–2 días c/u | sólo contenido + review nativo |

**Total infra + ES/EN completos: ~15–21 días de dev.** Cada idioma extra después: ~1–2 días + review. La inversión más alta es Fase 2 (core) — pero es la que convierte a Holy Oly en "traducible de verdad".

---

## 11. Referencias
| Tema | Archivo |
|---|---|
| Base i18n ya construida | `apps/web/src/screens/legal/useLegalLocale.ts`, `legalUi.tsx` (CHROME por-locale), `privacyContent[.en].tsx` |
| IDs estables del dominio | `packages/core/src/data/{movements,macrocycles,schools,complexes}.ts`, `logic/{prilepin,wellness,readinessModulation,movements}.ts`, `billing/plans.ts` |
| Errores como code | `apps/api/src/auth/coach-writes.ts` (patrón `code:`) · `auth/routes.ts` (authErrorMessage) |
| Email | `apps/api/src/email/index.ts` |
| Inventario completo | workflow `wf_c70de643-7dc` (resultado en la task `wfbbrul01`) |
| Reglas intocables | `docs/domain/HOLY-OLY-DOMAIN.md` · memoria del proyecto |

---

## 12. Orden sugerido de arranque (próximo chat)
1. Owner firma las 4 decisiones de 4.1 (registro es-419 vs es-AR, género, glosario, motto).
2. **Fase 0** (fundación + `common` + migrar legal al locale global + pseudo-loc + lint).
3. **Fase 1** (auth + UI/charts en EN) — prueba la tubería de punta a punta.
4. **Fase 2** (core) — el refactor que habilita todo el dominio.
5. Fases 3–4, luego idiomas (Fase 5) empezando por **PT-BR**.
