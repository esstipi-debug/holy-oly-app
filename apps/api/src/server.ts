import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import cookie from "@fastify/cookie";
import type { UserRole } from "@prisma/client";
import { prisma } from "./db/client";
import * as repo from "./repo";
import { validateSessionToken } from "./auth/session";
import { authRoutes, SESSION_COOKIE } from "./auth/routes";

declare module "fastify" {
  interface FastifyRequest {
    userId?: string;
    role?: UserRole;
    coachId?: string;
    athleteId?: string;
  }
}

/**
 * Build the Fastify app. A session cookie (httpOnly) identifies the principal; the
 * onRequest hook resolves it to coachId/athleteId. Coach-scoped reads require a coach
 * session AND an active Vinculo to the athlete (Fase 1 authz, now with real identity).
 */
export function buildServer(): FastifyInstance {
  const app = Fastify({ logger: true });
  app.register(cookie);

  app.setErrorHandler((err, _req, reply) => {
    reply.log.error(err);
    reply.code(500).send({ error: "internal server error" });
  });

  // Resolve the session cookie → set the principal (coachId/athleteId) on the request.
  app.addHook("onRequest", async (req: FastifyRequest) => {
    const token = req.cookies?.[SESSION_COOKIE];
    if (!token) return;
    const user = await validateSessionToken(prisma, token);
    if (!user) return;
    req.userId = user.id;
    req.role = user.role;
    if (user.role === "coach") {
      const c = await prisma.coach.findUnique({ where: { userId: user.id } });
      req.coachId = c?.id;
    } else {
      const a = await prisma.athlete.findUnique({ where: { userId: user.id } });
      req.athleteId = a?.id;
    }
  });

  app.register(authRoutes);

  app.get("/health", async () => ({ ok: true }));

  function requireCoach(req: FastifyRequest, reply: FastifyReply): string | undefined {
    if (!req.coachId) {
      reply.code(401).send({ error: "coach session required" });
      return undefined;
    }
    return req.coachId;
  }

  // Athlete-scoped read: requires a coach session + an active Vinculo to the athlete.
  const guardAthlete = async (req: FastifyRequest, reply: FastifyReply, id: string): Promise<boolean> => {
    const coachId = requireCoach(req, reply);
    if (!coachId) return false;
    if (!id) {
      reply.code(400).send({ error: "missing athlete id" });
      return false;
    }
    if (!(await repo.hasActiveLink(prisma, coachId, id))) {
      reply.code(403).send({ error: "forbidden" });
      return false;
    }
    return true;
  };

  app.get("/roster", async (req, reply) => {
    const coachId = requireCoach(req, reply);
    if (!coachId) return;
    return repo.getRoster(prisma, coachId);
  });

  app.get<{ Params: { id: string } }>("/athletes/:id/series", async (req, reply) => {
    if (!(await guardAthlete(req, reply, req.params.id))) return;
    const s = await repo.getSeries(prisma, req.params.id);
    if (!s) {
      reply.code(404).send({ error: "no series" });
      return;
    }
    return s;
  });

  app.get<{ Params: { id: string } }>("/athletes/:id/plan", async (req, reply) => {
    if (!(await guardAthlete(req, reply, req.params.id))) return;
    const p = await repo.getPlan(prisma, req.params.id);
    if (!p) {
      reply.code(404).send({ error: "no plan" });
      return;
    }
    return p;
  });

  app.get<{ Params: { id: string } }>("/athletes/:id/medals", async (req, reply) => {
    if (!(await guardAthlete(req, reply, req.params.id))) return;
    return repo.getMedals(prisma, req.params.id);
  });

  app.get<{ Params: { id: string } }>("/athletes/:id/comps", async (req, reply) => {
    if (!(await guardAthlete(req, reply, req.params.id))) return;
    return repo.getComps(prisma, req.params.id);
  });

  app.get<{ Params: { id: string } }>("/athletes/:id/cycle", async (req, reply) => {
    if (!(await guardAthlete(req, reply, req.params.id))) return;
    const ctx = await repo.getCycle(prisma, req.params.id);
    if (!ctx) {
      reply.code(404).send({ error: "no cycle context" });
      return;
    }
    return ctx;
  });

  return app;
}
