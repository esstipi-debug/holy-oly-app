import type { FastifyReply, FastifyRequest } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { requireCoach } from "./guards";
import {
  billingEnforced,
  emailVerifyEnforced,
  getCoachSubscription,
  isSubscriptionActive,
} from "../billing/subscription";

/** Coach mutation gate (E4/E5): active subscription when enforced; optional email verification (B6b). */
export async function requireCoachWrite(
  prisma: PrismaClient,
  req: FastifyRequest,
  reply: FastifyReply,
  opts: { requireEmailVerified?: boolean } = {},
): Promise<string | undefined> {
  const coachId = requireCoach(req, reply);
  if (!coachId) return undefined;

  if (billingEnforced()) {
    const sub = await getCoachSubscription(prisma, coachId);
    if (!isSubscriptionActive(sub)) {
      reply.code(402).send({ error: "subscription required", code: "subscription_required" });
      return undefined;
    }
  }

  if (opts.requireEmailVerified && emailVerifyEnforced() && req.userId) {
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { emailVerified: true } });
    if (!user?.emailVerified) {
      reply.code(403).send({ error: "email verification required", code: "email_verification_required" });
      return undefined;
    }
  }

  return coachId;
}
