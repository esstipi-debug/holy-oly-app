import { hash, verify } from "@node-rs/argon2";

// Explicit Argon2 cost params (B5) so the work factor is audit-visible, not an implicit default.
// Within the OWASP-recommended range. Algorithm is left at the library default (Argon2id); the
// const-enum `Algorithm` can't be referenced under isolatedModules, and the cost factors above
// are the security-relevant knobs.
const ARGON2_OPTS = {
  memoryCost: 65536, // 64 MiB
  timeCost: 3,
  parallelism: 4,
} as const;

/** Argon2id password hashing (prebuilt binary — no node-gyp). */
export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTS);
}

export function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  return verify(passwordHash, password);
}

// Precomputed once and reused: login verifies the submitted password against this when the email
// doesn't exist, so the Argon2 work runs on every attempt and unknown emails aren't faster to
// probe (B1 anti-enumeration). The sentinel is not a usable credential.
let dummyHashP: Promise<string> | null = null;
export function dummyHash(): Promise<string> {
  return (dummyHashP ??= hashPassword("dummy-anti-enumeration-sentinel-not-a-credential"));
}
