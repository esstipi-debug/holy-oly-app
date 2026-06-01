import { sha256 } from "@oslojs/crypto/sha2";
import { encodeBase32LowerCaseNoPadding, encodeHexLowerCase } from "@oslojs/encoding";
import type { PrismaClient, User } from "@prisma/client";

const DAY_MS = 86_400_000;
const TTL_MS = 30 * DAY_MS;
const RENEW_WITHIN_MS = 15 * DAY_MS;

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
  const expiresAt = new Date(Date.now() + TTL_MS);
  await prisma.session.create({ data: { id: sessionIdFromToken(token), userId, expiresAt } });
  return { token, expiresAt };
}

/** Validate a cookie token → the User, sliding-renewing the session; null if missing/expired. */
export async function validateSessionToken(prisma: PrismaClient, token: string): Promise<User | null> {
  const id = sessionIdFromToken(token);
  const session = await prisma.session.findUnique({ where: { id }, include: { user: true } });
  if (!session) return null;
  if (Date.now() >= session.expiresAt.getTime()) {
    await prisma.session.delete({ where: { id } }).catch(() => undefined);
    return null;
  }
  if (session.expiresAt.getTime() - Date.now() < RENEW_WITHIN_MS) {
    await prisma.session.update({ where: { id }, data: { expiresAt: new Date(Date.now() + TTL_MS) } });
  }
  return session.user;
}

export async function invalidateSessionToken(prisma: PrismaClient, token: string): Promise<void> {
  await prisma.session.delete({ where: { id: sessionIdFromToken(token) } }).catch(() => undefined);
}
