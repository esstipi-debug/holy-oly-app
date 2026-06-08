import { sha256 } from "@oslojs/crypto/sha2";
import { encodeBase32LowerCaseNoPadding, encodeHexLowerCase } from "@oslojs/encoding";
import type { PrismaClient, User } from "@prisma/client";

const DAY_MS = 86_400_000;
// TTL is read at call time (B4) so it can be tuned per environment via SESSION_TTL_DAYS.
// A session is slid forward once it falls inside the back half of its lifetime.
function ttlMs(): number {
  const days = Number(process.env.SESSION_TTL_DAYS ?? 30);
  return (Number.isFinite(days) && days > 0 ? days : 30) * DAY_MS;
}

/** Random session token (base32). The raw token goes in the cookie; only its hash is stored. */
export function generateSessionToken(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return encodeBase32LowerCaseNoPadding(bytes);
}

/** The stored session id is SHA-256(token) hex — a leaked DB row can't reconstruct the cookie. */
export function sessionIdFromToken(token: string): string {
  return encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
}

export async function createSession(prisma: PrismaClient, userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + ttlMs());
  await prisma.session.create({ data: { id: sessionIdFromToken(token), userId, expiresAt } });
  return { token, expiresAt };
}

export interface ValidatedSession {
  user: User;
  /** Set when the session was slid forward, so the caller can re-issue the cookie (B4/NEW-2). */
  refreshedExpiresAt: Date | null;
}

/** Validate a cookie token → the User, sliding-renewing the session; null if missing/expired. */
export async function validateSessionToken(prisma: PrismaClient, token: string): Promise<ValidatedSession | null> {
  const id = sessionIdFromToken(token);
  const session = await prisma.session.findUnique({ where: { id }, include: { user: true } });
  if (!session) return null;
  if (Date.now() >= session.expiresAt.getTime()) {
    await prisma.session.delete({ where: { id } }).catch(() => undefined);
    return null;
  }
  let refreshedExpiresAt: Date | null = null;
  if (session.expiresAt.getTime() - Date.now() < ttlMs() / 2) {
    refreshedExpiresAt = new Date(Date.now() + ttlMs());
    await prisma.session.update({ where: { id }, data: { expiresAt: refreshedExpiresAt } });
  }
  return { user: session.user, refreshedExpiresAt };
}

export async function invalidateSessionToken(prisma: PrismaClient, token: string): Promise<void> {
  await prisma.session.delete({ where: { id: sessionIdFromToken(token) } }).catch(() => undefined);
}

/** Revoke every session for a user (B3): used by revoke-all and single-session login. */
export async function invalidateSessionsByUserId(prisma: PrismaClient, userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}
