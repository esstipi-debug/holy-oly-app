export type Id = string;
export type Estado = "ok" | "warn" | "alert";

export type MacrocycleLevel = "beginner" | "intermediate" | "advanced" | "elite";
export type MacrocycleFamily =
  | "Búlgaro" | "Coreano" | "Chino" | "Cubano" | "Polaco"
  | "Ruso" | "Ucraniano" | "Colombiano" | "Híbrido" | "USA";

export interface MacrocyclePhase {
  key: string; name: string;
  weeks: [number, number];
  imrPct: [number, number];
  volRel: number; focus: string;
}

export interface Macrocycle {
  id: string; name: string; family: MacrocycleFamily; product: "holy-oly";
  desc: string; frequency: string; duration: string;
  intensity: number; volume: number; color: string; bestFor?: string;
  level: MacrocycleLevel; peaks: boolean; peakWeek: number | null;
  phaseProfile: MacrocyclePhase[];
}

/** `week` is the macro week (always present, used by the timeline). `date` (ISO YYYY-MM-DD)
 *  is the calendar date the coach picked; week is derived from it against the plan's startDate. */
export interface Competencia { name: string; week: number; date?: string; }

export interface Medal {
  comp: string; date: string; cat: string;
  medal: "oro" | "plata" | "bronce";
  sn: number; cj: number; place: string;
}

export interface RM { arranque: number; envion: number; sentadilla: number; frente: number; }

export interface Plan {
  atletaId: Id; macroId: string; startWeek: number;
  /** Calendar date (ISO YYYY-MM-DD) the plan begins — anchors macro weeks to real dates. Set
   *  at assignment (M5); until then the drill-down derives an effective start date from the series. */
  startDate?: string;
  rms: RM; comps: Competencia[];
}

/** Coach-tracked plan adherence: did a planned session happen? Sparse — only marked sessions are
 *  stored (unmarked = pending). Primary source for athletes who don't use the app; later the
 *  athlete app reports the same marks. `idx` is the session's position within its week (0-based). */
export type SessionStatus = "done" | "missed";
export interface SessionMark { week: number; idx: number; status: SessionStatus; }
export type SessionLog = SessionMark[];

export interface MonitorSeries {
  weeks: number;
  acute: number[];
  hrv: number[]; hrvBase: number;
  rhr: number[]; rhrBase: number;
  imr: number[];
  wellness: number[];
  recovery: number[];
  // M4b (optional, append-only — back the Cumplimiento / Peso / Bienestar-ítems charts)
  compliance?: number[];                 // % completado por semana (0..100)
  rpe?: number[];                        // RPE medio por semana (~5..10)
  bodyweight?: number[];                 // peso corporal por semana (kg)
  weightBand?: [number, number];         // banda objetivo de categoría [lo, hi]
  wellnessItems?: Record<string, number[]>; // ítems 1..5 por semana (Fatiga/Dolor/Estrés/Humor/Motivación/Sueño)
}

export type CycleShare = "full" | "min" | "none";
export type CycleState = "regular" | "unreliable" | "amenorrhea";

/** Coach-facing, redacted by construction: never exposes phase/day/symptom. */
export interface CycleContext {
  share: CycleShare;
  inLutealNow: boolean | null;
  health: "ok" | "referral";
  reliable: boolean;
}

/** La verdad de la atleta (sólo viaja por /me — el coach JAMÁS recibe este shape). */
export interface CycleData { share: CycleShare; state: CycleState; lastPeriodStart?: string; cycleLengthDays?: number; }
/** Marca proyectada de un día en el calendario de la atleta. */
export type CycleMark = "periodo" | "preperiodo";

export type VinculoEstado = "pendiente" | "activo" | "rechazado" | "revocado";
export interface Vinculo {
  id: Id; coachId: Id; atletaId: Id;
  estado: VinculoEstado; iniciadoPor: "atleta";
}

