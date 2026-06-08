import type { PrismaClient, UserRole } from "@prisma/client";

export interface AuditInput {
  /** Short stable label, e.g. "login.fail", "cycle.read", "plan.write". Never include PII here. */
  action: string;
  actorUserId?: string | null;
  actorRole?: UserRole | null;
  targetAthleteId?: string | null;
  ip?: string | null;
}

/**
 * Append a security/audit event (A9). Best-effort: NEVER throws — a failed audit write must not
 * break the request. Stores ids + action + ip only (no password/token/email/cycle-state).
 */
export async function recordAudit(prisma: PrismaClient, e: AuditInput): Promise<void> {
  try {
    await prisma.auditEvent.create({
      data: {
        action: e.action,
        actorUserId: e.actorUserId ?? null,
        actorRole: e.actorRole ?? null,
        targetAthleteId: e.targetAthleteId ?? null,
        ip: e.ip ?? null,
      },
    });
  } catch {
    // Swallow: the audit trail is best-effort and must not turn a 200 into a 500.
  }
}
