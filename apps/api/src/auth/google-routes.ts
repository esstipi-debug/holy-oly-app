import type { FastifyInstance, FastifyReply } from "fastify";
import { randomBytes } from "node:crypto";
import type { UserRole } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "../db/client";
import { recordAudit } from "../audit";
import { createSession } from "./session";
import { SESSION_COOKIE, cookieOpts } from "./routes";
import { signCookiePayload, verifyCookiePayload } from "./signed-cookie";
import { provisionUserRecords, sendVerificationEmail } from "./provision-user";
import { GoogleCompleteSchema } from "./schemas";
import {
  GOOGLE_PROVIDER,
  OAUTH_CTX_COOKIE,
  OAUTH_PENDING_COOKIE,
  OAUTH_COOKIE_MAX_AGE_SEC,
  buildGoogleAuthUrl,
  exchangeGoogleCode,
  verifyGoogleIdToken,
  googleConfigured,
  oauthStateSecret,
  oauthCookieOpts,
  webRedirect,
} from "./google";

interface OAuthCtxPayload {
  nonce: string;
  intent: "login" | "signup";
  role?: UserRole;
  name?: string;
  // PR-L1: legal acceptance is carried in the SIGNED context (not trusted from the callback query),
  // so the auto-provision branch can verify it server-side — not just rely on the frontend gate.
  acceptTerms?: boolean;
  // Onboarding del atleta (2026-06-14): sexo/peso viajan en el contexto firmado para el auto-provision.
  sexo?: "M" | "F";
  weightKg?: number;
  exp: number;
}

interface OAuthPendingPayload {
  email: string;
  sub: string;
  name?: string;
  emailVerified: boolean;
  exp: number;
}

function ctxExpiry(): number {
  return Date.now() + OAUTH_COOKIE_MAX_AGE_SEC * 1000;
}

async function issueSession(reply: FastifyReply, userId: string): Promise<void> {
  const { token, expiresAt } = await createSession(prisma, userId);
  reply.setCookie(SESSION_COOKIE, token, cookieOpts(expiresAt));
}

