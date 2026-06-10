# Spec: Motor de Prescripción — Prilepin interno → sets×reps×% de salida

> Entregable para Claude Code. Transmite a CÓDIGO la prescripción concreta de cada semana según cuántas faltan para la competencia (o la fase de la ola continua). Decisión: **opción C** — Prilepin como motor interno auditable, `sets × reps × %` como salida legible para el atleta. Implementa la lógica que `spec-supercompensacion-peaking.md` dejó a nivel de diagrama. Stack: TypeScript (compartible entre worker Node y frontend). NO es un sistema nuevo: consume el ACWR/sRPE del Stress Engine y las zonas Prilepin ya definidas.

---

## 1. El contrato: qué entra y qué sale

```ts
// ENTRADA
interface PrescriptionInput {
  weeksToComp: number | null;   // null = sin competencia → olas continuas
  currentE1RM: number;          // estimado de 1RM vigente (kg) del perfil carga-velocidad
  recentACWR: number;           // ACWR de 3 semanas del Stress Engine (carga aguda:crónica)
  movement: 'snatch' | 'clean_jerk' | 'pull' | 'squat';
  waveWeek?: number;            // 1-6, posición en la ola si weeksToComp === null
  readiness?: 'green' | 'amber' | 'red';  // semáforo del día (modula la salida)
}

// SALIDA (lo que ve el atleta)
interface WeekPrescription {
  phase: Phase;
  label: string;                // "Intensificación", "Pico", "Taper", etc.
  rationale: string;            // microcopy de supercompensación (por qué esta semana es así)
  sets: PrescribedSet[];        // sets × reps × % EXPLÍCITOS
  prilepinAudit: PrilepinAudit; // el cálculo interno, auditable (para el peek/coach)
}

interface PrescribedSet {
  sets: number;
  reps: number;
  pct: number;                  // % del e1RM
  weightKg: number;             // pct × currentE1RM, redondeado a disco cargable
  intensityZone: '70-80' | '80-90' | '90+';
}

interface PrilepinAudit {
  zone: '70-80' | '80-90' | '90+';
  optimalReps: number;          // de la tabla de Prilepin
  prescribedReps: number;       // total reps prescritas en la zona
  withinRange: boolean;         // ¿cae en el rango Prilepin?
  taperFactor: number;          // multiplicador aplicado por fase/semana
}
```

---

## 2. La tabla de Prilepin (el motor interno)

```ts
// Tabla de Prilepin: reps óptimas y rango por zona de intensidad.
// Fuente: diarios de levantadores soviéticos de élite (heurística observacional, no ECA).
const PRILEPIN = {
  '70-80': { optimal: 18, min: 12, max: 24, repsPerSet: 3 }, // 3-6 reps/set
  '80-90': { optimal: 15, min: 10, max: 20, repsPerSet: 2 }, // 2-4 reps/set
  '90+':   { optimal: 4,  min: 1,  max: 10, repsPerSet: 1 }, // 1-2 reps/set
} as const;

// Para movimientos clásicos (snatch, C&J) se baja el repsPerSet:
// la técnica degrada antes que en sentadilla. Override:
const REPS_PER_SET_CLASSIC = { '70-80': 2, '80-90': 2, '90+': 1 };
```

---

## 3. La regla central: qué % de Prilepin se usa según las semanas que faltan

Esta es la tabla que faltaba transmitir a código. **Cada semana mueve el peso de trabajo de "volumen en zona media" hacia "intensidad en zona alta", y baja el volumen total.** El `taperFactor` reduce las reps totales; la zona dominante sube de intensidad.

```ts
type Phase = 'accumulation' | 'intensification' | 'peak' | 'taper' | 'comp_week' | 'deload';

// Distribución por fase: qué fracción del óptimo de Prilepin se prescribe en cada zona,
// y cuál es la zona dominante. taperFactor escala el volumen total.
const PHASE_PROFILE: Record<Phase, {
  taperFactor: number;          // multiplica el óptimo de Prilepin (1.0 = óptimo pleno)
  zoneMix: Record<'70-80'|'80-90'|'90+', number>; // fracción de reps por zona (suma ~1)
  topPct: number;               // % más alto que se toca esta semana
  label: string;
}> = {
  accumulation:    { taperFactor: 1.00, zoneMix: {'70-80':0.6,'80-90':0.4,'90+':0.0}, topPct: 85, label: 'Acumulación' },
  intensification: { taperFactor: 0.80, zoneMix: {'70-80':0.3,'80-90':0.6,'90+':0.1}, topPct: 90, label: 'Intensificación' },
  peak:            { taperFactor: 0.55, zoneMix: {'70-80':0.1,'80-90':0.5,'90+':0.4}, topPct: 95, label: 'Pico' },
  taper:           { taperFactor: 0.40, zoneMix: {'70-80':0.1,'80-90':0.4,'90+':0.5}, topPct: 100, label: 'Taper' },
  comp_week:       { taperFactor: 0.25, zoneMix: {'70-80':0.0,'80-90':0.3,'90+':0.7}, topPct: 100, label: 'Semana de competencia' },
  deload:          { taperFactor: 0.50, zoneMix: {'70-80':0.8,'80-90':0.2,'90+':0.0}, topPct: 80, label: 'Descarga' },
};
```

