import type { FastifyReply, FastifyRequest } from "fastify";

/** Returns the coach id from the session, or sends 401 and returns undefined. */
export function requireCoach(req: FastifyRequest, reply: FastifyReply): string | undefined {
  if (!req.coachId) {
    reply.code(401).send({ error: "coach session required" });
    return undefined;
  }
  return req.coachId;
}

/** Returns the athlete id from the session, or sends 401 and returns undefined. */
export function requireAthlete(req: FastifyRequest, reply: FastifyReply): string | undefined {
  if (!req.athleteId) {
    reply.code(401).send({ error: "athlete session required" });
    return undefined;
  }
  return req.athleteId;
}
