// Per-account login lockout (A1b). Complements the per-IP rate limit (A1): a distributed
// credential-stuffing attack rotates IPs, so IP limits alone don't protect a single account;
// and shared NAT/CGNAT (common on LatAm mobile) makes IP limits over-block. This counter is
// keyed by email and is independent of source IP.
//
// In-memory by design: Render runs a single Node instance, and a soft lock that resets on
// restart is acceptable. If the app ever scales horizontally, back this with Redis/DB.

export const MAX_LOGIN_FAILS = 10;
export const LOGIN_LOCK_MS = 15 * 60 * 1000; // 15 minutes
// Safety cap so attacker-supplied emails can't grow the store unboundedly (memory-exhaustion DoS).
// Once full, new (unseen) emails are not tracked; emails already in the store still lock normally.
const MAX_STORE_SIZE = 50_000;

interface Entry {
  fails: number;
  lockedUntil: number; // epoch ms; 0 = not locked
}

const store = new Map<string, Entry>();

/** True while the account is within its lock window. Evicts the entry once the window expires. */
export function isAccountLocked(email: string, now: number = Date.now()): boolean {
  const e = store.get(email);
  if (e === undefined) return false;
  if (e.lockedUntil <= now) {
    // Past the lock window (or never locked & being checked) — drop it so the store self-cleans.
    if (e.lockedUntil > 0) store.delete(email);
    return false;
  }
  return true;
}

/** Record a failed login; lock the account once it reaches the failure threshold. */
export function recordLoginFailure(email: string, now: number = Date.now()): void {
  const existing = store.get(email);
  // Don't let unbounded fresh emails fill the store; known emails keep counting.
  if (existing === undefined && store.size >= MAX_STORE_SIZE) return;
  const prev = existing ?? { fails: 0, lockedUntil: 0 };
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

/** Test-only: current number of tracked accounts (asserts the store self-cleans). */
export function lockoutStoreSize(): number {
  return store.size;
}
