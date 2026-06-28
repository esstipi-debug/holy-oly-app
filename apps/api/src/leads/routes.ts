import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../db/client";
import { LeadInputSchema } from "./schemas";

/**
 * Public, cookieless lead capture for the marketing landing (hosted on a SEPARATE origin — the
 * landing's inline scripts can't live under the app's strict CSP). Because no session cookie is
 * involved, we can reflect the request Origin in ACAO without the credentialed-CORS constraint.
 * In the single-service prod deploy (SERVE_WEB=true) the global @fastify/cors plugin is OFF, so
 * these manual headers are the only ones set → no double-header risk. The hasHeader guard keeps it
 * safe if a split-origin deploy ever turns the plugin back on.
 */
function setCors(req: FastifyRequest, reply: FastifyReply): void {
  if (!reply.hasHeader("access-control-allow-origin")) {
    reply.header("access-control-allow-origin", req.headers.origin ?? "*");
    reply.header("vary", "Origin");
  }
}

export async function leadRoutes(app: FastifyInstance): Promise<void> {
  // CORS preflight: a JSON POST from another origin is a non-simple request, so the browser sends
  // OPTIONS first. Must answer explicitly — the SPA notFound fallback only serves GET+html.
  app.options("/leads", async (req, reply) => {
    setCors(req, reply);
    return reply
      .header("access-control-allow-methods", "POST, OPTIONS")
      .header("access-control-allow-headers", "content-type")
      .header("access-control-max-age", "600")
      .code(204)
      .send();
  });

  // Rate-limited per IP (anti-spam). Off automatically under NODE_ENV=test.
  app.post(
    "/leads",
    { config: { rateLimit: { max: 8, timeWindow: "1 minute" } } },
    async (req, reply) => {
      setCors(req, reply);
      const parsed = LeadInputSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: "invalid lead" });
      // Honeypot tripped → behave like success but persist nothing (don't tip off the bot).
      if (parsed.data.website && parsed.data.website.length > 0) {
        return reply.code(201).send({ ok: true });
      }
      await prisma.lead.create({
        data: {
          email: parsed.data.email,
          athletes: parsed.data.athletes,
          country: parsed.data.country,
          source: "landing-coach",
        },
      });
      return reply.code(201).send({ ok: true });
    },
  );
}
