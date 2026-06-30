import type { FastifyInstance } from "fastify";
import { prisma } from "../db/client";
import { createSession } from "./session";
import { cookieOpts, SESSION_COOKIE } from "./routes";
import { DEMO_LOGIN_RATE_LIMIT } from "./rateLimits";

type DemoRole = "coach" | "atleta";

// Short TTL bounds session-row growth from public demo traffic: unused demo sessions (e.g. a bot
// hitting the endpoint) expire in hours, not the 30-day default. Genuinely-active visitors are
// slid-renewed normally by validateSessionToken.
const DEMO_SESSION_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

/**
 * The two SEEDED demo accounts the public "try the demo" logs into. The coach owns the showcase
 * plantel (Mara/Kevin/…); the atleta (Kevin) has a full plan + history. Overridable by env for prod.
 */
function demoEmail(role: DemoRole): string {
  if (role === "coach") {
    return (process.env.DEMO_COACH_EMAIL ?? process.env.SEED_COACH_EMAIL ?? "coach@holyoly.dev")
      .trim()
      .toLowerCase();
  }
  return (process.env.DEMO_ATLETA_EMAIL ?? process.env.SEED_KEVIN_EMAIL ?? "kevin@holyoly.dev")
    .trim()
    .toLowerCase();
}

/** Every email that counts as a demo account — ANY session for these is read-only (server.ts gate). */
export function demoEmails(): string[] {
  return [demoEmail("coach"), demoEmail("atleta")];
}

/** True when the logged-in user is a demo account → its session must be treated as read-only. */
export function isDemoEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return demoEmails().includes(email.trim().toLowerCase());
}

/**
 * Off by default. The public demo is only exposed when DEMO_LOGIN_ENABLED=true (set deliberately
 * in prod). Lets us pull the demo instantly without a deploy.
 */
export function demoLoginEnabled(): boolean {
  return process.env.DEMO_LOGIN_ENABLED === "true";
}

/**
 * Public one-click demo login. Unlike auth/local-demo-login (loopback + non-prod ONLY), this is
 * built to run in production behind an explicit env opt-in. It starts a session for a SEEDED demo
 * account — no password typed or exposed. That session is READ-ONLY: the global gate in server.ts
 * rejects every mutating request from a demo session, which also makes the real MercadoPago
 * checkout unreachable. A visitor browses the real product; they can never write or be charged.
 */
export async function demoLoginRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { as?: string } }>(
    "/auth/demo",
    { config: { rateLimit: DEMO_LOGIN_RATE_LIMIT } },
    async (req, reply) => {
      if (!demoLoginEnabled()) {
        return reply.code(404).send({ error: "not found" });
      }
      const role: DemoRole = req.query.as === "atleta" ? "atleta" : "coach";
      const email = demoEmail(role);
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        // The demo account isn't seeded in this environment — honest 503 instead of a broken redirect.
        return reply.code(503).send({ error: "demo no disponible" });
      }
      const { token, expiresAt } = await createSession(prisma, user.id, DEMO_SESSION_TTL_MS);
      reply.setCookie(SESSION_COOKIE, token, cookieOpts(expiresAt));
      // Same-origin relative path only (no user-controlled target → no open redirect). Explicit 302.
      return reply.redirect(role === "coach" ? "/coach" : "/atleta", 302);
    },
  );
}
