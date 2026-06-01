import type { CycleShare, CycleState } from "@holy-oly/core";
import { KEYS } from "../data/keys";

/** In-memory Storage shim for tests (no jsdom localStorage needed). */
export class MemStorage implements Storage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.get(k) ?? null; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  removeItem(k: string) { this.m.delete(k); }
  setItem(k: string, v: string) { this.m.set(k, v); }
}

/**
 * Test-only cycle writer: writes cycle share/state straight to storage via KEYS.
 * Replaces the former `__setCycleForTest` backdoor that used to ship on the
 * production `LocalRepository` class. Values are JSON-encoded to match `JsonStore`.
 */
export function seedCycle(store: Storage, id: string, share: CycleShare, state: CycleState): void {
  store.setItem(KEYS.cycleShare(id), JSON.stringify(share));
  store.setItem(KEYS.cycleState(id), JSON.stringify(state));
}
