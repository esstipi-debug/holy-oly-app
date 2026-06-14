# Glosario de halterofilia — Holy Oly i18n

> **Propósito.** Fuente de verdad para la **transcreación** (no traducción literal) de la
> terminología de halterofilia. Lo consume la Fase 2 (catálogo `domain` por idioma) y el
> review de hablante nativo. La nomenclatura de movimientos es **regional y curada**: "Envión"
> es el Clean & Jerk completo en Chile, no el jerk. Una traducción mecánica rompe el dominio.
>
> **Regla de oro.** Los **IDs son INTOCABLES** (recetas, seeds, actuals históricos y el RM los
> referencian — verdad histórica). i18n agrega **sólo la capa del label visible**; jamás cambia
> un `id`, una key de fase (`hipertrofia`), un `EnginePhase` (`accumulation`) ni una `ReadinessBand`.

---

## 1. Términos a NO traducir (marca + jerga universal)

Quedan **idénticos** en todos los idiomas (se centralizan, no se localizan):

| Término | Por qué |
|---|---|
| **Holy Oly** | nombre de marca |
| **smart training · zero burnout** | motto/branding (marca, no copy) |
| Nombres de skin: **Neon PR**, **Neon Bloom**, **Plates**, **Premium**, **Chalk** | marca |
| **EMOM**, **AMRAP**, **GPP** | jerga de entrenamiento universal (siglas inglesas estándar) |
| **C&J** | abreviatura universal de Clean & Jerk |
| **RM**, **1RM** | "rep máxima" — sigla universal en la comunidad |
| **RPE** | escala universal — **además NO se muestra al atleta** (intocable de producto) |
| **kg**, **%** | unidades; el **kg manda**, el % aproxima (intocable) |
| **Prilepin** | nombre propio (tabla de Prilepin) |
| **ACWR**, **IMR**, **HRV**, **RHR** | siglas de métricas (se explican, no se traducen) |

### Bibliografía de escuelas (`schools.ts` → `sources`) = NOMBRES PROPIOS, no traducir
- *Sistema de Ivan Abadjiev* (búlgaro)
- *Método Urrutia* (colombiano)
- *Escuela cubana de halterofilia — Federación Cubana*
- …y toda cita de `sources`. Sólo se traduce el texto conector circundante ("según", "de la"), no el nombre del sistema/autor/federación.

---

## 2. Registro del español (decisión owner, firmada)

- **es-419** (default global): neutro, **"tú"** / imperativos neutros ("Inicia el entrenamiento").
- **es-AR** (variante, overlay): **voseo** rioplatense, la voz Holy Oly actual ("Iniciá el entrenamiento", "Mové los singles", "tenés", "registrás"). Sólo se almacenan en `es-AR` las claves donde la voz difiere; el resto hereda es-419.
- **Los nombres de movimiento son sustantivos** → es-419 y es-AR son **iguales** (no hay voseo en "Arranque"). El registro sólo afecta **verbos/instrucciones**, no la nomenclatura.

---

## 2b. Portugués (PT-BR) — idioma BASE (decisión owner 2026-06-14)

PT-BR (Brasil) es **idioma base** junto a ES/EN (subió desde Fase 5). Las superficies ya migradas
(common/auth/charts) están en PT-BR; cada fase futura produce PT-BR junto a es-419/en.
- **Registro:** portugués brasileño estándar ("você"). Sin variante pt-PT por ahora.
- **`discos` → `anilhas`** (término de gimnasio BR estándar) — congelar al curar el glosario completo.
- **Nomenclatura de movimientos en PT-BR = Fase 2** (con el builder de dominio): snatch → "arranco",
  C&J → "arremesso", agachamento (sentadilla), etc. Curar con hablante nativo.
- **Métricas:** Recuperación→Recuperação, Bienestar→Bem-estar, Cumplimiento→Adesão/Cumprimento.
- Do-not-translate (§1) y siglas: igual. `useLegalLang` aún mapea pt-BR→prosa ES (legal PT-BR = Fase 5).

---

## 3. Movimientos base (IDs CONGELADOS · `data/movements.ts`)

`ES` = es-419 **y** es-AR (idénticos). `EN` = el `aliasEn` ya presente en el dato. La columna **Transcreación** marca dónde el nombre NO es literal.

