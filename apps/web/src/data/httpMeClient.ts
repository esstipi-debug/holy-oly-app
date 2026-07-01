/**
 * Athlete-self data over the API (`/me/*`). The HTTP half of the athlete client; `meClient.ts`
 * delegates here when the app talks to a backend (API mode). Cookie-authenticated — the server
 * resolves the athlete from the session, never from a path/body, so there is no cross-athlete read.
 */
import {
  MePlanViewSchema, MonitorSeriesSchema, DayLogViewSchema, DayLogResultSchema, SessionViewsSchema, WeekHeatsSchema, MeCycleViewSchema, MeRecorridoSchema, MacroHistoryViewSchema, MeHeatDaysSchema,
  type MePlanView, type MeRecorrido, type MonitorSeries, type DayLogView, type DayLogResult, type DayLogInput, type SessionView, type WeekHeat, type CycleData, type MeCycleView, type PutMeSessionInput, type MacroHistoryView, type MeHeatDays, type SelfPlanInput,
} from "@holy-oly/core";
import { FechaOcupadaError, DiaBloqueadoError } from "./fechaError";

const BASE = import.meta.env.VITE_API_URL ?? "";

async function fail(res: Response): Promise<never> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  throw new Error(body?.error ?? `request failed (${res.status})`);
}

/** The athlete's own plan view (greeting + camino). plan is null when unassigned. */
export async function getMePlan(): Promise<MePlanView> {
  const res = await fetch(`${BASE}/me/plan`, { credentials: "include" });
  if (!res.ok) return fail(res);
  return MePlanViewSchema.parse(await res.json());
}

/** The athlete's own series (Titular state). undefined when there is none (404). */
export async function getMeSeries(): Promise<MonitorSeries | undefined> {
  const res = await fetch(`${BASE}/me/series`, { credentials: "include" });
  if (res.status === 404) return undefined;
  if (!res.ok) return fail(res);
  return MonitorSeriesSchema.parse(await res.json());
}

/** Today's entry (or `date`) + streak + logged days + server today. */
export async function getDayLog(date?: string): Promise<DayLogView> {
  const q = date ? `?date=${encodeURIComponent(date)}` : "";
  const res = await fetch(`${BASE}/me/daylog${q}`, { credentials: "include" });
  if (!res.ok) return fail(res);
  return DayLogViewSchema.parse(await res.json());
}

