/**
 * Catálogo de macrociclos disponibles para asignar a atletas — NORMALIZADO.
 *
 * Fuente de verdad: este archivo (espejo de frontend/src/data/macrocycles.ts).
 * Normalización §5.3 del documento maestro: se añaden 4 campos a las 24 plantillas
 *   · level      (nivel mínimo recomendado)
 *   · peaks      (pica — ¿termina en pico de competencia?)
 *   · peakWeek   (semanaPico — null si no pica)
 *   · phaseProfile (perfilFases — ancla del semáforo por fase, §8.4)
 *
 * Las fases (semanas, banda de IMR, volumen relativo, foco) están FUNDADAS en la
 * metodología real de cada escuela (MACROCYCLE_GENERATOR_BLUEPRINT.txt + RAW_SOURCES/
 * + USA_SCHOOL_COMPLETE.md), no inventadas.
 *
 * Decisiones aplicadas (acordadas con el coach, 2026-05-30):
 *  1. DURACIÓN: cuando la metodología canónica difería de la duración del catálogo,
 *     se ESCALÓ la estructura de fases a la duración de macrocycles.ts.
 *     · Colombiano: canónico 24 sem → catálogo 12 sem (fases a la mitad).
 *     · Ucraniano: fuente 10 sem (2 fases de 5) → catálogo 12 sem.
 *  2. NIVEL: enum {beginner, intermediate, advanced, elite} (alineado al SQL 017).
 *     El "40+" de USA Master se trata como categoría de edad (queda en name/bestFor),
 *     NO como nivel; su competencia es 'intermediate'.
 *  3. UBICACIÓN: primer archivo real del proyecto en el working dir.
 *
 * imrPct = banda de %1RM esperada en la fase (lo que el monitor compara contra el IMR real).
 * volRel = volumen relativo 0–100 (% del pico de volumen del propio ciclo).
 *
 * NOTA (legacy): el backend macrocycle_engine.py expone 23 programas / 9 escuelas con
 * otra taxonomía. Esta normalización fija los 24/10 del front como verdad; el backend
 * debe converger (migración 017 ya apunta a las 10 escuelas + phases JSONB).
 */

export type MacrocycleLevel = 'beginner' | 'intermediate' | 'advanced' | 'elite';

export interface MacrocyclePhase {
  key: string;                 // 'realizacion'
  name: string;                // 'Realización'
  weeks: [number, number];     // rango inclusivo de semanas dentro del ciclo
  imrPct: [number, number];    // banda de %1RM esperada (§8.4)
  volRel: number;              // volumen relativo 0–100 (% del pico de volumen del ciclo)
  focus: string;               // foco de la fase
}

export interface Macrocycle {
  id: string;
  name: string;
  family: 'Búlgaro' | 'Coreano' | 'Chino' | 'Cubano' | 'Polaco' | 'Ruso' | 'Ucraniano' | 'Colombiano' | 'Híbrido' | 'USA';
  /** Producto al que pertenece. Holy Oly = halterofilia. */
  product: 'holy-oly';
  desc: string;
  frequency: string;       // "5d/sem"
  duration: string;        // "12 semanas"
  intensity: number;       // 1-5
  volume: number;          // 1-5
  color: string;
  bestFor?: string;
  // ── Campos normalizados (§5.3) ──────────────────────────────
  level: MacrocycleLevel;          // nivel mínimo recomendado
  peaks: boolean;                  // pica
  peakWeek: number | null;         // semanaPico (null si no pica)
  phaseProfile: MacrocyclePhase[]; // perfilFases
}

