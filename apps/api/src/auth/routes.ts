import type { FastifyInstance } from "fastify";
import { prisma } from "../db/client";
import { hashPassword, verifyPassword, dummyHash } from "./password";
import { createSession, invalidateSessionToken, invalidateSessionsByUserId } from "./session";
import { SignupSchema, LoginSchema } from "./schemas";
import { LOGIN_RATE_LIMIT, SIGNUP_RATE_LIMIT } from "./rateLimits";
import { isAccountLocked, recordLoginFailure, clearLoginFailures } from "./lockout";

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

function profileName(name: string | undefined, email: string): string {
  return name ?? email.split("@")[0] ?? "Usuario";
}

/** Auth endpoints: signup / login / logout / me. Sets a session cookie on signup+login. */
export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post("/auth/signup", { config: { rateLimit: SIGNUP_RATE_LIMIT } }, async (req, reply) => {
    const parsed = SignupSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid input" });
    const { password, role, name } = parsed.data;
    const email = parsed.data.email.trim().toLowerCase();

    if (await prisma.user.findUnique({ where: { email } })) {
      return reply.code(409).send({ error: "email already registered" });
    }
    // Hash before opening the transaction so argon2's CPU work doesn't hold a DB tx open.
    const passwordHash = await hashPassword(password);
    // User + role profile are created atomically: a User without its Coach/Athlete row would
    // authenticate but resolve to no coachId/athleteId, silently 401-ing every scoped route.
    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({ data: { email, passwordHash, role } });
      if (role === "coach") {
        await tx.coach.create({ data: { userId: u.id, name: profileName(name, email) } });
      } else {
        const display = profileName(name, email);
        await tx.athlete.create({
          data: { userId: u.id, nombre: display, iniciales: display.slice(0, 2).toUpperCase(), nivel: "beginner" },
        });
      }
      return u;
    });
    const { token, expiresAt } = await createSession(prisma, user.id);
    reply.setCookie(SESSION_COOKIE, token, cookieOpts(expiresAt));
    return reply.code(201).send({ id: user.id, email: user.email, role: user.role });
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
    // Run Argon2 verify in BOTH branches (dummy hash when the email is unknown) so response time
    // doesn't reveal whether an account exists — anti-enumeration (B1). Body is already uniform.
    const passwordHash = user?.passwordHash ?? (await dummyHash());
    const ok = await verifyPassword(passwordHash, parsed.data.password);
    if (!user || !ok) {
      recordLoginFailure(email);
      return reply.code(401).send({ error: "invalid credentials" });
    }
    clearLoginFailures(email);
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
    return { ok: true };
  });

  app.get("/auth/me", async (req, reply) => {
    if (!req.userId) return reply.code(401).send({ error: "not authenticated" });
    return { id: req.userId, role: req.role, coachId: req.coachId ?? null, athleteId: req.athleteId ?? null };
  });

  // Revoke every session for the current user (B3): "log out everywhere". Clears this cookie too.
  app.post("/auth/sessions/revoke-all", async (req, reply) => {
    if (!req.userId) return reply.code(401).send({ error: "not authenticated" });
    await invalidateSessionsByUserId(prisma, req.userId);
    reply.clearCookie(SESSION_COOKIE, cookieOpts());
    return { ok: true };
  });
}