export interface Atleta {
  id: Id; nombre: string; iniciales: string;
  nivel: MacrocycleLevel; sexo: "M" | "F"; macroId?: string; compite?: boolean;
  /** Alerta del coach (slice macro-history): el atleta no tiene RM cargado (sin plan o lift ≤0).
   *  Sin RM el motor no puede prescribir → el Plantel lo señala. Ausente = no computado. */
  needsRm?: boolean;
}

// ── Athlete self-report (Proyecto A). `field` is the canonical key (DB column, DTO, answers map);
//    `label` is the display name AND the existing MonitorSeries.wellnessItems key (for the future
//    rollup). `highBad` polarity: true ⇒ a HIGH value is BAD (Fatiga/Dolor/Estrés). ──
export type WellnessField = "fatiga" | "dolor" | "estres" | "humor" | "motivacion" | "sueno";

export interface WellnessItemDef {
  field: WellnessField;
  label: string;
  q: string;
  lo: string;
  hi: string;
  highBad: boolean;
}

export type WellnessAnswers = Record<WellnessField, number>;

/** Ítems del check-in vigilados para rachas de bienestar (humor queda afuera por diseño). */
export type WatchedWellnessField = "sueno" | "estres" | "fatiga" | "dolor" | "motivacion";

/** Heads-up "si esto sigue, va a pasar X": el ítem líder en racha de días malos + severidad.
 *  Hechos estructurados — la copy (frase-factor/consecuencia/acción) vive en la capa web. */
export interface StreakHeadsUp {
  item: WatchedWellnessField;
  days: number;                          // días malos consecutivos del ítem líder
  severity: "warn" | "alert";
  alsoStreaking: WatchedWellnessField[]; // otros ítems en racha (≥3), por prioridad
}

/** One athlete-day self-report (private to the athlete, anchored to a calendar date). */
export interface DayLog {
  date: string; // ISO YYYY-MM-DD
  fatiga: number; dolor: number; estres: number; humor: number; motivacion: number; sueno: number; // 1..5
  weight?: number; // kg, optional (athlete may skip)
}

/** PUT /me/daylog body: the 6 items + optional weight. Date is server-assigned (today). */
export interface DayLogInput {
  fatiga: number; dolor: number; estres: number; humor: number; motivacion: number; sueno: number;
  weight?: number;
}

/** GET /me/daylog response. `today` is the server's date — anchors the client heatmap/streak frame. */
export interface DayLogView {
  entry: DayLog | null;
  streak: number;
  days: string[]; // ISO dates with a logged entry (for the heatmap)
  today: string;  // ISO
  headsUp?: StreakHeadsUp | null; // racha de bienestar (si esto sigue, va a pasar X), o null
}

/** PUT /me/daylog response. */
export interface DayLogResult {
  entry: DayLog;
  streak: number;
}

/** GET /me/plan response: a redaction-free, purpose-built view for the athlete's own Home. */
export interface MePlanView {
  athlete: { nombre: string; iniciales: string; sexo: "M" | "F" };
  plan: {
    /** Slug del macro del catálogo (p.ej. "ruso-5d"). `buildMePlanView` SIEMPRE lo setea; opcional
     *  sólo por lenidad de fixtures. Habilita el detalle de fase (catálogo + ADN de escuela) en el cliente. */
    macroId?: string;
    macroName: string;
    totalWeeks: number;
    currentWeek: number;
    currentPhase: string;
    startDate?: string; // ISO — ancla real del plan (fechas del mapa); ausente en planes pre-M5
    phases: { name: string; from: number; to: number; imr: number; imrLo: number; imrHi: number; volRel: number; focus: string }[];
    comps: { name: string; week: number }[];
  } | null;
}

