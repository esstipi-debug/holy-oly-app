import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// AES-256-GCM encryption at rest for sensitive columns (D1 — cycle state/share). Opt-in: with no
// CYCLE_ENCRYPTION_KEY the functions are no-ops (store plaintext) so behavior is unchanged until a
// key is configured. Ciphertext is prefixed so legacy plaintext rows keep reading correctly.
const PREFIX = "enc:v1:";

function key(): Buffer | null {
  const hex = process.env.CYCLE_ENCRYPTION_KEY;
  if (!hex) return null;
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("CYCLE_ENCRYPTION_KEY must be 64 hex chars (32 bytes)");
  }
  return Buffer.from(hex, "hex");
}

/** Encrypt a value for storage. No key configured → returns the plaintext unchanged. */
export function encryptAtRest(plain: string): string {
  const k = key();
  if (!k) return plain;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", k, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, ct]).toString("base64");
}

/** Decrypt a stored value. Non-prefixed input is treated as legacy plaintext and returned as-is. */
export function decryptAtRest(stored: string): string {
  if (!stored.startsWith(PREFIX)) return stored;
  const k = key();
  if (!k) throw new Error("CYCLE_ENCRYPTION_KEY required to read encrypted data");
  const raw = Buffer.from(stored.slice(PREFIX.length), "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const ct = raw.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", k, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
