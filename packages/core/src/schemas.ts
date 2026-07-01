import { z } from "zod";
import type { SessionRegistro } from "./types";

/**
 * Runtime validation schemas for the domain entities. Single source of truth for
 * the *shape* of stored/transmitted data — consumed by the web data boundary
 * (LocalRepository) today and by the Fase 1 API boundary later. Kept in lockstep
 * with the hand-written types in ./types: each repository read asserts the parsed
 * value is assignable to its entity type, so any drift fails `tsc`.
 */

export const MacrocycleLevelSchema = z.enum(["beginner", "intermediate", "advanced", "elite"]);

export const AtletaSchema = z.object({
  id: z.string(),
  nombre: z.string(),
  iniciales: z.string(),
  nivel: MacrocycleLevelSchema,
  sexo: z.enum(["M", "F"]),
  macroId: z.string().optional(),
  compite: z.boolean().optional(),
  needsRm: z.boolean().optional(),
});
export const RosterSchema = z.array(AtletaSchema);

export const MonitorSeriesSchema = z.object({
  weeks: z.number(),
  acute: z.array(z.number()),
  hrv: z.array(z.number()),
  hrvBase: z.number(),
  rhr: z.array(z.number()),
  rhrBase: z.number(),
  imr: z.array(z.number()),
  wellness: z.array(z.number()),
  recovery: z.array(z.number()),
  compliance: z.array(z.number()).optional(),
  rpe: z.array(z.number()).optional(),
  bodyweight: z.array(z.number()).optional(),
  weightBand: z.tuple([z.number(), z.number()]).optional(),
  wellnessItems: z.record(z.string(), z.array(z.number())).optional(),
});

// Bounds below are also the write-input contract (Fase 4): athletes/coaches are untrusted
// writers, so cap free text, array size, and numeric range at the boundary (an unbounded
// kg or NaN would corrupt downstream core math; a giant array/string is a resource vector).
export const MedalSchema = z.object({
  comp: z.string().max(120),
  date: z.string().max(20),
  cat: z.string().max(40),
  medal: z.enum(["oro", "plata", "bronce"]),
  sn: z.number().nonnegative().max(1000),
  cj: z.number().nonnegative().max(1000),
  place: z.string().max(20),
});
export const MedalsSchema = z.array(MedalSchema);

export const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "fecha ISO YYYY-MM-DD")
  // El regex acepta "2026-99-99"; el parser ISO la rechaza (NaN) → fecha de calendario real o nada.
  .refine((s) => !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime()), "fecha de calendario inválida");
export const CompetenciaSchema = z.object({
  name: z.string().max(120),
  week: z.number().int().min(1).max(104),
  date: IsoDateSchema.optional(),
});
export const CompsSchema = z.array(CompetenciaSchema).max(200);

export const SessionMarkSchema = z.object({
  week: z.number().int().min(1).max(104),
  idx: z.number().int().min(0).max(13),
  status: z.enum(["done", "missed"]),
});
export const SessionLogSchema = z.array(SessionMarkSchema).max(2000);

const KgSchema = z.number().positive().max(500); // realistic lift ceiling; positive rejects 0/NaN
export const RMSchema = z.object({
  arranque: KgSchema,
  envion: KgSchema,
  sentadilla: KgSchema,
  frente: KgSchema,
});
export const PlanSchema = z.object({
  atletaId: z.string(),
  macroId: z.string(),
  startWeek: z.number(),
  startDate: IsoDateSchema.optional(),
  rms: RMSchema,
  comps: z.array(CompetenciaSchema),
});

/** Self-coach (atleta autoentrenado): el atleta crea su propio plan. SIN `atletaId` (el server usa
 *  `req.athleteId`, nunca el body). Una competencia opcional. Ancla obligatoria — fecha de compe O
 *  `startDate` — si no, Hoy no puede calcular la semana actual. `startWeek` lo fija el server en 1. */
