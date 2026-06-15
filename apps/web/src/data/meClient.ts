/**
 * Athlete-self client. Single import surface for the athlete screens; delegates to the API
 * (`httpMeClient`) when the app talks to a backend, or to `LocalMeClient` (localStorage, demo
 * athlete Kevin) when standalone — the exact mirror of how `RepositoryProvider` picks Http vs Local.
 */
import type { CycleData, MeCycleView, MePlanView, MeRecorrido, MonitorSeries, DayLogView, DayLogResult, DayLogInput, SessionView, WeekHeat, PutMeSessionInput, MacroHistoryView, MeHeatDays } from "@holy-oly/core";
import { API_ENABLED } from "./apiConfig";
import * as http from "./httpMeClient";
import { LocalMeClient } from "./LocalMeClient";

// Re-exportar para que los callers (pantallas, tests) tengan un único punto de importación.
export { FechaOcupadaError, DiaBloqueadoError } from "./fechaError";
export type { PutMeSessionInput };

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
export function getMeRecorrido(): Promise<MeRecorrido> {
  return API_ENABLED ? http.getMeRecorrido() : local().getMeRecorrido();
}
export function getMeHeatDays(): Promise<MeHeatDays> {
  return API_ENABLED ? http.getMeHeatDays() : local().getMeHeatDays();
}
export function getMeMacroHistory(): Promise<MacroHistoryView> {
  return API_ENABLED ? http.getMeMacroHistory() : local().getMeMacroHistory();
}
export function putMeSession(week: number, idx: number, input: PutMeSessionInput): Promise<void> {
  return API_ENABLED ? http.putMeSession(week, idx, input) : local().putMeSession(week, idx, input);
}
export function anularMeSession(week: number, idx: number): Promise<void> {
  return API_ENABLED ? http.anularMeSession(week, idx) : local().anularMeSession(week, idx);
}
export function desanularMeSession(week: number, idx: number): Promise<void> {
  return API_ENABLED ? http.desanularMeSession(week, idx) : local().desanularMeSession(week, idx);
}
export function getMeCycle(): Promise<MeCycleView> {
  return API_ENABLED ? http.getMeCycle() : local().getMeCycle();
}
export function putMeCycle(input: CycleData, consent?: boolean): Promise<void> {
  return API_ENABLED ? http.putMeCycle(input, consent) : local().putMeCycle(input, consent);
}
export function deleteMeCycle(): Promise<void> {
  return API_ENABLED ? http.deleteMeCycle() : local().deleteMeCycle();
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
  /** Recorrido del macro: lo HECHO acumulado por semana (kg propios — jamás RM/RPE/ACWR). */
  getMeRecorrido(): Promise<MeRecorrido>;
  /** Mapa de calor por día (rediseño 0110): carga/bienestar/peso/recuperación por día. Sin RPE. */
  getMeHeatDays(): Promise<MeHeatDays>;
  /** Historial de macrociclos cerrados (constancia entre ciclos): adherencia % propia, sin RPE/ACWR. */
  getMeMacroHistory(): Promise<MacroHistoryView>;
  putMeSession(week: number, idx: number, input: PutMeSessionInput): Promise<void>;
  /** Secuencia de días (2026-06-13): anular un entreno (falló/canceló) y des-anular (reactivar).
   *  `anularMeSession` lanza `DiaBloqueadoError` si los días anteriores no están resueltos. */
  anularMeSession(week: number, idx: number): Promise<void>;
  desanularMeSession(week: number, idx: number): Promise<void>;
  /** Registro propio del ciclo (slice ciclo-visible) — la verdad de la atleta, jamás del coach.
   *  `getMeCycle` incluye `consented` (¿activó el módulo?); `putMeCycle` con `consent:true` en la
   *  1ª activación (PR-L2); `deleteMeCycle` revoca (borra el registro). */
  getMeCycle(): Promise<MeCycleView>;
  putMeCycle(input: CycleData, consent?: boolean): Promise<void>;
  deleteMeCycle(): Promise<void>;
}

/** The module singleton as a `MeClient` object — the default client for the athlete screens. */
export const meClient: MeClient = { getMePlan, getMeSeries, getDayLog, putDayLog, getMeSessions, getMeHeat, getMeRecorrido, getMeHeatDays, getMeMacroHistory, putMeSession, anularMeSession, desanularMeSession, getMeCycle, putMeCycle, deleteMeCycle };
