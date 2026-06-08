import type EmbeddedPostgres from "embedded-postgres";
import type { FastifyInstance } from "fastify";

// Shared between globalSetup and globalTeardown (same runner process).
export const handle: {
  app?: FastifyInstance;
  pg?: EmbeddedPostgres;
  dataDir?: string;
} = {};