export const SelfPlanInputSchema = z
  .object({
    macroId: z.string().min(1).max(60),
    rms: RMSchema,
    startDate: IsoDateSchema.optional(),
    comp: z.object({ name: z.string().min(1).max(120), date: IsoDateSchema }).optional(),
  })
  .refine((v) => v.startDate != null || v.comp != null, { message: "ancla requerida: compe o startDate" });
export type SelfPlanInput = z.infer<typeof SelfPlanInputSchema>;

export const CycleShareSchema = z.enum(["full", "min", "none"]);
export const CycleStateSchema = z.enum(["regular", "unreliable", "amenorrhea"]);

// Coach-facing, redacted cycle view — now transmitted over the wire (API → front), so it
// gets a schema too. (Raw share/state never crosses the boundary; only this projection.)
export const CycleContextSchema = z.object({
  share: CycleShareSchema,
  inLutealNow: z.boolean().nullable(),
  health: z.enum(["ok", "referral"]),
  reliable: z.boolean(),
});

// ── Auth + Vínculo wire shapes (Fase 3). The front parses every API response against
// these instead of casting `unknown` — same boundary discipline as the reads above. ──
/** La verdad de la atleta (el registro propio del ciclo). */
export const CycleDataSchema = z.object({
  share: CycleShareSchema,
  state: CycleStateSchema,
  lastPeriodStart: IsoDateSchema.optional(),
  cycleLengthDays: z.number().int().min(21).max(45).optional(),
});
/** Lo que devuelve GET /me/cycle: el registro + si la atleta YA activó el módulo (consintió).
 *  `consented:false` → la UI muestra el gate de activación, no el formulario (PR-L2, §3 opt-in).
 *  `sexo`: el ciclo es female-only (decisión del owner 2026-06-14 — un hombre JAMÁS ve la opción).
 *  Viaja en el view para que TODA superficie del atleta (Cuenta/carrusel/mapa) gatee igual; es el
 *  dato propio de la atleta (sólo /me), nunca llega al coach. */
export const MeCycleViewSchema = CycleDataSchema.extend({ consented: z.boolean(), sexo: z.enum(["M", "F"]) });
export type MeCycleView = z.infer<typeof MeCycleViewSchema>;
/** Input del PUT: el registro + (en la 1ª activación) el acto de consentimiento informado. El
 *  server exige `consent:true` la primera vez; luego es opcional (editar libremente). */
export const PutMeCycleInputSchema = CycleDataSchema.extend({ consent: z.boolean().optional() });

export const RoleSchema = z.enum(["coach", "atleta"]);

export const AuthUserSchema = z.object({
  id: z.string(),
  role: RoleSchema,
  coachId: z.string().nullable(),
  athleteId: z.string().nullable(),
  email: z.string().email().nullable().optional(),
  emailVerified: z.boolean().optional(),
});

export const VinculoEstadoSchema = z.enum(["pendiente", "activo", "rechazado", "revocado"]);

export const VinculoRowSchema = z.object({
  id: z.string(),
  estado: VinculoEstadoSchema,
  athlete: z.object({ id: z.string(), nombre: z.string(), iniciales: z.string() }),
});
export const VinculoRowsSchema = z.array(VinculoRowSchema);

export const InviteSchema = z.object({ inviteCode: z.string().nullable() });
export const InviteCodeSchema = z.object({ inviteCode: z.string() });
export const AcceptResultSchema = z.object({ id: z.string(), estado: VinculoEstadoSchema });

/** Estado del vínculo visto por la atleta (GET /me/vinculo, Cuenta · W5): sólo estado + nombre
 *  del coach — NUNCA inviteCode ni ids de otros atletas. `vinculo: null` = sin vínculo vigente. */
export const MeVinculoSchema = z.object({
  vinculo: z.object({ estado: VinculoEstadoSchema, coachNombre: z.string() }).nullable(),
});

