/**
 * Demo-only (T4): wipe seeded + own-written demo state so the next load re-seeds pristine.
 * Removes every key under the demo namespaces (`ho:` / `holyoly:`) — roster, seeded marker, series,
 * plan, prescription, daylog, actuals, medals, comps, cycle, plus future demo keys (tour flag, leads).
 * Keys outside those namespaces are left intact. Returns how many keys it cleared (for the caller/test).
 */
const DEMO_PREFIXES = ["ho:", "holyoly:"] as const;

export function resetDemoStorage(storage: Storage): number {
  const toRemove: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k && DEMO_PREFIXES.some((p) => k.startsWith(p))) toRemove.push(k);
  }
  for (const k of toRemove) storage.removeItem(k);
  return toRemove.length;
}
