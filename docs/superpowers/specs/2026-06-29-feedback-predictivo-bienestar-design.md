# Feedback predictivo por racha de bienestar — spec

**Fecha:** 2026-06-29
**Estado:** DISEÑO (aprobado en brainstorming, sin implementar)
**Alcance:** acotado. Nueva señal "si esto sigue, va a pasar X" derivada de rachas del check-in
diario. DOS superficies: atleta (suavizada, sin diagnóstico) y coach (directa, suma carga).
Sin migración (los datos ya están en DB).

---

## 0. Por qué (el gap que cierra)

Hoy la app **no dice en ninguna parte** "si seguís durmiendo poco, va a pasar X" — ni al atleta
ni al coach (auditoría 2026-06-29, 5 agentes). Solo hay: empujones en presente al atleta
(`signalData.ts`, `Titular.tsx`), semáforos de estado **actual** al coach (ACWR/readiness), y la
modulación de carga que el motor aplica **en silencio** (`prilepin.ts` cut ~75/90%). Nada conecta
una conducta/señal **de hoy** con una **consecuencia futura**. Esto agrega esa capa, respetando las
reglas de dominio.

## 1. Decisiones (NO re-litigar)

- **Motor = racha por umbral** (determinístico), NO extrapolación de pendiente ni scoring de riesgo.
  Sin inventar horizontes ni números: cuenta días consecutivos malos. Encaja con la disciplina
  "sin dato → none honesto".
- **Señales del atleta = rachas por-ítem del check-in**: `sueño, estrés, fatiga, dolor, motivación`.
  Por-ítem (no compuesto) para que el copy **nombre el factor** ("3 días durmiendo mal").
- **Señales extra del coach** (coach-only): suma `ACWR` sostenido y `readiness` band / `readinessTrend`
  de `MonitorSeries`. El atleta nunca ve esto (HR-1).
- **Consecuencia al atleta = reversible y sentida**, en el vocabulario de la app ("tu recuperación",
  "tu normal", "el plan se hace más pesado"). **NUNCA** "sobreentrenamiento", "lesión", "readiness",
  "ACWR", "RPE" (HR-1 + sin diagnóstico).
- **Ubicación atleta = bloque "Atención" propio** en Hoy, debajo de "Mi estado de hoy", visible
  **solo** cuando hay racha activa (sin racha, no existe — no es un puntaje permanente).
- **Ubicación coach = chip en la mini-card + línea de rationale en el drill-down**, donde ya vive la
  tendencia ▲/▼.
- **El ciclo menstrual NO entra**: ni dispara ni suprime. Sigue siendo contexto, jamás semáforo.
- **Advisory**: complementa, **no cambia el plan prescrito**. No toca el motor Prilepin ni el semáforo
  `seriesState`.

## 2. La regla de racha (el motor)

Módulo PURO nuevo: `packages/core/src/logic/wellnessStreak.ts`.

**Normalización** (reusa `goodness()` de `wellness.ts`): cada ítem 1–5 se mapea a su valor "bueno"
1–5 invirtiendo los `highBad` (`fatiga`, `dolor`, `estres`). Un día es **malo** para un ítem si
`goodness(val) ≤ 2` (el extremo feo de la carita). Ítems vigilados y su "malo":

| Ítem | highBad | "día malo" (crudo) |
|---|---|---|
| sueño | no | sueño ≤ 2 (dormiste mal) |
| motivación | no | motivación ≤ 2 (pocas ganas) |
| estrés | sí | estrés ≥ 4 (muy estresada) |
| fatiga | sí | fatiga ≥ 4 (agotada) |
| dolor | sí | dolor ≥ 4 (mucho dolor) |

**Conteo**: días **consecutivos** malos en un mismo ítem, contando hacia atrás desde el día con
check-in **más reciente**; la racha debe **incluir** ese día (un patrón que ya terminó no se avisa).
Severidad:

| Severidad | Condición |
|---|---|
| `warn` | 3 días seguidos malos en un ítem |
| `alert` | 5+ días seguidos en un ítem, **o** 2+ ítems en racha (≥3) a la vez |

