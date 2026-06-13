import type { FastifyInstance } from "fastify";
import { prisma } from "../db/client";
import { hashPassword, verifyPassword, dummyHash } from "./password";
import { createSession, invalidateSessionToken, invalidateSessionsByUserId } from "./session";
import { SignupSchema, LoginSchema, ForgotPasswordSchema, ResetPasswordSchema, VerifyEmailSchema } from "./schemas";
import {
  LOGIN_RATE_LIMIT,
  SIGNUP_RATE_LIMIT,
  FORGOT_PASSWORD_RATE_LIMIT,
  RESET_PASSWORD_RATE_LIMIT,
} from "./rateLimits";
import { isAccountLocked, recordLoginFailure, clearLoginFailures } from "./lockout";
import { recordAudit } from "../audit";
import { generateOneTimeToken, tokenIdFromRaw } from "./one-time-token";
import { sendCoachVerificationEmail, provisionUserRecords } from "./provision-user";
import { sendEmail, appOrigin } from "../email";

export const SESSION_COOKIE = "session";

export function cookieOpts(expires?: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    // Set both expires (absolute) and maxAge (relative seconds — preferred by modern browsers and
    // robust to client clock skew). Omitted when clearing (clearCookie sets its own expiry) (B4).
    ...(expires ? { expires, maxAge: Math.max(0, Math.floor((expires.getTime() - Date.now()) / 1000)) } : {}),
  };
}

