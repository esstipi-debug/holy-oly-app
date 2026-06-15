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
  Atleta, CycleData, MeCycleView, MePlanView, MeRecorrido, MonitorSeries, Plan, PrescriptionRow, RecorridoSemana,
  DayLog, DayLogView, DayLogResult, DayLogInput,
  SessionView, SessionActual, WeekHeat, SessionRegistro, PutMeSessionInput, MacroHistoryView, MeHeatDays,
} from "@holy-oly/core";
import {
  buildMePlanView, computeStreak, mergeActuals, buildSessionViews, summarizeSets, barKgForSexo,
  DayLogInputSchema, PutMeSessionInputSchema, PutMeCycleInputSchema,
  MonitorSeriesSchema, PlanSchema, RosterSchema, PrescriptionRowsSchema,
  DayLogsSchema, SessionActualsSchema, SessionRegistrosSchema, CycleShareSchema, CycleStateSchema, MacroHistoryViewSchema,
  MACROCYCLES, planHeat, weekDoneSummary, dayLayoutFor, buildMeHeatDays, setTonnage, wellnessScore,
  validateFechaEntreno, fechaConflict, unresolvedPriorDays,
} from "@holy-oly/core";
import { FechaOcupadaError, DiaBloqueadoError } from "./fechaError";
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
  private registros(): SessionRegistro[] {
    const r = SessionRegistrosSchema.safeParse(this.s.getOptional<unknown>(KEYS.sessionRegistros(this.id)));
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

  /** A week's sessions (kg from plan RMs) merged with actuals, with day/turno/fecha. Mirrors server. */
  async getMeSessions(week: number): Promise<SessionView[]> {
    const plan = this.plan();
    if (!plan) return [];
    const rows = this.prescriptionRows().filter((r) => r.week === week);
    const actuals = this.actuals().filter((a) => a.week === week);
    const barKg = barKgForSexo(this.athlete()?.sexo ?? "M");
    const macro = MACROCYCLES.find((m) => m.id === plan.macroId);
    const layout = macro ? dayLayoutFor(macro, week) : null;
    const weekRegs = this.registros().filter((r) => r.week === week);
    // Secuencia de días: un día ANULADO no lleva fecha (no se entrenó) — sólo el flag `anulado`.
    const fechaByIdx = new Map(weekRegs.filter((r) => r.estado !== "anulado").map((r) => [r.sessionIdx, r.fecha]));
    const anuladoIdx = new Set(weekRegs.filter((r) => r.estado === "anulado").map((r) => r.sessionIdx));
    return mergeActuals(buildSessionViews(rows, plan.rms, barKg), actuals).map((v) => ({
      ...v,
      ...(layout?.[v.sessionIdx] ? layout[v.sessionIdx]! : {}),
      ...(fechaByIdx.has(v.sessionIdx) ? { fecha: fechaByIdx.get(v.sessionIdx)! } : {}),
      ...(anuladoIdx.has(v.sessionIdx) ? { anulado: true } : {}),
    }));
  }

  /** Per-day heat of the athlete's own plan (calendar map). Mirrors repo.getPlanHeat (con day). */
  async getMeHeat(): Promise<WeekHeat[]> {
    const plan = this.plan();
    if (!plan) return [];
    const macro = MACROCYCLES.find((m) => m.id === plan.macroId);
    const totalWeeks = macro ? (macro.phaseProfile[macro.phaseProfile.length - 1]?.weeks[1] ?? 0) : 0;
    if (totalWeeks === 0) return [];
    // Adjuntar `day` por semana (caché de layout para no recomputar por fila).
    const layoutCache = new Map<number, { day: number; turno?: "AM" | "PM" }[] | null>();
    const rows = this.prescriptionRows().map((r) => {
      if (!layoutCache.has(r.week)) {
        layoutCache.set(r.week, macro ? dayLayoutFor(macro, r.week) : null);
      }
      const layout = layoutCache.get(r.week) ?? null;
      const day = layout?.[r.sessionIdx]?.day;
      return day != null ? { ...r, day } : r;
    });
    return planHeat(rows, totalWeeks);
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

  /** Mapa de calor por día (rediseño 0110). Espejo de repo.getMeHeatDays con las MISMAS fuentes
   *  REALES del seed/registro local: carga (actuals.doneAt → tonelaje), bienestar+peso (DayLog),
   *  recuperación (HRV/FC semanal del macro). NUNCA RPE. Días sin dato → null (gris honesto). */
  async getMeHeatDays(): Promise<MeHeatDays> {
    const plan = this.plan();
    const macro = plan ? MACROCYCLES.find((m) => m.id === plan.macroId) : undefined;
    const totalWeeks = macro ? macro.phaseProfile[macro.phaseProfile.length - 1]?.weeks[1] : undefined;

    const byDate = new Map<string, { kg: number; sessions: Set<string> }>();
    for (const a of this.actuals()) {
      if (!a.doneAt) continue;
      const kg = a.sets && a.sets.length > 0
        ? a.sets.reduce((s, set) => s + setTonnage(set), 0)
        : a.done && a.actualKg != null && a.actualReps != null ? a.actualKg * a.actualReps : 0;
      let e = byDate.get(a.doneAt);
      if (!e) { e = { kg: 0, sessions: new Set() }; byDate.set(a.doneAt, e); }
      e.kg += kg;
      e.sessions.add(`${a.week}-${a.sessionIdx}`);
    }
    const training: Record<string, { kg: number; sessions: number }> = {};
    for (const [iso, e] of byDate) training[iso] = { kg: Math.round(e.kg), sessions: e.sessions.size };

    const daylogs = this.dayLogs().map((l) => ({
      date: l.date,
      wellness: wellnessScore({ fatiga: l.fatiga, dolor: l.dolor, estres: l.estres, humor: l.humor, motivacion: l.motivacion, sueno: l.sueno }),
      bw: l.weight ?? null,
    }));

    const series = await this.getMeSeries();
    const comps = (plan?.comps ?? []).filter((c) => c.date).map((c) => ({ iso: c.date!, name: c.name, note: `S${c.week}` }));
    const band = series?.weightBand;

    return buildMeHeatDays({
      today: this.today(),
      startDate: plan?.startDate,
      totalWeeks,
      training,
      daylogs,
      comps,
      weekly: series ? { hrv: series.hrv, rhr: series.rhr } : undefined,
      hrvBase: series?.hrvBase,
      rhrBase: series?.rhrBase,
      weightBand: band,
      category: band ? `${Math.round(band[1])} kg` : undefined,
    });
  }

  /** Historial de macrociclos cerrados del atleta (constancia propia). Espejo del API /me/macro-history. */
  async getMeMacroHistory(): Promise<MacroHistoryView> {
    const r = MacroHistoryViewSchema.safeParse(this.s.getOptional<unknown>(KEYS.macroHistory(this.id)));
    return r.success ? r.data : { entries: [], cyclesDone: 0, avgAdherencePct: 0 };
  }

  /** Día/turno layout de la semana (para dayOf), espejo de repo. */
  private dayOfFor(week: number): (idx: number) => number {
    const macro = MACROCYCLES.find((m) => m.id === this.plan()?.macroId);
    const layout = macro ? dayLayoutFor(macro, week) : null;
    return (idx: number): number => layout?.[idx]?.day ?? idx + 1;
  }

  /** Secuencia de días (2026-06-13): para completar/anular `sessionIdx`, todo día anterior de la
   *  semana debe estar resuelto (tener registro). Espejo de repo.assertDayUnlocked. */
  private assertDayUnlocked(week: number, sessionIdx: number, dayOf: (idx: number) => number): void {
    const allIdxs = [...new Set(this.prescriptionRows().filter((r) => r.week === week).map((r) => r.sessionIdx))];
    const resolved = new Set(this.registros().filter((r) => r.week === week).map((r) => r.sessionIdx));
    const faltan = unresolvedPriorDays(allIdxs, (i) => resolved.has(i), dayOf, sessionIdx);
    if (faltan.length > 0) throw new DiaBloqueadoError(faltan);
  }

  /** Replace one session's actuals (self-written). Mirrors repo.setSessionActuals (1×fecha D1 +
   *  gate de secuencia de días). */
  async putMeSession(week: number, sessionIdx: number, input: PutMeSessionInput): Promise<void> {
    const parsed = PutMeSessionInputSchema.parse(input);
    const hoy = this.today();
    const fecha = parsed.fecha ?? hoy;
    if (validateFechaEntreno(fecha, hoy) === "futuro") throw new Error("fecha futura");
    const dayOf = this.dayOfFor(week);
    const registros = this.registros();
    const summarized = parsed.actuals.map((a) => ({
      a,
      sum: a.sets && a.sets.length > 0 ? summarizeSets(a.sets) : { done: a.done, kg: a.kg, reps: a.reps },
    }));
    const anyDone = summarized.some(({ sum }) => sum.done);
    if (anyDone) {
      this.assertDayUnlocked(week, sessionIdx, dayOf); // secuencia de días: días anteriores resueltos
      const conflict = fechaConflict(registros, week, sessionIdx, fecha, dayOf);
      // Contrato público = { week, sessionIdx, fecha }; `estado` es interno (espejo del backend).
      if (conflict) throw new FechaOcupadaError({ week: conflict.week, sessionIdx: conflict.sessionIdx, fecha: conflict.fecha });
    }
    const kept = this.actuals().filter((a) => !(a.week === week && a.sessionIdx === sessionIdx));
    const added: SessionActual[] = summarized.map(({ a, sum }) => ({
      week, sessionIdx, order: a.order, movementId: a.movementId,
      prescribedMovementId: a.prescribedMovementId,
      done: sum.done, actualKg: sum.kg, actualReps: sum.reps, note: a.note,
      sets: a.sets && a.sets.length > 0 ? a.sets : undefined,
      doneAt: sum.done ? fecha : undefined,
    }));
    this.s.set(KEYS.sessionActuals(this.id), [...kept, ...added]);
    // Actualizar el registro de fecha de la sesión (D1). Completar SIEMPRE deja la sesión 'hecho'.
    const keptRegs = registros.filter((r) => !(r.week === week && r.sessionIdx === sessionIdx));
    this.s.set(
      KEYS.sessionRegistros(this.id),
      anyDone ? [...keptRegs, { week, sessionIdx, fecha, estado: "hecho" as const }] : keptRegs,
    );
  }

  /** Anular un entreno (secuencia de días): gate + sin volumen + registro 'anulado'. Mirror de repo. */
  async anularMeSession(week: number, sessionIdx: number): Promise<void> {
    const dayOf = this.dayOfFor(week);
    this.assertDayUnlocked(week, sessionIdx, dayOf);
    this.s.set(
      KEYS.sessionActuals(this.id),
      this.actuals().filter((a) => !(a.week === week && a.sessionIdx === sessionIdx)),
    );
    const keptRegs = this.registros().filter((r) => !(r.week === week && r.sessionIdx === sessionIdx));
    this.s.set(
      KEYS.sessionRegistros(this.id),
      [...keptRegs, { week, sessionIdx, fecha: this.today(), estado: "anulado" as const }],
    );
  }

  /** Des-anular (reactivar): borra sólo el registro 'anulado' → el día vuelve a pendiente. */
  async desanularMeSession(week: number, sessionIdx: number): Promise<void> {
    this.s.set(
      KEYS.sessionRegistros(this.id),
      this.registros().filter((r) => !(r.week === week && r.sessionIdx === sessionIdx && r.estado === "anulado")),
    );
  }

  // ── cuenta (D3/D4) — espejo honesto: en la demo NO hay cuenta. La UI gatea "Tus datos" por
  //    apiEnabled, así que esto es defensa en profundidad, no un camino real. ──
  async exportMe(): Promise<unknown> {
    throw new Error("El export está disponible sólo con cuenta real (la demo no tiene cuenta).");
  }
  async deleteMyAccount(): Promise<void> {
    throw new Error("El borrado está disponible sólo con cuenta real (la demo no tiene cuenta).");
  }

  /** Registro propio del ciclo + si la atleta ya activó (consintió). Mirror de repo.getMyCycle:
   *  sin flag de consentimiento → consented=false (la UI muestra el gate de activación, §3). */
  async getMeCycle(): Promise<MeCycleView> {
    const consented = this.s.getOptional<unknown>(KEYS.cycleConsented(this.id)) === true;
    const share = CycleShareSchema.safeParse(this.s.getOptional<unknown>(KEYS.cycleShare(this.id)));
    const state = CycleStateSchema.safeParse(this.s.getOptional<unknown>(KEYS.cycleState(this.id)));
    // Demo offline: la atleta es femenina para que el ciclo (female-only, owner 2026-06-14) se vea.
    if (!share.success) return { sexo: "F", share: "none", state: "regular", consented };
    const start = this.s.getOptional<unknown>(KEYS.cycleStart(this.id));
    const len = Number(this.s.getOptional<unknown>(KEYS.cycleLen(this.id)));
    return {
      sexo: "F",
      share: share.data,
      state: state.success ? state.data : "regular",
      ...(typeof start === "string" && /^\d{4}-\d{2}-\d{2}$/.test(start) ? { lastPeriodStart: start } : {}),
      ...(Number.isInteger(len) && len >= 21 && len <= 45 ? { cycleLengthDays: len } : {}),
      consented,
    };
  }

  /** Upsert del registro (mirrors repo.putMyCycle; el "cifrado" no aplica en local — es SU storage).
   *  `consent:true` marca el opt-in (1ª activación). El enforcement legal autoritativo está en el API. */
  async putMeCycle(input: CycleData, consent?: boolean): Promise<void> {
    const parsed = PutMeCycleInputSchema.parse(input); // mirror del 400-on-invalid del API
    if (consent === true) this.s.set(KEYS.cycleConsented(this.id), true);
    this.s.set(KEYS.cycleShare(this.id), parsed.share);
    this.s.set(KEYS.cycleState(this.id), parsed.state);
    if (parsed.lastPeriodStart != null) this.s.set(KEYS.cycleStart(this.id), parsed.lastPeriodStart);
    else this.s.remove(KEYS.cycleStart(this.id));
    if (parsed.cycleLengthDays != null) this.s.set(KEYS.cycleLen(this.id), parsed.cycleLengthDays);
    else this.s.remove(KEYS.cycleLen(this.id));
  }

  /** Revocación: borra el registro propio del ciclo (dueña del dato), incl. el opt-in. */
  async deleteMeCycle(): Promise<void> {
    this.s.remove(KEYS.cycleShare(this.id));
    this.s.remove(KEYS.cycleState(this.id));
    this.s.remove(KEYS.cycleStart(this.id));
    this.s.remove(KEYS.cycleLen(this.id));
    this.s.remove(KEYS.cycleConsented(this.id));
  }
}
