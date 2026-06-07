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
