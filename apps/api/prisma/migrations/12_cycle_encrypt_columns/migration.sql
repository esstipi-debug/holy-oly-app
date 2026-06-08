-- D1: convert the cycle columns from enum to TEXT *in place* (USING ::text), so existing rows are
-- preserved as plaintext. New writes are encrypted-at-rest (AES-256-GCM) when CYCLE_ENCRYPTION_KEY
-- is set; legacy plaintext stays readable (decryptAtRest passes through non-prefixed values).
-- (Prisma's generated drop+add would have destroyed data and failed on a non-empty table.)
ALTER TABLE "CycleConsent"
  ALTER COLUMN "share" TYPE TEXT USING "share"::text,
  ALTER COLUMN "state" TYPE TEXT USING "state"::text;
