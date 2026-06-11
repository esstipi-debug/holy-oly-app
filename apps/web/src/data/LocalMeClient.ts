/**
 * Athlete-self data offline (standalone demo). The local twin of `httpMeClient` / the API's
 * `/me/*` routes: it reads & writes the SAME localStorage the coach `LocalRepository` seeds, and
 * reuses the SAME pure `core` functions the server does — so the athlete app runs with no backend.
 *
 * Identity: in the demo there is no session, so "me" is a fixed athlete (Kevin). The class mirrors
 * `apps/api/src/repo.ts` (getMePlanView / getDayLogView / upsertDayLog / getPrescriptionWeek /
 * setSessionActuals) verbatim in semantics, keeping the two athlete clients swappable.
 */
import type {
  Atleta, CycleData, MePlanView, MeRecorrido, MonitorSeries, Plan, PrescriptionRow, RecorridoSemana,
  DayLog, DayLogView, DayLogResult, DayLogInput,
  SessionView, SessionActual, ExerciseActualInput, WeekHeat,
} from "@holy-oly/core";
import {
  buildMePlanView, computeStreak, mergeActuals, buildSessionViews, summarizeSets, barKgForSexo,
  DayLogInputSchema, SessionActualsInputSchema, PutMeCycleInputSchema,
  MonitorSeriesSchema, PlanSchema, RosterSchema, PrescriptionRowsSchema,
  DayLogsSchema, SessionActualsSchema, CycleShareSchema, CycleStateSchema,
  MACROCYCLES, planHeat, weekDoneSummary,
} from "@holy-oly/core";
import { JsonStore } from "./storage";
import { KEYS } from "./keys";
import type { MeClient } from "./meClient";

/** The demo athlete ("me") — Kevin. The coach `LocalRepository` seeds his roster row, series,
 *  plan/prescription and a year of check-ins. */
export const DEMO_ATHLETE_ID = "kv";

export class LocalMeClient implements MeClient {
  private s: JsonStore;
  constructor(
    private readonly id: string = DEMO_ATHLETE_ID,
    backend: Storage = localStorage,
    private readonly today: () => string = () => new Date().toISOString().slice(0, 10),
  ) {
    this.s = new JsonStore(backend);
  }

  // ── reads ──────────────────────────────────────────────────────────────────
  private athlete(): Atleta | undefined {
    const r = RosterSchema.safeParse(this.s.getOptional<unknown>(KEYS.roster));
    return r.success ? r.data.find((a) => a.id === this.id) : undefined;
  }
  private plan(): Plan | undefined {
    const r = PlanSchema.safeParse(this.s.getOptional<unknown>(KEYS.plan(this.id)));
    return r.success ? r.data : undefined;
  }
  private prescriptionRows(): PrescriptionRow[] {
    const r = PrescriptionRowsSchema.safeParse(this.s.getOptional<unknown>(KEYS.prescription(this.id)));
    return r.success ? r.data : [];
  }
  private dayLogs(): DayLog[] {
    // Own-written (putDayLog), but localStorage is an untrusted boundary (extensions/DevTools/
    // future bugs) — validate per storage.ts's "domain reads MUST validate" rule; corrupt → [].
    const r = DayLogsSchema.safeParse(this.s.getOptional<unknown>(KEYS.dayLog(this.id)));
    return r.success ? r.data : [];
  }
  private actuals(): SessionActual[] {
    const r = SessionActualsSchema.safeParse(this.s.getOptional<unknown>(KEYS.sessionActuals(this.id)));
    return r.success ? r.data : [];
  }

  /** Greeting + camino. Mirrors repo.getMePlanView (throws "no athlete" → screen error state). */
  async getMePlan(): Promise<MePlanView> {
    const a = this.athlete();
    if (!a) throw new Error("no athlete");
    return buildMePlanView({ nombre: a.nombre, iniciales: a.iniciales, sexo: a.sexo ?? "M" }, this.plan(), this.today());
  }

  /** Titular series. undefined when there is none (mirrors the API 404). */
  async getMeSeries(): Promise<MonitorSeries | undefined> {
    const r = MonitorSeriesSchema.safeParse(this.s.getOptional<unknown>(KEYS.series(this.id)));
    return r.success ? r.data : undefined;
  }

  /** Today's entry (or `date`) + streak + logged days, all as of today. Mirrors repo.getDayLogView. */
  async getDayLog(date?: string): Promise<DayLogView> {
    const today = this.today();
    const logs = this.dayLogs();
    const days = logs.map((l) => l.date);
    const target = date ?? today;
    const entry = logs.find((l) => l.date === target) ?? null;
    return { entry, streak: computeStreak(days, today), days, today };
  }

  /** Upsert today's self-report, then recompute the streak. Mirrors repo.upsertDayLog. */
  async putDayLog(input: DayLogInput): Promise<DayLogResult> {
    const parsed = DayLogInputSchema.parse(input); // mirror the API's 400-on-invalid contract
    const today = this.today();
    const entry: DayLog = { date: today, ...parsed };
    const next = [...this.dayLogs().filter((l) => l.date !== today), entry];
    this.s.set(KEYS.dayLog(this.id), next);
    return { entry, streak: computeStreak(next.map((l) => l.date), today) };
  }

  /** A week's sessions (kg from plan RMs) merged with the athlete's actuals. [] when no plan.
   *  Mirrors repo.getPrescriptionWeek. */
  async getMeSessions(week: number): Promise<SessionView[]> {
    const plan = this.plan();
    if (!plan) return [];
    const rows = this.prescriptionRows().filter((r) => r.week === week);
    const actuals = this.actuals().filter((a) => a.week === week);
    const barKg = barKgForSexo(this.athlete()?.sexo ?? "M");
    return mergeActuals(buildSessionViews(rows, plan.rms, barKg), actuals);
  }

