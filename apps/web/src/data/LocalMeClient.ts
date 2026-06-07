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
  Atleta, MePlanView, MonitorSeries, Plan, PrescriptionRow,
  DayLog, DayLogView, DayLogResult, DayLogInput,
  SessionView, SessionActual, ExerciseActualInput,
} from "@holy-oly/core";
import {
  buildMePlanView, computeStreak, mergeActuals, buildSessionViews, summarizeSets, barKgForSexo,
  DayLogInputSchema, SessionActualsInputSchema,
  MonitorSeriesSchema, PlanSchema, RosterSchema, PrescriptionRowsSchema,
  DayLogsSchema, SessionActualsSchema,
} from "@holy-oly/core";
import { JsonStore } from "./storage";
import { KEYS } from "./keys";

/** The demo athlete ("me") — Kevin. The coach `LocalRepository` seeds his roster row, series,
 *  plan/prescription and a year of check-ins. */
export const DEMO_ATHLETE_ID = "kv";

export class LocalMeClient {
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
}
