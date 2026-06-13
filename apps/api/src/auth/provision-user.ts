import type { Prisma, PrismaClient, User, UserRole } from "@prisma/client";
import { LEGAL_TERMS_VERSION, LEGAL_PRIVACY_VERSION } from "@holy-oly/core";
import { sendEmail, appOrigin } from "../email";
import { generateOneTimeToken, tokenIdFromRaw } from "./one-time-token";

export function profileName(name: string | undefined, email: string): string {
  return name ?? email.split("@")[0] ?? "Usuario";
}

type Tx = Prisma.TransactionClient;

export async function provisionUserRecords(
  tx: Tx,
  opts: {
    email: string;
    role: UserRole;
    name?: string;
    emailVerified: boolean;
    passwordHash?: string | null;
  },
): Promise<User> {
  const email = opts.email.trim().toLowerCase();
  // PR-L1: every new account records its legal acceptance (timestamp + server-stamped version).
  // Provisioning IS the acceptance moment — password signup, Google callback and Google complete
  // all flow through here, so the trail is universal. Enforcement (reject if not accepted) lives
  // in the routes; here we only record the truth for accounts that reached this point.
  const acceptedAt = new Date();
  const u = await tx.user.create({
    data: {
      email,
      passwordHash: opts.passwordHash ?? null,
      role: opts.role,
      emailVerified: opts.emailVerified,
      termsAcceptedAt: acceptedAt,
      termsVersion: LEGAL_TERMS_VERSION,
      privacyAcceptedAt: acceptedAt,
      privacyVersion: LEGAL_PRIVACY_VERSION,
    },
  });
  if (opts.role === "coach") {
    const coach = await tx.coach.create({
      data: { userId: u.id, name: profileName(opts.name, email) },
    });
    await tx.subscription.create({
      data: { coachId: coach.id, provider: process.env.BILLING_PROVIDER ?? "mock", status: "none" },
    });
  } else {
    const display = profileName(opts.name, email);
    await tx.athlete.create({
      data: {
        userId: u.id,
        nombre: display,
        iniciales: display.slice(0, 2).toUpperCase(),
        nivel: "beginner",
      },
    });
  }
  return u;
}

/** Coach email verification email when signup did not auto-verify (password signup). */
export async function sendCoachVerificationEmail(prisma: PrismaClient, userId: string, email: string): Promise<void> {
  const raw = generateOneTimeToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await prisma.emailVerificationToken.create({
    data: { id: tokenIdFromRaw(raw), userId, expiresAt },
  });
  const verifyUrl = `${appOrigin()}/login/verify?token=${encodeURIComponent(raw)}`;
  await sendEmail(email, "email_verify", { verifyUrl });
}