  /** Per-day heat of the athlete's own plan (calendar map). Mirrors repo.getPlanHeat. */
  async getMeHeat(): Promise<WeekHeat[]> {
    const plan = this.plan();
    if (!plan) return [];
    const macro = MACROCYCLES.find((m) => m.id === plan.macroId);
    const totalWeeks = macro ? (macro.phaseProfile[macro.phaseProfile.length - 1]?.weeks[1] ?? 0) : 0;
    if (totalWeeks === 0) return [];
    return planHeat(this.prescriptionRows(), totalWeeks);
  }

  /** Recorrido del macro: lo HECHO acumulado por semana, con el MISMO builder de vistas que
   *  getMeSessions + `weekDoneSummary` de core. Mirrors repo.getMeRecorrido — datos REALES del
   *  seed/registro local, jamás inventados: semanas sin actuals quedan en 0. */
  async getMeRecorrido(): Promise<MeRecorrido> {
    const plan = this.plan();
    if (!plan) return { semanas: [] };
    const macro = MACROCYCLES.find((m) => m.id === plan.macroId);
    const totalWeeks = macro ? (macro.phaseProfile[macro.phaseProfile.length - 1]?.weeks[1] ?? 0) : 0;
    if (totalWeeks === 0) return { semanas: [] };
    const allRows = this.prescriptionRows();
    const allActuals = this.actuals();
    const barKg = barKgForSexo(this.athlete()?.sexo ?? "M");
    const semanas: RecorridoSemana[] = [];
    for (let week = 1; week <= totalWeeks; week++) {
      const views = mergeActuals(
        buildSessionViews(allRows.filter((r) => r.week === week), plan.rms, barKg),
        allActuals.filter((a) => a.week === week),
      );
      const { trabajoKg, calentamientoKg, sesionesHechas, sesionesTotales } = weekDoneSummary(views);
      semanas.push({ week, trabajoKg, calentamientoKg, sesionesHechas, sesionesTotales });
    }
    return { semanas };
  }

  /** Replace one session's actuals (self-written). Mirrors repo.setSessionActuals (top-set summary). */
  async putMeSession(week: number, sessionIdx: number, actuals: ExerciseActualInput[]): Promise<void> {
    const parsed = SessionActualsInputSchema.parse(actuals);
    const today = this.today();
    const kept = this.actuals().filter((a) => !(a.week === week && a.sessionIdx === sessionIdx));
    const added: SessionActual[] = parsed.map((a) => {
      const sum = a.sets && a.sets.length > 0 ? summarizeSets(a.sets) : { done: a.done, kg: a.kg, reps: a.reps };
      return {
        week, sessionIdx, order: a.order, movementId: a.movementId,
        prescribedMovementId: a.prescribedMovementId,
        done: sum.done, actualKg: sum.kg, actualReps: sum.reps, note: a.note,
        sets: a.sets && a.sets.length > 0 ? a.sets : undefined,
        doneAt: sum.done ? today : undefined,
      };
    });
    this.s.set(KEYS.sessionActuals(this.id), [...kept, ...added]);
  }

  // ── cuenta (D3/D4) — espejo honesto: en la demo NO hay cuenta. La UI gatea "Tus datos" por
  //    apiEnabled, así que esto es defensa en profundidad, no un camino real. ──
  async exportMe(): Promise<unknown> {
    throw new Error("El export está disponible sólo con cuenta real (la demo no tiene cuenta).");
  }
  async deleteMyAccount(): Promise<void> {
    throw new Error("El borrado está disponible sólo con cuenta real (la demo no tiene cuenta).");
  }

  /** Registro propio del ciclo. Mirrors repo.getMyCycle (sin fila → default honesto "no optó"). */
  async getMeCycle(): Promise<CycleData> {
    const share = CycleShareSchema.safeParse(this.s.getOptional<unknown>(KEYS.cycleShare(this.id)));
    const state = CycleStateSchema.safeParse(this.s.getOptional<unknown>(KEYS.cycleState(this.id)));
    if (!share.success) return { share: "none", state: "regular" };
    const start = this.s.getOptional<unknown>(KEYS.cycleStart(this.id));
    const len = Number(this.s.getOptional<unknown>(KEYS.cycleLen(this.id)));
    return {
      share: share.data,
      state: state.success ? state.data : "regular",
      ...(typeof start === "string" && /^\d{4}-\d{2}-\d{2}$/.test(start) ? { lastPeriodStart: start } : {}),
      ...(Number.isInteger(len) && len >= 21 && len <= 45 ? { cycleLengthDays: len } : {}),
    };
  }

  /** Upsert del registro (mirrors repo.putMyCycle; el "cifrado" no aplica en local — es SU storage). */
  async putMeCycle(input: CycleData): Promise<void> {
    const parsed = PutMeCycleInputSchema.parse(input); // mirror del 400-on-invalid del API
    this.s.set(KEYS.cycleShare(this.id), parsed.share);
    this.s.set(KEYS.cycleState(this.id), parsed.state);
    if (parsed.lastPeriodStart != null) this.s.set(KEYS.cycleStart(this.id), parsed.lastPeriodStart);
    else this.s.remove(KEYS.cycleStart(this.id));
    if (parsed.cycleLengthDays != null) this.s.set(KEYS.cycleLen(this.id), parsed.cycleLengthDays);
    else this.s.remove(KEYS.cycleLen(this.id));
  }
}