// ── Movement library (SP1 · pilar de ejecución). A Movement is a base lift × modifiers
//    (captura/origen/posición/tipoEnvión); the catalog is generated from the bases. ──
export type RmRef = "arranque" | "envion" | "sentadilla" | "frente" | "none";
export type Captura = "completo" | "potencia";          // squat catch vs power
export type Origen = "piso" | "bloques" | "colgado";    // floor / blocks / hang
export type Posicion = "alto" | "rodilla" | "bajo";     // only when origen ∈ {bloques, colgado}
export type TipoEnvion = "tijera" | "empuje" | "potencia" | "fuerza"; // split / push / power / strict-rack
export type MovementFlag = "pausa" | "deficit" | "tempo" | "sin-recibida";

/** Concrete modifiers of a variant. `flags` is always present (`[]` in the generated catalog). */
export interface MovementModifiers {
  captura?: Captura;
  origen?: Origen;
  posicion?: Posicion;
  tipoEnvion?: TipoEnvion;
  flags: MovementFlag[];
}

/** Scores de carga (1..10) — dimensiones DISTINTAS de la complejidad técnica (D5 del spec
 *  entrenamientos-distintivos): `snc` demanda neural · `axial` compresión de columna/costo
 *  estructural · `metabolica` volumen×músculo. Informan secuencia/presupuesto del generador;
 *  JAMÁS derivan kg (kg = %×RM, siempre). */
export interface MovementLoads { snc: number; axial: number; metabolica: number }

/** Techos de reps por serie (D7): dentro de un complejo vs como ejercicio aislado. */
export interface RepsMax { enComplejo: number; aislado: number }

/** Hand-curated base lift. Declares which axes it admits; variants are generated from these. */
export interface MovementBase {
  id: string;            // slug: "arranque", "tiron-arranque", "sentadilla-frente"…
  name: string;          // "Arranque"
  aliasEn?: string;      // "Snatch" — bilingual search
  rmRef: RmRef;
  baseComplexity: number;
  /** Carga base por dimensión (los modificadores la ajustan vía computeLoads). */
  baseLoads: MovementLoads;
  /** Techos de reps por serie (D7) — el generador jamás prescribe encima. */
  repsMax: RepsMax;
  /** `posicion` is NOT declared per base — the generator applies all 3 when origen ∈ {bloques, colgado}. */
  axes: {
    captura?: Captura[];
    origen?: Origen[];
    tipoEnvion?: TipoEnvion[];
  };
  /** Flags that make sense for this base (SP2 applies them at prescription time; NOT pre-generated). */
  allowedFlags: MovementFlag[];
  /** Curated substitute base ids (same pattern/objetivo; may cross family). */
  substituteBases: string[];
  notes?: string;
}

/** A concrete variant — GENERATED from base × axes. Flag-less in the catalog. */
export interface Movement {
  id: string;            // "arranque.potencia.colgado.rodilla" (canonical = baseId)
  baseId: string;
  name: string;          // "Arranque de potencia colgado (rodilla)"
  rmRef: RmRef;          // = base.rmRef
  complexity: number;    // derived (1..12)
  loads: MovementLoads;  // derived (computeLoads — 1..10 cada dimensión)
  modifiers: MovementModifiers;
}

// ── Complejos (slice entrenamientos-distintivos, D6/D7): composición ordenada de movimientos
//    en UNA serie con UNA barra. El % se programa contra el eslabón MÁS DÉBIL (min RM de los
//    rmRef de los eslabones); la notación de reps ("1+1+2") vive en el nombre. ──
export interface ComplexLink { movementId: string; reps: number }
export interface ComplexDef {
  id: string;          // namespace "cx." — p.ej. "cx.tiron-arranque+arranque"
  name: string;        // "Tirón de arranque + Arranque (2+1)" — notación incluida
  links: ComplexLink[]; // 2..4 eslabones, orden de ejecución
  notes?: string;
}

