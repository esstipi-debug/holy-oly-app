import Fastify, { type FastifyError, type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import helmet from "@fastify/helmet";
import fastifyStatic from "@fastify/static";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { UserRole } from "@prisma/client";
import { PlanSchema, MedalSchema, CompsSchema, SessionLogSchema, PrescribedExercisesSchema } from "@holy-oly/core";
import { prisma } from "./db/client";
import * as repo from "./repo";
import { validateSessionToken } from "./auth/session";
import { authRoutes, SESSION_COOKIE, cookieOpts } from "./auth/routes";
import { localDemoLoginRoutes } from "./auth/local-demo-login";
import { googleAuthRoutes } from "./auth/google-routes";
import { vinculoRoutes } from "./vinculo/routes";
import { meRoutes } from "./me/routes";
import { requireCoach } from "./auth/guards";
import { requireCoachWrite } from "./auth/coach-writes";
import { billingRoutes } from "./billing/routes";
import { dummyHash } from "./auth/password";
import { recordAudit } from "./audit";

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
export interface BuildServerOptions {
  /** Enable per-route rate limiting (A1). Defaults to on, except under NODE_ENV=test. */
  rateLimit?: boolean;
}

export function buildServer(opts: BuildServerOptions = {}): FastifyInstance {
  const app = Fastify({
    // C5 — keep credentials out of logs. Fastify's default serializers don't log headers/bodies,
    // but redact is belt-and-suspenders if a custom serializer or debug level is ever enabled.
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
      redact: { paths: ["req.headers.cookie", "req.headers.authorization"], remove: true },
    },
    // A7 — DoS guards: cap body size and slow-request/connection time so a single client
    // can't exhaust memory or hold connections open. 256 KiB is generous for our JSON payloads.
    bodyLimit: 256 * 1024,
    requestTimeout: 15_000,
    connectionTimeout: 10_000,
  });
  app.register(cookie);
  // C1/C2/C6 — security headers owned in-app (one layer). CSP allows the SPA's inline styles and
  // Google Fonts; scripts stay 'self' (Vite emits external hashed chunks). HSTS only in prod.
  app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
      },
    },
    xFrameOptions: { action: "deny" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    hsts:
      process.env.NODE_ENV === "production"
        ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
        : false,
  });
  // Opt-in per route via config.rateLimit. Off under test so the int suite isn't throttled;
  // the dedicated ratelimit.int.test.ts enables it explicitly.
  const rateLimitEnabled = opts.rateLimit ?? process.env.NODE_ENV !== "test";
  if (rateLimitEnabled) {
    app.register(rateLimit, { global: false });
  }
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

  // Prime the anti-enumeration dummy hash so the first unknown-email login isn't measurably
  // slower than later ones (B1).
  void dummyHash();

  app.setErrorHandler((err: FastifyError, _req, reply) => {
    const status = err.statusCode ?? 500;
    if (status >= 500) {
      // Server errors: log full detail server-side, return a generic body (no internals leak).
      reply.log.error(err);
      return reply.code(500).send({ error: "internal server error" });
    }
    // 400s reaching here are framework body/parse errors whose message can echo request input
    // (e.g. a JSON SyntaxError char) — return a generic body. Our own validation 400s reply directly.
    if (status === 400) {
      return reply.code(400).send({ error: "bad request" });
    }
    // Other client errors (413 too-large, 429 rate-limited) have static, safe messages.
    return reply.code(status).send({ error: err.message });
  });

  // Resolve the session cookie → set the principal (coachId/athleteId) on the request.
  app.addHook("onRequest", async (req: FastifyRequest, reply: FastifyReply) => {
    const token = req.cookies?.[SESSION_COOKIE];
    if (!token) return;
    const result = await validateSessionToken(prisma, token);
    if (!result) return;
    const { user, refreshedExpiresAt } = result;
    req.userId = user.id;
    req.role = user.role;
    if (user.role === "coach") {
      const c = await prisma.coach.findUnique({ where: { userId: user.id } });
      req.coachId = c?.id;
    } else {
      const a = await prisma.athlete.findUnique({ where: { userId: user.id } });
      req.athleteId = a?.id;
    }
    // Sliding renewal slid the DB expiry forward → re-issue the cookie so the browser tracks it (B4).
    if (refreshedExpiresAt) {
      reply.setCookie(SESSION_COOKIE, token, cookieOpts(refreshedExpiresAt));
    }
  });

  app.register(authRoutes);
  app.register(localDemoLoginRoutes);
  app.register(googleAuthRoutes);
  app.register(vinculoRoutes);
  app.register(billingRoutes);
  app.register(meRoutes);

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

  const guardAthleteWrite = async (req: FastifyRequest, reply: FastifyReply, id: string): Promise<boolean> => {
    if (!(await guardAthlete(req, reply, id))) return false;
    const coachId = await requireCoachWrite(prisma, req, reply);
    return coachId !== undefined;
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
    // A9: the coach accessing an athlete's (redacted) cycle is the most sensitive read → audited.
    await recordAudit(prisma, { action: "cycle.read", actorUserId: req.userId, actorRole: req.role, targetAthleteId: req.params.id, ip: req.ip });
    const ctx = await repo.getCycle(prisma, req.params.id);
    if (!ctx) {
      reply.code(404).send({ error: "no cycle context" });
      return;
    }
    return ctx;
  });

  // ── Coach-authorized writes (Fase 4). Same gate as the reads (coach session + active Vinculo). ──

  app.put<{ Params: { id: string } }>("/athletes/:id/plan", async (req, reply) => {
    if (!(await guardAthleteWrite(req, reply, req.params.id))) return;
    const parsed = PlanSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid plan" });
    // The path id is the authorized athlete; reject a body that targets a different one.
    if (parsed.data.atletaId !== req.params.id) {
      return reply.code(400).send({ error: "athlete id mismatch" });
    }
    await repo.savePlan(prisma, req.params.id, parsed.data);
    await recordAudit(prisma, { action: "plan.write", actorUserId: req.userId, actorRole: req.role, targetAthleteId: req.params.id, ip: req.ip });
    return reply.code(200).send({ ok: true });
  });

  app.post<{ Params: { id: string } }>("/athletes/:id/medals", async (req, reply) => {
    if (!(await guardAthleteWrite(req, reply, req.params.id))) return;
    const parsed = MedalSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid medal" });
    await repo.addMedal(prisma, req.params.id, parsed.data);
    await recordAudit(prisma, { action: "medal.add", actorUserId: req.userId, actorRole: req.role, targetAthleteId: req.params.id, ip: req.ip });
    return reply.code(201).send({ ok: true });
  });

  app.put<{ Params: { id: string } }>("/athletes/:id/comps", async (req, reply) => {
    if (!(await guardAthleteWrite(req, reply, req.params.id))) return;
    const parsed = CompsSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid comps" });
    await repo.setComps(prisma, req.params.id, parsed.data);
    await recordAudit(prisma, { action: "comps.write", actorUserId: req.userId, actorRole: req.role, targetAthleteId: req.params.id, ip: req.ip });
    return reply.code(200).send({ ok: true });
  });

  app.get<{ Params: { id: string } }>("/athletes/:id/sessions", async (req, reply) => {
    if (!(await guardAthlete(req, reply, req.params.id))) return;
    return repo.getSessionLog(prisma, req.params.id);
  });

  app.put<{ Params: { id: string } }>("/athletes/:id/sessions", async (req, reply) => {
    if (!(await guardAthleteWrite(req, reply, req.params.id))) return;
    const parsed = SessionLogSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid sessions" });
    await repo.setSessionLog(prisma, req.params.id, parsed.data);
    await recordAudit(prisma, { action: "sessions.write", actorUserId: req.userId, actorRole: req.role, targetAthleteId: req.params.id, ip: req.ip });
    return reply.code(200).send({ ok: true });
  });

  app.get<{ Params: { id: string }; Querystring: { week?: string } }>("/athletes/:id/prescription", async (req, reply) => {
    if (!(await guardAthlete(req, reply, req.params.id))) return;
    const week = Number(req.query.week);
    if (!Number.isInteger(week) || week < 1 || week > 104) return reply.code(400).send({ error: "week required (1..104)" });
    return repo.getPrescriptionWeek(prisma, req.params.id, week);
  });

  app.get<{ Params: { id: string } }>("/athletes/:id/heat", async (req, reply) => {
    if (!(await guardAthlete(req, reply, req.params.id))) return;
    return repo.getPlanHeat(prisma, req.params.id);
  });

  app.put<{ Params: { id: string; week: string; idx: string } }>("/athletes/:id/prescription/:week/:idx", async (req, reply) => {
    if (!(await guardAthleteWrite(req, reply, req.params.id))) return;
    const week = Number(req.params.week);
    const idx = Number(req.params.idx);
    if (!Number.isInteger(week) || week < 1 || week > 104 || !Number.isInteger(idx) || idx < 0 || idx > 13) {
      return reply.code(400).send({ error: "bad week/idx" });
    }
    const parsed = PrescribedExercisesSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid session" });
    await repo.setSession(prisma, req.params.id, week, idx, parsed.data);
    await recordAudit(prisma, { action: "prescription.write", actorUserId: req.userId, actorRole: req.role, targetAthleteId: req.params.id, ip: req.ip });
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