**Ítem líder** (cuál se muestra cuando hay varios en racha): gana la racha **más larga**; empata por
prioridad fija `dolor > sueño > fatiga > estrés > motivación` (dolor primero por ser el más sensible
a seguridad — deriva al coach). Los demás van en `alsoStreaking`.

**Honestidad de datos**:
- Un día **sin check-in corta la racha** (no se afirma "3 seguidos" con un hueco). La racha se mide
  sobre fechas calendario consecutivas con registro.
- **Guarda de frescura**: si el check-in más reciente es más viejo que 2 días respecto de `today`, no
  se muestra heads-up (evita avisos rancios de quien dejó de registrar).
- <3 días con check-in en la ventana → `null` (sin heads-up), como el "Sin datos aún" del Titular.
- El ciclo menstrual se ignora por completo en el cómputo.

**Salida (hechos estructurados, sin copy)**:

```ts
type WellnessField = "sueno" | "motivacion" | "estres" | "fatiga" | "dolor";
interface StreakHeadsUp {
  item: WellnessField;   // el ítem líder (racha más larga; desempata por severidad de ítem)
  days: number;          // días consecutivos malos
  severity: "warn" | "alert";
  alsoStreaking: WellnessField[]; // otros ítems en racha (para el "2+ ítems")
}
// Atleta:
function wellnessStreak(logs: DayLog[], today: string): StreakHeadsUp | null;
```

La copy (es-419/es-AR/en/pt-BR) vive en la capa web/i18n, keyed por `item` × `severity` — igual que
`Titular.COPY` y los locales. Core devuelve hechos, no texto.

## 3. Superficie del atleta — bloque "Atención"

Componente nuevo `apps/web/src/screens/atleta/hoy/AtencionBlock.tsx`, renderizado en `HomeScreen`
**debajo del `Titular`**, solo si `headsUp != null`. Estructura (vocabulario del Titular, sin puntaje):

> **Atención**
> Llevás **{days} días {frase-factor}**.
> Si sigue, **{consecuencia}**.
> *{acción}*

**Frase-factor** y **consecuencia** por ítem (reversible, sentida, sin diagnóstico):

| Ítem | frase-factor | consecuencia | acción / cierre |
|---|---|---|---|
| sueño | "durmiendo mal" | "vas a notar la recuperación caer y el plan se te va a hacer más pesado" | "Esta semana bajá un cambio y priorizá descanso." |
| estrés | "con la cabeza a full" | "te va a costar concentrarte y sostener la intensidad" | "Buscá bajar revoluciones fuera del gym." |
| fatiga | "muy cansada" | "el cansancio se acumula y vas a rendir por debajo de lo tuyo" | "Date margen: dormir y comer mejor esta semana." |
| dolor | "con molestias" | "forzar sobre una molestia que no cede puede frenarte" | "Contáselo a tu coach antes de cargar fuerte." |
| motivación | "sin ganas" | "las ganas se siguen apagando y te va a costar arrancar las sesiones" | "Aflojá la exigencia un toque; volvé a lo que disfrutás." |

- En `alert` (o `item === "dolor"`) el cierre **deriva al coach**: "Conviene que se lo cuentes a tu
  coach."
- Color/tono: usa la paleta de estado (`STATUS.warn`/`STATUS.alert`) como el Titular.
- Es advisory; no cambia el plan.

## 4. Superficie del coach — chip + drill-down

El coach puede ser directo (HR-1 limita solo al atleta) y suma su carga.

- **Mini-card del plantel** (`AtletaMiniCard.tsx`): chip junto a la flecha de tendencia, ej.
  `⚠ Sueño 4d` / `⚠ Riesgo sobrecarga` (color por severidad).
- **Drill-down**: línea de rationale que combina check-in + carga, ej.:
  *"Sueño bajo 4 días seguidos + ACWR 1,4 sostenido 2 sem → riesgo de sobrecarga si no descarga."*
  Acá sí aparecen "sobrecarga", "ACWR", "readiness".
