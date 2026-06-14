import type {
  Atleta, Plan, Medal, Competencia, MonitorSeries,
  CycleShare, CycleContext, SessionLog, SessionView, PrescribedExercise, WeekHeat,
  PrCandidate, RmLift, RmUpdate, AthleteDailyView, EngineWeek, MacroHistoryView,
  Competition, CompetitionInput, CompetitionListItem, CompetitionDetailView, CompetitionEntryInput,
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
  /** PREVIEW del motor Prilepin (COACH-ONLY): la semana del motor para un lift, generada desde
   *  los datos reales del atleta. Read-only — NO persiste ni reemplaza la prescripción de
   *  recetas. `null` = sin datos honesto (sin plan/RM vigente, semana fuera de rango). El coach
   *  ve pct/zonas/audits (HR-1: jamás llega a superficie de atleta). */
  getPrilepinWeek(id: string, week: number, lift: RmLift): Promise<EngineWeek | null>;
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
  /** Lazo diario (coach): check-ins crudos del atleta (6 ítems + peso, SIN RPE) + adherencia
   *  reconciliada (atleta > coach > none) de las últimas semanas. El ciclo NUNCA viaja por acá. */
  getDaily(id: string): Promise<AthleteDailyView>;
  /** Historial de macrociclos cerrados (slice macro-history): ciclos más reciente primero +
   *  adherencia % derivada. {entries:[], cyclesDone:0, avgAdherencePct:0} sin historial. */
  getMacroHistory(id: string): Promise<MacroHistoryView>;

  // ── Competencias compartidas del coach (slice 2026-06-14). El coach crea una compe UNA vez y
  //    acopla atletas con rol (pico ancla el macro / paso no toca el plan). Coach-scoped. ──
  /** Catálogo de competencias del coach (con conteo de acoplados por rol). */
  getCompetitions(): Promise<CompetitionListItem[]>;
  /** Detalle de una compe + atletas acoplados. undefined si no existe / no es del coach. */
  getCompetition(id: string): Promise<CompetitionDetailView | undefined>;
  /** Crea una compe; devuelve la fila creada (con su id). */
  createCompetition(input: CompetitionInput): Promise<Competition>;
  /** Edita nombre/fecha/lugar; re-sincroniza el pico de los acoplados. */
  updateCompetition(id: string, input: CompetitionInput): Promise<void>;
  /** Borra la compe (y limpia el anclaje de los acoplados). */
  deleteCompetition(id: string): Promise<void>;
  /** Acopla atletas en lote (upsert por atleta → re-acoplar cambia el rol). */
  acoplarAtletas(id: string, entries: CompetitionEntryInput[]): Promise<void>;
  /** Desacopla un atleta (borra su acople y desancla su pico). */
  desacoplarAtleta(id: string, athleteId: string): Promise<void>;
}
