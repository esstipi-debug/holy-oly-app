import type { Prisma, PrismaClient, SubscriptionStatus } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;
import { ensureCoachSubscription, setSubscriptionStatus } from "./subscription";

export interface MockWebhookEvent {
  id: string;
  type: string;
  created: number;
  data: {
    coachId: string;
    status: SubscriptionStatus;
    currentPeriodEnd?: string;
  };
}

const REPLAY_WINDOW_SEC = 5 * 60;

export function verifyMockWebhookSecret(header: string | undefined): boolean {
  const secret = process.env.BILLING_WEBHOOK_SECRET ?? "dev-mock-webhook-secret";
  return header === secret;
}

export function isReplaySafe(createdUnix: number): boolean {
  const now = Math.floor(Date.now() / 1000);
  return Math.abs(now - createdUnix) <= REPLAY_WINDOW_SEC;
}

export async function applyMockWebhook(prisma: Db, evt: MockWebhookEvent): Promise<void> {
  await ensureCoachSubscription(prisma, evt.data.coachId, "mock");
  const end = evt.data.currentPeriodEnd ? new Date(evt.data.currentPeriodEnd) : new Date(Date.now() + 30 * 86400_000);
  await setSubscriptionStatus(prisma, evt.data.coachId, evt.data.status, end);
}

export function mockCheckoutUrl(coachId: string, origin: string): string {
  return `${origin}/coach/suscripcion?mockCheckout=1&coachId=${encodeURIComponent(coachId)}`;
}