export const MACROCYCLES: Macrocycle[] = [
  // ── BÚLGARO ──────────────────────────────────────────────
  {
    id: 'bulgaro-6d',
    name: 'Búlgaro 6D',
    family: 'Búlgaro',
    product: 'holy-oly',
    desc: 'Daily Max. Especificidad máxima, intensidad extrema, frecuencia alta.',
    frequency: '6d/sem',
    duration: '12 semanas',
    intensity: 5,
    volume: 2,
    color: '#EF4444',
    bestFor: 'Atletas avanzados con SNC adaptado a >90% diario.',
    level: 'elite',
    peaks: false,            // daily-max plano, sin pico planificado (Abadjiev)
    peakWeek: null,
    phaseProfile: [
      // Estructura plana ("flat high"): siempre ≥95%, descarga cada 4ª semana (~70%).
      { key: 'dailymax', name: 'Daily Max', weeks: [1, 12], imrPct: [95, 110], volRel: 95, focus: 'daily max · descarga cada 4ª sem (~70%)' },
    ],
  },

  // ── COREANO ──────────────────────────────────────────────
  {
    id: 'coreano-5d',
    name: 'Coreano 5D',
    family: 'Coreano',
    product: 'holy-oly',
    desc: 'Estructura rígida, fuerza posicional, disciplina. Sesión única.',
    frequency: '5d/sem',
    duration: '12 semanas',
    intensity: 4,
    volume: 4,
    color: '#3B82F6',
    bestFor: 'Énfasis en tirones y posiciones de transición.',
    level: 'intermediate',
    peaks: true,
    peakWeek: 12,
    phaseProfile: [
      { key: 'cimentacion', name: 'Cimentación', weeks: [1, 4], imrPct: [70, 76], volRel: 100, focus: 'hipertrofia · técnica' },
      { key: 'transformacion', name: 'Transformación', weeks: [5, 8], imrPct: [78, 84], volRel: 80, focus: 'fuerza · pulls pesados' },
      { key: 'realizacion', name: 'Realización', weeks: [9, 12], imrPct: [85, 95], volRel: 45, focus: 'peaking · competencia' },
    ],
  },
  {
    id: 'coreano-6d',
    name: 'Coreano 6D',
    family: 'Coreano',
    product: 'holy-oly',
    desc: 'Coreano de alta densidad. Más volumen distribuido en 6 días.',
    frequency: '6d/sem',
    duration: '12 semanas',
    intensity: 4,
    volume: 5,
    color: '#3B82F6',
    bestFor: 'Atletas full-time con buena capacidad de recuperación.',
    level: 'advanced',
    peaks: true,
    peakWeek: 12,
    phaseProfile: [
      { key: 'cimentacion', name: 'Cimentación', weeks: [1, 4], imrPct: [72, 78], volRel: 100, focus: 'hipertrofia · alta densidad' },
      { key: 'transformacion', name: 'Transformación', weeks: [5, 8], imrPct: [80, 86], volRel: 82, focus: 'fuerza · pulls >100%' },
      { key: 'realizacion', name: 'Realización', weeks: [9, 12], imrPct: [86, 96], volRel: 45, focus: 'peaking · competencia' },
    ],
  },

  // ── CHINO ────────────────────────────────────────────────
  {
    id: 'chino-5d',
    name: 'Chino 5D',
    family: 'Chino',
    product: 'holy-oly',
    desc: 'Hibridación fuerza-técnica + culturismo funcional. Pulls y squats.',
    frequency: '5d/sem',
    duration: '4 semanas',
    intensity: 4,
    volume: 4,
    color: '#F59E0B',
    bestFor: 'Corrección de debilidades específicas, hipertrofia.',
    level: 'intermediate',
    peaks: false,            // bloque de choque de 4 sem, no pico de competencia
    peakWeek: null,
    phaseProfile: [
      { key: 'base', name: 'Base estructural', weeks: [1, 1], imrPct: [70, 75], volRel: 100, focus: 'volumen · tendones · culturismo' },
      { key: 'acumulacion', name: 'Acumulación', weeks: [2, 2], imrPct: [80, 88], volRel: 90, focus: 'fuerza absoluta · pulls' },
      { key: 'choque', name: 'Choque', weeks: [3, 3], imrPct: [90, 98], volRel: 65, focus: 'max out controlado' },
      { key: 'descarga', name: 'Descarga', weeks: [4, 4], imrPct: [80, 85], volRel: 35, focus: 'taper · recuperación' },
    ],
  },

  // ── CUBANO ───────────────────────────────────────────────
  {
    id: 'cubano-novicio-2d',
    name: 'Cubano Novicio 2D',
    family: 'Cubano',
    product: 'holy-oly',
    desc: 'Iniciación con 2 sesiones semanales. Foco técnico.',
    frequency: '2d/sem',
    duration: '8 semanas',
    intensity: 2,
    volume: 1,
    color: '#10B981',
    bestFor: 'Principiantes absolutos, tiempo muy limitado.',
    level: 'beginner',
    peaks: false,
    peakWeek: null,
    phaseProfile: [
      { key: 'cimentacion', name: 'Cimentación', weeks: [1, 4], imrPct: [58, 64], volRel: 100, focus: 'iniciación · técnica' },
      { key: 'desarrollo', name: 'Desarrollo', weeks: [5, 8], imrPct: [62, 70], volRel: 90, focus: 'fuerza general' },
    ],
  },
  {
    id: 'cubano-novicio-3d',
    name: 'Cubano Novicio 3D',
    family: 'Cubano',
    product: 'holy-oly',
    desc: 'Distribución eficiente: volumen lunes, técnico miércoles, intensidad viernes.',
    frequency: '3d/sem',
    duration: '8 semanas',
    intensity: 2,
    volume: 2,
    color: '#10B981',
    bestFor: 'Novato con disponibilidad media.',
    level: 'beginner',
    peaks: false,
    peakWeek: null,
    phaseProfile: [
      { key: 'cimentacion', name: 'Cimentación', weeks: [1, 4], imrPct: [60, 66], volRel: 100, focus: 'volumen · técnica' },
      { key: 'desarrollo', name: 'Desarrollo', weeks: [5, 8], imrPct: [64, 72], volRel: 88, focus: 'fuerza general' },
    ],
  },
  {
    id: 'cubano-int-5d',
    name: 'Cubano Intermedio 5D',
    family: 'Cubano',
    product: 'holy-oly',
    desc: 'Lun volumen · Mié intensidad media · Vie test. Estructura clásica.',
    frequency: '5d/sem',
    duration: '12 semanas',
    intensity: 3,
    volume: 3,
    color: '#10B981',
    bestFor: 'Atleta con base técnica establecida.',
    level: 'intermediate',
    peaks: false,            // programa de desarrollo (test semanal, no pico de competencia)
    peakWeek: null,
    phaseProfile: [
      { key: 'cimentacion', name: 'Cimentación', weeks: [1, 4], imrPct: [65, 72], volRel: 100, focus: 'base · volumen' },
      { key: 'desarrollo', name: 'Desarrollo', weeks: [5, 8], imrPct: [72, 80], volRel: 78, focus: 'fuerza general' },
      { key: 'intensificacion', name: 'Intensificación', weeks: [9, 12], imrPct: [78, 86], volRel: 55, focus: 'fuerza máxima · test' },
    ],
  },
  {
    id: 'cubano-avanzado-5d',
    name: 'Cubano Avanzado 5D',
    family: 'Cubano',
    product: 'holy-oly',
    desc: 'Mayor capacidad de trabajo. Volumen mensual 1.100-1.300 reps.',
    frequency: '5d/sem',
    duration: '12 semanas',
    intensity: 4,
    volume: 5,
    color: '#10B981',
    bestFor: 'Avanzado con tolerancia alta al volumen.',
    level: 'advanced',
    peaks: false,            // bloque de acumulación de volumen, no peaking
    peakWeek: null,
    phaseProfile: [
      { key: 'cimentacion', name: 'Cimentación', weeks: [1, 4], imrPct: [70, 76], volRel: 100, focus: 'volumen alto (1.100–1.300 reps/mes)' },
      { key: 'desarrollo', name: 'Desarrollo', weeks: [5, 8], imrPct: [74, 82], volRel: 85, focus: 'fuerza · volumen' },
      { key: 'intensificacion', name: 'Intensificación', weeks: [9, 12], imrPct: [80, 88], volRel: 60, focus: 'fuerza máxima' },
    ],
  },
  {
    id: 'cubano-competidor',
    name: 'Cubano Competidor',
    family: 'Cubano',
    product: 'holy-oly',
    desc: 'Macrociclo orientado a salida competitiva. Acumulación → realización.',
    frequency: '5d/sem',
    duration: '16 semanas',
    intensity: 5,
    volume: 4,
    color: '#10B981',
    bestFor: 'Pre-competencia, picos planificados.',
    level: 'advanced',
    peaks: true,
    peakWeek: 16,
    phaseProfile: [
      { key: 'cimentacion', name: 'Cimentación', weeks: [1, 4], imrPct: [70, 76], volRel: 100, focus: 'base · volumen' },
      { key: 'desarrollo', name: 'Desarrollo', weeks: [5, 8], imrPct: [74, 82], volRel: 80, focus: 'fuerza general' },
      { key: 'intensificacion', name: 'Intensificación', weeks: [9, 12], imrPct: [80, 88], volRel: 57, focus: 'fuerza máxima' },
      { key: 'realizacion', name: 'Realización', weeks: [13, 16], imrPct: [88, 100], volRel: 34, focus: 'peaking · competencia' },
    ],
  },

  // ── POLACO ───────────────────────────────────────────────
  {
    id: 'polaco-4d',
    name: 'Polaco 4D',
    family: 'Polaco',
    product: 'holy-oly',
    desc: 'Ciclo corto de choque. Progresión cauta + picos frecuentes.',
    frequency: '4d/sem',
    duration: '6 semanas',
    intensity: 4,
    volume: 2,
    color: '#DC2626',
    bestFor: 'Atletas que necesitan picar rápido sin saturar.',
    level: 'beginner',
    peaks: true,
    peakWeek: 6,
    phaseProfile: [
      { key: 'reps-altas', name: 'Reps altas', weeks: [1, 2], imrPct: [70, 75], volRel: 100, focus: 'reps altas · técnica' },
      { key: 'reps-medias', name: 'Reps medias', weeks: [3, 4], imrPct: [80, 85], volRel: 60, focus: 'reps medias · fuerza' },
      { key: 'singles', name: 'Singles', weeks: [5, 6], imrPct: [90, 95], volRel: 25, focus: 'singles · peaking' },
    ],
  },
  {
    id: 'polaco-5d',
    name: 'Polaco 5D',
    family: 'Polaco',
    product: 'holy-oly',
    desc: 'Calidad sobre cantidad. Series cortas (1-3 reps), mucho pull desde bloques.',
    frequency: '5d/sem',
    duration: '6 semanas',
    intensity: 4,
    volume: 2,
    color: '#DC2626',
    bestFor: 'Recuperar sensaciones de competencia rápidamente.',
    level: 'intermediate',
    peaks: true,
    peakWeek: 6,
    phaseProfile: [
      { key: 'reps-altas', name: 'Reps altas', weeks: [1, 2], imrPct: [70, 75], volRel: 100, focus: 'reps altas · calidad' },
      { key: 'reps-medias', name: 'Reps medias', weeks: [3, 4], imrPct: [80, 85], volRel: 60, focus: 'reps medias · pulls desde bloque' },
      { key: 'singles', name: 'Singles', weeks: [5, 6], imrPct: [90, 95], volRel: 25, focus: 'singles · sensaciones de competencia' },
    ],
  },

  // ── RUSO ─────────────────────────────────────────────────
  {
    id: 'ruso-5d',
    name: 'Ruso 5D',
    family: 'Ruso',
    product: 'holy-oly',
    desc: 'Waviness: ondulación diaria + semanal. GPP extensa.',
    frequency: '5d/sem',
    duration: '16 semanas',
    intensity: 3,
    volume: 5,
    color: '#06B6D4',
    bestFor: 'Atleta clásico, ciclo largo con peaking final.',
    level: 'intermediate',
    peaks: true,
    peakWeek: 16,
    phaseProfile: [
      // Onda rusa por mesociclo: tonnage [1.0, 0.9, 0.6, 0.45]
      { key: 'hipertrofia', name: 'Hipertrofia', weeks: [1, 4], imrPct: [65, 72], volRel: 100, focus: 'hipertrofia · GPP' },
      { key: 'fuerza-basica', name: 'Fuerza básica', weeks: [5, 8], imrPct: [75, 82], volRel: 85, focus: 'fuerza base' },
      { key: 'fuerza-potencia', name: 'Fuerza / Potencia', weeks: [9, 12], imrPct: [85, 92], volRel: 65, focus: 'fuerza · potencia' },
      { key: 'peaking', name: 'Peaking', weeks: [13, 16], imrPct: [92, 102], volRel: 45, focus: 'peaking · competencia' },
    ],
  },

  // ── UCRANIANO ────────────────────────────────────────────
  {
    id: 'ucraniano-3d',
    name: 'Ucraniano 3D',
    family: 'Ucraniano',
    product: 'holy-oly',
    desc: 'Alta densidad pura. EMOM-heavy, ideal para CrossFitters.',
    frequency: '3d/sem',
    duration: '12 semanas',
    intensity: 4,
    volume: 3,
    color: '#FACC15',
    bestFor: 'Tiempo limitado, enfoque en densidad.',
    level: 'intermediate',
    peaks: true,
    peakWeek: 12,            // fuente 10 sem → escalado a 12 del catálogo
    phaseProfile: [
      { key: 'acumulacion', name: 'Acumulación', weeks: [1, 6], imrPct: [70, 85], volRel: 100, focus: 'EMOM · densidad' },
      { key: 'intensificacion', name: 'Intensificación', weeks: [7, 11], imrPct: [85, 94], volRel: 55, focus: 'singles · intensificación + taper' },
      { key: 'test', name: 'Test máximo', weeks: [12, 12], imrPct: [90, 100], volRel: 20, focus: 'pico · test' },
    ],
  },
  {
    id: 'ucraniano-4d',
    name: 'Ucraniano 4D',
    family: 'Ucraniano',
    product: 'holy-oly',
    desc: 'Estándar. Más volumen accesorio y distribución de carga.',
    frequency: '4d/sem',
    duration: '12 semanas',
    intensity: 4,
    volume: 4,
    color: '#FACC15',
    bestFor: 'Balance entre densidad y accesorios.',
    level: 'intermediate',
    peaks: true,
    peakWeek: 12,            // fuente 10 sem → escalado a 12 del catálogo
    phaseProfile: [
      { key: 'acumulacion', name: 'Acumulación', weeks: [1, 6], imrPct: [70, 85], volRel: 100, focus: 'EMOM · densidad · accesorios' },
      { key: 'intensificacion', name: 'Intensificación', weeks: [7, 11], imrPct: [85, 94], volRel: 55, focus: 'singles · intensificación + taper' },
      { key: 'test', name: 'Test máximo', weeks: [12, 12], imrPct: [90, 100], volRel: 20, focus: 'pico · test' },
    ],
  },

  // ── COLOMBIANO ───────────────────────────────────────────
  {
    id: 'colombiano-5d',
    name: 'Colombiano 5D',
    family: 'Colombiano',
    product: 'holy-oly',
    desc: 'Prioridad absoluta al C&J. Mesociclos con ondulación constante.',
    frequency: '5d/sem',
    duration: '12 semanas',
    intensity: 4,
    volume: 4,
    color: '#A855F7',
    bestFor: 'Atletas con Jerk débil que necesitan reforzar overhead.',
    level: 'intermediate',
    peaks: true,
    peakWeek: 12,            // método Urrutia canónico 24 sem → escalado a 12 del catálogo
    phaseProfile: [
      { key: 'prep-general', name: 'Preparatorio General', weeks: [1, 4], imrPct: [58, 66], volRel: 100, focus: 'volumen extremo de piernas' },
      { key: 'prep-especial', name: 'Preparatorio Especial', weeks: [5, 8], imrPct: [65, 72], volRel: 65, focus: 'balance técnica-fuerza' },
      { key: 'precompetencia', name: 'Precompetencia', weeks: [9, 10], imrPct: [72, 82], volRel: 30, focus: 'intensidad · baja volumen' },
      { key: 'realizacion', name: 'Realización', weeks: [11, 12], imrPct: [82, 100], volRel: 10, focus: 'peak · piernas a cero' },
    ],
  },

  // ── HÍBRIDO MODERNO ──────────────────────────────────────
  {
    id: 'hibrido-3d',
    name: 'Híbrido Moderno 3D',
    family: 'Híbrido',
    product: 'holy-oly',
    desc: 'Alta densidad por sesión. Compuestos grandes, menos accesorios.',
    frequency: '3d/sem',
    duration: '12 semanas',
    intensity: 3,
    volume: 2,
    color: '#22C55E',
    bestFor: 'Atletas máster o time-constrained.',
    level: 'intermediate',
    peaks: true,
    peakWeek: 12,
    phaseProfile: [
      { key: 'acumulacion', name: 'Acumulación', weeks: [1, 4], imrPct: [70, 76], volRel: 100, focus: 'hipertrofia · complejos' },
      { key: 'transmutacion', name: 'Transmutación', weeks: [5, 8], imrPct: [80, 86], volRel: 70, focus: 'fuerza · densidad EMOM' },
      { key: 'realizacion', name: 'Realización', weeks: [9, 12], imrPct: [88, 96], volRel: 40, focus: 'peaking · test' },
    ],
  },
  {
    id: 'hibrido-4d',
    name: 'Híbrido Moderno 4D',
    family: 'Híbrido',
    product: 'holy-oly',
    desc: 'Block periodization. Hipertrofia + fuerza + densidad EMOM.',
    frequency: '4d/sem',
    duration: '12 semanas',
    intensity: 3,
    volume: 3,
    color: '#22C55E',
    bestFor: 'Atleta con tiempo limitado, sostenibilidad largo plazo.',
    level: 'intermediate',
    peaks: true,
    peakWeek: 12,
    phaseProfile: [
      { key: 'acumulacion', name: 'Acumulación', weeks: [1, 4], imrPct: [70, 76], volRel: 100, focus: 'hipertrofia funcional' },
      { key: 'transmutacion', name: 'Transmutación', weeks: [5, 8], imrPct: [80, 86], volRel: 70, focus: 'fuerza · densidad EMOM' },
      { key: 'realizacion', name: 'Realización', weeks: [9, 12], imrPct: [88, 96], volRel: 40, focus: 'peaking · test' },
    ],
  },
  {
    id: 'hibrido-5d',
    name: 'Híbrido Moderno 5D',
    family: 'Híbrido',
    product: 'holy-oly',
    desc: 'Acumulación → Transmutación → Realización. Sesiones ~90min.',
    frequency: '5d/sem',
    duration: '12 semanas',
    intensity: 4,
    volume: 3,
    color: '#22C55E',
    bestFor: 'Transición CrossFit → Weightlifting competitivo.',
    level: 'intermediate',
    peaks: true,
    peakWeek: 12,
    phaseProfile: [
      { key: 'acumulacion', name: 'Acumulación', weeks: [1, 4], imrPct: [70, 76], volRel: 100, focus: 'hipertrofia · capacidad' },
      { key: 'transmutacion', name: 'Transmutación', weeks: [5, 8], imrPct: [80, 86], volRel: 70, focus: 'fuerza · densidad EMOM' },
      { key: 'realizacion', name: 'Realización', weeks: [9, 12], imrPct: [88, 96], volRel: 40, focus: 'peaking · test' },
    ],
  },
  {
    id: 'hibrido-block',
    name: 'Híbrido Modular (BLOCK)',
    family: 'Híbrido',
    product: 'holy-oly',
    desc: 'Variación coordinada. Bloques concentrados con ondulación semanal.',
    frequency: 'variable',
    duration: 'modular',
    intensity: 4,
    volume: 4,
    color: '#22C55E',
    bestFor: 'Evitar estancamiento, programación adaptable.',
    level: 'advanced',
    peaks: true,
    peakWeek: 12,            // ciclo modular; perfil canónico = 12 sem (ondulación A-B-C-D)
    phaseProfile: [
      { key: 'hipertrofia', name: 'Bloque Hipertrofia', weeks: [1, 4], imrPct: [65, 82], volRel: 100, focus: 'acumulación · ondulación A-B-C-D' },
      { key: 'fuerza', name: 'Bloque Fuerza', weeks: [5, 8], imrPct: [78, 92], volRel: 65, focus: 'fuerza absoluta · CNS' },
      { key: 'potencia', name: 'Bloque Potencia', weeks: [9, 12], imrPct: [85, 97], volRel: 40, focus: 'potencia · peaking' },
    ],
  },

  // ── USA / HYROX ──────────────────────────────────────────
  {
    id: 'usa-school',
    name: 'USA Weightlifting',
    family: 'USA',
    product: 'holy-oly',
    desc: 'Periodización lineal americana. Balance volumen / intensidad.',
    frequency: '4-5d/sem',
    duration: '10-12 semanas',
    intensity: 3,
    volume: 3,
    color: '#0EA5E9',
    bestFor: 'Estándar competitivo norteamericano.',
    level: 'intermediate',
    peaks: true,
    peakWeek: 12,            // duración 10-12 sem; perfil sobre 12
    phaseProfile: [
      { key: 'acumulacion', name: 'Acumulación', weeks: [1, 4], imrPct: [65, 75], volRel: 100, focus: 'general strength · 50:50' },
      { key: 'desarrollo', name: 'Desarrollo', weeks: [5, 8], imrPct: [75, 85], volRel: 70, focus: 'olympic specificity · complexes' },
      { key: 'realizacion', name: 'Realización', weeks: [9, 12], imrPct: [85, 97], volRel: 40, focus: 'peaking & testing' },
    ],
  },
  {
    id: 'usa-principiante',
    name: 'USA Principiante',
    family: 'USA',
    product: 'holy-oly',
    desc: 'Periodización lineal de 16 semanas: preparación anatómica → fuerza base → integración → intensificación y test.',
    frequency: '4d/sem',
    duration: '16 semanas',
    intensity: 2,
    volume: 4,
    color: '#0EA5E9',
    bestFor: 'Principiantes (0-2 años) construyendo base técnica y de fuerza.',
    level: 'beginner',
    peaks: false,            // lineal de base; termina en test, no en pico de competencia
    peakWeek: null,
    phaseProfile: [
      { key: 'anatomica', name: 'Preparación anatómica', weeks: [1, 4], imrPct: [55, 65], volRel: 100, focus: 'high hang · sentadillas ligeras · core' },
      { key: 'fuerza-base', name: 'Fuerza base', weeks: [5, 8], imrPct: [65, 70], volRel: 85, focus: 'desde suelo · pull correcto' },
      { key: 'integracion', name: 'Fuerza integrada', weeks: [9, 12], imrPct: [70, 80], volRel: 65, focus: 'snatch + C&J completos' },
      { key: 'intensificacion', name: 'Intensificación', weeks: [13, 16], imrPct: [80, 90], volRel: 45, focus: 'intensificación + test (Epley)' },
    ],
  },
  {
    id: 'usa-intermedio',
    name: 'USA Intermedio',
    family: 'USA',
    product: 'holy-oly',
    desc: 'Bloques ondulantes de 16 semanas: acumulación → transmutación → intensificación → realización, con deloads.',
    frequency: '5d/sem',
    duration: '16 semanas',
    intensity: 4,
    volume: 4,
    color: '#0EA5E9',
    bestFor: 'Intermedios (2-5 años) con base sólida.',
    level: 'intermediate',
    peaks: true,
    peakWeek: 16,
    phaseProfile: [
      { key: 'acumulacion', name: 'Acumulación (B1)', weeks: [1, 4], imrPct: [65, 75], volRel: 100, focus: 'sentadillas 5-8 · complexes · deload sem4' },
      { key: 'transmutacion', name: 'Transmutación (B2)', weeks: [5, 8], imrPct: [75, 82], volRel: 80, focus: 'front squat · push press · pausas' },
      { key: 'intensificacion', name: 'Intensificación (B3)', weeks: [9, 12], imrPct: [80, 88], volRel: 55, focus: 'balístico · pulls 105% · deload sem12' },
      { key: 'realizacion', name: 'Realización (B4)', weeks: [13, 16], imrPct: [85, 97], volRel: 35, focus: 'simulación comp · singles · max test' },
    ],
  },
  {
    id: 'usa-avanzado',
    name: 'USA Avanzado',
    family: 'USA',
    product: 'holy-oly',
    desc: 'Peaking de 8 semanas pre-competencia: sobrecarga transmutativa → choque neural → realización submáxima → tapering.',
    frequency: '5d/sem',
    duration: '8 semanas',
    intensity: 5,
    volume: 2,
    color: '#0EA5E9',
    bestFor: 'Avanzados afinando para una competencia.',
    level: 'advanced',
    peaks: true,
    peakWeek: 8,
    phaseProfile: [
      { key: 'sobrecarga', name: 'Sobrecarga transmutativa', weeks: [1, 2], imrPct: [80, 85], volRel: 100, focus: 'frecuencia alta · squats post-OLY' },
      { key: 'choque-neural', name: 'Choque neural', weeks: [3, 4], imrPct: [85, 92], volRel: 65, focus: 'choque sem3 · supercompensación sem4 (70%)' },
      { key: 'realizacion', name: 'Realización submáxima', weeks: [5, 6], imrPct: [90, 98], volRel: 40, focus: 'últimos pulls max · OLY = aperturas' },
      { key: 'taper', name: 'Tapering', weeks: [7, 8], imrPct: [85, 100], volRel: 20, focus: 'tapering abrupto · competencia' },
    ],
  },
  {
    id: 'usa-master',
    name: 'USA Master 40+',
    family: 'USA',
    product: 'holy-oly',
    desc: 'Adaptado a 12 semanas para máster: estabilidad articular → fuerza preservada → realización, con descansos largos.',
    frequency: '3d/sem',
    duration: '12 semanas',
    intensity: 3,
    volume: 3,
    color: '#0EA5E9',
    bestFor: 'Atletas máster (40+) priorizando articulaciones y recuperación.',
    level: 'intermediate',     // competencia; el "40+" es categoría de edad (ver name/bestFor)
    peaks: true,
    peakWeek: 12,
    phaseProfile: [
      { key: 'estabilidad', name: 'Estabilidad articular', weeks: [1, 4], imrPct: [60, 70], volRel: 100, focus: 'unilateral · powers dominantes' },
      { key: 'fuerza', name: 'Fuerza preservada', weeks: [5, 8], imrPct: [70, 80], volRel: 75, focus: 'desde bloques · deload 2:1' },
      { key: 'realizacion', name: 'Realización Master', weeks: [9, 12], imrPct: [80, 92], volRel: 45, focus: 'front squat ligero · descansos largos' },
    ],
  },
];

export const MACROCYCLE_FAMILIES = Array.from(new Set(MACROCYCLES.map(m => m.family)));

/**
 * Devuelve la fase del programa que corresponde a una semana dada (1-indexada).
 * Útil para el monitor: la banda `imrPct` de la fase es lo que el semáforo compara
 * contra el IMR real de la semana (§8.4). Devuelve la última fase si la semana excede
 * el perfil (p.ej. programas de duración modular/rango).
 */
export function phaseForWeek(macro: Macrocycle, week: number): MacrocyclePhase | null {
  const phases = macro.phaseProfile;
  if (!phases.length) return null;
  const hit = phases.find(p => week >= p.weeks[0] && week <= p.weeks[1]);
  return hit ?? phases[phases.length - 1];
}
