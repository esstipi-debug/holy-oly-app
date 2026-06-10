# Ciclo visible (Capas 1–2) — registro + proyección en el calendario + contexto redactado — diseño

> **Fecha:** 2026-06-10 · **Estado:** aprobado por el owner en conversación (acepta el modelo de
> 3 capas; ordena implementar Capas 1–2 YA; Capa 3 = modulación queda para readiness post-motor).
> **Pilar:** el calendario como columna vertebral — el ciclo menstrual es otra capa periódica sobre él.

## 1. Objetivo

La atleta registra su ciclo (opt-in) y lo VE proyectado sobre su mapa del plan — la colisión
"semana pesada ∩ ventana de peor recuperación esperada" se vuelve visible. El coach recibe sólo el
contrato redactado que ya existe (`{share, inLutealNow, health, reliable}`), ahora con
`inLutealNow` REAL (hoy es un placeholder, `cycle.ts:13`). **Contextualiza, jamás automatiza**
(rulebook §3): nada de esto toca el semáforo, la prescripción ni los kg.

**Decisiones cerradas (conversación owner 2026-06-10):**
- Capa 1 (overlay en SU mapa, atleta-only) + Capa 2 (contexto del día + chip coach) = ESTE slice.
- Capa 3 (proponer −% / capear volumen) = entra como señal del motor de readiness, post-Prilepin. FUERA.
- Paleta neutra (no-estado), atleta dueña del dato, opt-in por elección (no por género),
  amenorrea = derivación sobria.

## 2. Alcance

**Dentro:** migración 17 (`lastPeriodStart` + `cycleLengthDays` cifrados) · `GET/PUT /me/cycle` ·
cómputo de fase puro en core · overlay con dots neutros en `PlanHeatMap` (vista atleta) · línea de
contexto en el desglose del día (atleta) · línea de colisión bajo el mapa · sección «Ciclo» en
Cuenta (registro) · chip redactado en el drill-down del coach · espejo Local completo (demo).

**Fuera:** modulación de cargas (Capa 3) · registro día-a-día de síntomas · predicción avanzada
(ML/longitud variable) · ciclo en el check-in diario · cualquier superficie nueva del coach más
allá del chip.

## 3. Diseño

### 3.1 Datos (migración `17_cycle_fields` — el booking WIP renumera su 15 → 18)

`CycleConsent` (ya cifrado at-rest, mig 12) gana 2 columnas TEXT nullable, cifradas con el MISMO
mecanismo (`encryptAtRest`/`decryptAtRest`, prefijo `enc:v1:`):
- `lastPeriodStart` — ISO `YYYY-MM-DD` del inicio del último período.
- `cycleLengthDays` — duración típica como string numérico (validada 21..45 app-side).

### 3.2 Core puro (`logic/cycle.ts` + tipos + schemas)

Tipos (`types/index.ts`):
```ts
/** La verdad de la atleta (sólo viaja por /me — el coach JAMÁS la recibe). */
export interface CycleData { share: CycleShare; state: CycleState; lastPeriodStart?: string; cycleLengthDays?: number; }
export type CycleMark = "periodo" | "preperiodo";
```

`logic/cycle.ts` (puro, `today`/fechas siempre por parámetro; constantes documentadas v1 —
criterio ajustable, no ciencia inventada):
- `PERIOD_DAYS = 5` · `PRE_DAYS = 5` · `LUTEAL_DAYS = 14` (aprox estándar) · `HORIZON_CYCLES = 3`.
- `cycleDayOf(lastPeriodStart, len, date)` → día 0-based dentro del ciclo, o **null** si
  `date < lastPeriodStart` (no proyectar al pasado) o si `date` queda a más de `HORIZON_CYCLES`
  ciclos (la proyección decae honesta, no se estira infinita).
- `cycleMarkFor(lastPeriodStart, len, date)` → `"periodo"` (días `0..PERIOD_DAYS-1`) |
  `"preperiodo"` (días `len-PRE_DAYS..len-1`) | null.
