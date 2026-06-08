import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../db/client";
import { requireCoach, requireAthlete } from "../auth/guards";
import { AcceptCodeSchema } from "../auth/schemas";

// Unambiguous alphabet (no 0/O/1/I) for human-typed invite codes.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function genInviteCode(): string {
  // 12 chars × log2(32) = 60 bits of entropy (A6). No modulo bias: 256 % 32 === 0.
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]!).join("");
}

/** Vínculo (coach⇄athlete) lifecycle: rotate code → athlete accepts → coach confirms/denies. */
export async function vinculoRoutes(app: FastifyInstance): Promise<void> {
  app.post("/invite/rotate", async (req, reply) => {
    const coachId = requireCoach(req, reply);
    if (!coachId) return;
    const inviteCode = genInviteCode();
    await prisma.coach.update({ where: { id: coachId }, data: { inviteCode } });
    return { inviteCode };
  });

  app.get("/invite", async (req, reply) => {
    const coachId = requireCoach(req, reply);
    if (!coachId) return;
    const coach = await prisma.coach.findUnique({ where: { id: coachId } });
    return { inviteCode: coach?.inviteCode ?? null };
  });

  app.post("/vinculos/accept", async (req, reply) => {
    const athleteId = requireAthlete(req, reply);
    if (!athleteId) return;
    const parsed = AcceptCodeSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid input" });
    const coach = await prisma.coach.findUnique({ where: { inviteCode: parsed.data.code } });
    if (!coach) return reply.code(404).send({ error: "invalid code" });
    // Idempotent: re-accepting resets to pendiente (e.g., after a previous denial).
    const v = await prisma.vinculo.upsert({
      where: { coachId_athleteId: { coachId: coach.id, athleteId } },
      create: { coachId: coach.id, athleteId, estado: "pendiente" },
      update: { estado: "pendiente" },
    });
    return reply.code(201).send({ id: v.id, estado: v.estado });
  });

  app.get("/vinculos", async (req, reply) => {
    const coachId = requireCoach(req, reply);
    if (!coachId) return;
    const vinculos = await prisma.vinculo.findMany({
      where: { coachId },
      include: { athlete: { select: { id: true, nombre: true, iniciales: true } } },
      orderBy: { createdAt: "desc" },
    });
    return vinculos.map((v) => ({ id: v.id, estado: v.estado, athlete: v.athlete }));
  });

  async function setEstado(
    req: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
    estado: "activo" | "rechazado",
  ): Promise<unknown> {
    const coachId = requireCoach(req, reply);
    if (!coachId) return undefined;
    const v = await prisma.vinculo.findUnique({ where: { id: req.params.id } });
    if (!v || v.coachId !== coachId) {
      reply.code(404).send({ error: "not found" });
      return undefined;
    }
    // Confirm/deny only act on a pending request. Without this, a coach could re-activate a
    // previously rejected vínculo (or reject an active one) out of band; the athlete must
    // re-initiate (accept resets to "pendiente") to restart the flow.
    if (v.estado !== "pendiente") {
      reply.code(409).send({ error: "vínculo is not pending" });
      return undefined;
    }
    const updated = await prisma.vinculo.update({ where: { id: v.id }, data: { estado } });
    return { id: updated.id, estado: updated.estado };
  }

  app.post<{ Params: { id: string } }>("/vinculos/:id/confirm", (req, reply) => setEstado(req, reply, "activo"));
  app.post<{ Params: { id: string } }>("/vinculos/:id/deny", (req, reply) => setEstado(req, reply, "rechazado"));
}