// ── Prescription (SP2). The macro carries a recipe; assigning instantiates the athlete's
//    editable prescription; kg = %×RM (or an explicit override). Reuses SP1 movements. ──
export interface PrescribedExercise {
  movementId: string;        // SP1 movement id (e.g. "arranque", "tiron-arranque", "envion.tijera")
  sets: number;
  reps: number;
  pct?: number;              // %1RM (present when the movement derives from a RM)
  kgOverride?: number;       // explicit kg (accessories, or the coach pins the weight) — beats pct
  flags?: MovementFlag[];
  notes?: string;
}
/** day/turno (D9): rama de doble sesión por día. Ausentes = comportamiento histórico (sesión n = día n). Primera receta bi-diaria: Búlgaro (spec 2026-06-12); la UI AM/PM llega en el mismo slice. */
export interface SessionTemplate { exercises: PrescribedExercise[]; day?: number; turno?: "AM" | "PM" }
export interface PhaseTemplate { phaseKey: string; sessions: SessionTemplate[] } // sessions[idx], idx 0-based
export interface MacroRecipe { macroId: string; phases: PhaseTemplate[] }

/** A concrete prescription row of an athlete (a PrescribedExercise + its location). */
export interface PrescriptionRow extends PrescribedExercise { week: number; sessionIdx: number; order: number }
/** A prescribed exercise with its display name + derived target kg, for the front. */
export interface PrescribedExerciseView extends PrescribedExercise { movementName: string; targetKg?: number; actual?: ExerciseActual; warmup?: WarmupSet[] }
/** One instantiated session (a column in the week), kg already derived. `day`/`turno` vienen
 *  del layout de la receta (D8); `fecha` del SessionRegistro del atleta (D1). */
export interface SessionView {
  week: number; sessionIdx: number; exercises: PrescribedExerciseView[];
  day?: number; turno?: "AM" | "PM"; fecha?: string;
  /** Secuencia de días: la sesión fue ANULADA por el atleta (falló/canceló). Sin volumen,
   *  cuenta como resuelta para destrabar los días siguientes. `fecha` ausente cuando anulado. */
  anulado?: boolean;
}

/** Estado de una sesión en la secuencia de días: sin registro · hecho (con fecha) · anulado. */
export type SessionEstado = "hecho" | "anulado";

/** Registro de fecha de una sesión (spec 2026-06-12 D1/D3): cuándo se HIZO el entreno.
 *  Fuente de verdad; doneAt por-ejercicio es copia estampada en la misma transacción.
 *  `estado` (secuencia de días, 2026-06-13): ausente ⇒ "hecho"; "anulado" = día saltado. */
export interface SessionRegistro { week: number; sessionIdx: number; fecha: string; estado?: SessionEstado }

/** One day's heat aggregate (calendar heat map). `topPct` absent = no % data that day. */
export interface DayHeat { topPct?: number; lifts: number }
/** A plan week's 7 day slots (Monday-first; session i → day i). `null` = rest day. */
export interface WeekHeat { week: number; days: (DayHeat | null)[] }

// ── Recorrido (lo HECHO a lo largo del macro, wire de /me/recorrido). Sólo carga PROPIA en kg
//    (permitida al atleta, HR-1); el total se deriva (trabajo + calentamiento) en el cliente. ──
export interface RecorridoSemana { week: number; trabajoKg: number; calentamientoKg: number; sesionesHechas: number; sesionesTotales: number }
export interface MeRecorrido { semanas: RecorridoSemana[] }

// ── Adherencia reconciliada (slice lazo-diario; lógica en logic/adherence.ts). Por sesión
//    planificada, prioriza la VERDAD del atleta sobre el toggle manual del coach. ──
/** Estado reconciliado de una sesión planificada para la cara del coach:
 *  - `done`    todas las prescripciones de la sesión quedaron hechas
 *  - `partial` algunas hechas, otras no (el atleta dejó la sesión a medias)
 *  - `skipped` el atleta registró la sesión y NINGUNA quedó hecha (o el coach marcó "missed")
 *  - `planned` reservado para una fuente futura ("agendada pero aún sin tocar")
 *  - `none`    sin ningún dato — jamás inventar (HR de dominio). */
