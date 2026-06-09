import type { FastifyInstance, FastifyRequest } from "fastify";
import { prisma } from "../db/client";
import { createSession } from "./session";
import { cookieOpts, SESSION_COOKIE } from "./routes";

type DemoRole = "coach" | "atleta";

function isLoopback(req: FastifyRequest): boolean {
  const ip = req.ip;
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
}

function localDemoLoginAllowed(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.ALLOW_LOCAL_DEMO_LOGIN === "false") return false;
  // Explicit opt-in only — SERVE_WEB is also true in production single-origin deploys.
  return process.env.ALLOW_LOCAL_DEMO_LOGIN === "true";
}

function demoEmail(role: DemoRole): string {
  if (role === "coach") {
    return (process.env.SEED_COACH_EMAIL ?? "coach@holyoly.dev").trim().toLowerCase();
  }
  return (process.env.SEED_KEVIN_EMAIL ?? "kevin@holyoly.dev").trim().toLowerCase();
}

/** One-click demo login for the local desktop shortcuts (127.0.0.1 only, never in production). */
export async function localDemoLoginRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { as?: string } }>("/auth/local-demo-login", async (req, reply) => {
    if (!localDemoLoginAllowed() || !isLoopback(req)) {
      return reply.code(404).send({ error: "not found" });
    }
    const role: DemoRole = req.query.as === "atleta" ? "atleta" : "coach";
    const email = demoEmail(role);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return reply.code(503).send({ error: "demo user missing — run db:seed once" });
    }
    const { token, expiresAt } = await createSession(prisma, user.id);
    reply.setCookie(SESSION_COOKIE, token, cookieOpts(expiresAt));
    return reply.redirect(role === "coach" ? "/coach" : "/atleta");
  });
}
