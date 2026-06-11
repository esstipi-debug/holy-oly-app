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
      peaking: [
        { key: "A", slots: ["olimpico", "rodilla"] },
        { key: "B", slots: ["olimpico", "rodilla"] },
      ],
    },
    sessionsPerDay: 1, // el bi-diario real (AM arranque / PM envión) llega con la UI AM/PM (D14)
    tecnicosMax: 3,
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
      base: [
        { key: "A", slots: ["olimpico", "tiron", "rodilla"] },
        { key: "B", slots: ["olimpico", "rodilla", "bisagra"], optionalFrom: 2 },
        { key: "C", slots: ["complejo", "tiron", "empuje"], optionalFrom: 2 },
        { key: "D", slots: ["olimpico", "rodilla", "empuje"], optionalFrom: 2 },
        { key: "E", slots: ["olimpico", "olimpico", "bisagra"], optionalFrom: 2 },
      ],
      fuerza: [
        { key: "A", slots: ["olimpico", "tiron", "rodilla"] },
        { key: "B", slots: ["olimpico", "rodilla", "bisagra"], optionalFrom: 2 },
        { key: "C", slots: ["olimpico", "tiron", "empuje"], optionalFrom: 2 },
        { key: "D", slots: ["olimpico", "rodilla", "rodilla"] },
        { key: "E", slots: ["olimpico", "olimpico", "bisagra"], optionalFrom: 2 },
      ],
      intensidad: [
        { key: "A", slots: ["olimpico", "tiron", "rodilla"] },
        { key: "B", slots: ["olimpico", "rodilla"] },
        { key: "C", slots: ["olimpico", "tiron"] },
        { key: "D", slots: ["olimpico", "rodilla", "empuje"], optionalFrom: 2 },
        { key: "E", slots: ["olimpico", "olimpico"] },
      ],
      peaking: [
        { key: "A", slots: ["olimpico", "rodilla"] },
        { key: "B", slots: ["olimpico"] },
        { key: "C", slots: ["olimpico", "tiron"] },
        { key: "D", slots: ["olimpico", "rodilla"] },
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
        { key: "A", slots: ["olimpico", "rodilla", "metabolico"] },
        { key: "B", slots: ["olimpico", "tiron", "metabolico"] },
        { key: "C", slots: ["complejo", "rodilla", "metabolico"] },
        { key: "D", slots: ["olimpico", "empuje", "metabolico"] },
        { key: "E", slots: ["tiron", "rodilla", "metabolico"] },
      ],
      intensidad: [
        { key: "A", slots: ["olimpico", "rodilla", "metabolico"] },
        { key: "B", slots: ["olimpico", "tiron", "metabolico"] },
        { key: "C", slots: ["olimpico", "rodilla", "metabolico"] },
        { key: "D", slots: ["olimpico", "tiron", "metabolico"] },
        { key: "E", slots: ["tiron", "rodilla", "metabolico"] },
      ],
      peaking: [
        { key: "A", slots: ["olimpico", "rodilla", "metabolico"] },
        { key: "B", slots: ["olimpico", "tiron", "metabolico"] },
        { key: "C", slots: ["olimpico", "metabolico"] },
        { key: "D", slots: ["olimpico", "rodilla", "metabolico"] },
        { key: "E", slots: ["olimpico", "metabolico"] },
      ],
      descarga: [
        { key: "A", slots: ["olimpico", "metabolico"] },
        { key: "B", slots: ["rodilla", "metabolico"] },
        { key: "C", slots: ["empuje", "metabolico"] },
        { key: "D", slots: ["olimpico", "metabolico"] },
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
      base: [
        { key: "A", slots: ["complejo", "rodilla"] },
        { key: "B", slots: ["olimpico", "tiron", "empuje"], optionalFrom: 2 },
        { key: "C", slots: ["olimpico", "rodilla", "bisagra"], optionalFrom: 2 },
        { key: "D", slots: ["complejo", "rodilla", "empuje"], optionalFrom: 2 },
        { key: "E", slots: ["olimpico", "tiron", "rodilla"] },
      ],
      fuerza: [
        { key: "A", slots: ["complejo", "rodilla"] },
        { key: "B", slots: ["olimpico", "tiron", "empuje"], optionalFrom: 2 },
        { key: "C", slots: ["olimpico", "rodilla", "bisagra"], optionalFrom: 2 },
        { key: "D", slots: ["olimpico", "tiron", "rodilla"] },
        { key: "E", slots: ["complejo", "empuje"] },
      ],
      intensidad: [
        { key: "A", slots: ["olimpico", "tiron", "rodilla"] },
        { key: "B", slots: ["olimpico", "rodilla"] },
        { key: "C", slots: ["olimpico", "tiron", "empuje"], optionalFrom: 2 },
        { key: "D", slots: ["olimpico", "rodilla", "bisagra"], optionalFrom: 2 },
        { key: "E", slots: ["olimpico", "rodilla"] },
      ],
      peaking: [
        { key: "A", slots: ["olimpico", "rodilla"] },
        { key: "B", slots: ["olimpico"] },
        { key: "C", slots: ["olimpico", "rodilla"] },
        { key: "D", slots: ["olimpico", "tiron"] },
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
      base: [
        { key: "A", slots: ["olimpico", "rodilla", "rodilla"] },
        { key: "B", slots: ["olimpico", "tiron", "rodilla"] },
        { key: "C", slots: ["olimpico", "rodilla", "bisagra"] },
        { key: "D", slots: ["olimpico", "empuje", "rodilla"] },
        { key: "E", slots: ["tiron", "rodilla", "rodilla"] },
      ],
      fuerza: [
        { key: "A", slots: ["olimpico", "rodilla", "rodilla"] },
        { key: "B", slots: ["olimpico", "tiron", "rodilla"] },
        { key: "C", slots: ["olimpico", "empuje", "rodilla"] },
        { key: "D", slots: ["olimpico", "rodilla", "bisagra"] },
        { key: "E", slots: ["olimpico", "tiron", "rodilla"] },
      ],
      // Realización Urrutia: "piernas a cero" — el gesto queda solo.
      peaking: [
        { key: "A", slots: ["olimpico"] },
        { key: "B", slots: ["olimpico", "empuje"] },
        { key: "C", slots: ["olimpico"] },
        { key: "D", slots: ["olimpico", "tiron"] },
        { key: "E", slots: ["olimpico"] },
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
        { key: "A", slots: ["olimpico", "tiron", "rodilla"] },
        { key: "B", slots: ["olimpico", "tiron", "empuje"] },
        { key: "C", slots: ["olimpico", "rodilla", "tiron"] },
        { key: "D", slots: ["olimpico", "tiron", "bisagra"] },
        { key: "E", slots: ["tiron", "rodilla", "empuje"] },
      ],
      peaking: [
        { key: "A", slots: ["olimpico", "tiron", "rodilla"] },
        { key: "B", slots: ["olimpico", "tiron"] },
        { key: "C", slots: ["olimpico", "rodilla"] },
        { key: "D", slots: ["olimpico", "tiron"] },
        { key: "E", slots: ["olimpico", "rodilla"] },
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
        { key: "A", slots: ["olimpico", "tiron", "rodilla"] },
        { key: "B", slots: ["olimpico", "olimpico", "tiron"] },
        { key: "C", slots: ["olimpico", "rodilla"] },
        { key: "D", slots: ["olimpico", "tiron", "rodilla"] },
        { key: "E", slots: ["olimpico", "olimpico", "rodilla"] },
      ],
      peaking: [
        { key: "A", slots: ["olimpico", "olimpico"] },
        { key: "B", slots: ["olimpico", "tiron"] },
        { key: "C", slots: ["olimpico", "rodilla"] },
        { key: "D", slots: ["olimpico"] },
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
        { key: "B", slots: ["olimpico", "tiron"] },
        { key: "C", slots: ["olimpico", "rodilla"] },
        { key: "D", slots: ["olimpico", "olimpico", "tiron"] },
      ],
      intensidad: [
        { key: "A", slots: ["olimpico", "olimpico"] },
        { key: "B", slots: ["olimpico", "tiron"] },
        { key: "C", slots: ["olimpico", "rodilla"] },
        { key: "D", slots: ["olimpico", "olimpico"] },
      ],
      peaking: [
        { key: "A", slots: ["olimpico", "rodilla"] },
        { key: "B", slots: ["olimpico"] },
        { key: "C", slots: ["olimpico"] },
        { key: "D", slots: ["olimpico", "tiron"] },
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
        { key: "B", slots: ["olimpico", "tiron", "rodilla"] },
        { key: "C", slots: ["olimpico", "empuje", "bisagra"] },
        { key: "D", slots: ["complejo", "rodilla", "bisagra"], optionalFrom: 2 },
        { key: "E", slots: ["olimpico", "tiron", "empuje"], optionalFrom: 2 },
      ],
      fuerza: [
        { key: "A", slots: ["olimpico", "tiron", "rodilla"] },
        { key: "B", slots: ["complejo", "rodilla"] },
        { key: "C", slots: ["olimpico", "empuje", "bisagra"], optionalFrom: 2 },
        { key: "D", slots: ["olimpico", "tiron", "rodilla"] },
        { key: "E", slots: ["olimpico", "rodilla", "empuje"], optionalFrom: 2 },
      ],
      intensidad: [
        { key: "A", slots: ["olimpico", "tiron", "rodilla"] },
        { key: "B", slots: ["olimpico", "rodilla"] },
        { key: "C", slots: ["olimpico", "empuje"] },
        { key: "D", slots: ["olimpico", "tiron"] },
      ],
      peaking: [
        { key: "A", slots: ["olimpico", "rodilla"] },
        { key: "B", slots: ["olimpico"] },
        { key: "C", slots: ["olimpico", "tiron"] },
        { key: "D", slots: ["olimpico", "rodilla"] },
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
        { key: "A", slots: ["olimpico", "rodilla", "empuje"], optionalFrom: 2 },
        { key: "B", slots: ["olimpico", "tiron", "bisagra"], optionalFrom: 2 },
        { key: "C", slots: ["olimpico", "rodilla", "bisagra"], optionalFrom: 2 },
        { key: "D", slots: ["olimpico", "empuje", "bisagra"], optionalFrom: 2 },
        { key: "E", slots: ["olimpico", "rodilla", "empuje"], optionalFrom: 2 },
      ],
      fuerza: [
        { key: "A", slots: ["complejo", "rodilla", "empuje"], optionalFrom: 2 },
        { key: "B", slots: ["olimpico", "tiron", "bisagra"], optionalFrom: 2 },
        { key: "C", slots: ["olimpico", "rodilla", "empuje"], optionalFrom: 2 },
        { key: "D", slots: ["complejo", "tiron", "rodilla"] },
        { key: "E", slots: ["olimpico", "rodilla", "bisagra"], optionalFrom: 2 },
      ],
      intensidad: [
        { key: "A", slots: ["olimpico", "tiron", "rodilla"] },
        { key: "B", slots: ["olimpico", "rodilla", "empuje"], optionalFrom: 2 },
        { key: "C", slots: ["olimpico", "tiron"] },
        { key: "D", slots: ["olimpico", "rodilla"] },
        { key: "E", slots: ["olimpico", "rodilla", "bisagra"], optionalFrom: 2 },
      ],
      peaking: [
        { key: "A", slots: ["olimpico", "rodilla"] },
        { key: "B", slots: ["olimpico", "tiron"] },
        { key: "C", slots: ["olimpico"] },
        { key: "D", slots: ["olimpico", "rodilla"] },
        { key: "E", slots: ["olimpico"] },
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