export type AdherenceStatus = "done" | "partial" | "skipped" | "planned" | "none";
/** De dónde sale el estado: la verdad registrada por el atleta vs el toggle manual del coach. */
export type AdherenceSource = "athlete" | "coach" | "none";
/** Una sesión planificada (coordenada en el plan). */
export interface PlannedSession { week: number; idx: number }
/** Estado reconciliado de una sesión planificada, con su origen. */
export interface ReconciledSession { week: number; idx: number; status: AdherenceStatus; source: AdherenceSource }

// ── Día a día (slice lazo-diario, wire de GET /athletes/:id/daily). Cara COACH: el check-in
//    crudo del atleta (6 ítems + peso, SIN RPE) + la adherencia RECONCILIADA (atleta > coach >
//    none, vía reconcileAdherence). El ciclo JAMÁS viaja por acá (sigue por su endpoint redactado). ──
/** Un check-in diario del atleta tal como lo registró (los 6 ítems 1..5 + peso opcional). */
export interface DailyCheckin {
  date: string; // ISO YYYY-MM-DD
  fatiga: number; dolor: number; estres: number; humor: number; motivacion: number; sueno: number;
  weight?: number;
}
/** Respuesta de GET /athletes/:id/daily: ventana de los últimos N días. `today` ancla el marco
 *  del cliente; `checkins` orden cronológico ascendente. `adherence` ya viene reconciliada. */
export interface AthleteDailyView {
  today: string;                          // ISO
  fromDate: string;                       // ISO — inicio de la ventana (inclusive)
  checkins: DailyCheckin[];               // crudos del atleta, asc por fecha
  adherence: ReconciledSession[];         // estado reconciliado por sesión planificada
}

// ── SP3 actuals: what the athlete actually lifted, per prescribed exercise. ──
/** Una serie de trabajo registrada (Opción B: registro por serie). */
export interface SetActual { kg?: number; reps?: number; done: boolean; }

export interface SessionActual {
  week: number; sessionIdx: number; order: number; movementId: string;
  /** The plan's movement at that slot when recorded (SP4). SP3 rows omit this. */
  prescribedMovementId?: string;
  done: boolean; actualKg?: number; actualReps?: number; note?: string; doneAt?: string;
  /** Detalle por serie (Opción B). El resumen (actualKg/actualReps/done) se deriva del top set. */
  sets?: SetActual[];
}
/** The flattened actual attached to a prescribed-exercise view (no location — it rides the exercise). */
export interface ExerciseActual {
  done: boolean; kg?: number; reps?: number; note?: string;
  /** SP4 substitution fields. */
  movementId: string;
  movementName: string;
  substituted: boolean;
  desfasado: boolean;
  /** Series registradas (Opción B), para el reproductor del atleta al reabrir. */
  sets?: SetActual[];
}

/** Un set de calentamiento (se muestra, NO cuenta). `label:"barra"` = barra vacía del 1er movimiento. */
export interface WarmupSet { pct: number; kg: number; reps: number; label: "barra" | "rampa"; }

// ── SP5 autorregulación: historial de RMs + detección de PR (coach-territory). ──
/** Los 4 lifts con RM (= keyof RM; sin "none"). */
export type RmLift = "arranque" | "envion" | "sentadilla" | "frente";
/** Por qué se fijó un RM: baseline al asignar, edición manual del coach, o confirmación de PR. */
export type RmReason = "assign" | "manual" | "pr";
/** Una fila del historial append-only de RMs (la curva del 1RM). `setAt` ISO YYYY-MM-DD. */
export interface RmUpdate { lift: RmLift; kg: number; setAt: string; reason: RmReason; }
/** Set hecho que SUPERA el RM vigente del lift (rmRef del movimiento) — sugerencia al coach.
 *  `doneAt` = fecha real del levantamiento (verdad anclada a fecha); `week` queda como fallback. */
