import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import type { UserRole } from "@prisma/client";
import { PlanSchema, MedalSchema, CompsSchema } from "@holy-oly/core";
import { prisma } from "./db/client";
import * as repo from "./repo";
import { validateSessionToken } from "./auth/session";
import { authRoutes, SESSION_COOKIE } from "./auth/routes";
import { vinculoRoutes } from "./vinculo/routes";
import { requireCoach } from "./auth/guards";

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
  // Allow the front (cross-origin in dev) to send the session cookie. In production an explicit
  // WEB_ORIGIN is REQUIRED: with credentials:true the `?? true` dev fallback reflects any Origin,
  // letting any site make authenticated calls. Fail fast rather than ship that.
  const webOrigin = process.env.WEB_ORIGIN;
  if (process.env.NODE_ENV === "production" && !webOrigin) {
    throw new Error("WEB_ORIGIN must be set in production (CORS credentials require an explicit origin)");
  }
  app.register(cors, { origin: webOrigin ?? true, credentials: true });

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
  app.register(vinculoRoutes);

  app.get("/health", async () => ({ ok: true }));

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

  // ── Coach-authorized writes (Fase 4). Same gate as the reads (coach session + active Vinculo). ──

  app.put<{ Params: { id: string } }>("/athletes/:id/plan", async (req, reply) => {
    if (!(await guardAthlete(req, reply, req.params.id))) return;
    const parsed = PlanSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid plan" });
    // The path id is the authorized athlete; reject a body that targets a different one.
    if (parsed.data.atletaId !== req.params.id) {
      return reply.code(400).send({ error: "athlete id mismatch" });
    }
    await repo.savePlan(prisma, req.params.id, parsed.data);
    return reply.code(200).send({ ok: true });
  });

  app.post<{ Params: { id: string } }>("/athletes/:id/medals", async (req, reply) => {
    if (!(await guardAthlete(req, reply, req.params.id))) return;
    const parsed = MedalSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid medal" });
    await repo.addMedal(prisma, req.params.id, parsed.data);
    return reply.code(201).send({ ok: true });
  });

  app.put<{ Params: { id: string } }>("/athletes/:id/comps", async (req, reply) => {
    if (!(await guardAthlete(req, reply, req.params.id))) return;
    const parsed = CompsSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid comps" });
    await repo.setComps(prisma, req.params.id, parsed.data);
    return reply.code(200).send({ ok: true });
  });

  return app;
}
