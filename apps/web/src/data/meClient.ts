/**
 * Athlete-self client. Single import surface for the athlete screens; delegates to the API
 * (`httpMeClient`) when the app talks to a backend, or to `LocalMeClient` (localStorage, demo
 * athlete Kevin) when standalone — the exact mirror of how `RepositoryProvider` picks Http vs Local.
 */
import type { CycleData, MePlanView, MonitorSeries, DayLogView, DayLogResult, DayLogInput, SessionView, ExerciseActualInput, WeekHeat } from "@holy-oly/core";
import { API_ENABLED } from "./apiConfig";
import * as http from "./httpMeClient";
import { LocalMeClient } from "./LocalMeClient";

// Lazy so the standalone client (which touches localStorage) is only built when actually used.
let _local: LocalMeClient | null = null;
const local = (): LocalMeClient => (_local ??= new LocalMeClient());

export function getMePlan(): Promise<MePlanView> {
  return API_ENABLED ? http.getMePlan() : local().getMePlan();
}
export function getMeSeries(): Promise<MonitorSeries | undefined> {
  return API_ENABLED ? http.getMeSeries() : local().getMeSeries();
}
export function getDayLog(date?: string): Promise<DayLogView> {
  return API_ENABLED ? http.getDayLog(date) : local().getDayLog(date);
}
export function putDayLog(input: DayLogInput): Promise<DayLogResult> {
  return API_ENABLED ? http.putDayLog(input) : local().putDayLog(input);
}
export function getMeSessions(week: number): Promise<SessionView[]> {
  return API_ENABLED ? http.getMeSessions(week) : local().getMeSessions(week);
}
export function getMeHeat(): Promise<WeekHeat[]> {
  return API_ENABLED ? http.getMeHeat() : local().getMeHeat();
}
export function putMeSession(week: number, idx: number, actuals: ExerciseActualInput[]): Promise<void> {
  return API_ENABLED ? http.putMeSession(week, idx, actuals) : local().putMeSession(week, idx, actuals);
}
export function getMeCycle(): Promise<CycleData> {
  return API_ENABLED ? http.getMeCycle() : local().getMeCycle();
}
export function putMeCycle(input: CycleData): Promise<void> {
  return API_ENABLED ? http.putMeCycle(input) : local().putMeCycle(input);
}

// ── Cuenta (D3/D4, W5) — scope CUENTA, no vista: a propósito FUERA de la interface `MeClient`
//    (el drill-down del coach instancia un MeClient id-scoped para "ver como atleta" y jamás
//    debe poder exportar/borrar). La UI gatea por apiEnabled; el Local tira error honesto.
export function exportMe(): Promise<unknown> {
  return API_ENABLED ? http.exportMe() : local().exportMe();
}
export function deleteMyAccount(): Promise<void> {
  return API_ENABLED ? http.deleteMyAccount() : local().deleteMyAccount();
}

/**
 * The athlete-self data contract. The module above is the app-wide singleton ("me" = the logged-in
 * athlete, or demo Kevin), but the coach drill-down's "ver como atleta" toggle needs an id-scoped
 * instance (`new LocalMeClient(athleteId)`), so the athlete screens take a `MeClient` they can swap.
 */
export interface MeClient {
  getMePlan(): Promise<MePlanView>;
  getMeSeries(): Promise<MonitorSeries | undefined>;
  getDayLog(date?: string): Promise<DayLogView>;
  putDayLog(input: DayLogInput): Promise<DayLogResult>;
  getMeSessions(week: number): Promise<SessionView[]>;
  getMeHeat(): Promise<WeekHeat[]>;
  putMeSession(week: number, idx: number, actuals: ExerciseActualInput[]): Promise<void>;
  /** Registro propio del ciclo (slice ciclo-visible) — la verdad de la atleta, jamás del coach. */
  getMeCycle(): Promise<CycleData>;
  putMeCycle(input: CycleData): Promise<void>;
}

/** The module singleton as a `MeClient` object — the default client for the athlete screens. */
export const meClient: MeClient = { getMePlan, getMeSeries, getDayLog, putDayLog, getMeSessions, getMeHeat, putMeSession, getMeCycle, putMeCycle };