> Clave que la spec anterior solo dibujó: **el volumen baja (`taperFactor` 1.00 → 0.25) mientras la intensidad sube (`topPct` 85 → 100)**. Eso es el "menos trabajo, mismo peso" hecho número.

### 3.1 Mapeo de semanas restantes → secuencia de fases

```ts
// Dado weeksToComp, devuelve la fase de CADA semana hasta la competencia.
// Esta es la respuesta a "qué hacemos según cuántas semanas quedan".
function phasePlan(weeksToComp: number): Phase[] {
  if (weeksToComp >= 8) {
    // Peaking completo: acumular hasta dejar 4 semanas, luego afilar.
    const acc = weeksToComp - 4;
    return [
      ...Array(acc).fill('accumulation'),
      'intensification', 'peak', 'taper', 'comp_week',
    ];
  }
  if (weeksToComp >= 6) return ['accumulation','accumulation','intensification','peak','taper','comp_week'].slice(-weeksToComp);
  if (weeksToComp === 5) return ['accumulation','intensification','peak','taper','comp_week'];
  if (weeksToComp === 4) return ['intensification','peak','taper','comp_week'];
  if (weeksToComp === 3) return ['intensification','peak','comp_week'];        // ← el caso de tu pregunta
  if (weeksToComp === 2) return ['peak','comp_week'];
  if (weeksToComp === 1) return ['taper'];                                      // solo afilar, sin margen
  return ['comp_week'];
}
```

**El caso de 3 semanas (tu pregunta explícita), en código:**
- Semana 1 → `intensification` (taperFactor 0.80, top 90%, zona dominante 80-90%): últimos kg de volumen útil.
- Semana 2 → `peak` (taperFactor 0.55, top 95%, zona 90%+ sube a 40%): afinar a peso de competencia.
- Semana 3 → `comp_week` (taperFactor 0.25, top 100%, 70% del trabajo en 90%+): solo singles de apertura, disipar fatiga.

Sin reiniciar nada: el motor lee dónde está el atleta y aplica `phasePlan(3)`.

---

## 4. La función que genera la prescripción (todo junto)

```ts
function generateWeek(input: PrescriptionInput): WeekPrescription {
  // 1. Determinar la fase de esta semana
  const phase: Phase = input.weeksToComp !== null
    ? phasePlan(input.weeksToComp)[0]            // peaking: la fase de la semana actual
    : wavePhase(input.waveWeek ?? 1);            // ola continua: fase según semana 1-6

  const profile = PHASE_PROFILE[phase];

  // 2. AJUSTE HÍBRIDO por carga real reciente (ACWR del Stress Engine)
  let taper = profile.taperFactor;
  if (input.recentACWR > 1.3) taper *= 0.9;      // venía cargado → descargar más
  else if (input.recentACWR < 0.9) taper *= 1.1; // venía liviano → empujar algo más

  // 3. AJUSTE por readiness del día (semáforo, spec de fricción)
  if (input.readiness === 'amber') taper *= 0.9;
  if (input.readiness === 'red')   taper *= 0.75; // y el sistema sugiere mover singles 90%+ a otro día

  // 4. Calcular reps por zona desde Prilepin × taper × zoneMix
  const repsPerSet = input.movement === 'snatch' || input.movement === 'clean_jerk'
    ? REPS_PER_SET_CLASSIC : null;

  const sets: PrescribedSet[] = [];
  const audits: PrilepinAudit[] = [];

  (['70-80','80-90','90+'] as const).forEach(zone => {
    const frac = profile.zoneMix[zone];
    if (frac === 0) return;

    const z = PRILEPIN[zone];
    const targetReps = Math.round(z.optimal * taper * frac);
    if (targetReps < 1) return;

    const rps = repsPerSet?.[zone] ?? z.repsPerSet;
    const numSets = Math.max(1, Math.round(targetReps / rps));
    const pct = pctForZone(zone, profile.topPct); // % concreto dentro de la zona

    sets.push({
      sets: numSets,
      reps: rps,
      pct,
      weightKg: roundToLoadable(pct / 100 * input.currentE1RM),
      intensityZone: zone,
    });

    audits.push({
      zone,
      optimalReps: z.optimal,
      prescribedReps: numSets * rps,
      withinRange: numSets * rps >= z.min && numSets * rps <= z.max,
      taperFactor: taper,
    });
  });

  return {
    phase,
    label: profile.label,
    rationale: rationaleFor(phase),  // microcopy de supercompensación
    sets,
    prilepinAudit: audits[0],        // o el agregado; el peek muestra todas las zonas
  };
}

// % concreto dentro de una zona, escalado hacia topPct en fases de pico/taper
function pctForZone(zone: '70-80'|'80-90'|'90+', topPct: number): number {
  const base = { '70-80': 75, '80-90': 85, '90+': 92 }[zone];
  return Math.min(base, topPct);   // en taper/comp_week, 90+ se acerca a topPct (100)
}

// Redondeo a peso cargable con discos estándar (de tu algoritmo existente de rounding)
function roundToLoadable(kg: number): number {
  return Math.round(kg / 2.5) * 2.5; // simplificado; usar tu algoritmo real de pares de discos
}
```

