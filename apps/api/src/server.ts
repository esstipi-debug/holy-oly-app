import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
  // SERVE_WEB = the single-service deploy where Fastify also serves the built SPA → same origin,
  // so CORS isn't involved at all. Otherwise (split origin) the front sends the session cookie
  // cross-origin: in production an explicit WEB_ORIGIN is REQUIRED (credentialed CORS can't be a
  // wildcard — the `?? true` dev fallback would reflect any Origin). Fail fast rather than ship that.
  const serveWeb = process.env.SERVE_WEB === "true";
  const webOrigin = process.env.WEB_ORIGIN;
  if (process.env.NODE_ENV === "production" && !serveWeb && !webOrigin) {
    throw new Error("WEB_ORIGIN must be set in production (CORS credentials require an explicit origin)");
  }
  if (!serveWeb) {
    app.register(cors, { origin: webOrigin ?? true, credentials: true });
  }

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

  // Single-service deploy: Fastify also serves the built SPA + a client-routing fallback.
  // API routes above take router precedence; this only catches assets and unmatched client paths.
  if (serveWeb) {
    const webRoot =
      process.env.WEB_DIST_PATH ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "public");
    app.register(fastifyStatic, { root: webRoot, wildcard: false });
    app.setNotFoundHandler((req, reply) => {
      // An unmatched GET that wants HTML is a client route → hand back the SPA shell.
      if (req.method === "GET" && (req.headers.accept ?? "").includes("text/html")) {
        return reply.sendFile("index.html");
      }
      return reply.code(404).send({ error: "not found" });
    });
  }

  return app;
}
