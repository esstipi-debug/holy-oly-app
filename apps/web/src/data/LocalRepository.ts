import type {
  Repository, Atleta, Plan, Medal, Competencia, MonitorSeries,
  CycleShare, CycleState, CycleContext, SessionLog, SessionView, PrescribedExercise, PrescriptionRow, WeekHeat,
  PrCandidate, RmLift, RmUpdate, AthleteDailyView, EngineWeek, MacroHistoryView,
  Competition, CompetitionInput, CompetitionListItem, CompetitionDetailView, CompetitionEntryView, CompetitionEntryInput, CompResult, CompRole,
  CoachRisk,
} from "@holy-oly/core";
import {
  RosterSchema, MonitorSeriesSchema, PlanSchema, MedalsSchema,
  CompsSchema, SessionLogSchema, CycleShareSchema, CycleStateSchema,
  PrescriptionRowsSchema, RmUpdatesSchema, SessionActualsSchema, DayLogsSchema, MacroHistoryViewSchema,
  MACROCYCLES, ALL_RECIPES, instantiatePrescription, buildSessionViews, defaultStartDate, planHeat,
  prCandidates, RM_LIFTS, lutealNow, redactCycle, buildDailyView, DAILY_WINDOW_WEEKS, prilepinPreviewWeek, planNeedsRm,
  competenciaForPico, coachStreakRisk,
} from "@holy-oly/core";
import { JsonStore } from "./storage";
import { KEYS } from "./keys";
import { SEED_ROSTER, SEED_SERIES, SEED_CYCLE, SEED_MEDALS, SEED_COMPS, SEED_VERSION, SEED_PLAN_INPUTS, makeDayLogYear, makeMacroHistory } from "./seeds";

/** Acople persistido en el demo offline (espejo de CompetitionEntry del API). */
interface StoredEntry { athleteId: string; role: CompRole; result?: CompResult }
/** Competencia compartida persistida en localStorage (demo offline; el coach es implícito). */
interface StoredCompetition { id: string; name: string; date: string; place?: string; entries: StoredEntry[] }

export class LocalRepository implements Repository {
  private s: JsonStore;
  constructor(backend: Storage = localStorage) { this.s = new JsonStore(backend); }

  /** Idempotent within a version: seeds once, guarded by SEED_VERSION so a version bump re-seeds. */
  init(): void {
    if (this.s.get<number>(KEYS.seeded, 0) === SEED_VERSION) return;
    this.s.set(KEYS.roster, SEED_ROSTER);
    for (const a of SEED_ROSTER) {
      const series = SEED_SERIES[a.id];
      if (series) this.s.set(KEYS.series(a.id), series);
      const medals = SEED_MEDALS[a.id];
      if (medals) this.s.set(KEYS.medals(a.id), medals);
      const comps = SEED_COMPS[a.id];
      if (comps) this.s.set(KEYS.comps(a.id), comps);
      const cyc = SEED_CYCLE[a.id] ?? { share: "min" as CycleShare, state: "regular" as CycleState };
      this.s.set(KEYS.cycleShare(a.id), cyc.share);
      this.s.set(KEYS.cycleState(a.id), cyc.state);
      if (cyc.lastPeriodStart != null) this.s.set(KEYS.cycleStart(a.id), cyc.lastPeriodStart);
      if (cyc.cycleLengthDays != null) this.s.set(KEYS.cycleLen(a.id), cyc.cycleLengthDays);
      // PR-L2: los atletas demo arrancan ya "activados" (la demo muestra el registro, no el gate).
      this.s.set(KEYS.cycleConsented(a.id), true);
    }
    // Athlete-demo seed: an assigned plan (+ its instantiated prescription) and a year of check-ins,
    // so the offline athlete app (LocalMeClient) opens fully populated. startDate anchors today to
    // the chosen currentWeek; the prescription is instantiated exactly as savePlan would.
    const today = new Date().toISOString().slice(0, 10);
    for (const [id, inp] of Object.entries(SEED_PLAN_INPUTS)) {
      const macro = MACROCYCLES.find((m) => m.id === inp.macroId);
      const totalWeeks = macro ? (macro.phaseProfile[macro.phaseProfile.length - 1]?.weeks[1] ?? 0) : 0;
      const plan: Plan = {
        atletaId: id, macroId: inp.macroId, startWeek: 1,
        startDate: defaultStartDate(today, inp.currentWeek), rms: inp.rms, comps: inp.comps,
      };
      this.s.set(KEYS.plan(id), plan);
      this.s.set(KEYS.prescription(id), macro ? instantiatePrescription(ALL_RECIPES, macro, totalWeeks) : []);
      this.s.set(KEYS.dayLog(id), makeDayLogYear(today));
    }
    // Slice macro-history: ciclos cerrados (constancia entre ciclos) — espejo del seed del API.
    for (const [id, view] of Object.entries(makeMacroHistory(today))) {
      this.s.set(KEYS.macroHistory(id), view);
    }
    this.s.set(KEYS.seeded, SEED_VERSION);
  }

