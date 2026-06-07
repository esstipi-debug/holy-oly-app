/**
 * Athlete-self client. Single import surface for the athlete screens; delegates to the API
 * (`httpMeClient`) when the app talks to a backend, or to `LocalMeClient` (localStorage, demo
 * athlete Kevin) when standalone — the exact mirror of how `RepositoryProvider` picks Http vs Local.
 */
import type { MePlanView, MonitorSeries, DayLogView, DayLogResult, DayLogInput, SessionView, ExerciseActualInput } from "@holy-oly/core";
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
export function putMeSession(week: number, idx: number, actuals: ExerciseActualInput[]): Promise<void> {
  return API_ENABLED ? http.putMeSession(week, idx, actuals) : local().putMeSession(week, idx, actuals);
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
  putMeSession(week: number, idx: number, actuals: ExerciseActualInput[]): Promise<void>;
}

/** The module singleton as a `MeClient` object — the default client for the athlete screens. */
export const meClient: MeClient = { getMePlan, getMeSeries, getDayLog, putDayLog, getMeSessions, putMeSession };
