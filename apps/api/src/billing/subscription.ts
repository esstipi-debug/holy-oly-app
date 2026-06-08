import type { Prisma, PrismaClient, Subscription, SubscriptionStatus } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

export function billingEnforced(): boolean {
  if (process.env.NODE_ENV === "test") return process.env.BILLING_ENFORCE === "true";
  return process.env.BILLING_ENFORCE !== "false";
}

export function emailVerifyEnforced(): boolean {
  if (process.env.NODE_ENV === "test") return process.env.EMAIL_VERIFY_ENFORCE === "true";
  return process.env.EMAIL_VERIFY_ENFORCE !== "false";
}

export function isSubscriptionActive(sub: Subscription | null): boolean {
  if (!sub || sub.status !== "active") return false;
  if (!sub.currentPeriodEnd) return true;
  return sub.currentPeriodEnd.getTime() > Date.now();
}

export async function getCoachSubscription(prisma: Db, coachId: string): Promise<Subscription | null> {
  return prisma.subscription.findUnique({ where: { coachId } });
}

export async function ensureCoachSubscription(prisma: Db, coachId: string, provider: string): Promise<Subscription> {
  return prisma.subscription.upsert({
    where: { coachId },
    create: { coachId, provider, status: "none" },
    update: {},
  });
}

export async function setSubscriptionStatus(
  prisma: Db,
  coachId: string,
  status: SubscriptionStatus,
  currentPeriodEnd: Date | null,
  meta?: { providerSubId?: string; planId?: string },
): Promise<Subscription> {
  return prisma.subscription.update({
    where: { coachId },
    data: {
      status,
      currentPeriodEnd,
      ...(meta?.providerSubId ? { providerSubId: meta.providerSubId } : {}),
      ...(meta?.planId ? { planId: meta.planId } : {}),
    },
  });
}