  async getRoster(): Promise<Atleta[]> {
    // All-or-nothing: one invalid athlete rejects the whole roster → []. Acceptable because
    // the roster is seeded atomically and SEED_VERSION re-seeds on shape changes.
    const r = RosterSchema.safeParse(this.s.getOptional<unknown>(KEYS.roster));
    if (!r.success) return [];
    // needsRm: mirror del API — sin plan o rms incompleto ⇒ falta RM (alerta del Plantel).
    return r.data.map((a) => ({ ...a, needsRm: planNeedsRm(this.planFor(a.id)) }));
  }

  async getRosterRisk(): Promise<Record<string, CoachRisk>> {
    const today = new Date().toISOString().slice(0, 10);
    const roster = await this.getRoster();
    const out: Record<string, CoachRisk> = {};
    for (const a of roster) {
      const logs = DayLogsSchema.safeParse(this.s.getOptional<unknown>(KEYS.dayLog(a.id)));
      const series = MonitorSeriesSchema.safeParse(this.s.getOptional<unknown>(KEYS.series(a.id)));
      const risk = coachStreakRisk(logs.success ? logs.data : [], series.success ? series.data : undefined, today);
      if (risk) out[a.id] = risk;
    }
    return out;
  }

  private planFor(id: string): Plan | undefined {
    const r = PlanSchema.safeParse(this.s.getOptional<unknown>(KEYS.plan(id)));
    return r.success ? r.data : undefined;
  }
  async getAthlete(id: string): Promise<Atleta | undefined> {
    return (await this.getRoster()).find((a) => a.id === id);
  }
  async getSeries(id: string): Promise<MonitorSeries | undefined> {
    const r = MonitorSeriesSchema.safeParse(this.s.getOptional<unknown>(KEYS.series(id)));
    return r.success ? r.data : undefined;
  }
  async getPlan(id: string): Promise<Plan | undefined> {
    const r = PlanSchema.safeParse(this.s.getOptional<unknown>(KEYS.plan(id)));
    return r.success ? r.data : undefined;
  }
  async savePlan(plan: Plan): Promise<void> {
    this.s.set(KEYS.plan(plan.atletaId), plan);
    const macro = MACROCYCLES.find((m) => m.id === plan.macroId);
    const totalWeeks = macro ? (macro.phaseProfile[macro.phaseProfile.length - 1]?.weeks[1] ?? 0) : 0;
    const rows: PrescriptionRow[] = macro ? instantiatePrescription(ALL_RECIPES, macro, totalWeeks) : [];
    this.s.set(KEYS.prescription(plan.atletaId), rows);
    // SP5: cada asignación fija los 4 RMs → baseline del historial (mirror del API).
    // setAt = HOY (la fecha del acto de fijarlos, no el startDate — que con anclaje por compe
    // cae en el pasado y retro-fechar mostraría falso-stale sobre RMs recién tipeados).
    const setAt = new Date().toISOString().slice(0, 10);
    this.appendRmUpdates(plan.atletaId, RM_LIFTS.map((lift) => ({ lift, kg: plan.rms[lift], setAt, reason: "assign" as const })));
  }
  async getMedals(id: string): Promise<Medal[]> {
    const r = MedalsSchema.safeParse(this.s.getOptional<unknown>(KEYS.medals(id)));
    return r.success ? r.data : [];
  }
  async addMedal(id: string, medal: Medal): Promise<void> {
    this.s.set(KEYS.medals(id), [...(await this.getMedals(id)), medal]);
  }
  async getComps(id: string): Promise<Competencia[]> {
    const r = CompsSchema.safeParse(this.s.getOptional<unknown>(KEYS.comps(id)));
    return r.success ? r.data : [];
  }
  async setComps(id: string, comps: Competencia[]): Promise<void> { this.s.set(KEYS.comps(id), comps); }
  async getSessionLog(id: string): Promise<SessionLog> {
    const r = SessionLogSchema.safeParse(this.s.getOptional<unknown>(KEYS.sessionLog(id)));
    return r.success ? r.data : [];
  }
  async setSessionLog(id: string, log: SessionLog): Promise<void> { this.s.set(KEYS.sessionLog(id), log); }

