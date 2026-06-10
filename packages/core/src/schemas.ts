import { z } from "zod";

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

const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "fecha ISO YYYY-MM-DD");
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

export const DayLogViewSchema = z.object({
  entry: DayLogSchema.nullable(),
  streak: z.number().int().nonnegative(),
  days: z.array(IsoDateSchema).max(2000),
  today: IsoDateSchema,
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
// Catalog ids are lowercase base ids + dot-joined variant modifiers (e.g. "arranque.potencia.colgado.rodilla").
// Constrain the charset (D7) so neither coach nor athlete can inject arbitrary/long strings as a movement id.
const MovementIdSchema = z.string().min(1).max(60).regex(/^[a-z0-9.\-]+$/);
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
});
export const PrCandidatesSchema = z.array(PrCandidateSchema).max(4);

export const UpdateRmsInputSchema = z.object({
  // "assign" no es input del coach — sólo lo escribe savePlan al asignar.
  updates: z
    .array(z.object({ lift: RmLiftSchema, kg: KgSchema }))
    .min(1)
    .max(4)
    .refine((u) => new Set(u.map((x) => x.lift)).size === u.length, "lift duplicado"),
  reason: z.enum(["manual", "pr"]),
});
