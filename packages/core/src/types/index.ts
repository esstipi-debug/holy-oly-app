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

/** Hand-curated base lift. Declares which axes it admits; variants are generated from these. */
export interface MovementBase {
  id: string;            // slug: "arranque", "tiron-arranque", "sentadilla-frente"…
  name: string;          // "Arranque"
  aliasEn?: string;      // "Snatch" — bilingual search
  rmRef: RmRef;
  baseComplexity: number;
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
  modifiers: MovementModifiers;
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
export interface SessionTemplate { exercises: PrescribedExercise[] }
export interface PhaseTemplate { phaseKey: string; sessions: SessionTemplate[] } // sessions[idx], idx 0-based
export interface MacroRecipe { macroId: string; phases: PhaseTemplate[] }

/** A concrete prescription row of an athlete (a PrescribedExercise + its location). */
export interface PrescriptionRow extends PrescribedExercise { week: number; sessionIdx: number; order: number }
/** A prescribed exercise with its display name + derived target kg, for the front. */
export interface PrescribedExerciseView extends PrescribedExercise { movementName: string; targetKg?: number; actual?: ExerciseActual; warmup?: WarmupSet[] }
/** One instantiated session (a column in the week), kg already derived. */
export interface SessionView { week: number; sessionIdx: number; exercises: PrescribedExerciseView[] }

/** One day's heat aggregate (calendar heat map). `topPct` absent = no % data that day. */
export interface DayHeat { topPct?: number; lifts: number }
/** A plan week's 7 day slots (Monday-first; session i → day i). `null` = rest day. */
export interface WeekHeat { week: number; days: (DayHeat | null)[] }

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