// ── Athlete self-report wire shapes (Proyecto A · /me/*). Items 1-5 + optional weight. The 6
//    items are untrusted writer input → bound each value; date is server-assigned, not in the body. ──
const WellnessValueSchema = z.number().int().min(1).max(5);

export const DayLogInputSchema = z.object({
  fatiga: WellnessValueSchema, dolor: WellnessValueSchema, estres: WellnessValueSchema,
  humor: WellnessValueSchema, motivacion: WellnessValueSchema, sueno: WellnessValueSchema,
  weight: KgSchema.optional(),
});

export const DayLogSchema = z.object({
  date: IsoDateSchema,
  fatiga: WellnessValueSchema, dolor: WellnessValueSchema, estres: WellnessValueSchema,
  humor: WellnessValueSchema, motivacion: WellnessValueSchema, sueno: WellnessValueSchema,
  weight: KgSchema.optional(),
});

/** Stored array of own-written check-ins — validates the LocalMeClient localStorage read. */
export const DayLogsSchema = z.array(DayLogSchema).max(2000);

export const StreakHeadsUpSchema = z.object({
  item: z.enum(["sueno", "estres", "fatiga", "dolor", "motivacion"]),
  days: z.number().int().positive(),
  severity: z.enum(["warn", "alert"]),
  alsoStreaking: z.array(z.enum(["sueno", "estres", "fatiga", "dolor", "motivacion"])),
});

export const CoachRiskSchema = z.object({
  item: z.enum(["sueno", "estres", "fatiga", "dolor", "motivacion"]),
  days: z.number().int().positive(),
  severity: z.enum(["warn", "alert"]),
  alsoStreaking: z.array(z.enum(["sueno", "estres", "fatiga", "dolor", "motivacion"])),
  acwrSustained: z.boolean(),
  readinessBand: z.enum(["green", "amber", "red"]).nullable(),
  loadNote: z.enum(["sobrecarga"]).nullable(),
});
/** Mapa athleteId → riesgo. Sólo atletas CON racha (ausente = sin riesgo). */
export const RosterRiskSchema = z.record(z.string(), CoachRiskSchema);

export const DayLogViewSchema = z.object({
  entry: DayLogSchema.nullable(),
  streak: z.number().int().nonnegative(),
  days: z.array(IsoDateSchema).max(2000),
  today: IsoDateSchema,
  headsUp: StreakHeadsUpSchema.nullable().optional(),
});

export const DayLogResultSchema = z.object({
  entry: DayLogSchema,
  streak: z.number().int().nonnegative(),
});

export const MePlanViewSchema = z.object({
  athlete: z.object({ nombre: z.string(), iniciales: z.string(), sexo: z.enum(["M", "F"]) }),
  plan: z.object({
    macroName: z.string(),
    totalWeeks: z.number().int(),
    currentWeek: z.number().int(),
    currentPhase: z.string(),
    startDate: IsoDateSchema.optional(),
    phases: z.array(z.object({
      name: z.string(), from: z.number().int(), to: z.number().int(), imr: z.number(),
      imrLo: z.number(), imrHi: z.number(), volRel: z.number(), focus: z.string().max(120),
    })).max(20),
    comps: z.array(z.object({ name: z.string(), week: z.number().int() })).max(50),
  }).nullable(),
});

// ── Prescription wire shapes (SP2). The PUT body is untrusted coach input → bounded. ──
const MovementFlagSchema = z.enum(["pausa", "deficit", "tempo", "sin-recibida"]);
// Catalog ids are lowercase base ids + dot-joined variant modifiers (e.g. "arranque.potencia.colgado.rodilla")
// y complejos en el namespace "cx." con eslabones unidos por '+' (e.g. "cx.tiron-cargada+cargada", "cx.a+b+c").
// Constrain the charset (D7) so neither coach nor athlete can inject arbitrary/long strings as a movement id.
const MovementIdSchema = z.string().min(1).max(60).regex(/^[a-z0-9.+\-]+$/);
export const PrescribedExerciseSchema = z.object({
  movementId: MovementIdSchema,
  sets: z.number().int().min(1).max(20),
  reps: z.number().int().min(1).max(50),
  pct: z.number().min(1).max(120).optional(),
  kgOverride: KgSchema.optional(),
  flags: z.array(MovementFlagSchema).max(4).optional(),
  notes: z.string().max(200).optional(),
});
export const PrescribedExercisesSchema = z.array(PrescribedExerciseSchema).max(15);

