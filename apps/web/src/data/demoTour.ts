/**
 * Demo-only (T2): persistence for the prospect tour card. The "visto" flag lives under the `ho:`
 * namespace so the T4 reset clears it (tour reappears after a reset). Pure given the Storage passed in.
 */
export const TOUR_SEEN_KEY = "ho:tourSeen";

export function isTourSeen(storage: Storage): boolean {
  return storage.getItem(TOUR_SEEN_KEY) === "1";
}

export function markTourSeen(storage: Storage): void {
  storage.setItem(TOUR_SEEN_KEY, "1");
}
