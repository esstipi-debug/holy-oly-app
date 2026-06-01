import { recoverySeries, type MonitorSeries } from "@holy-oly/core";

/**
 * Maps between core's `MonitorSeries` (parallel arrays) and the relational row shapes
 * (`MonitorWeek` + `WellnessItem`). Pure + DB-agnostic so it is unit-tested without a database.
 */

export interface MonitorWeekInput {
  week: number;
  acute: number;
  hrv: number;
  hrvBase: number;
  rhr: number;
  rhrBase: number;
  imr: number;
  wellness: number;
  recovery: number;
  compliance: number | null;
  rpe: number | null;
  bodyweight: number | null;
}

export interface WellnessItemInput {
  week: number;
  key: string;
  value: number;
}

/**
 * `MonitorSeries` → relational rows. `recovery` is (re)computed via `core.recoverySeries`
 * on write — the stored value is derived, never trusted from input.
 */
export function seriesToRows(s: MonitorSeries): { weeks: MonitorWeekInput[]; items: WellnessItemInput[] } {
  if (s.acute.length !== s.weeks) {
    throw new Error(`MonitorSeries length mismatch: weeks=${s.weeks}, acute.length=${s.acute.length}`);
  }
  const recovery = recoverySeries(s);
  const weeks: MonitorWeekInput[] = [];
  const items: WellnessItemInput[] = [];
  for (let i = 0; i < s.weeks; i++) {
    weeks.push({
      week: i + 1,
      acute: s.acute[i]!,
      hrv: s.hrv[i]!,
      hrvBase: s.hrvBase,
      rhr: s.rhr[i]!,
      rhrBase: s.rhrBase,
      imr: s.imr[i]!,
      wellness: s.wellness[i]!,
      recovery: recovery[i]!,
      compliance: s.compliance?.[i] ?? null,
      rpe: s.rpe?.[i] ?? null,
      bodyweight: s.bodyweight?.[i] ?? null,
    });
  }
  if (s.wellnessItems) {
    for (const [key, arr] of Object.entries(s.wellnessItems)) {
      for (let i = 0; i < arr.length; i++) items.push({ week: i + 1, key, value: arr[i]! });
    }
  }
  return { weeks, items };
}

/**
 * Relational rows → `MonitorSeries`. Order-independent (sorts by week). `weightBand` is
 * series-level (stored on the athlete), so it is passed in rather than derived from the rows.
 */
export function rowsToSeries(
  weekRows: MonitorWeekInput[],
  itemRows: WellnessItemInput[],
  weightBand?: [number, number],
): MonitorSeries {
  const rows = [...weekRows].sort((a, b) => a.week - b.week);
  const out: MonitorSeries = {
    weeks: rows.length,
    acute: rows.map((r) => r.acute),
    hrv: rows.map((r) => r.hrv),
    hrvBase: rows[0]?.hrvBase ?? 0,
    rhr: rows.map((r) => r.rhr),
    rhrBase: rows[0]?.rhrBase ?? 0,
    imr: rows.map((r) => r.imr),
    wellness: rows.map((r) => r.wellness),
    recovery: rows.map((r) => r.recovery),
  };
  // Optional series are all-or-nothing: include only when EVERY week has the value, so the
  // output never carries NaN holes (which would fail MonitorSeriesSchema in the Fase 2 client).
  if (rows.length > 0 && rows.every((r) => r.compliance != null)) out.compliance = rows.map((r) => r.compliance!);
  if (rows.length > 0 && rows.every((r) => r.rpe != null)) out.rpe = rows.map((r) => r.rpe!);
  if (rows.length > 0 && rows.every((r) => r.bodyweight != null)) out.bodyweight = rows.map((r) => r.bodyweight!);
  if (weightBand) out.weightBand = weightBand;
  if (itemRows.length) {
    const byKey: Record<string, number[]> = {};
    for (const it of [...itemRows].sort((a, b) => a.week - b.week)) (byKey[it.key] ??= []).push(it.value);
    out.wellnessItems = byKey;
  }
  return out;
}