export interface PrCandidate { lift: RmLift; movementId: string; movementName: string; kg: number; week: number; sessionIdx: number; doneAt?: string; }
/** Vigencia por lift: cuándo se fijó y hace cuántas semanas ({} = sin dato, nunca inventar). */
export type RmVigencia = Record<RmLift, { setAt?: string; weeksAgo?: number }>;

// ── Historial de macrociclos (slice macro-history 2026-06-14): los ciclos CERRADOS del atleta.
//    `Plan` es 1:1 (un ciclo en curso); esto persiste los ciclos completados con su adherencia.
//    Coach- y atleta-visible (constancia propia); jamás señal de estado (no semáforo/readiness). ──
/** Una fila persistida de un ciclo cerrado. `rmEnd` = los 4 RM al cerrar (curva de fuerza). */
export interface MacroHistoryRow {
  macroId: string;        // slug del catálogo (MACROCYCLES)
  ordinal: number;        // 1 = el ciclo más antiguo del atleta (ascendente)
  startDate: string;      // ISO YYYY-MM-DD
  endDate: string;        // ISO YYYY-MM-DD
  weeks: number;
  sessionsDone: number;
  sessionsTotal: number;
  rmEnd?: RM;
}
/** Fila enriquecida para la UI: nombre del macro + adherencia derivada (jamás inventada). */
export interface MacroHistoryEntry extends MacroHistoryRow {
  macroName: string;
  adherencePct: number;   // round(sessionsDone/sessionsTotal*100); 0 si total=0
}
/** Vista de /…/macro-history: ciclos más reciente primero + agregados derivados. */
export interface MacroHistoryView {
  entries: MacroHistoryEntry[];
  cyclesDone: number;
  avgAdherencePct: number;
}

// ── Competencias compartidas del coach (slice competencias 2026-06-14): el coach crea una compe
//    UNA vez (nombre + fecha + lugar) y acopla a varios atletas con un ROL — "pico" ancla el pico
//    del macro a la fecha (reusa el peaking: sincroniza la fila Competencia por-atleta), "paso" es
//    una compe de preparación que se registra pero NO toca el plan. Los resultados (marcas +
//    medalla) se cargan después de la compe (Fase 2). Propiedad del coach (catálogo por coach). ──

/** Rol del atleta en una competencia. "pico": ancla el pico del macro a la fecha. "paso": compe
 *  de preparación — se registra que va, pero NO toca la planificación. */
export type CompRole = "pico" | "paso";

/** Una competencia compartida, propiedad del coach. `date` ISO YYYY-MM-DD; `place` opcional. */
export interface Competition { id: string; name: string; date: string; place?: string; }

/** Resultado de un atleta en una competencia (Fase 2): marca lograda (Arr/Env), medalla y puesto.
 *  `sn` arranque · `cj` envión (kg). Espejo de los campos de `Medal` salvo `comp`/`date` (los pone
 *  la competencia compartida). */
export interface CompResult {
  medal: "oro" | "plata" | "bronce";
  cat: string; sn: number; cj: number; place: string;
}

/** Input de creación/edición de una competencia (coach; untrusted → acotado en schema). */
export interface CompetitionInput { name: string; date: string; place?: string; }

/** Acople de un atleta (input): a quién, con qué rol. */
export interface CompetitionEntryInput { athleteId: string; role: CompRole; }

/** Una fila del catálogo de competencias (lista del coach), con el conteo de acoplados por rol. */
export interface CompetitionListItem extends Competition {
  athleteCount: number; picoCount: number; pasoCount: number;
}

/** Un atleta acoplado, enriquecido para el detalle. `peakWeek` (sólo rol "pico" con plan anclado)
 *  = la semana del macro donde cae la compe; `result` presente sólo si ya se cargó (Fase 2). */
export interface CompetitionEntryView {
  athleteId: string; nombre: string; iniciales: string;
  role: CompRole; peakWeek?: number; result?: CompResult;
}

