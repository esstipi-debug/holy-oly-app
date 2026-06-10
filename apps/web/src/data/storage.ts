/**
 * Typed JSON over a Storage (default localStorage). Corrupt/missing → fallback.
 * NOTE: `get`/`getOptional` are unchecked `as T` casts. Domain reads MUST validate the
 * result against a core Zod schema (see LocalRepository); the bare casts are only for
 * internal/non-domain keys (e.g. the numeric seed version).
 */
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

  remove(key: string): void {
    try {
      this.backend.removeItem(key);
    } catch {
      // Best effort (mirror set): unavailable storage must never throw into a screen.
    }
  }
}
