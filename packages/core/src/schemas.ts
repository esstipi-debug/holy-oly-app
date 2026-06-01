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

export const MedalSchema = z.object({
  comp: z.string(),
  date: z.string(),
  cat: z.string(),
  medal: z.enum(["oro", "plata", "bronce"]),
  sn: z.number(),
  cj: z.number(),
  place: z.string(),
});
export const MedalsSchema = z.array(MedalSchema);

export const CompetenciaSchema = z.object({ name: z.string(), week: z.number() });
export const CompsSchema = z.array(CompetenciaSchema);

export const RMSchema = z.object({
  arranque: z.number(),
  envion: z.number(),
  sentadilla: z.number(),
  frente: z.number(),
});
export const PlanSchema = z.object({
  atletaId: z.string(),
  macroId: z.string(),
  startWeek: z.number(),
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