  private prescriptionRows(id: string): PrescriptionRow[] {
    const parsed = PrescriptionRowsSchema.safeParse(this.s.getOptional<unknown>(KEYS.prescription(id)));
    return parsed.success ? parsed.data : [];
  }
  async getPrescriptionWeek(id: string, week: number): Promise<SessionView[]> {
    const plan = await this.getPlan(id);
    if (!plan) return [];
    const all = this.prescriptionRows(id);
    return buildSessionViews(all.filter((r) => r.week === week), plan.rms);
  }
  async setSession(id: string, week: number, sessionIdx: number, exercises: PrescribedExercise[]): Promise<void> {
    const all = this.prescriptionRows(id);
    const kept = all.filter((r) => !(r.week === week && r.sessionIdx === sessionIdx));
    const added: PrescriptionRow[] = exercises.map((ex, order) => ({ ...ex, week, sessionIdx, order }));
    this.s.set(KEYS.prescription(id), [...kept, ...added]);
  }
  /** Per-day heat of the whole plan (calendar map). Mirrors the API's repo.getPlanHeat. */
  async getPlanHeat(id: string): Promise<WeekHeat[]> {
    const plan = await this.getPlan(id);
    if (!plan) return [];
    const macro = MACROCYCLES.find((m) => m.id === plan.macroId);
    const totalWeeks = macro ? (macro.phaseProfile[macro.phaseProfile.length - 1]?.weeks[1] ?? 0) : 0;
    if (totalWeeks === 0) return [];
    return planHeat(this.prescriptionRows(id), totalWeeks);
  }

  /** PREVIEW del motor Prilepin (coach-only). Mirror del API repo.getPrilepinWeek: genera la
   *  semana del motor desde plan+comps+serie, SIN persistir. `null` = sin datos honesto. */
  async getPrilepinWeek(id: string, week: number, lift: RmLift): Promise<EngineWeek | null> {
    const plan = await this.getPlan(id);
    if (!plan) return null;
    const macro = MACROCYCLES.find((m) => m.id === plan.macroId);
    const totalWeeks = macro ? (macro.phaseProfile[macro.phaseProfile.length - 1]?.weeks[1] ?? 0) : 0;
    if (totalWeeks === 0) return null;
    const series = await this.getSeries(id);
    return prilepinPreviewWeek({ lift, rms: plan.rms, requestedWeek: week, totalWeeks, comps: plan.comps, series });
  }