/** Upsert today's self-report. */
export async function putDayLog(input: DayLogInput): Promise<DayLogResult> {
  const res = await fetch(`${BASE}/me/daylog`, {
    method: "PUT",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) return fail(res);
  return DayLogResultSchema.parse(await res.json());
}

/** Self-coach (atleta autoentrenado): el atleta crea su propio plan (POST /me/plan). */
export async function createMyPlan(input: SelfPlanInput): Promise<void> {
  const res = await fetch(`${BASE}/me/plan`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) await fail(res);
}

/** The athlete's prescribed sessions for a given week (merged with their actuals). */
export async function getMeSessions(week: number): Promise<SessionView[]> {
  const res = await fetch(`${BASE}/me/sessions?week=${week}`, { credentials: "include" });
  if (!res.ok) return fail(res);
  return SessionViewsSchema.parse(await res.json());
}

/** Per-day heat of the athlete's own plan (calendar map). Athlete-safe: % + lift counts. */
export async function getMeHeat(): Promise<WeekHeat[]> {
  const res = await fetch(`${BASE}/me/heat`, { credentials: "include" });
  if (!res.ok) return fail(res);
  return WeekHeatsSchema.parse(await res.json());
}

/** Mapa de calor por día (rediseño 0110): carga/bienestar/peso/recuperación por día. Sin RPE. */
export async function getMeHeatDays(): Promise<MeHeatDays> {
  const res = await fetch(`${BASE}/me/heatdays`, { credentials: "include" });
  if (!res.ok) return fail(res);
  return MeHeatDaysSchema.parse(await res.json());
}

/** Recorrido del macro: lo HECHO acumulado por semana (kg propios, jamás RM/RPE/ACWR). */
export async function getMeRecorrido(): Promise<MeRecorrido> {
  const res = await fetch(`${BASE}/me/recorrido`, { credentials: "include" });
  if (!res.ok) return fail(res);
  return MeRecorridoSchema.parse(await res.json());
}

/** Historial de macrociclos cerrados del propio atleta (constancia entre ciclos, adherencia %). */
export async function getMeMacroHistory(): Promise<MacroHistoryView> {
  const res = await fetch(`${BASE}/me/macro-history`, { credentials: "include" });
  if (!res.ok) return fail(res);
  return MacroHistoryViewSchema.parse(await res.json());
}

/** El 409 del backend puede ser fecha_ocupada (1×fecha, D1) o dia_bloqueado (secuencia de días).
 *  Lanza el error tipado correspondiente; cuerpo inesperado → cae al error genérico. */
async function throw409(res: Response): Promise<never> {
  const body = (await res.json().catch(() => null)) as
    | { error?: string; conflicto?: { week: number; sessionIdx: number; fecha: string }; faltan?: number[] }
    | null;
  if (body?.error === "dia_bloqueado") throw new DiaBloqueadoError(Array.isArray(body.faltan) ? body.faltan : []);
  const c = body?.conflicto;
  if (c && typeof c.week === "number" && typeof c.sessionIdx === "number" && typeof c.fecha === "string") {
    throw new FechaOcupadaError(c);
  }
  return fail(res); // 409 con cuerpo inesperado (proxy raro)
}

/** Record (replace) the athlete's actuals for one session. 409 → FechaOcupadaError (D1) o
 *  DiaBloqueadoError (secuencia de días). */
export async function putMeSession(week: number, idx: number, input: PutMeSessionInput): Promise<void> {
  const res = await fetch(`${BASE}/me/session/${week}/${idx}`, {
    method: "PUT",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (res.status === 409) return void (await throw409(res));
  if (!res.ok) await fail(res);
}

/** Anular un entreno (secuencia de días). 409 → DiaBloqueadoError (días anteriores sin resolver). */
export async function anularMeSession(week: number, idx: number): Promise<void> {
  const res = await fetch(`${BASE}/me/session/${week}/${idx}/anular`, { method: "POST", credentials: "include" });
  if (res.status === 409) return void (await throw409(res));
  if (!res.ok) await fail(res);
}

/** Des-anular (reactivar) un entreno → vuelve a pendiente. Idempotente. */
export async function desanularMeSession(week: number, idx: number): Promise<void> {
  const res = await fetch(`${BASE}/me/session/${week}/${idx}/anular`, { method: "DELETE", credentials: "include" });
  if (!res.ok) await fail(res);
}

/** D3: la atleta baja TODO lo suyo (GET /me/export). Devuelve el JSON crudo del export —
 *  la pantalla lo descarga como archivo; acá no se re-valida (es el dump del server). */
export async function exportMe(): Promise<unknown> {
  const res = await fetch(`${BASE}/me/export`, { credentials: "include" });
  if (!res.ok) return fail(res);
  return res.json();
}

/** D4: borrado de la propia cuenta (DELETE /me/account). El server cascadea los datos y
 *  mata la sesión (clearCookie) — la pantalla redirige a /login al éxito. */
export async function deleteMyAccount(): Promise<void> {
  const res = await fetch(`${BASE}/me/account`, { method: "DELETE", credentials: "include" });
  if (!res.ok) await fail(res);
}

/** El registro propio del ciclo + si la atleta ya activó (consintió). El coach jamás recibe este shape. */
export async function getMeCycle(): Promise<MeCycleView> {
  const res = await fetch(`${BASE}/me/cycle`, { credentials: "include" });
  if (!res.ok) return fail(res);
  return MeCycleViewSchema.parse(await res.json());
}

/** `consent:true` sólo en la 1ª activación (acto de opt-in informado, PR-L2). Después es opcional. */
export async function putMeCycle(input: CycleData, consent?: boolean): Promise<void> {
  const res = await fetch(`${BASE}/me/cycle`, {
    method: "PUT",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...input, ...(consent === true ? { consent: true } : {}) }),
  });
  if (!res.ok) await fail(res);
}

/** Revocación: borra el registro propio del ciclo (dueña del dato). */
export async function deleteMeCycle(): Promise<void> {
  const res = await fetch(`${BASE}/me/cycle`, { method: "DELETE", credentials: "include" });
  if (!res.ok) await fail(res);
}