export const PrescriptionRowSchema = PrescribedExerciseSchema.extend({
  week: z.number().int().min(1).max(104),
  sessionIdx: z.number().int().min(0).max(13),
  order: z.number().int().min(0).max(20),
});
export const PrescriptionRowsSchema = z.array(PrescriptionRowSchema).max(2000);

// ── Calendar heat map wire shape (athlete-safe: % + lift counts, no RM/RPE). ──
export const DayHeatSchema = z.object({
  topPct: z.number().min(1).max(120).optional(),
  // Techo holgado: el máximo teórico schema-legal por día es 15 ej × 20 sets × 50 reps = 15.000.
  lifts: z.number().int().min(0).max(20000),
});
export const WeekHeatSchema = z.object({
  week: z.number().int().min(1).max(104),
  days: z.array(DayHeatSchema.nullable()).length(7),
});
export const WeekHeatsSchema = z.array(WeekHeatSchema).max(104);

// ── Mapa de calor por día (GET /me/heatdays — rediseño 0110). Lectura del atleta: el server arma
//    desde fuentes ya acotadas (sessions/daylog/series) → sólo shape + rangos honestos. NUNCA RPE. ──
export const HeatDayCellSchema = z.object({
  iso: IsoDateSchema,
  future: z.boolean(),
  today: z.boolean(),
  trained: z.boolean(),
  kg: z.number().nonnegative(),
  sessions: z.number().int().nonnegative(),
  wellness: z.number().min(0).max(100).nullable(),
  bw: z.number().min(0).max(500).nullable(), // techo = KgSchema.max(500) del productor (DayLog.weight)
  hrv: z.number().min(0).max(300).nullable(),
  rhr: z.number().min(0).max(250).nullable(),
  comp: z.object({ name: z.string().max(120), note: z.string().max(40) }).optional(),
});
export const HeatWeekRowSchema = z.object({
  startIso: IsoDateSchema,
  days: z.array(HeatDayCellSchema).length(7),
});
export const MeHeatDaysSchema = z.object({
  today: IsoDateSchema,
  weeks: z.array(HeatWeekRowSchema).max(60),
  anchorWeekIdx: z.number().int().min(0),
  macroFromIdx: z.number().int().min(-1),
  macroToIdx: z.number().int().min(-1),
  weightBand: z.tuple([z.number(), z.number()]).optional(),
  category: z.string().max(40).optional(),
  hrvBase: z.number().optional(),
  rhrBase: z.number().optional(),
  wellnessMean: z.number().optional(),
  wellnessStd: z.number().optional(),
});