  // ── SP5: RMs a mitad de ciclo (mirror del API). updateRms NO re-instancia. ──
  private rmRows(id: string): RmUpdate[] {
    const r = RmUpdatesSchema.safeParse(this.s.getOptional<unknown>(KEYS.rmUpdates(id)));
    return r.success ? r.data : [];
  }
  private appendRmUpdates(id: string, rows: RmUpdate[]): void {
    this.s.set(KEYS.rmUpdates(id), [...this.rmRows(id), ...rows]);
  }
  async updateRms(id: string, updates: { lift: RmLift; kg: number }[], reason: "manual" | "pr"): Promise<void> {
    const plan = await this.getPlan(id);
    if (!plan) throw new Error("sin plan");
    const rms = { ...plan.rms };
    for (const u of updates) rms[u.lift] = u.kg;
    // Set directo del plan — NO savePlan (re-instanciaría y pisaría las ediciones del coach).
    this.s.set(KEYS.plan(id), { ...plan, rms });
    const today = new Date().toISOString().slice(0, 10);
    this.appendRmUpdates(id, updates.map((u) => ({ lift: u.lift, kg: u.kg, setAt: today, reason })));
  }
  async getPrCandidates(id: string): Promise<PrCandidate[]> {
    const plan = await this.getPlan(id);
    if (!plan) return [];
    const r = SessionActualsSchema.safeParse(this.s.getOptional<unknown>(KEYS.sessionActuals(id)));
    return prCandidates(r.success ? r.data : [], plan.rms);
  }
  async getRmHistory(id: string): Promise<RmUpdate[]> {
    return [...this.rmRows(id)].reverse(); // append-order → más nuevo primero
  }

  // ── Lazo diario (mirror del API repo.getDailyView). Check-ins crudos + adherencia reconciliada
  //    (atleta > coach > none). El CRITERIO (ventana/dedup/reconciliación) vive en core
  //    `buildDailyView` — espejo exacto del repo Http. El ciclo JAMÁS sale por acá. ──
  async getDaily(id: string): Promise<AthleteDailyView> {
    const today = new Date().toISOString().slice(0, 10);
    const plan = await this.getPlan(id);
    const dl = DayLogsSchema.safeParse(this.s.getOptional<unknown>(KEYS.dayLog(id)));
    const sa = SessionActualsSchema.safeParse(this.s.getOptional<unknown>(KEYS.sessionActuals(id)));
    const sl = SessionLogSchema.safeParse(this.s.getOptional<unknown>(KEYS.sessionLog(id)));

    return buildDailyView({
      today,
      windowWeeks: DAILY_WINDOW_WEEKS,
      macroId: plan?.macroId ?? null,
      startDate: plan?.startDate ?? null,
      dayLogs: dl.success ? dl.data : [],
      prescription: this.prescriptionRows(id).map((r) => ({ week: r.week, sessionIdx: r.sessionIdx })),
      actuals: sa.success ? sa.data : [],
      marks: sl.success ? sl.data : [],
    });
  }

  async getCycleShare(id: string): Promise<CycleShare> {
    const r = CycleShareSchema.safeParse(this.s.getOptional<unknown>(KEYS.cycleShare(id)));
    return r.success ? r.data : "none";
  }
  /** Redaction by construction (core redactCycle): never exposes phase/day/symptom. */
  async getCycleContext(id: string): Promise<CycleContext | undefined> {
    const share = await this.getCycleShare(id);
    const stateParsed = CycleStateSchema.safeParse(this.s.getOptional<unknown>(KEYS.cycleState(id)));
    const state: CycleState = stateParsed.success ? stateParsed.data : "regular";
    // Lúteo REAL sólo bajo "full" + estado regular + datos (mirror de repo.getCycle del API).
    let luteal: boolean | null = null;
    if (share === "full" && state === "regular") {
      const start = this.s.getOptional<unknown>(KEYS.cycleStart(id));
      const len = Number(this.s.getOptional<unknown>(KEYS.cycleLen(id)));
      // Mismo formato que valida LocalMeClient: storage corrupto jamás fabrica el booleano del coach.
      if (typeof start === "string" && /^\d{4}-\d{2}-\d{2}$/.test(start) && Number.isFinite(len)) {
        luteal = lutealNow(start, len, new Date().toISOString().slice(0, 10));
      }
    }
    return redactCycle(share, state, luteal);
  }