- `lutealNow(lastPeriodStart, len, today)` → boolean (día ≥ `len-LUTEAL_DAYS`) | **null** sin datos
  o fuera de horizonte.
- **Elegibilidad de proyección: SOLO `state === "regular"`.** `unreliable` → proyectar sería falsa
  precisión (sin-dato honesto: sin marcas, con nota del porqué). `amenorrhea` → sin proyección +
  la derivación sobria existente (`health: "referral"`).

Schemas (`schemas.ts`): `CycleDataSchema` (lectura propia) ·
`PutMeCycleInputSchema = { share: CycleShareSchema, state: CycleStateSchema, lastPeriodStart?: IsoDate, cycleLengthDays?: z.number().int().min(21).max(45) }`
(los campos de fecha son opcionales: puede optar-in y completar después).

### 3.3 API

- `GET /me/cycle` (`requireAthlete`, scope-self): fila descifrada → `CycleData`; sin fila →
  `{ share: "none", state: "regular" }` (default honesto: no optó).
- `PUT /me/cycle` (`requireAthlete`): valida `PutMeCycleInputSchema`, upsert con
  `encryptAtRest` en los 4 campos. **Audit `cycle.write` SIN payload** (jamás datos de salud al
  audit log — sólo el evento).
- `getCycle` (coach, ya existe): `redactCycle` cambia de firma →
  `redactCycle(share, state, lutealNow: boolean | null)`; el caller computa `lutealNow` con core
  **sólo si `share === "full"`** y hay datos válidos; `"min"` → null (contrato vigente); `"full"`
  sin datos → null. El payload del coach sigue siendo EXACTAMENTE `{share, inLutealNow, health, reliable}`.
- `exportAthleteData` (D3): descifra también los 2 campos nuevos (la curva es suya).

### 3.4 Web — data layer

- `MeClient` interface += `getMeCycle(): Promise<CycleData>` + `putMeCycle(input): Promise<void>`
  (singleton + `httpMeClient` + `LocalMeClient`).
- Local: persiste en los MISMOS keys que lee el `LocalRepository` coach-side
  (`KEYS.cycleShare/cycleState` existentes + `KEYS.cycleStart/cycleLen` nuevos) → en el demo, lo
  que registra Kevin se refleja en el chip del coach. `LocalRepository.getCycleContext` computa
  `lutealNow` real con core cuando share = full.
- `SEED_CYCLE` (web): Mara gana `lastPeriodStart`/`cycleLengthDays` de ejemplo (demo visible).
  Seed api (`prisma/seed.ts`): ídem para `mv` (sólo afecta DBs frescas).

### 3.5 Web — atleta

- **Cuenta (`CuentaMin`), sección «Ciclo»** (opt-in por elección): selector de compartir con copy
  honesto de qué ve el coach en cada nivel («No compartir — el coach no ve nada» / «Mínimo — sabe
  que registrás, sin detalle» / «Contexto — además ve si estás en ventana lútea HOY, nunca fecha ni
  fase»); estado (regular / irregular / amenorrea — amenorrea muestra la línea de derivación
  sobria); fecha de inicio del último período + duración típica (21..45). Guardado con error
  visible. Si `state ≠ regular`: nota de por qué no se proyecta.
- **`PlanMapSection`**: carga `getMeCycle()`; con `state regular` + datos + `plan.startDate` →
  computa `Map<"week-day", CycleMark>` mapeando cada celda a su fecha real (`dateOfWeek` + offset).
  Sin `startDate` → sin overlay (sin fechas no hay verdad). **El overlay es SUYO e independiente
  del `share`** (dueña del dato: compartir es hacia el coach, no hacia sí misma).
- **`PlanHeatMap`** prop opcional `cycleMarks?: ReadonlyMap<string, CycleMark>`: dot neutro de 5px
  abajo-centro de la celda — período = sólido, pre-período = hueco (borde). Color neutro derivado
  de `--wl-text` (`color-mix` ~65%) = paleta no-estado en cualquier skin. El `aria-label` de la
  celda suma «· período (proy.)» / «· pre-período (proy.)». El coach NUNCA pasa esta prop.