// ── Motor Prilepin preview wire shape (GET /athletes/:id/prilepin-week — COACH-ONLY). El coach
//    SÍ ve pct/zonas/audits (HR-1: jamás llega a superficie de atleta). `null` = sin datos
//    honesto (sin RM vigente / compe pasada / semana fuera de rango). Sin RPE en ningún campo. ──
export const EnginePhaseSchema = z.enum(["accumulation", "intensification", "peak", "taper", "comp_week", "deload"]);
export const IntensityZoneSchema = z.enum(["70-80", "80-90", "90+"]);
export const ReadinessBandSchema = z.enum(["green", "amber", "red"]);
export const EngineSetSchema = z.object({
  sets: z.number().int().min(1).max(20),
  reps: z.number().int().min(1).max(50),
  pct: z.number().min(1).max(100),
  weightKg: KgSchema,
  zone: IntensityZoneSchema,
});
export const EngineZoneAuditSchema = z.object({
  zone: IntensityZoneSchema,
  optimalReps: z.number().int().min(0).max(100),
  prescribedReps: z.number().int().min(0).max(1000),
  withinRange: z.boolean(),
});
export const EngineWeekSchema = z.object({
  phase: EnginePhaseSchema,
  label: z.string().max(60),
  rationale: z.string().max(300),
  sets: z.array(EngineSetSchema).max(3), // ≤1 set por zona prescrita (3 zonas)
  audits: z.array(EngineZoneAuditSchema).max(3),
  taper: z.object({
    base: z.number(), acwrFactor: z.number(), readinessFactor: z.number(), final: z.number(),
  }),
  inputs: z.object({ acwr: z.number().nullable(), readiness: ReadinessBandSchema.nullable() }),
  heavySinglesAdvisory: z.boolean(),
});
/** El endpoint devuelve el week, o `null` cuando no hay prescripción honesta posible. */
export const PrilepinWeekSchema = EngineWeekSchema.nullable();

// ── Recorrido wire shape (GET /me/recorrido). Lectura: el server ya acotó al escribir los
//    actuals → sólo shape + no-negativos (un kg negativo jamás es verdad). Sin RM/RPE/ACWR. ──
export const RecorridoSemanaSchema = z.object({
  week: z.number().int().min(1).max(104),
  trabajoKg: z.number().nonnegative(),
  calentamientoKg: z.number().nonnegative(),
  sesionesHechas: z.number().int().nonnegative(),
  sesionesTotales: z.number().int().nonnegative(),
});
export const MeRecorridoSchema = z.object({
  semanas: z.array(RecorridoSemanaSchema).max(104),
});

// ── Día a día wire shape (GET /athletes/:id/daily). Lectura coach-only: el server ya acotó al
//    escribir check-ins/actuals → sólo shape + rangos honestos. SIN RPE, SIN ciclo. ──
export const AdherenceStatusSchema = z.enum(["done", "partial", "skipped", "planned", "none"]);
export const AdherenceSourceSchema = z.enum(["athlete", "coach", "none"]);
export const ReconciledSessionSchema = z.object({
  week: z.number().int().min(1).max(104),
  idx: z.number().int().min(0).max(13),
  status: AdherenceStatusSchema,
  source: AdherenceSourceSchema,
});
/** Check-in crudo del atleta (los 6 ítems 1..5 + peso). Mismo rango que DayLog; jamás RPE. */
export const DailyCheckinSchema = z.object({
  date: IsoDateSchema,
  fatiga: WellnessValueSchema, dolor: WellnessValueSchema, estres: WellnessValueSchema,
  humor: WellnessValueSchema, motivacion: WellnessValueSchema, sueno: WellnessValueSchema,
  weight: KgSchema.optional(),
});
export const AthleteDailyViewSchema = z.object({
  today: IsoDateSchema,
  fromDate: IsoDateSchema,
  checkins: z.array(DailyCheckinSchema).max(370),       // ventana ≤ ~1 año de check-ins diarios
  adherence: z.array(ReconciledSessionSchema).max(2000),
});

// ── SP3 actuals wire shapes (untrusted athlete input → bounded). ──
export const SetActualInputSchema = z.object({
  kg: KgSchema.optional(),
  reps: z.number().int().min(0).max(100).optional(),
  done: z.boolean(),
});
export const SetActualsSchema = z.array(SetActualInputSchema).max(20);

export const ExerciseActualInputSchema = z.object({
  order: z.number().int().min(0).max(20),
  movementId: MovementIdSchema,
  prescribedMovementId: MovementIdSchema.optional(),
  done: z.boolean(),
  kg: KgSchema.optional(),
  reps: z.number().int().min(0).max(100).optional(), // 0 = intentó pero completó 0 reps (serie fallida)
  note: z.string().max(200).optional(),
  sets: SetActualsSchema.optional(),
});
export const SessionActualsInputSchema = z.array(ExerciseActualInputSchema).max(15);
export type ExerciseActualInput = z.infer<typeof ExerciseActualInputSchema>;

