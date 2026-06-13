import type { MacrocycleFamily, SchoolDNA } from "../types";

/** ADN de las 10 escuelas del catálogo (slice entrenamientos-distintivos 2026-06-11).
 *
 *  Cada familia descrita como DATOS: repertorio firmado, prohibiciones, arquetipos de sesión
 *  por rol de fase, presupuesto SNC y carácter de dosis. El generador (logic/recipeGen.ts)
 *  convierte esto en MacroRecipe — determinístico, auditable, jamás random (D10).
 *
 *  La investigación está citada en `sources` de cada ADN y espejada en el rulebook §Escuelas.
 *  Afirmaciones sin fuente sólida quedan marcadas "criterio del coach" — curaduría del owner.
 *  Los pesos (weight) son preferencia de rotación, no ciencia: calibrables por el coach. */
export const SCHOOL_DNA: SchoolDNA[] = [
  // ── BÚLGARO — Abadjiev: especificidad absoluta ───────────────────────────────
  {
    family: "Búlgaro",
    character: "Sólo los lifts de competencia y sentadillas, a singles pesados, todos los días. Cero variedad: la adaptación ES la especificidad.",
    repertoire: {
      olimpico: [{ id: "arranque", weight: 3 }, { id: "cargada-envion", weight: 3 }],
      rodilla: [{ id: "sentadilla-frente", weight: 3 }, { id: "sentadilla", weight: 2 }],
    },
    // Abadjiev eliminó tirones, presses y accesorios: "el levantamiento ES el ejercicio".
    forbidden: [
      "tiron-arranque", "tiron-cargada", "sentadilla-overhead", "press-empuje", "press-hombros",
      "peso-muerto-rumano", "buenos-dias", "remo", "remo-menton", "press-banca", "hiperextension",
      "salto-cajon", "snatch-balance", "jerk-dip", "sots-press",
    ],
    archetypes: {
      // Día de arranque / día de envión, alternados — la pareja de competencia completa
      // garantizada por diseño (focus), como entrenaba la selección de Abadjiev.
      peaking: [
        { key: "A", slots: ["olimpico", "rodilla"], focus: "arranque" },
        { key: "B", slots: ["olimpico", "rodilla"], focus: "envion" },
      ],
    },
    sessionsPerDay: 2, // bi-diario REAL (AM arranque / PM envión) — D14 saldado (spec 2026-06-12)
    tecnicosMax: 3,
    // claves no-peaking exigidas por Record<PhaseRole, number>: el búlgaro no tiene fases
    // de otro rol en el catálogo — valores espejo del peaking por si un macro futuro las usa.
    sncBudget: { base: 30, fuerza: 30, intensidad: 30, peaking: 30, descarga: 22 },
    dosage: { mainBias: "high", setsBias: 1, singlesPhases: ["base", "fuerza", "intensidad", "peaking", "descarga"] },
    sources: ["Sistema de Ivan Abadjiev — daily max de la selección búlgara (1970–1989)"],
  },

  // ── RUSO — Medvedev/Roman: waviness y GPP ancha ──────────────────────────────
  {
    family: "Ruso",
    character: "Ondulación de volumen sobre una base general ancha: tirones 90–110%, mucha sentadilla, complejos en la base y peaking clásico.",
    repertoire: {
      // pesos hacia las bases de la receta CURADA (es el benchmark de regresión del modelo, D4)
      olimpico: [
        { id: "arranque", weight: 4 }, { id: "cargada-envion", weight: 3 }, { id: "cargada", weight: 2 },
        { id: "arranque.potencia", weight: 1 }, { id: "cargada.potencia", weight: 1 }, { id: "envion.tijera", weight: 1 },
      ],
      tiron: [{ id: "tiron-arranque", weight: 3 }, { id: "tiron-cargada", weight: 3 }, { id: "tiron-arranque.bloques.rodilla", weight: 1 }],
      rodilla: [{ id: "sentadilla", weight: 3 }, { id: "sentadilla-frente", weight: 3 }, { id: "sentadilla-overhead", weight: 1 }],
      bisagra: [{ id: "peso-muerto-rumano", weight: 2 }, { id: "buenos-dias", weight: 1 }],
      empuje: [{ id: "press-empuje", weight: 2 }, { id: "press-hombros", weight: 1 }],
      complejo: [{ id: "cx.tiron-arranque+arranque", weight: 2 }, { id: "cx.cargada+frontal+2t", weight: 1 }],
    },
    forbidden: [],
    archetypes: {
      // focus alternado arranque/envión (espejo de las 5 sesiones de la receta curada);
      // C y E mixtos: el complejo y el día doble-técnico rotan libres.
      base: [
        { key: "A", slots: ["olimpico", "tiron", "rodilla"], focus: "arranque" },
        { key: "B", slots: ["olimpico", "rodilla", "bisagra"], optionalFrom: 2, focus: "envion" },
        { key: "C", slots: ["complejo", "tiron", "empuje"], optionalFrom: 2 },
        { key: "D", slots: ["olimpico", "rodilla", "empuje"], optionalFrom: 2, focus: "arranque" },
        { key: "E", slots: ["olimpico", "olimpico", "bisagra"], optionalFrom: 2, focus: "envion" },
      ],
      fuerza: [
        { key: "A", slots: ["olimpico", "tiron", "rodilla"], focus: "arranque" },
        { key: "B", slots: ["olimpico", "rodilla", "bisagra"], optionalFrom: 2, focus: "envion" },
        { key: "C", slots: ["olimpico", "tiron", "empuje"], optionalFrom: 2, focus: "arranque" },
        { key: "D", slots: ["olimpico", "rodilla", "rodilla"], focus: "envion" },
        { key: "E", slots: ["olimpico", "olimpico", "bisagra"], optionalFrom: 2 },
      ],
      intensidad: [
        { key: "A", slots: ["olimpico", "tiron", "rodilla"], focus: "arranque" },
        { key: "B", slots: ["olimpico", "rodilla"], focus: "envion" },
        { key: "C", slots: ["olimpico", "tiron"], focus: "arranque" },
        { key: "D", slots: ["olimpico", "rodilla", "empuje"], optionalFrom: 2, focus: "envion" },
        { key: "E", slots: ["olimpico", "olimpico"] },
      ],
      peaking: [
        { key: "A", slots: ["olimpico", "rodilla"], focus: "arranque" },
        { key: "B", slots: ["olimpico"], focus: "envion" },
        { key: "C", slots: ["olimpico", "tiron"], focus: "arranque" },
        { key: "D", slots: ["olimpico", "rodilla"], focus: "envion" },
        { key: "E", slots: ["olimpico"] },
      ],
    },
    sessionsPerDay: 1,
    tecnicosMax: 2,
    sncBudget: { base: 26, fuerza: 26, intensidad: 24, peaking: 22, descarga: 18 },
    dosage: { mainBias: "mid", setsBias: 0, singlesPhases: ["peaking"] },
    sources: [
      "A.S. Medvedev — A System of Multi-Year Training in Weightlifting (1986)",
      "R.A. Roman — The Training of the Weightlifter",
      "A.S. Prilepin — tablas de reps óptimas por zona de intensidad",
    ],
  },

  // ── CHINO — técnica×fuerza + culturismo funcional ────────────────────────────
  {
    family: "Chino",
    character: "Híbrido técnica-fuerza squat-dominante: potencias y segmentos, snatch balance y sots, y TODA sesión cierra con bloque de culturismo funcional.",
    repertoire: {
      olimpico: [
        { id: "arranque.potencia", weight: 2 }, { id: "cargada.potencia", weight: 2 },
        { id: "arranque", weight: 2 }, { id: "cargada", weight: 2 }, { id: "snatch-balance", weight: 2 },
        { id: "arranque.bloques.rodilla", weight: 1 }, { id: "cargada.bloques.rodilla", weight: 1 },
        { id: "cargada-envion", weight: 1 }, // el gesto completo — el pico lo exige (especificidad)
      ],
      tiron: [
        { id: "tiron-arranque.bloques.rodilla", weight: 2 }, { id: "tiron-cargada.bloques.rodilla", weight: 2 },
        { id: "tiron-arranque", weight: 2 }, { id: "tiron-cargada", weight: 2 },
      ],
      rodilla: [{ id: "sentadilla-frente", weight: 3 }, { id: "sentadilla", weight: 3 }],
      empuje: [{ id: "press-empuje", weight: 2 }, { id: "sots-press", weight: 2 }, { id: "jerk-dip", weight: 1 }],
      bisagra: [{ id: "peso-muerto-rumano", weight: 2 }],
      metabolico: [{ id: "remo", weight: 2 }, { id: "remo-menton", weight: 2 }, { id: "press-hombros", weight: 1 }],
      complejo: [{ id: "cx.arranque+ohs", weight: 2 }, { id: "cx.cargada-potencia+frontal", weight: 2 }],
    },
    forbidden: [],
    archetypes: {
      base: [
        { key: "A", slots: ["olimpico", "rodilla", "metabolico"], focus: "arranque" },
        { key: "B", slots: ["olimpico", "tiron", "metabolico"], focus: "envion" },
        { key: "C", slots: ["complejo", "rodilla", "metabolico"] },
        { key: "D", slots: ["olimpico", "empuje", "metabolico"], focus: "arranque" },
        { key: "E", slots: ["tiron", "rodilla", "metabolico"] },
      ],
      intensidad: [
        { key: "A", slots: ["olimpico", "rodilla", "metabolico"], focus: "arranque" },
        { key: "B", slots: ["olimpico", "tiron", "metabolico"], focus: "envion" },
        { key: "C", slots: ["olimpico", "rodilla", "metabolico"], focus: "envion" },
        { key: "D", slots: ["olimpico", "tiron", "metabolico"], focus: "arranque" },
        { key: "E", slots: ["tiron", "rodilla", "metabolico"] },
      ],
      peaking: [
        { key: "A", slots: ["olimpico", "rodilla", "metabolico"], focus: "arranque" },
        { key: "B", slots: ["olimpico", "tiron", "metabolico"], focus: "envion" },
        { key: "C", slots: ["olimpico", "metabolico"], focus: "arranque" },
        { key: "D", slots: ["olimpico", "rodilla", "metabolico"], focus: "envion" },
        { key: "E", slots: ["olimpico", "metabolico"] },
      ],
      descarga: [
        { key: "A", slots: ["olimpico", "metabolico"], focus: "arranque" },
        { key: "B", slots: ["rodilla", "metabolico"] },
        { key: "C", slots: ["empuje", "metabolico"] },
        { key: "D", slots: ["olimpico", "metabolico"], focus: "envion" },
        { key: "E", slots: ["olimpico", "metabolico"] },
      ],
    },
    sessionsPerDay: 1,
    tecnicosMax: 2,
    sncBudget: { base: 28, fuerza: 28, intensidad: 26, peaking: 24, descarga: 20 },
    dosage: { mainBias: "mid", setsBias: 0, singlesPhases: ["peaking"] },
    sources: [
      "Sistema chino moderno — hibridación técnica×fuerza (Cao Wenyuan; análisis Ma-strength)",
      "Kim Goss — The Chinese Weightlifting System (análisis occidental del bloque accesorio)",
    ],
  },

  // ── CUBANO — velocidad por complejos, calidad sobre cantidad ─────────────────
  {
    family: "Cubano",
    character: "Velocidad-fuerza por complejos y variantes de potencia/colgado, a porcentajes moderados y calidad máxima por serie.",
    repertoire: {
      olimpico: [
        { id: "arranque.potencia", weight: 2 }, { id: "cargada.potencia", weight: 2 },
        { id: "arranque", weight: 2 }, { id: "cargada", weight: 2 },
        { id: "arranque.colgado.rodilla", weight: 1 }, { id: "cargada.colgado.rodilla", weight: 1 },
        { id: "cargada-envion", weight: 1 }, // el gesto completo — el pico lo exige (especificidad)
      ],
      complejo: [
        { id: "cx.arranque-potencia+arranque", weight: 3 }, { id: "cx.tiron-cargada+cargada", weight: 2 },
        { id: "cx.arranque-colgado+arranque", weight: 2 }, { id: "cx.press-empuje+2t", weight: 1 },
      ],
      tiron: [{ id: "tiron-arranque", weight: 2 }, { id: "tiron-cargada", weight: 2 }],
      rodilla: [{ id: "sentadilla", weight: 3 }, { id: "sentadilla-frente", weight: 2 }],
      empuje: [{ id: "press-empuje", weight: 2 }, { id: "press-hombros", weight: 1 }],
      bisagra: [{ id: "peso-muerto-rumano", weight: 2 }, { id: "buenos-dias", weight: 1 }],
    },
    forbidden: [],
    archetypes: {
      // A/B con focus opuesto: hasta el novicio de 2 días entrena AMBOS lifts cada semana.
      base: [
        { key: "A", slots: ["complejo", "rodilla"], focus: "arranque" },
        { key: "B", slots: ["olimpico", "tiron", "empuje"], optionalFrom: 2, focus: "envion" },
        { key: "C", slots: ["olimpico", "rodilla", "bisagra"], optionalFrom: 2, focus: "arranque" },
        { key: "D", slots: ["complejo", "rodilla", "empuje"], optionalFrom: 2, focus: "envion" },
        { key: "E", slots: ["olimpico", "tiron", "rodilla"] },
      ],
      fuerza: [
        { key: "A", slots: ["complejo", "rodilla"], focus: "arranque" },
        { key: "B", slots: ["olimpico", "tiron", "empuje"], optionalFrom: 2, focus: "envion" },
        { key: "C", slots: ["olimpico", "rodilla", "bisagra"], optionalFrom: 2, focus: "arranque" },
        { key: "D", slots: ["olimpico", "tiron", "rodilla"], focus: "envion" },
        { key: "E", slots: ["complejo", "empuje"] },
      ],
      intensidad: [
        { key: "A", slots: ["olimpico", "tiron", "rodilla"], focus: "arranque" },
        { key: "B", slots: ["olimpico", "rodilla"], focus: "envion" },
        { key: "C", slots: ["olimpico", "tiron", "empuje"], optionalFrom: 2, focus: "arranque" },
        { key: "D", slots: ["olimpico", "rodilla", "bisagra"], optionalFrom: 2, focus: "envion" },
        { key: "E", slots: ["olimpico", "rodilla"] },
      ],
      peaking: [
        { key: "A", slots: ["olimpico", "rodilla"], focus: "arranque" },
        { key: "B", slots: ["olimpico"], focus: "envion" },
        { key: "C", slots: ["olimpico", "rodilla"], focus: "arranque" },
        { key: "D", slots: ["olimpico", "tiron"], focus: "envion" },
        { key: "E", slots: ["olimpico"] },
      ],
    },
    sessionsPerDay: 1,
    tecnicosMax: 2,
    sncBudget: { base: 26, fuerza: 26, intensidad: 24, peaking: 22, descarga: 18 },
    dosage: { mainBias: "low", setsBias: 0, singlesPhases: ["peaking"] },
    sources: ["Escuela cubana de halterofilia — manuales de la Federación Cubana (complejos de velocidad, tradición LATAM)"],
  },

  // ── COLOMBIANO — Urrutia: prioridad C&J + piernas extremas ───────────────────
  {
    family: "Colombiano",
    character: "Prioridad absoluta al envión con volumen extremo de piernas (frontal dominante); en realización las piernas van a cero y queda el gesto.",
    repertoire: {
      olimpico: [
        { id: "cargada-envion", weight: 4 }, { id: "envion.tijera", weight: 2 }, { id: "cargada", weight: 2 },
        { id: "arranque", weight: 2 }, { id: "arranque.potencia", weight: 1 },
      ],
      rodilla: [{ id: "sentadilla-frente", weight: 4 }, { id: "sentadilla", weight: 3 }],
      tiron: [{ id: "tiron-cargada", weight: 3 }, { id: "tiron-arranque", weight: 2 }],
      empuje: [{ id: "jerk-dip", weight: 2 }, { id: "press-empuje", weight: 2 }],
      bisagra: [{ id: "peso-muerto-rumano", weight: 2 }, { id: "buenos-dias", weight: 1 }],
    },
    forbidden: [],
    archetypes: {
      // Prioridad C&J (Urrutia): el focus envión domina 3:2 — pero el arranque JAMÁS desaparece.
      base: [
        { key: "A", slots: ["olimpico", "rodilla", "rodilla"], focus: "envion" },
        { key: "B", slots: ["olimpico", "tiron", "rodilla"], focus: "arranque" },
        { key: "C", slots: ["olimpico", "rodilla", "bisagra"], focus: "envion" },
        { key: "D", slots: ["olimpico", "empuje", "rodilla"], focus: "envion" },
        { key: "E", slots: ["tiron", "rodilla", "rodilla"] },
      ],
      fuerza: [
        { key: "A", slots: ["olimpico", "rodilla", "rodilla"], focus: "envion" },
        { key: "B", slots: ["olimpico", "tiron", "rodilla"], focus: "arranque" },
        { key: "C", slots: ["olimpico", "empuje", "rodilla"], focus: "envion" },
        { key: "D", slots: ["olimpico", "rodilla", "bisagra"], focus: "envion" },
        { key: "E", slots: ["olimpico", "tiron", "rodilla"], focus: "arranque" },
      ],
      // Realización Urrutia: "piernas a cero" — el gesto queda solo.
      peaking: [
        { key: "A", slots: ["olimpico"], focus: "envion" },
        { key: "B", slots: ["olimpico", "empuje"], focus: "envion" },
        { key: "C", slots: ["olimpico"], focus: "arranque" },
        { key: "D", slots: ["olimpico", "tiron"], focus: "envion" },
        { key: "E", slots: ["olimpico"], focus: "arranque" },
      ],
    },
    sessionsPerDay: 1,
    tecnicosMax: 2,
    sncBudget: { base: 26, fuerza: 26, intensidad: 24, peaking: 22, descarga: 18 },
    dosage: { mainBias: "mid", setsBias: 1, singlesPhases: ["peaking"] },
    sources: ["Método Urrutia — escuela colombiana (prioridad C&J + volumen extremo de piernas; fuente del catálogo)"],
  },

  // ── COREANO — fuerza posicional: tirones y posiciones ────────────────────────
  {
    family: "Coreano",
    character: "Estructura rígida con tirones pesados omnipresentes (también desde bloques) y trabajo de posiciones: la fuerza se construye en el tirón.",
    repertoire: {
      olimpico: [
        { id: "arranque", weight: 3 }, { id: "cargada", weight: 3 },
        { id: "envion.tijera", weight: 2 }, { id: "cargada-envion", weight: 1 },
      ],
      tiron: [
        { id: "tiron-arranque", weight: 3 }, { id: "tiron-cargada", weight: 3 },
        { id: "tiron-arranque.bloques.rodilla", weight: 2 }, { id: "tiron-cargada.bloques.rodilla", weight: 2 },
      ],
      rodilla: [{ id: "sentadilla", weight: 3 }, { id: "sentadilla-frente", weight: 2 }, { id: "sentadilla-overhead", weight: 2 }],
      empuje: [{ id: "press-empuje", weight: 2 }, { id: "press-hombros", weight: 2 }],
      bisagra: [{ id: "buenos-dias", weight: 2 }, { id: "peso-muerto-rumano", weight: 2 }],
    },
    forbidden: [],
    archetypes: {
      base: [
        { key: "A", slots: ["olimpico", "tiron", "rodilla"], focus: "arranque" },
        { key: "B", slots: ["olimpico", "tiron", "empuje"], focus: "envion" },
        { key: "C", slots: ["olimpico", "rodilla", "tiron"], focus: "arranque" },
        { key: "D", slots: ["olimpico", "tiron", "bisagra"], focus: "envion" },
        { key: "E", slots: ["tiron", "rodilla", "empuje"] },
      ],
      peaking: [
        { key: "A", slots: ["olimpico", "tiron", "rodilla"], focus: "arranque" },
        { key: "B", slots: ["olimpico", "tiron"], focus: "envion" },
        { key: "C", slots: ["olimpico", "rodilla"], focus: "arranque" },
        { key: "D", slots: ["olimpico", "tiron"], focus: "envion" },
        { key: "E", slots: ["olimpico", "rodilla"], focus: "envion" },
      ],
    },
    sessionsPerDay: 1,
    tecnicosMax: 2,
    sncBudget: { base: 26, fuerza: 26, intensidad: 24, peaking: 22, descarga: 18 },
    dosage: { mainBias: "mid", setsBias: 0, singlesPhases: ["peaking"] },
    sources: ["Escuela coreana — fuerza posicional (tirones supra-máximos, pausas y posiciones de transición)"],
  },

  // ── POLACO — singles y series cortas, pulls desde bloques ────────────────────
  {
    family: "Polaco",
    character: "Calidad sobre cantidad en ciclos cortos: singles y dobles a % alto desde temprano, con tirones desde bloques como segundo pilar.",
    repertoire: {
      olimpico: [
        { id: "arranque", weight: 3 }, { id: "cargada", weight: 3 },
        { id: "envion.tijera", weight: 2 }, { id: "cargada-envion", weight: 1 },
      ],
      tiron: [
        { id: "tiron-arranque.bloques.rodilla", weight: 3 }, { id: "tiron-cargada.bloques.rodilla", weight: 3 },
        { id: "tiron-arranque.bloques.alto", weight: 1 }, { id: "tiron-cargada", weight: 1 },
      ],
      rodilla: [{ id: "sentadilla-frente", weight: 3 }, { id: "sentadilla", weight: 2 }],
    },
    forbidden: [],
    archetypes: {
      base: [
        { key: "A", slots: ["olimpico", "tiron", "rodilla"], focus: "arranque" },
        { key: "B", slots: ["olimpico", "olimpico", "tiron"] },
        { key: "C", slots: ["olimpico", "rodilla"], focus: "envion" },
        { key: "D", slots: ["olimpico", "tiron", "rodilla"], focus: "arranque" },
        { key: "E", slots: ["olimpico", "olimpico", "rodilla"] },
      ],
      peaking: [
        { key: "A", slots: ["olimpico", "olimpico"] },
        { key: "B", slots: ["olimpico", "tiron"], focus: "envion" },
        { key: "C", slots: ["olimpico", "rodilla"], focus: "arranque" },
        { key: "D", slots: ["olimpico"], focus: "envion" },
        { key: "E", slots: ["olimpico", "olimpico"] },
      ],
    },
    sessionsPerDay: 1,
    tecnicosMax: 2,
    // base/fuerza 26: el arquetipo doble-técnico (C&J 10 + arranque 9 + pierna 7) debe caber.
    sncBudget: { base: 26, fuerza: 26, intensidad: 24, peaking: 20, descarga: 18 },
    dosage: { mainBias: "high", setsBias: -1, singlesPhases: ["intensidad", "peaking"] },
    sources: ["Escuela polaca — ciclos cortos de choque (singles a % alto, pulls desde bloques)"],
  },

  // ── UCRANIANO — densidad pura ────────────────────────────────────────────────
  {
    family: "Ucraniano",
    character: "Densidad: pocas piezas por sesión, dobles y triples al estilo EMOM, cero accesorios lentos — el descanso es la variable que se entrena.",
    repertoire: {
      olimpico: [
        { id: "arranque", weight: 3 }, { id: "cargada", weight: 3 }, { id: "cargada-envion", weight: 2 },
        { id: "arranque.potencia", weight: 2 }, { id: "cargada.potencia", weight: 2 }, { id: "envion.tijera", weight: 1 },
      ],
      tiron: [{ id: "tiron-arranque", weight: 2 }, { id: "tiron-cargada", weight: 2 }],
      rodilla: [{ id: "sentadilla-frente", weight: 3 }, { id: "sentadilla", weight: 2 }],
    },
    // Densidad pura: los accesorios lentos rompen el reloj.
    forbidden: ["peso-muerto-rumano", "buenos-dias", "remo", "remo-menton", "press-banca", "hiperextension"],
    archetypes: {
      fuerza: [
        { key: "A", slots: ["olimpico", "olimpico", "rodilla"] },
        { key: "B", slots: ["olimpico", "tiron"], focus: "arranque" },
        { key: "C", slots: ["olimpico", "rodilla"], focus: "envion" },
        { key: "D", slots: ["olimpico", "olimpico", "tiron"] },
      ],
      intensidad: [
        { key: "A", slots: ["olimpico", "olimpico"] },
        { key: "B", slots: ["olimpico", "tiron"], focus: "arranque" },
        { key: "C", slots: ["olimpico", "rodilla"], focus: "envion" },
        { key: "D", slots: ["olimpico", "olimpico"] },
      ],
      peaking: [
        { key: "A", slots: ["olimpico", "rodilla"], focus: "envion" },
        { key: "B", slots: ["olimpico"], focus: "arranque" },
        { key: "C", slots: ["olimpico"], focus: "envion" },
        { key: "D", slots: ["olimpico", "tiron"], focus: "arranque" },
      ],
    },
    sessionsPerDay: 1,
    tecnicosMax: 2,
    // base/fuerza 26: el arquetipo doble-técnico (C&J 10 + arranque 9 + frontal 7) debe caber.
    sncBudget: { base: 26, fuerza: 26, intensidad: 24, peaking: 22, descarga: 18 },
    dosage: { mainBias: "mid", setsBias: 0, singlesPhases: ["peaking"] },
    sessionNotes: { olimpico: "Estilo EMOM: una serie al minuto, técnica impecable." },
    sources: ["Adaptación de casa sobre densidad ucraniana (catálogo 2026: EMOM-heavy, alta densidad)"],
  },

  // ── HÍBRIDO — Issurin A/T/R con complejos por eficiencia ─────────────────────
  {
    family: "Híbrido",
    character: "Bloques acumulación→transmutación→realización con compuestos grandes y complejos por eficiencia de tiempo — máximo estímulo por sesión corta.",
    repertoire: {
      olimpico: [
        { id: "cargada-envion", weight: 2 }, { id: "arranque", weight: 2 },
        { id: "arranque.potencia", weight: 2 }, { id: "cargada.potencia", weight: 2 }, { id: "cargada", weight: 1 },
      ],
      complejo: [
        { id: "cx.cargada+frontal+2t", weight: 2 }, { id: "cx.press-empuje+2t", weight: 1 },
        { id: "cx.tiron-arranque+arranque", weight: 1 },
      ],
      tiron: [{ id: "tiron-cargada", weight: 2 }, { id: "tiron-arranque", weight: 2 }],
      rodilla: [{ id: "sentadilla", weight: 3 }, { id: "sentadilla-frente", weight: 2 }],
      empuje: [{ id: "press-empuje", weight: 2 }, { id: "jerk-dip", weight: 1 }],
      bisagra: [{ id: "peso-muerto-rumano", weight: 2 }, { id: "buenos-dias", weight: 1 }],
    },
    forbidden: [],
    archetypes: {
      base: [
        { key: "A", slots: ["complejo", "rodilla"] },
        { key: "B", slots: ["olimpico", "tiron", "rodilla"], focus: "arranque" },
        { key: "C", slots: ["olimpico", "empuje", "bisagra"], focus: "envion" },
        { key: "D", slots: ["complejo", "rodilla", "bisagra"], optionalFrom: 2 },
        { key: "E", slots: ["olimpico", "tiron", "empuje"], optionalFrom: 2, focus: "envion" },
      ],
      fuerza: [
        { key: "A", slots: ["olimpico", "tiron", "rodilla"], focus: "arranque" },
        { key: "B", slots: ["complejo", "rodilla"] },
        { key: "C", slots: ["olimpico", "empuje", "bisagra"], optionalFrom: 2, focus: "envion" },
        { key: "D", slots: ["olimpico", "tiron", "rodilla"], focus: "arranque" },
        { key: "E", slots: ["olimpico", "rodilla", "empuje"], optionalFrom: 2, focus: "envion" },
      ],
      intensidad: [
        { key: "A", slots: ["olimpico", "tiron", "rodilla"], focus: "arranque" },
        { key: "B", slots: ["olimpico", "rodilla"], focus: "envion" },
        { key: "C", slots: ["olimpico", "empuje"], focus: "envion" },
        { key: "D", slots: ["olimpico", "tiron"], focus: "arranque" },
      ],
      peaking: [
        { key: "A", slots: ["olimpico", "rodilla"], focus: "arranque" },
        { key: "B", slots: ["olimpico"], focus: "envion" },
        { key: "C", slots: ["olimpico", "tiron"], focus: "arranque" },
        { key: "D", slots: ["olimpico", "rodilla"], focus: "envion" },
        { key: "E", slots: ["olimpico"] },
      ],
    },
    sessionsPerDay: 1,
    tecnicosMax: 2,
    sncBudget: { base: 26, fuerza: 26, intensidad: 24, peaking: 22, descarga: 18 },
    dosage: { mainBias: "mid", setsBias: 0, singlesPhases: ["peaking"] },
    sources: ["V. Issurin — Block Periodization (acumulación/transmutación/realización)", "Diseño de casa A/T/R (catálogo 2026)"],
  },

  // ── USA — lineal 50:50 fuerza:oly ────────────────────────────────────────────
  {
    family: "USA",
    character: "Lineal americana 50:50 fuerza general : especificidad olímpica — powers dominantes en la base, complejos en el desarrollo, accesorios de espalda siempre.",
    repertoire: {
      olimpico: [
        { id: "arranque.potencia", weight: 3 }, { id: "cargada.potencia", weight: 3 },
        { id: "arranque", weight: 2 }, { id: "cargada", weight: 2 }, { id: "cargada-envion", weight: 2 },
        { id: "envion.tijera", weight: 1 },
      ],
      tiron: [{ id: "tiron-arranque", weight: 2 }, { id: "tiron-cargada", weight: 2 }],
      rodilla: [{ id: "sentadilla", weight: 3 }, { id: "sentadilla-frente", weight: 2 }, { id: "sentadilla-overhead", weight: 1 }],
      empuje: [{ id: "press-empuje", weight: 2 }, { id: "press-hombros", weight: 2 }, { id: "jerk-dip", weight: 1 }],
      bisagra: [{ id: "peso-muerto-rumano", weight: 3 }, { id: "buenos-dias", weight: 1 }],
      complejo: [{ id: "cx.tiron-arranque+arranque", weight: 2 }, { id: "cx.cargada+2t-doble", weight: 1 }],
    },
    forbidden: [],
    archetypes: {
      base: [
        { key: "A", slots: ["olimpico", "rodilla", "empuje"], optionalFrom: 2, focus: "arranque" },
        { key: "B", slots: ["olimpico", "tiron", "bisagra"], optionalFrom: 2, focus: "envion" },
        { key: "C", slots: ["olimpico", "rodilla", "bisagra"], optionalFrom: 2, focus: "arranque" },
        { key: "D", slots: ["olimpico", "empuje", "bisagra"], optionalFrom: 2, focus: "envion" },
        { key: "E", slots: ["olimpico", "rodilla", "empuje"], optionalFrom: 2 },
      ],
      fuerza: [
        { key: "A", slots: ["complejo", "rodilla", "empuje"], optionalFrom: 2 },
        { key: "B", slots: ["olimpico", "tiron", "bisagra"], optionalFrom: 2, focus: "envion" },
        { key: "C", slots: ["olimpico", "rodilla", "empuje"], optionalFrom: 2, focus: "arranque" },
        { key: "D", slots: ["complejo", "tiron", "rodilla"] },
        { key: "E", slots: ["olimpico", "rodilla", "bisagra"], optionalFrom: 2, focus: "envion" },
      ],
      intensidad: [
        { key: "A", slots: ["olimpico", "tiron", "rodilla"], focus: "arranque" },
        { key: "B", slots: ["olimpico", "rodilla", "empuje"], optionalFrom: 2, focus: "envion" },
        { key: "C", slots: ["olimpico", "tiron"], focus: "arranque" },
        { key: "D", slots: ["olimpico", "rodilla"], focus: "envion" },
        { key: "E", slots: ["olimpico", "rodilla", "bisagra"], optionalFrom: 2, focus: "arranque" },
      ],
      peaking: [
        { key: "A", slots: ["olimpico", "rodilla"], focus: "arranque" },
        { key: "B", slots: ["olimpico", "tiron"], focus: "envion" },
        { key: "C", slots: ["olimpico"], focus: "envion" },
        { key: "D", slots: ["olimpico", "rodilla"], focus: "arranque" },
        { key: "E", slots: ["olimpico"], focus: "envion" },
      ],
    },
    sessionsPerDay: 1,
    tecnicosMax: 2,
    sncBudget: { base: 26, fuerza: 26, intensidad: 24, peaking: 22, descarga: 18 },
    dosage: { mainBias: "mid", setsBias: 0, singlesPhases: ["peaking"] },
    sources: [
      "USAW linear periodization / LSUS (Kyle Pierce) — balance 50:50 fuerza general : olímpico",
      "USA_SCHOOL_COMPLETE.md (fuente metodológica del catálogo)",
    ],
  },
];

const BY_FAMILY = new Map<MacrocycleFamily, SchoolDNA>(SCHOOL_DNA.map((d) => [d.family, d]));

export function dnaForFamily(family: MacrocycleFamily): SchoolDNA | undefined {
  return BY_FAMILY.get(family);
}
