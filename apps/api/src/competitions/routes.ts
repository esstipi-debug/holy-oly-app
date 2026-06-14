import type { FastifyInstance } from "fastify";
import { CompetitionInputSchema, AcoplarInputSchema } from "@holy-oly/core";
import { prisma } from "../db/client";
import { requireCoach } from "../auth/guards";
import { requireCoachWrite } from "../auth/coach-writes";
import * as repo from "../repo";
import { recordAudit } from "../audit";

/**
 * Competencias compartidas del coach (slice 2026-06-14). El coach crea una compe UNA vez y acopla
 * a varios atletas de su plantel con un rol (pico ancla el macro / paso no toca el plan). Todas las
 * rutas son coach-scoped: la compe debe ser del coach autenticado, y cada atleta acoplado debe
 * tener vínculo ACTIVO con él. Las mutaciones pasan por requireCoachWrite (gate de billing/email,
 * igual que el resto de las escrituras del coach).
 */
export async function competitionRoutes(app: FastifyInstance): Promise<void> {
  app.get("/competitions", async (req, reply) => {
    const coachId = requireCoach(req, reply);
    if (!coachId) return;
    return repo.getCompetitions(prisma, coachId);
  });

  app.post("/competitions", async (req, reply) => {
    const coachId = await requireCoachWrite(prisma, req, reply);
    if (!coachId) return;
    const parsed = CompetitionInputSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid competition" });
    const c = await repo.createCompetition(prisma, coachId, parsed.data);
    await recordAudit(prisma, { action: "competition.create", actorUserId: req.userId, actorRole: req.role, ip: req.ip });
    return reply.code(201).send(c);
  });

  app.get<{ Params: { id: string } }>("/competitions/:id", async (req, reply) => {
    const coachId = requireCoach(req, reply);
    if (!coachId) return;
    const c = await repo.getCompetition(prisma, coachId, req.params.id);
    if (!c) {
      reply.code(404).send({ error: "not found" });
      return;
    }
    return c;
  });

  app.patch<{ Params: { id: string } }>("/competitions/:id", async (req, reply) => {
    const coachId = await requireCoachWrite(prisma, req, reply);
    if (!coachId) return;
    const parsed = CompetitionInputSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid competition" });
    const ok = await repo.updateCompetition(prisma, coachId, req.params.id, parsed.data);
    if (!ok) return reply.code(404).send({ error: "not found" });
    await recordAudit(prisma, { action: "competition.update", actorUserId: req.userId, actorRole: req.role, ip: req.ip });
    return reply.code(200).send({ ok: true });
  });

  app.delete<{ Params: { id: string } }>("/competitions/:id", async (req, reply) => {
    const coachId = await requireCoachWrite(prisma, req, reply);
    if (!coachId) return;
    const ok = await repo.deleteCompetition(prisma, coachId, req.params.id);
    if (!ok) return reply.code(404).send({ error: "not found" });
    await recordAudit(prisma, { action: "competition.delete", actorUserId: req.userId, actorRole: req.role, ip: req.ip });
    return reply.code(200).send({ ok: true });
  });

  // Acople en lote: [{ athleteId, role }]. Cada atleta debe tener vínculo ACTIVO con el coach.
  app.post<{ Params: { id: string } }>("/competitions/:id/entries", async (req, reply) => {
    const coachId = await requireCoachWrite(prisma, req, reply);
    if (!coachId) return;
    const parsed = AcoplarInputSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid entries" });
    // Cada atleta debe tener vínculo ACTIVO con el coach (una sola query para todo el lote).
    const ids = parsed.data.entries.map((e) => e.athleteId);
    const linked = await prisma.vinculo.findMany({
      where: { coachId, athleteId: { in: ids }, estado: "activo" },
      select: { athleteId: true },
    });
    const linkedSet = new Set(linked.map((v) => v.athleteId));
    if (ids.some((aid) => !linkedSet.has(aid))) {
      return reply.code(403).send({ error: "athlete not linked" });
    }
    const ok = await repo.acoplarAtletas(prisma, coachId, req.params.id, parsed.data.entries);
    if (!ok) return reply.code(404).send({ error: "not found" });
    await recordAudit(prisma, { action: "competition.acople", actorUserId: req.userId, actorRole: req.role, ip: req.ip });
    return reply.code(200).send({ ok: true });
  });

  app.delete<{ Params: { id: string; athleteId: string } }>("/competitions/:id/entries/:athleteId", async (req, reply) => {
    const coachId = await requireCoachWrite(prisma, req, reply);
    if (!coachId) return;
    const ok = await repo.desacoplarAtleta(prisma, coachId, req.params.id, req.params.athleteId);
    if (!ok) return reply.code(404).send({ error: "not found" });
    await recordAudit(prisma, { action: "competition.desacople", actorUserId: req.userId, actorRole: req.role, targetAthleteId: req.params.athleteId, ip: req.ip });
    return reply.code(200).send({ ok: true });
  });
}