/** Detalle de una competencia: la compe + sus atletas acoplados. */
export interface CompetitionDetailView extends Competition { entries: CompetitionEntryView[]; }

// ── ADN de escuela (slice entrenamientos-distintivos 2026-06-11): cada familia del catálogo
//    descrita como DATOS — el generador determinístico los convierte en MacroRecipe. ──────────

/** Rol funcional de una fase, derivado del propio dato (imrPct/volRel) vía phaseRole. */
export type PhaseRole = "base" | "fuerza" | "intensidad" | "peaking" | "descarga";

/** Slot por patrón de movimiento — el esqueleto de la sesión. */
export type SlotKind = "olimpico" | "tiron" | "rodilla" | "empuje" | "bisagra" | "complejo" | "metabolico";

/** Arquetipo de sesión de una escuela: secuencia DESEADA de slots (el generador reordena por
 *  demanda neural). `optionalFrom` = índice desde el cual los slots son recortables si la
 *  sesión excede el presupuesto SNC (los firmados JAMÁS se recortan). `focus` restringe los
 *  slots olímpico/complejo a una familia de competencia (arranque-pattern vs envión-pattern):
 *  es la garantía ESTRUCTURAL de que ambos lifts se entrenan cada semana — por diseño, no por
 *  suerte del hash (HIGH-1 de El Carnicero, 2026-06-11). Ausente = mixto. */
export interface SessionArchetype {
  key: string;                 // "A", "B", … — entra al hash de rotación
  slots: SlotKind[];
  optionalFrom?: number;
  focus?: "arranque" | "envion";
}

/** Un candidato del repertorio: id de variante de la librería o de complejo ("cx.*"), con peso
 *  de preferencia para la rotación determinística. */
export interface RepertoireItem { id: string; weight: number }

/** El ADN de una escuela — lo que la hace inconfundible, hecho datos con fuentes citadas. */
export interface SchoolDNA {
  family: MacrocycleFamily;
  character: string;                       // 1 línea es-CL (espejo del rulebook §Escuelas)
  repertoire: Partial<Record<SlotKind, RepertoireItem[]>>;
  /** baseIds que la escuela JAMÁS programa (defensa en profundidad: el generador también filtra). */
  forbidden: string[];
  archetypes: Partial<Record<PhaseRole, SessionArchetype[]>>;
  sessionsPerDay: 1 | 2;                   // 2 = bi-diario (shape listo; v1 todas en 1 — D14)
  tecnicosMax: 1 | 2 | 3;                  // techo duro del sistema: 3 (D8)
  sncBudget: Record<PhaseRole, number>;    // presupuesto de Σsnc por sesión
  dosage: {
    mainBias: "low" | "mid" | "high";      // dónde del corredor imrPct se paran los lifts
    setsBias: -1 | 0 | 1;                  // ± sets sobre la base derivada de volRel
    singlesPhases: PhaseRole[];            // roles donde los clásicos van a 1 rep
  };
  /** Nota de estilo opcional que el generador estampa en los olímpicos (p.ej. "EMOM" ucraniano). */
  sessionNotes?: Partial<Record<SlotKind, string>>;
  sources: string[];                       // literatura que funda el ADN (citada en el dato)
}

// ── Motor Prilepin (core dormant — spec 2026-06-10-motor-prilepin-design.md) ──────────────────

export type EnginePhase = "accumulation" | "intensification" | "peak" | "taper" | "comp_week" | "deload";
export type IntensityZone = "70-80" | "80-90" | "90+";
/** Banda del semáforo diario sobre readiness 0-100 (cortes 70/80, espejo de recoveryState). */
export type ReadinessBand = "green" | "amber" | "red";