| id (CONGELADO) | ES (es-419 / es-AR) | EN | Transcreación / nota |
|---|---|---|---|
| `arranque` | Arranque | Snatch | — |
| `cargada` | Cargada | Clean | el clean aislado suele superar el RM de envión |
| `envion` | **Segundo tiempo** | Jerk | 🟡 CL: el jerk aislado = "segundo tiempo" (NO "envión") |
| `cargada-envion` | **Envión** | Clean & Jerk (C&J) | 🟡 CL: "envión" = el **C&J COMPLETO** (consistente con el RM "Envión") |
| `tiron-arranque` | Tirón de arranque | Snatch pull | — |
| `tiron-cargada` | Tirón de cargada | Clean pull | — |
| `sentadilla` | Sentadilla trasera | Back squat | — |
| `sentadilla-frente` | Sentadilla frontal | Front squat | — |
| `sentadilla-overhead` | Sentadilla de arranque | Overhead squat | ES describe "de arranque", EN es "overhead" |
| `press-empuje` | Press de empuje | Push press | — |
| `press-hombros` | Press militar | Strict (military) press | — |
| `peso-muerto-rumano` | Peso muerto rumano | Romanian deadlift (RDL) | — |
| `buenos-dias` | Buenos días | Good morning | — |
| `remo` | Remo con barra | Barbell row | — |
| `snatch-balance` | Snatch balance | Snatch balance | anglicismo aceptado también en ES |
| `jerk-dip` | Dip de envión | Jerk dip | — |
| `sots-press` | Press Sots | Sots press | nombre propio (Viktor Sots) |
| `remo-menton` | Remo al mentón | Upright row | — |
| `press-banca` | Press banca | Bench press | GPP; sin RM de casa |
| `hiperextension` | Hiperextensión | Back extension | — |
| `salto-cajon` | Salto al cajón | Box jump | — |

🟡 = decisión de nomenclatura curada por el owner; al traducir a PT/IT/FR/DE repetir la **decisión regional**, no traducir el español.

---

## 4. Modificadores (axes + flags) — el nombre COMPUESTO

El display name se arma con la base + modificadores. **El orden gramatical cambia por idioma** → builder por idioma (Fase 2), NO swap de tokens.

| eje / flag | id-token | ES | EN | nota |
|---|---|---|---|---|
| captura | `completo` | completo | full | a menudo implícito |
| captura | `potencia` | de potencia | power | |
| origen | `piso` | desde el piso | from floor | default, suele omitirse |
| origen | `bloques` | desde bloques | from blocks | + altura (`rodilla` → knee) |
| origen | `colgado` | desde colgado | hang | |
| tipoEnvion | `tijera` | a la tijera | split | jerk |
| tipoEnvion | `empuje` | de empuje | push | jerk |
| tipoEnvion | `potencia` | de potencia | power | jerk |
| tipoEnvion | `fuerza` | de fuerza | ⚠ revisar (¿"squat/strict jerk"?) | review nativo |
| flag | `pausa` | con pausa | paused | |
| flag | `deficit` | en déficit | deficit | |
| flag | `tempo` | a tempo | tempo | |
| flag | `sin-recibida` | sin recibida | no-catch / no-receive | ⚠ review nativo |

**Ejemplo del reordenamiento (la trampa #7 del plan):**
- ES: `Arranque de potencia desde colgado` → EN: **`hang power snatch`** (modificadores antes de la base).
- El builder debe producir el orden natural de cada idioma, no concatenar tokens en orden español.

---

## 5. Escuelas (`schools.ts` → `family`)

`family` se traduce (es un adjetivo de nacionalidad). `character` es **léxico de coach** (se traduce en Fase 2, NO se muestra al atleta — §1 lente, intocable). `sources` NO se traduce (§1).

| family (ES) | EN |
|---|---|
| Búlgaro | Bulgarian |
| Ruso | Russian |
| Chino | Chinese |
| Cubano | Cuban |
| Colombiano | Colombian |
| Coreano | Korean |
| *(otras familias del archivo)* | *(adjetivo de nacionalidad EN)* |

---

## 6. Cómo se agrega un idioma (recordatorio)
1. Repetir la **decisión regional** de nomenclatura (no traducir el español): p.ej. en PT-BR ¿"Arremesso" para C&J? → curar con hablante nativo.
2. Modificadores: revisar el **orden gramatical** del idioma (el builder de Fase 2).
3. `sources` y siglas (§1) quedan igual.
4. Review de hablante nativo obligatorio para la voz y los ⚠ marcados.

> Anclas: rulebook `docs/domain/HOLY-OLY-DOMAIN.md` · plan `docs/superpowers/plans/2026-06-13-i18n-multilenguaje.md` · memoria del proyecto (intocables).
