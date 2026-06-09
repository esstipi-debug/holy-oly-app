// Guard + config loader for the destructive demo seed. Pure (no DB, no side effects) so it is
// unit-testable without spinning up Postgres. `seed.ts` calls these before touching the database.

type Env = Record<string, string | undefined>;

/**
 * Refuse to run the destructive demo seed against production. The seed wipes every table, so a
 * stray `db:seed` in the Render shell would erase live data. Allow it only with an explicit
 * `ALLOW_DEMO_SEED=true` override (e.g. seeding a freshly-created empty prod DB on purpose).
 */
export function assertSeedAllowed(env: Env = process.env): void {
  if (env.NODE_ENV === "production" && env.ALLOW_DEMO_SEED !== "true") {
    throw new Error(
      "Refusing to run the destructive demo seed with NODE_ENV=production. " +
        "Set ALLOW_DEMO_SEED=true to override (and provide explicit SEED_* secrets).",
    );
  }
}

export interface SeedConfig {
  coachEmail: string;
  coachPassword: string;
  coachInvite: string;
  coach2Email: string;
  coach2Password: string;
  coach2Invite: string;
  atletaEmail: string;
  atletaPassword: string;
  maraEmail: string;
  maraPassword: string;
  kevinEmail: string;
  kevinPassword: string;
  coachId: string;
  coach2Id: string;
}

/**
 * Resolve a seed secret. Outside production the committed demo default is fine (local dev, CI,
 * embedded-Postgres integration tests). In production the value MUST come from the environment —
 * the committed defaults (`holyoly-demo`, `HOLY-DEMO`) must never authenticate a real deployment.
 */
function secret(key: string, devDefault: string, env: Env): string {
  const v = env[key];
  if (v && v.trim() !== "") return v;
  if (env.NODE_ENV === "production") {
    throw new Error(`Seed secret ${key} must be set explicitly in production (no committed default).`);
  }
  return devDefault;
}

/** Load and validate the seed configuration. Throws (via assertSeedAllowed/secret) before any DB work. */
export function loadSeedConfig(env: Env = process.env): SeedConfig {
  assertSeedAllowed(env);
  return {
    coachEmail: secret("SEED_COACH_EMAIL", "coach@holyoly.dev", env).trim().toLowerCase(),
    coachPassword: secret("SEED_COACH_PASSWORD", "holyoly-demo", env),
    coachInvite: secret("SEED_INVITE_CODE", "HALTER234567", env), // 12-char demo code (A6 format)
    atletaEmail: secret("SEED_ATLETA_EMAIL", "atleta@holyoly.dev", env).trim().toLowerCase(),
    atletaPassword: secret("SEED_ATLETA_PASSWORD", "holyoly-demo", env),
    maraEmail: secret("SEED_MARA_EMAIL", "mara@holyoly.dev", env).trim().toLowerCase(),
    maraPassword: secret("SEED_MARA_PASSWORD", "holyoly-demo", env),
    kevinEmail: secret("SEED_KEVIN_EMAIL", "kevin@holyoly.dev", env).trim().toLowerCase(),
    kevinPassword: secret("SEED_KEVIN_PASSWORD", "holyoly-demo", env),
    coach2Email: secret("SEED_COACH2_EMAIL", "coach2@holyoly.dev", env).trim().toLowerCase(),
    coach2Password: secret("SEED_COACH2_PASSWORD", "holyoly-demo", env),
    coach2Invite: secret("SEED_COACH2_INVITE", "HALTER345678", env),
    coachId: env.DEV_COACH_ID?.trim() || crypto.randomUUID(),
    coach2Id: env.DEV_COACH2_ID?.trim() || crypto.randomUUID(),
  };
}