export interface EngineInput {
  /** Largo del countdown a la compe FIJADO AL ANCLAR — la compe es la ÚLTIMA semana (n=1 = la
   *  compe es ESTA semana); null = sin competencia → ola continua. Jamás re-derivarlo semana a
   *  semana (D13). Renombrado de `weeksToComp`: el nombre no debe invitar a computar
   *  "distancia" — ese off-by-one correría el peak (N2 de El Carnicero). */
  countdownWeeks: number | null;
  /** Semana del countdown a generar (0-based). REQUERIDO en modo countdown: ausente/degenerado
   *  → null honesto — la posición es estado del cableado, igual que waveWeek (D13c). La
   *  secuencia vivida es phasePlan(n)[weekIdx] por construcción. No se usa en modo ola. */
  weekIdx?: number;
  /** Lift del RM de la casa (D2) — no el enum del bundle. */
  lift: RmLift;
  /** RM vigente del lift en kg (SP5). Acá jamás se estima. */
  rmKg: number;
  /** ACWR reciente de monitor.ts; null = sin dato → sin ajuste, jamás inventar (D7). */
  recentACWR: number | null;
  /** Posición 1-based en la ola si weeksToComp === null. SIN default: la posición en la ola
   *  es estado del cableado; ausente → null honesto (jamás fabricar la semana más pesada). */
  waveWeek?: number;
  /** Banda del día (readinessBand); null/ausente = sin dato. */
  readiness?: ReadinessBand | null;
}

export interface EngineSet { sets: number; reps: number; pct: number; weightKg: number; zone: IntensityZone; }

export interface EngineZoneAudit { zone: IntensityZone; optimalReps: number; prescribedReps: number; withinRange: boolean; }

/** La dosis del motor es POR SESIÓN — la sesión principal del lift en la semana (la tabla
 *  Prilepin es por sesión; `withinRange` se lee contra ESA unidad). El reparto multi-sesión
 *  es del cableado (D14). */
export interface EngineWeek {
  phase: EnginePhase;
  label: string;
  /** Microcopy de supercompensación — explica, no castiga. */
  rationale: string;
  /** Cara del atleta (kg manda; los discos los pinta la UI). */
  sets: EngineSet[];
  /** Material de coach/peek (HR-1: NO va a superficie de atleta — D12). */
  audits: EngineZoneAudit[];
  taper: { base: number; acwrFactor: number; readinessFactor: number; final: number };
  inputs: { acwr: number | null; readiness: ReadinessBand | null };
  /** readiness red + zona 90+ presente → el cableado sugiere mover los singles, no borrarlos. */
  heavySinglesAdvisory: boolean;
}

/** Cara del atleta del motor (redacción en core, patrón redactCycle — D12/HR-1): SOLO
 *  fase/label/rationale/sets. Sin audits, sin factores, sin ACWR crudo (número gameable). */
export interface EngineWeekAthleteView {
  phase: EnginePhase; label: string; rationale: string; sets: EngineSet[];
}

/** Directiva legible del ajuste por readiness (spec 2026-06-12-readiness-modulacion-design):
 *  allow = permitir lo planificado · hold = sostener · cut = recortar · none = sin señal. */
export type ReadinessDirective = "allow" | "hold" | "cut" | "none";

/** Rationale COACH-ONLY de la modulación por readiness que el motor YA aplicó (no recalcula nada;
 *  deriva del EngineWeek — única fuente, sin drift). Read-only, NO va a superficie de atleta,
 *  NO entra al semáforo. Sin readiness → directive "none" honesto. */
export interface ReadinessModulation {
  /** Eco de week.inputs.readiness (null = sin dato). */
  band: ReadinessBand | null;
  directive: ReadinessDirective;
  /** week.taper.readinessFactor (1 / 0.9 / 0.75); null cuando directive === "none". */
  factor: number | null;
  /** Título corto coach-only (la banda en palabras). */
  headline: string;
  /** Explicación legible del ajuste. */
  rationale: string;
  /** Refleja week.heavySinglesAdvisory: mover los singles pesados, no borrarlos (solo "cut"). */
  moveHeavySingles: boolean;
}
