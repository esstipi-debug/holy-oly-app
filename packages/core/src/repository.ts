import type {
  Atleta, Plan, Medal, Competencia, MonitorSeries,
  CycleShare, CycleContext, SessionLog, SessionView, PrescribedExercise, WeekHeat,
  PrCandidate, RmLift, RmUpdate,
} from "./types";

export interface Repository {
  getRoster(): Promise<Atleta[]>;
  getAthlete(id: string): Promise<Atleta | undefined>;
  getSeries(id: string): Promise<MonitorSeries | undefined>;
  getPlan(id: string): Promise<Plan | undefined>;
  /**
   * Persist the plan's scalar fields (atletaId, macroId, startWeek, rms). The HTTP backend
   * intentionally ignores `plan.comps` — competitions are owned by `setComps` and live in
   * their own store — so do not rely on `getPlan().comps` reflecting a value passed here.
   * (Formal Plan/Competencia reconciliation is M5.)
   */
  savePlan(plan: Plan): Promise<void>;
  getMedals(id: string): Promise<Medal[]>;
  addMedal(id: string, medal: Medal): Promise<void>;
  getComps(id: string): Promise<Competencia[]>;
  setComps(id: string, comps: Competencia[]): Promise<void>;
  /** Coach-tracked session adherence (did each planned session happen). Sparse; unmarked = pending. */
  getSessionLog(id: string): Promise<SessionLog>;
  setSessionLog(id: string, log: SessionLog): Promise<void>;
  /** Coach-visible sharing level (for UI copy "compartido" vs "reservado"). */
  getCycleShare(id: string): Promise<CycleShare>;
  /** Redacted coach-facing cycle view; undefined when share === "none". */
  getCycleContext(id: string): Promise<CycleContext | undefined>;
  /** A week's sessions with kg derived from the athlete's plan RMs. [] if no plan or no recipe. */
  getPrescriptionWeek(id: string, week: number): Promise<SessionView[]>;
  /** Per-day intensity/volume aggregate of the WHOLE plan (calendar heat map). [] if no plan. */
  getPlanHeat(id: string): Promise<WeekHeat[]>;
  /** Replace one session's exercises (coach edit). Valid after savePlan has instantiated the
   *  athlete's prescription; coach-authorized server-side. */
  setSession(id: string, week: number, sessionIdx: number, exercises: PrescribedExercise[]): Promise<void>;
  /** Sube/edita 1+ RMs del plan a mitad de ciclo SIN re-instanciar (el kg derivado recae solo).
   *  `reason`: "manual" (edición del coach) | "pr" (confirmación de un PR detectado). */
  updateRms(id: string, updates: { lift: RmLift; kg: number }[], reason: "manual" | "pr"): Promise<void>;
  /** Sets hechos que SUPERAN el RM vigente (sugerencias de PR; ≤1 por lift). [] sin plan. */
  getPrCandidates(id: string): Promise<PrCandidate[]>;
  /** Historial append-only de RMs, más nuevo primero. [] sin historial (planes pre-SP5). */
  getRmHistory(id: string): Promise<RmUpdate[]>;
}