- **Señales coach-only que se suman** (de `MonitorSeries`, ya en el roster):
  - `ACWR` sostenido `> 1,3` (≥2 semanas), y/o
  - `readiness` band roja/ámbar o `readinessTrend < 0`.
- Función coach: `coachStreakRisk(logs, series, week): CoachRisk | null` — reusa `wellnessStreak`
  y le agrega el contexto de carga. `CoachRisk` = `StreakHeadsUp` + `{ acwrSustained: boolean;
  readinessBand: ReadinessBand | null; loadNote: "sobrecarga" | "descarga" | null }`. Si solo hay
  racha de check-in (sin carga) igual avisa; si solo hay carga sostenida sin racha, eso ya lo cubre
  el semáforo `seriesState` (no se duplica).

## 5. Arquitectura y flujo de datos

```
packages/core/src/logic/wellnessStreak.ts   ← PURO, testeable
   ├─ wellnessStreak(logs, today)            → StreakHeadsUp | null   (atleta)
   └─ coachStreakRisk(logs, series, week)    → CoachRisk | null       (coach: + ACWR/readiness)

apps/api
   ├─ repo.getDayLogView → adjunta `headsUp: StreakHeadsUp | null`     (lee DayLog recientes que ya tiene)
   └─ roster.ts          → adjunta `headsUp` por fila del plantel       (DayLog + MonitorSeries)

apps/web
   ├─ atleta: <AtencionBlock> en HomeScreen, bajo <Titular>            (consume DayLogView.headsUp)
   └─ coach:  chip en <AtletaMiniCard> + línea en el drill-down        (consume RosterRow.headsUp)

i18n: claves nuevas en es-419 / es-AR / en / pt-BR.
```

**Por qué el cómputo es server-side** (hallazgo de la investigación): `GET /me/daylog` hoy devuelve
`DayLogView { entry, streak (=constancia), days (=fechas), today }` — el cliente del atleta **no
tiene** los valores diarios por-ítem, solo el de hoy. Los crudos están en `prisma.dayLog`. Igual que
`heatdays`/`dailyView`: el server arma la vista acotada desde fuentes ya delimitadas y manda un
heads-up **redactado** (factor + días + severidad), nunca la serie cruda ni RPE. **Sin migración**:
solo lectura de filas existentes + un campo de shape en cada vista.

## 6. Cumplimiento de reglas de dominio

| Regla | Cómo se respeta |
|---|---|
| HR-1 (readiness/sobreentrenamiento no va al atleta) | Atleta ve solo su check-in + consecuencia sentida; jamás readiness/ACWR/sobreentrenamiento |
| Sin RPE en ninguna superficie | El motor no toca `series.rpe`; copy sin RPE |
| "No es un puntaje" | Heads-up de patrón; aparece solo si activo, desaparece solo |
| Ciclo = contexto, nunca semáforo | El motor ignora el ciclo por completo |
| Advisory, no cambia el plan | No toca Prilepin ni `seriesState`; es display |

## 7. Testing

- **Core** (`wellnessStreak.test.ts`, AAA): detección por ítem; hueco corta racha; borde exacto
  (2 días → null, 3 → warn); escalado a `alert` (5+ días y 2+ ítems); inversión `highBad`
  (estrés/fatiga/dolor altos = malo; sueño/motivación bajos = malo); <3 logs → null; ciclo ignorado.
  `coachStreakRisk`: suma ACWR/readiness; racha sola sin carga igual avisa.
- **Web**: `AtencionBlock` (cada ítem × severidad; derivación al coach en alert/dolor; oculto si
  null); chip del coach en `AtletaMiniCard`.
- **i18n**: claves presentes en los 4 locales.

## 8. Fuera de alcance (YAGNI / futuro)

- `humor` como 6º ítem (trivial de sumar después).
- Extrapolación de tendencia / horizonte temporal ("en ~X días").
- Notificaciones/push (no hay infra hoy).
- Persistir/historizar los avisos (hoy se derivan en vivo, sin estado).
