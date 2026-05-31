/** Typed JSON over a Storage (default localStorage). Corrupt/missing → fallback. */
export class JsonStore {
  constructor(private readonly backend: Storage) {}

  get<T>(key: string, fallback: T): T {
    try {
      const raw = this.backend.getItem(key);
      if (raw == null) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      // Corrupt JSON or unavailable storage: never throw into a screen.
      return fallback;
    }
  }

  /** Typed read for "maybe-absent" values: undefined when missing/corrupt (no `as never`). */
  getOptional<T>(key: string): T | undefined {
    try {
      const raw = this.backend.getItem(key);
      if (raw == null) return undefined;
      return JSON.parse(raw) as T;
    } catch {
      return undefined;
    }
  }

  set<T>(key: string, value: T): void {
    try {
      this.backend.setItem(key, JSON.stringify(value));
    } catch {
      // Quota/private-mode: swallow; UI stays functional this session.
    }
  }

  has(key: string): boolean {
    try {
      return this.backend.getItem(key) != null;
    } catch {
      return false;
    }
  }
}
