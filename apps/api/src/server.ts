import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { prisma } from "./db/client";
import * as repo from "./repo";

const DEV_COACH_ID = process.env.DEV_COACH_ID ?? "coach-stub";

declare module "fastify" {
  interface FastifyRequest {
    coachId: string;
  }
}

/**
 * Build the Fastify app. Coach resolution is a STUB in Fase 1 (dev header / constant);
 * Fase 3 replaces the onRequest hook with real session auth — endpoints stay unchanged.
 */
export function buildServer(): FastifyInstance {
  const app = Fastify({ logger: true });

  // Generic error responses — internal/Prisma details never leak; full error logged server-side.
  app.setErrorHandler((err, _req, reply) => {
    reply.log.error(err);
    reply.code(500).send({ error: "internal server error" });
  });

  app.decorateRequest("coachId", "");
  app.addHook("onRequest", async (req: FastifyRequest) => {
    // Fase 1 stub: the dev header is honored only outside production (real auth lands in Fase 3).
    const header = req.headers["x-dev-coach"];
    const allowDevHeader = process.env.NODE_ENV !== "production";
    req.coachId = (allowDevHeader && typeof header === "string" && header) || DEV_COACH_ID;
  });

  app.get("/health", async () => ({ ok: true }));

  app.get("/roster", async (req: FastifyRequest) => {
    return repo.getRoster(prisma, req.coachId);
  });

  // Every athlete-scoped read authorizes against an active Vinculo, then fetches.
  const guard = async (req: FastifyRequest, reply: FastifyReply, id: string): Promise<boolean> => {
    if (!id) {
      reply.code(400).send({ error: "missing athlete id" });
      return false;
    }
    if (!(await repo.hasActiveLink(prisma, req.coachId, id))) {
      reply.code(403).send({ error: "forbidden" });
      return false;
    }
    return true;
  };

  app.get<{ Params: { id: string } }>("/athletes/:id/series", async (req, reply) => {
    if (!(await guard(req, reply, req.params.id))) return;
    const s = await repo.getSeries(prisma, req.params.id);
    if (!s) {
      reply.code(404).send({ error: "no series" });
      return;
    }
    return s;
  });

  app.get<{ Params: { id: string } }>("/athletes/:id/plan", async (req, reply) => {
    if (!(await guard(req, reply, req.params.id))) return;
    const p = await repo.getPlan(prisma, req.params.id);
    if (!p) {
      reply.code(404).send({ error: "no plan" });
      return;
    }
    return p;
  });

  app.get<{ Params: { id: string } }>("/athletes/:id/medals", async (req, reply) => {
    if (!(await guard(req, reply, req.params.id))) return;
    return repo.getMedals(prisma, req.params.id);
  });

  app.get<{ Params: { id: string } }>("/athletes/:id/comps", async (req, reply) => {
    if (!(await guard(req, reply, req.params.id))) return;
    return repo.getComps(prisma, req.params.id);
  });

  app.get<{ Params: { id: string } }>("/athletes/:id/cycle", async (req, reply) => {
    if (!(await guard(req, reply, req.params.id))) return;
    const ctx = await repo.getCycle(prisma, req.params.id);
    if (!ctx) {
      reply.code(404).send({ error: "no cycle context" });
      return;
    }
    return ctx;
  });

  return app;
}