  // ── Historial de macrociclos cerrados (slice macro-history). Espejo del API. ──
  async getMacroHistory(id: string): Promise<MacroHistoryView> {
    const r = MacroHistoryViewSchema.safeParse(this.s.getOptional<unknown>(KEYS.macroHistory(id)));
    return r.success ? r.data : { entries: [], cyclesDone: 0, avgAdherencePct: 0 };
  }

  // ── Competencias compartidas del coach (slice 2026-06-14). Demo offline: persiste en
  //    localStorage; el pico NO re-sincroniza la fila Competencia del atleta (eso vive en el
  //    backend real). El detalle deriva peakWeek del plan, igual que el API. ──
  private storedComps(): StoredCompetition[] {
    const v = this.s.getOptional<unknown>(KEYS.competitions);
    return Array.isArray(v) ? (v as StoredCompetition[]) : [];
  }
  async getCompetitions(): Promise<CompetitionListItem[]> {
    return this.storedComps().map((c) => ({
      id: c.id, name: c.name, date: c.date, place: c.place,
      athleteCount: c.entries.length,
      picoCount: c.entries.filter((e) => e.role === "pico").length,
      pasoCount: c.entries.filter((e) => e.role === "paso").length,
    }));
  }
  async getCompetition(id: string): Promise<CompetitionDetailView | undefined> {
    const c = this.storedComps().find((x) => x.id === id);
    if (!c) return undefined;
    const roster = await this.getRoster();
    const entries: CompetitionEntryView[] = [];
    for (const e of c.entries) {
      const a = roster.find((r) => r.id === e.athleteId);
      let peakWeek: number | undefined;
      if (e.role === "pico") {
        const plan = await this.getPlan(e.athleteId);
        const macro = MACROCYCLES.find((m) => m.id === plan?.macroId);
        const totalWeeks = macro ? (macro.phaseProfile[macro.phaseProfile.length - 1]?.weeks[1] ?? 0) : 0;
        peakWeek = competenciaForPico({ name: c.name, date: c.date }, plan?.startDate, totalWeeks)?.week;
      }
      entries.push({
        athleteId: e.athleteId,
        nombre: a?.nombre ?? e.athleteId,
        iniciales: a?.iniciales ?? "?",
        role: e.role,
        ...(peakWeek != null ? { peakWeek } : {}),
        ...(e.result ? { result: e.result } : {}),
      });
    }
    entries.sort((a, b) => (a.role === b.role ? a.nombre.localeCompare(b.nombre) : a.role === "pico" ? -1 : 1));
    return { id: c.id, name: c.name, date: c.date, place: c.place, entries };
  }
  async createCompetition(input: CompetitionInput): Promise<Competition> {
    const c: StoredCompetition = { id: crypto.randomUUID(), name: input.name, date: input.date, place: input.place, entries: [] };
    this.s.set(KEYS.competitions, [...this.storedComps(), c]);
    return { id: c.id, name: c.name, date: c.date, place: c.place };
  }
  async updateCompetition(id: string, input: CompetitionInput): Promise<void> {
    this.s.set(KEYS.competitions, this.storedComps().map((c) => (c.id === id ? { ...c, name: input.name, date: input.date, place: input.place } : c)));
  }
  async deleteCompetition(id: string): Promise<void> {
    this.s.set(KEYS.competitions, this.storedComps().filter((c) => c.id !== id));
  }
  async acoplarAtletas(id: string, entries: CompetitionEntryInput[]): Promise<void> {
    this.s.set(KEYS.competitions, this.storedComps().map((c) => {
      if (c.id !== id) return c;
      const next = [...c.entries];
      for (const e of entries) {
        const i = next.findIndex((x) => x.athleteId === e.athleteId);
        if (i >= 0) next[i] = { ...next[i]!, role: e.role };
        else next.push({ athleteId: e.athleteId, role: e.role });
      }
      return { ...c, entries: next };
    }));
  }
  async desacoplarAtleta(id: string, athleteId: string): Promise<void> {
    this.s.set(KEYS.competitions, this.storedComps().map((c) => (c.id === id ? { ...c, entries: c.entries.filter((e) => e.athleteId !== athleteId) } : c)));
  }
}