/** Envelope del PUT /me/session (spec 2026-06-12 D4): fecha del entreno + actuals. Sin
 *  retrocompat con el array pelado (pre-launch, cliente y server se despliegan juntos). */
export const PutMeSessionInputSchema = z.object({
  fecha: IsoDateSchema.optional(),
  actuals: SessionActualsInputSchema,
});
export type PutMeSessionInput = z.infer<typeof PutMeSessionInputSchema>;

export const SessionRegistroSchema: z.ZodType<SessionRegistro> = z.object({
  week: z.number().int().min(1).max(104),
  sessionIdx: z.number().int().min(0).max(13),
  fecha: IsoDateSchema,
  estado: z.enum(["hecho", "anulado"]).optional(),
});
/** Array listo para el read-side local (espejo del SessionActualsSchema). */
export const SessionRegistrosSchema = z.array(SessionRegistroSchema);

// The actual rides the prescribed-exercise view (no `order` — positional). Extend the view schema.
// Read-side (lo que el server ya validó al escribir) → sin bounds; el INPUT (ExerciseActualInputSchema) es el que acota.
export const ExerciseActualSchema = z.object({
  done: z.boolean(),
  kg: z.number().optional(),
  reps: z.number().optional(),
  note: z.string().optional(),
  movementId: z.string(),
  movementName: z.string(),
  substituted: z.boolean(),
  desfasado: z.boolean(),
  sets: SetActualsSchema.optional(),
});

// Stored session actual (read-side: the API/LocalMeClient already validated it on write) → no
// bounds, like ExerciseActualSchema above. Validates own-written localStorage reads in LocalMeClient.
export const SessionActualSchema = z.object({
  week: z.number().int(),
  sessionIdx: z.number().int(),
  order: z.number().int(),
  movementId: z.string(),
  prescribedMovementId: z.string().optional(),
  done: z.boolean(),
  actualKg: z.number().optional(),
  actualReps: z.number().optional(),
  note: z.string().optional(),
  doneAt: z.string().optional(),
  sets: SetActualsSchema.optional(),
});
export const SessionActualsSchema = z.array(SessionActualSchema).max(2000);

export const WarmupSetSchema = z.object({
  pct: z.number(),
  kg: z.number(),
  reps: z.number().int(),
  label: z.enum(["barra", "rampa"]),
});

export const PrescribedExerciseViewSchema = PrescribedExerciseSchema.extend({
  movementName: z.string(),
  targetKg: z.number().optional(),
  actual: ExerciseActualSchema.optional(),
  warmup: z.array(WarmupSetSchema).max(8).default([]),
});
export const SessionViewSchema = z.object({
  week: z.number().int().min(1).max(104),
  sessionIdx: z.number().int().min(0).max(13),
  exercises: z.array(PrescribedExerciseViewSchema).max(15),
  day: z.number().int().optional(),
  turno: z.enum(["AM", "PM"]).optional(),
  fecha: z.string().optional(), // read-side: el server ya validó al escribir (patrón de la casa)
  anulado: z.boolean().optional(), // secuencia de días (2026-06-13): día saltado por el atleta
});
export const SessionViewsSchema = z.array(SessionViewSchema).max(14);

// ── SP5 RMs: historial + PRs. El INPUT del coach va acotado (KgSchema, 1..4, sin duplicados);
//    las lecturas validan shape (el server ya acotó al escribir). ──
export const RmLiftSchema = z.enum(["arranque", "envion", "sentadilla", "frente"]);
export const RmReasonSchema = z.enum(["assign", "manual", "pr"]);