export async function googleAuthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/auth/google/config", async () => ({ enabled: googleConfigured() }));

  app.get("/auth/google/start", async (req, reply) => {
    if (!googleConfigured()) return reply.code(503).send({ error: "google login not configured" });

    const q = req.query as { intent?: string; role?: string; name?: string; accept?: string; sexo?: string; weightKg?: string };
    const intent = q.intent === "signup" ? "signup" : "login";
    let role: UserRole | undefined;
    if (q.role === "coach" || q.role === "atleta") role = q.role;
    const name = typeof q.name === "string" && q.name.trim() ? q.name.trim().slice(0, 120) : undefined;
    const acceptTerms = q.accept === "1" || q.accept === "true";
    // Onboarding del atleta (2026-06-14): sexo/peso del form van al contexto firmado (para el auto-provision).
    const sexo = q.sexo === "M" || q.sexo === "F" ? q.sexo : undefined;
    const weightNum = typeof q.weightKg === "string" ? Number(q.weightKg) : NaN;
    const weightKg = Number.isFinite(weightNum) && weightNum >= 20 && weightNum <= 300 ? weightNum : undefined;

    if (intent === "signup" && !role) {
      return reply.code(400).send({ error: "role required for signup" });
    }
    // PR-L1: a signup must carry explicit legal acceptance — even via OAuth (parity with password).
    if (intent === "signup" && !acceptTerms) {
      return reply.code(400).send({ error: "must accept terms" });
    }

    const nonce = randomBytes(24).toString("hex");
    const ctx: OAuthCtxPayload = { nonce, intent, role, name, acceptTerms, sexo, weightKg, exp: ctxExpiry() };
    const signed = signCookiePayload(ctx, oauthStateSecret());
    reply.setCookie(OAUTH_CTX_COOKIE, signed, oauthCookieOpts(OAUTH_COOKIE_MAX_AGE_SEC));

    const url = buildGoogleAuthUrl(nonce);
    return reply.redirect(url);
  });

  app.get("/auth/google/callback", async (req, reply) => {
    if (!googleConfigured()) return reply.redirect(webRedirect("/login?error=google"));

    const q = req.query as { code?: string; state?: string; error?: string };
    reply.clearCookie(OAUTH_CTX_COOKIE, oauthCookieOpts(0));

    if (q.error || !q.code || !q.state) {
      return reply.redirect(webRedirect("/login?error=google"));
    }

    const rawCtx = req.cookies?.[OAUTH_CTX_COOKIE];
    const ctx = rawCtx ? verifyCookiePayload<OAuthCtxPayload>(rawCtx, oauthStateSecret()) : null;
    if (!ctx || ctx.nonce !== q.state) {
      return reply.redirect(webRedirect("/login?error=google"));
    }

    let profile;
    try {
      const { idToken } = await exchangeGoogleCode(q.code);
      profile = await verifyGoogleIdToken(idToken);
    } catch {
      return reply.redirect(webRedirect("/login?error=google"));
    }

    const linked = await prisma.oAuthAccount.findUnique({
      where: { provider_providerUserId: { provider: GOOGLE_PROVIDER, providerUserId: profile.sub } },
      include: { user: true },
    });
    if (linked) {
      await issueSession(reply, linked.userId);
      await recordAudit(prisma, {
        action: "login.success",
        actorUserId: linked.userId,
        actorRole: linked.user.role,
        ip: req.ip,
      });
      return reply.redirect(webRedirect("/"));
    }

    const existingByEmail = await prisma.user.findUnique({ where: { email: profile.email } });
    if (existingByEmail) {
      await prisma.oAuthAccount.create({
        data: { provider: GOOGLE_PROVIDER, providerUserId: profile.sub, userId: existingByEmail.id },
      });
      if (profile.emailVerified && !existingByEmail.emailVerified) {
        await prisma.user.update({ where: { id: existingByEmail.id }, data: { emailVerified: true } });
      }
      await issueSession(reply, existingByEmail.id);
      await recordAudit(prisma, {
        action: "login.success",
        actorUserId: existingByEmail.id,
        actorRole: existingByEmail.role,
        ip: req.ip,
      });
      return reply.redirect(webRedirect("/"));
    }

    // Auto-provision only when the SIGNED context proves legal acceptance (PR-L1). Without it we
    // fall through to the pending → /login/google-complete flow, where the checkbox is enforced.
    const role = ctx.intent === "signup" && ctx.acceptTerms === true ? ctx.role : undefined;
    if (role) {
      // Google ya verificó el email para todo rol: si su flag es true, queda verificado; si no, se envía link.
      const emailVerified = profile.emailVerified;
      let user;
      try {
        user = await prisma.$transaction(async (tx) => {
          const u = await provisionUserRecords(tx, {
            email: profile.email,
            role,
            name: ctx.name ?? profile.name,
            emailVerified,
            passwordHash: null,
            sexo: ctx.sexo,
            weightKg: ctx.weightKg,
          });
          await tx.oAuthAccount.create({
            data: { provider: GOOGLE_PROVIDER, providerUserId: profile.sub, userId: u.id },
          });
          return u;
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          return reply.redirect(webRedirect("/login?error=google"));
        }
        throw err;
      }
      if (!emailVerified) {
        await sendVerificationEmail(prisma, user.id, user.email);
      }
      await issueSession(reply, user.id);
      await recordAudit(prisma, { action: "signup", actorUserId: user.id, actorRole: role, ip: req.ip });
      return reply.redirect(webRedirect("/"));
    }

    const pending: OAuthPendingPayload = {
      email: profile.email,
      sub: profile.sub,
      name: profile.name,
      emailVerified: profile.emailVerified,
      exp: ctxExpiry(),
    };
    reply.setCookie(OAUTH_PENDING_COOKIE, signCookiePayload(pending, oauthStateSecret()), oauthCookieOpts(OAUTH_COOKIE_MAX_AGE_SEC));
    return reply.redirect(webRedirect("/login/google-complete"));
  });

  app.post("/auth/google/complete", async (req, reply) => {
    if (!googleConfigured()) return reply.code(503).send({ error: "google login not configured" });

    const parsed = GoogleCompleteSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid input" });
    // PR-L1: OAuth signup must explicitly accept Terms + Privacy, same as password signup.
    if (parsed.data.acceptTerms !== true) {
      return reply.code(400).send({ error: "must accept terms" });
    }

    const rawPending = req.cookies?.[OAUTH_PENDING_COOKIE];
    const pending = rawPending ? verifyCookiePayload<OAuthPendingPayload>(rawPending, oauthStateSecret()) : null;
    if (!pending) return reply.code(400).send({ error: "session expired, try google again" });

    reply.clearCookie(OAUTH_PENDING_COOKIE, oauthCookieOpts(0));

    const existing = await prisma.user.findUnique({ where: { email: pending.email } });
    if (existing) {
      return reply.code(409).send({ error: "email already registered" });
    }

    const { role, name, sexo, weightKg } = parsed.data;
    // Onboarding del atleta: el FORM (GoogleCompleteScreen) exige sexo; la API es tolerante (default "M").
    const emailVerified = pending.emailVerified;
    let user;
    try {
      user = await prisma.$transaction(async (tx) => {
        const u = await provisionUserRecords(tx, {
          email: pending.email,
          role,
          name: name ?? pending.name,
          emailVerified,
          passwordHash: null,
          sexo,
          weightKg,
        });
        await tx.oAuthAccount.create({
          data: { provider: GOOGLE_PROVIDER, providerUserId: pending.sub, userId: u.id },
        });
        return u;
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return reply.code(409).send({ error: "email already registered" });
      }
      throw err;
    }

    if (!emailVerified) {
      await sendVerificationEmail(prisma, user.id, user.email);
    }
    await issueSession(reply, user.id);
    await recordAudit(prisma, { action: "signup", actorUserId: user.id, actorRole: role, ip: req.ip });
    return reply.code(201).send({ id: user.id, email: user.email, role: user.role, emailVerified: user.emailVerified });
  });
}