### 4.1 Ola continua sin competencia (weeksToComp === null)

```ts
function wavePhase(waveWeek: number): Phase {
  // Ola de 6 semanas: acumular→acumular→intensif→intensif→mini-pico→descarga
  return ([
    'accumulation', 'accumulation',
    'intensification', 'intensification',
    'peak',     // mini-pico semana 5 (single/test opcional)
    'deload',   // semana 6
  ] as Phase[])[(waveWeek - 1) % 6];
}
```

---

## 5. Ejemplo de salida concreta (snatch, e1RM 100kg)

**Caso: competencia en 3 semanas, ACWR 1.1 (normal), readiness verde.**

```
SEMANA 1 — Intensificación
"Últimos kg de fuerza útil antes de afilar. Volumen medio, intensidad alta."
  • Snatch 3×2 @80%  (80kg)   zona 80-90
  • Snatch 4×2 @85%  (85kg)   zona 80-90
  • Snatch 2×1 @90%  (90kg)   zona 90+
  [Prilepin: 80-90% → 14 reps (rango 10-20 ✓) · 90+ → 2 reps (rango 1-10 ✓)]

SEMANA 2 — Pico
"Afinamos a peso de competencia. Baja el volumen, sube el peso."
  • Snatch 2×2 @85%  (85kg)
  • Snatch 3×1 @92%  (92kg)
  • Snatch 2×1 @95%  (95kg)
  [Prilepin: 90+ → 5 reps (rango 1-10 ✓), taperFactor 0.55]

SEMANA 3 — Semana de competencia
"Solo aperturas. Disipamos cansancio, llegas afilado el día 21."
  • Snatch 2×1 @90%  (90kg)
  • Snatch 1×1 @95%  (95kg) — opcional según sensaciones
  [Prilepin: 90+ → 3 reps, taperFactor 0.25 · 🏆 día 19-21]
```

Si readiness fuera 🔴 en semana 2, el motor multiplica taper ×0.75 y mueve los singles 90%+ con nota: *"Hoy ámbar/rojo — bajé el volumen y moví el single pesado. Estás en fase de fatiga, no la fuerces."*

---

## 6. Cómo se conecta con las otras specs
- **Auditoría (app viva):** `prilepinAudit` alimenta el peek de cada prescripción → el coach toca un set y ve el cálculo Prilepin completo (zona, rango, taperFactor). El "¿por qué esta semana?" del grafo.
- **Fricción:** la salida son `sets × reps × %` legibles; el motor Prilepin queda oculto salvo que se audite. El atleta ve la planilla, no la matemática.
- **Supercompensación:** `rationale` de cada fase usa el microcopy de las 4 fases (cada descarga se explica, no se impone).
- **Readiness:** el semáforo entra como multiplicador de `taper` en el paso 3 — el ajuste diario fino sobre la estructura semanal.

---

## 7. Criterios de aceptación
- [ ] `phasePlan(n)` devuelve la secuencia correcta de fases para n = 1..12 semanas.
- [ ] Con 3 semanas, genera intensificación → pico → semana de competencia, sin reiniciar el programa.
- [ ] El `taperFactor` baja (1.00→0.25) mientras `topPct` sube (85→100) a medida que se acerca la competencia.
- [ ] El ajuste híbrido por ACWR modifica el volumen (cargado→menos, liviano→más).
- [ ] El semáforo 🟡/🔴 reduce el volumen del día y mueve los singles pesados.
- [ ] Toda prescripción produce un `prilepinAudit` con `withinRange` correcto.
- [ ] Los pesos se redondean a discos cargables reales (usar el algoritmo de rounding existente).
- [ ] Movimientos clásicos (snatch/C&J) usan menos reps/set que sentadilla.
- [ ] Sin competencia, `wavePhase` cicla la ola de 6 semanas indefinidamente.

## 8. Resumen para Claude Code (orden de ejecución)
1. Implementar `PRILEPIN`, `PHASE_PROFILE` y `phasePlan` como configuración pura (testeable).
2. Implementar `generateWeek` con los 4 pasos (fase → ajuste ACWR → ajuste readiness → cálculo Prilepin→sets).
3. Conectar `roundToLoadable` al algoritmo de redondeo por pares de discos ya existente.
4. Exponer `prilepinAudit` al peek de la app viva para el "¿por qué esta semana?".
5. Tests: los 9 criterios de aceptación, con foco en `phasePlan(3)` y la inversión volumen↓/intensidad↑.
