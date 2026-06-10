import type { FastifyInstance, FastifyRequest } from "fastify";
import { prisma } from "../db/client";
import { createSession } from "./session";
import { cookieOpts, SESSION_COOKIE } from "./routes";

type DemoRole = "coach" | "atleta";

/**
 * True only when the request's TCP peer is localhost. Reads `req.socket.remoteAddress` (the raw
 * connection peer) rather than `req.ip` ON PURPOSE: `req.ip` honors `X-Forwarded-For` when Fastify's
 * `trustProxy` is enabled, so a remote client could spoof "loopback" by sending that header. The
 * socket peer address can never be set by a header, so this gate stays sound regardless of trustProxy.
 */
export function isLoopback(req: Pick<FastifyRequest, "socket">): boolean {
  const ip = req.socket.remoteAddress ?? "";
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

/** Prisma "can't reach the database" family (engine init failure or P1xxx connection codes). */
function isDbUnreachable(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { name?: string; code?: string; errorCode?: string };
  if (e.name === "PrismaClientInitializationError") return true;
  const code = e.errorCode ?? e.code ?? "";
  return ["P1001", "P1002", "P1008", "P1017"].includes(code);
}

/** One-click demo login for the local desktop shortcuts (127.0.0.1 only, never in production). */
export async function localDemoLoginRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { as?: string } }>("/auth/local-demo-login", async (req, reply) => {
    if (!localDemoLoginAllowed() || !isLoopback(req)) {
      return reply.code(404).send({ error: "not found" });
    }
    const role: DemoRole = req.query.as === "atleta" ? "atleta" : "coach";
    const email = demoEmail(role);
    try {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return reply.code(503).send({ error: "demo user missing — run db:seed once" });
      }
      const { token, expiresAt } = await createSession(prisma, user.id);
      reply.setCookie(SESSION_COOKIE, token, cookieOpts(expiresAt));
      return reply.redirect(role === "coach" ? "/coach" : "/atleta");
    } catch (err) {
      // The demo's embedded Postgres can die under the server (force-killed orphans, double
      // boot). An honest 503 beats the generic 500: it names the fix for the desktop user.
      if (isDbUnreachable(err)) {
        req.log.error(err, "local-demo-login: database unreachable");
        return reply
          .code(503)
          .send({ error: "base de datos local no disponible — cerrá la app y volvé a abrirla" });
      }
      throw err;
    }
  });
}
