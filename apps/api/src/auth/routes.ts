import type { FastifyInstance } from "fastify";
import { prisma } from "../db/client";
import { hashPassword, verifyPassword } from "./password";
import { createSession, invalidateSessionToken } from "./session";
import { SignupSchema, LoginSchema } from "./schemas";

export const SESSION_COOKIE = "session";

function cookieOpts(expires?: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    // Omitted when absent so the same options can clear the cookie (clearCookie sets its own expiry).
    ...(expires ? { expires } : {}),
  };
}

function profileName(name: string | undefined, email: string): string {
  return name ?? email.split("@")[0] ?? "Usuario";
}

/** Auth endpoints: signup / login / logout / me. Sets a session cookie on signup+login. */
export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post("/auth/signup", async (req, reply) => {
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

  app.post("/auth/login", async (req, reply) => {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid input" });
    const email = parsed.data.email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });
    // Verify even on missing user is ideal to avoid enumeration; here we keep it simple + generic.
    if (!user || !(await verifyPassword(user.passwordHash, parsed.data.password))) {
      return reply.code(401).send({ error: "invalid credentials" });
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
}
