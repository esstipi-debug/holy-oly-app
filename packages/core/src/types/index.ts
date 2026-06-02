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

export type VinculoEstado = "pendiente" | "activo" | "rechazado" | "revocado";
export interface Vinculo {
  id: Id; coachId: Id; atletaId: Id;
  estado: VinculoEstado; iniciadoPor: "atleta";
}

export interface Atleta {
  id: Id; nombre: string; iniciales: string;
  nivel: MacrocycleLevel; macroId?: string; compite?: boolean;
}
