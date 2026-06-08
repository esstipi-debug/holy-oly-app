import { sha256 } from "@oslojs/crypto/sha2";
import { encodeBase32LowerCaseNoPadding, encodeHexLowerCase } from "@oslojs/encoding";

/** Random single-use token (base32). Only SHA-256 hex is persisted (same pattern as sessions). */
export function generateOneTimeToken(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return encodeBase32LowerCaseNoPadding(bytes);
}

export function tokenIdFromRaw(token: string): string {
  return encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
}
