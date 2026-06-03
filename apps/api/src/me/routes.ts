import type { FastifyInstance } from "fastify";
import { DayLogInputSchema } from "@holy-oly/core";
import { prisma } from "../db/client";
import { requireAthlete } from "../auth/guards";
import * as repo from "../repo";

/** Server's calendar date (UTC). A1 anchors the athlete loop to this; per-athlete timezones are a
 *  later refinement. */
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Athlete-self surface (Proyecto A). The principal is the athlete's own session: `req.athleteId`
 * comes from the session cookie, NEVER from the body or path — so there is no cross-athlete write.
 * No Vínculo is required (the athlete owns their data).
 */
export async function meRoutes(app: FastifyInstance): Promise<void> {
  app.get("/me/plan", async (req, reply) => {
    const athleteId = requireAthlete(req, reply);
    if (!athleteId) return;
    const view = await repo.getMePlanView(prisma, athleteId, todayISO());
    if (!view) return reply.code(404).send({ error: "no athlete" });
    return view;
  });

  app.get("/me/series", async (req, reply) => {
    const athleteId = requireAthlete(req, reply);
    if (!athleteId) return;
    const s = await repo.getSeries(prisma, athleteId);
    if (!s) return reply.code(404).send({ error: "no series" });
    return s;
  });

  app.get<{ Querystring: { date?: string } }>("/me/daylog", async (req, reply) => {
    const athleteId = requireAthlete(req, reply);
    if (!athleteId) return;
    return repo.getDayLogView(prisma, athleteId, todayISO(), req.query.date);
  });

  app.put("/me/daylog", async (req, reply) => {
    const athleteId = requireAthlete(req, reply);
    if (!athleteId) return;
    const parsed = DayLogInputSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid daylog" });
    return repo.upsertDayLog(prisma, athleteId, todayISO(), parsed.data);
  });
}