export const RmUpdateSchema = z.object({
  lift: RmLiftSchema,
  kg: z.number().positive(),
  setAt: IsoDateSchema,
  reason: RmReasonSchema,
});
export const RmUpdatesSchema = z.array(RmUpdateSchema).max(5000);

export const PrCandidateSchema = z.object({
  lift: RmLiftSchema,
  movementId: z.string(),
  movementName: z.string(),
  kg: z.number().positive(),
  week: z.number().int().min(1).max(104),
  sessionIdx: z.number().int().min(0).max(13),
  doneAt: IsoDateSchema.optional(),
});
export const PrCandidatesSchema = z.array(PrCandidateSchema).max(4);

// ── Historial de macrociclos (slice macro-history). El % de adherencia viaja calculado por el
//    server (core macroHistoryView) — el cliente lo valida pero jamás lo recalcula. ──
export const MacroHistoryEntrySchema = z.object({
  macroId: z.string().max(60),
  macroName: z.string().max(120),
  ordinal: z.number().int().min(1).max(1000),
  startDate: IsoDateSchema,
  endDate: IsoDateSchema,
  weeks: z.number().int().min(1).max(104),
  sessionsDone: z.number().int().min(0).max(10000),
  sessionsTotal: z.number().int().min(0).max(10000),
  adherencePct: z.number().int().min(0).max(100),
  rmEnd: RMSchema.optional(),
});
export const MacroHistoryViewSchema = z.object({
  entries: z.array(MacroHistoryEntrySchema).max(200),
  cyclesDone: z.number().int().min(0).max(1000),
  avgAdherencePct: z.number().int().min(0).max(100),
});

export const UpdateRmsInputSchema = z.object({
  // "assign" no es input del coach — sólo lo escribe savePlan al asignar.
  updates: z
    .array(z.object({ lift: RmLiftSchema, kg: KgSchema }))
    .min(1)
    .max(4)
    .refine((u) => new Set(u.map((x) => x.lift)).size === u.length, "lift duplicado"),
  reason: z.enum(["manual", "pr"]),
});

// ── Competencias compartidas del coach (slice 2026-06-14). El input del coach es untrusted →
//    acotado (free text/array). Las vistas de lectura validan shape (el server ya acotó al escribir). ──
export const CompRoleSchema = z.enum(["pico", "paso"]);

export const CompetitionInputSchema = z.object({
  name: z.string().min(1).max(120),
  date: IsoDateSchema,
  place: z.string().max(120).optional(),
});

export const CompetitionEntryInputSchema = z.object({
  athleteId: z.string().min(1).max(60),
  role: CompRoleSchema,
});
/** Acople en lote: 1..200 atletas en una sola llamada. */
export const AcoplarInputSchema = z.object({
  entries: z.array(CompetitionEntryInputSchema).min(1).max(200),
});

export const CompResultSchema = z.object({
  medal: z.enum(["oro", "plata", "bronce"]),
  cat: z.string().max(40),
  sn: z.number().nonnegative().max(1000),
  cj: z.number().nonnegative().max(1000),
  place: z.string().max(20),
});

export const CompetitionSchema = z.object({
  id: z.string(),
  name: z.string().max(120),
  date: IsoDateSchema,
  place: z.string().max(120).optional(),
});
export const CompetitionListItemSchema = CompetitionSchema.extend({
  athleteCount: z.number().int().nonnegative(),
  picoCount: z.number().int().nonnegative(),
  pasoCount: z.number().int().nonnegative(),
});
export const CompetitionListSchema = z.array(CompetitionListItemSchema).max(500);
export const CompetitionEntryViewSchema = z.object({
  athleteId: z.string(),
  nombre: z.string(),
  iniciales: z.string(),
  role: CompRoleSchema,
  peakWeek: z.number().int().min(1).max(104).optional(),
  result: CompResultSchema.optional(),
});
export const CompetitionDetailViewSchema = CompetitionSchema.extend({
  entries: z.array(CompetitionEntryViewSchema).max(500),
});