- **`HeatLegend`** prop `showCycle?: boolean` → leyenda de los dots (sólo atleta).
- **`PlanDayDetail`** prop opcional `contextLine?: string` (muted, neutra). La atleta la pasa
  cuando el día cae en ventana: «Período (proyección según tu registro) — contexto, no regla.» /
  «Pre-período (proyección según tu registro) — contexto, no regla.»
- **Línea de colisión** bajo el mapa (sólo si computable): «Tu semana más pesada (S{n}) cae en tu
  ventana pre-período (proyección).» — semana más pesada = `maxLifts` del heat; ventana = cualquier
  día marcado de esa semana.

### 3.6 Web — coach (Drilldown)

`Promise.all` += `repo.getCycleContext(id)` → una línea compacta NEUTRA (sin colores de estado)
después de los charts:
- share `full` → «Ciclo · compartido — contexto lúteo hoy: sí/no/—» (— = sin datos para computar).
- share `min` → «Ciclo · compartido (mínimo)».
- `undefined` (none/sin fila) → la línea no se muestra.
- `health === "referral"` → sufijo « · derivación sugerida» (sobrio, médico, jamás logro).
- `reliable === false` → sufijo « · registro irregular».

## 4. Privacidad (no-negociables — El Carnicero los valida como CRITICAL)

- Fase, día del ciclo, fechas y duración **JAMÁS llegan al coach** — sólo el booleano lúteo bajo
  `share: "full"`. El wire del coach no cambia de shape.
- Overlay, marcas y copy de ventanas: **sólo superficies de la atleta**.
- Paleta neutra (derivada de texto), nunca la de estado; el semáforo NO se toca.
- Audit del write sin payload. Export D3 completo (su dato crudo). Cifrado at-rest en los 4 campos.
- Opt-in por elección — la sección existe para todas las cuentas de atleta, sin asumir género.

## 5. Casos borde

- Sin plan o sin `startDate` → mapa sin overlay (los demás usos del registro siguen).
- `state` cambia a `unreliable`/`amenorrhea` → el overlay se apaga (sin marcas viejas fantasma).
- Horizonte (>3 ciclos sin actualizar fecha) → overlay se apaga solo; Cuenta sugiere actualizar.
- `lastPeriodStart` futura → Zod la acepta (fecha válida) pero `cycleDayOf` da null hasta llegar
  (no inventa pasado). Duración fuera de 21..45 → 400.
- Demo Local: espejo completo (registrar como Kevin → chip del coach cambia).

## 6. Tests

- **core**: aritmética modular (día 0, fin de ciclo, ciclo 2..3), límites de ventana (día 4/5,
  len−5/len−6), lúteo (límite len−14), horizonte (dentro/fuera), elegibilidad (unreliable/amenorrhea
  → null), fechas pre-inicio → null.
- **api int**: PUT/GET roundtrip · ciphertext en DB (patrón de `cycle-encryption.int.test`) ·
  redacción por share (full real / min null / none undefined) · sin sesión 401 · coach no recibe
  campos crudos · export incluye los campos.
- **web**: Cuenta guarda y refleja · overlay presente con regular+datos y AUSENTE con
  unreliable/sin-startDate · contextLine del día · chip del coach por share + referral ·
  **no-leak: el DOM del drill-down del coach no contiene «período/pre-período/proyección»**.

## 7. Decomposición (para writing-plans)

C1 core → C2 api (mig 17) → C3 web data → C4 Cuenta → C5 overlay+día → C6 chip coach →
C7 verificación+reviews (El Carnicero foco privacidad) → C8 ship (FF, :8765, handoff/memoria).

## 8. Defaults v1 a validar con uso (criterio, no ciencia inventada)

`PERIOD_DAYS=5`, `PRE_DAYS=5`, `LUTEAL_DAYS=14`, `HORIZON_CYCLES=3`, rango 21..45 — todos
constantes nombradas en un solo lugar (`logic/cycle.ts`), ajustables cuando haya feedback real.
