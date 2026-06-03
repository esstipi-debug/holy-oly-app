import {
  MePlanViewSchema, MonitorSeriesSchema, DayLogViewSchema, DayLogResultSchema,
  type MePlanView, type MonitorSeries, type DayLogView, type DayLogResult, type DayLogInput,
} from "@holy-oly/core";

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
