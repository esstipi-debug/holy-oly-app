// Per-account login lockout (A1b). Complements the per-IP rate limit (A1): a distributed
// credential-stuffing attack rotates IPs, so IP limits alone don't protect a single account;
// and shared NAT/CGNAT (common on LatAm mobile) makes IP limits over-block. This counter is
// keyed by email and is independent of source IP.
//
// In-memory by design: Render runs a single Node instance, and a soft lock that resets on
// restart is acceptable. If the app ever scales horizontally, back this with Redis/DB.

export const MAX_LOGIN_FAILS = 10;
export const LOGIN_LOCK_MS = 15 * 60 * 1000; // 15 minutes

interface Entry {
  fails: number;
  lockedUntil: number; // epoch ms; 0 = not locked
}

const store = new Map<string, Entry>();

/** True while the account is within its lock window. */
export function isAccountLocked(email: string, now: number = Date.now()): boolean {
  const e = store.get(email);
  return e !== undefined && e.lockedUntil > now;
}

/** Record a failed login; lock the account once it reaches the failure threshold. */
export function recordLoginFailure(email: string, now: number = Date.now()): void {
  const prev = store.get(email) ?? { fails: 0, lockedUntil: 0 };
  const fails = prev.fails + 1;
  if (fails >= MAX_LOGIN_FAILS) {
    store.set(email, { fails: 0, lockedUntil: now + LOGIN_LOCK_MS });
  } else {
    store.set(email, { fails, lockedUntil: prev.lockedUntil });
  }
}

/** Clear the counter on a successful login. */
export function clearLoginFailures(email: string): void {
  store.delete(email);
}

/** Test-only: wipe the in-memory store between tests. */
export function resetLockoutStore(): void {
  store.clear();
}
