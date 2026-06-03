import type {
  Atleta, Plan, Medal, Competencia, MonitorSeries,
  CycleShare, CycleContext, SessionLog, SessionView, PrescribedExercise,
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
  /** Replace one session's exercises (coach edit). */
  setSession(id: string, week: number, sessionIdx: number, exercises: PrescribedExercise[]): Promise<void>;
}