/** Auth endpoints: signup / login / logout / me. Sets a session cookie on signup+login. */
export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post("/auth/signup", { config: { rateLimit: SIGNUP_RATE_LIMIT } }, async (req, reply) => {
    const parsed = SignupSchema.safeParse(req.body);
    if (!parsed.success) {
      // Password failures get a specific code so the client can show an actionable, localized
      // message (too short / too common) instead of a generic "invalid input".
      const weakPassword = parsed.error.issues.some((i) => i.path[0] === "password");
      return reply.code(400).send({ error: weakPassword ? "weak password" : "invalid input" });
    }
    const { password, role, name } = parsed.data;
    const email = parsed.data.email.trim().toLowerCase();
    if (parsed.data.website?.trim()) {
      return reply.code(400).send({ error: "invalid input" });
    }
    // PR-L1: no account without explicit legal acceptance (the version is stamped server-side).
    if (parsed.data.acceptTerms !== true) {
      return reply.code(400).send({ error: "must accept terms" });
    }

    if (await prisma.user.findUnique({ where: { email } })) {
      return reply.code(409).send({ error: "email already registered" });
    }
    const passwordHash = await hashPassword(password);
    const emailVerified = role !== "coach";
    const user = await prisma.$transaction(async (tx) =>
      provisionUserRecords(tx, { email, role, name, emailVerified, passwordHash }),
    );
    if (role === "coach") {
      await sendCoachVerificationEmail(prisma, user.id, email);
    }
    const { token, expiresAt } = await createSession(prisma, user.id);
    reply.setCookie(SESSION_COOKIE, token, cookieOpts(expiresAt));
    await recordAudit(prisma, { action: "signup", actorUserId: user.id, actorRole: role, ip: req.ip });
    return reply.code(201).send({ id: user.id, email: user.email, role: user.role, emailVerified: user.emailVerified });
  });

  app.post("/auth/login", { config: { rateLimit: LOGIN_RATE_LIMIT } }, async (req, reply) => {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid input" });
    const email = parsed.data.email.trim().toLowerCase();
    // Per-account lockout (A1b): IP-independent, complements the per-IP rate limit above.
    if (isAccountLocked(email)) {
      return reply.code(429).send({ error: "too many attempts, try again later" });
    }
    const user = await prisma.user.findUnique({ where: { email } });
    // Run Argon2 verify in BOTH branches (dummy hash when the email is unknown or OAuth-only) so
    // response time doesn't reveal whether an account exists — anti-enumeration (B1).
    const passwordHash = user?.passwordHash ?? (await dummyHash());
    const ok = user?.passwordHash ? await verifyPassword(passwordHash, parsed.data.password) : false;
    if (!user || !ok) {
      recordLoginFailure(email);
      await recordAudit(prisma, { action: "login.fail", actorUserId: user?.id ?? null, ip: req.ip });
      return reply.code(401).send({ error: "invalid credentials" });
    }
    clearLoginFailures(email);
    await recordAudit(prisma, { action: "login.success", actorUserId: user.id, actorRole: user.role, ip: req.ip });
    // Optional single-session policy (B3): a new login revokes the user's other sessions.
    if (process.env.SINGLE_SESSION_LOGIN === "true") {
      await invalidateSessionsByUserId(prisma, user.id);
    }
    const { token, expiresAt } = await createSession(prisma, user.id);
    reply.setCookie(SESSION_COOKIE, token, cookieOpts(expiresAt));
    return { id: user.id, email: user.email, role: user.role };
  });

  app.post("/auth/logout", async (req, reply) => {
    const token = req.cookies?.[SESSION_COOKIE];
    if (token) await invalidateSessionToken(prisma, token);
    reply.clearCookie(SESSION_COOKIE, cookieOpts());
    await recordAudit(prisma, { action: "logout", actorUserId: req.userId ?? null, actorRole: req.role ?? null, ip: req.ip });
    return { ok: true };
  });

  app.get("/auth/me", async (req, reply) => {
    if (!req.userId) return reply.code(401).send({ error: "not authenticated" });
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { emailVerified: true, email: true },
    });
    return {
      id: req.userId,
      role: req.role,
      coachId: req.coachId ?? null,
      athleteId: req.athleteId ?? null,
      email: user?.email ?? null,
      emailVerified: user?.emailVerified ?? false,
    };
  });

  app.post("/auth/password/forgot", { config: { rateLimit: FORGOT_PASSWORD_RATE_LIMIT } }, async (req, reply) => {
    const parsed = ForgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid input" });
    const email = parsed.data.email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const raw = generateOneTimeToken();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      await prisma.passwordResetToken.create({ data: { id: tokenIdFromRaw(raw), userId: user.id, expiresAt } });
      const resetUrl = `${appOrigin()}/login/reset?token=${encodeURIComponent(raw)}`;
      await sendEmail(email, "password_reset", { resetUrl });
      await recordAudit(prisma, { action: "password.forgot", actorUserId: user.id, actorRole: user.role, ip: req.ip });
    }
    return { ok: true };
  });

  app.post("/auth/password/reset", { config: { rateLimit: RESET_PASSWORD_RATE_LIMIT } }, async (req, reply) => {
    const parsed = ResetPasswordSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid input" });
    const tokenId = tokenIdFromRaw(parsed.data.token);
    const row = await prisma.passwordResetToken.findUnique({ where: { id: tokenId } });
    if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) {
      return reply.code(400).send({ error: "invalid or expired token" });
    }
    const passwordHash = await hashPassword(parsed.data.password);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: row.userId }, data: { passwordHash } });
      await tx.passwordResetToken.update({ where: { id: tokenId }, data: { usedAt: new Date() } });
    });
    await invalidateSessionsByUserId(prisma, row.userId);
    await recordAudit(prisma, { action: "password.reset", actorUserId: row.userId, ip: req.ip });
    return { ok: true };
  });

  app.post("/auth/email/verify", async (req, reply) => {
    const parsed = VerifyEmailSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid input" });
    const tokenId = tokenIdFromRaw(parsed.data.token);
    const row = await prisma.emailVerificationToken.findUnique({ where: { id: tokenId } });
    if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) {
      return reply.code(400).send({ error: "invalid or expired token" });
    }
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: row.userId }, data: { emailVerified: true } });
      await tx.emailVerificationToken.update({ where: { id: tokenId }, data: { usedAt: new Date() } });
    });
    await recordAudit(prisma, { action: "email.verify", actorUserId: row.userId, ip: req.ip });
    return { ok: true };
  });

  app.post("/auth/email/resend", async (req, reply) => {
    if (!req.userId || req.role !== "coach") return reply.code(401).send({ error: "coach session required" });
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user || user.emailVerified) return { ok: true };
    const raw = generateOneTimeToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await prisma.emailVerificationToken.create({ data: { id: tokenIdFromRaw(raw), userId: user.id, expiresAt } });
    const verifyUrl = `${appOrigin()}/login/verify?token=${encodeURIComponent(raw)}`;
    await sendEmail(user.email, "email_verify", { verifyUrl });
    return { ok: true };
  });

  // Revoke every session for the current user (B3): "log out everywhere". Clears this cookie too.
  app.post("/auth/sessions/revoke-all", async (req, reply) => {
    if (!req.userId) return reply.code(401).send({ error: "not authenticated" });
    await invalidateSessionsByUserId(prisma, req.userId);
    reply.clearCookie(SESSION_COOKIE, cookieOpts());
    await recordAudit(prisma, { action: "sessions.revoke_all", actorUserId: req.userId, actorRole: req.role ?? null, ip: req.ip });
    return { ok: true };
  });
}
