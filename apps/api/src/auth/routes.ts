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
    expires,
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
    const { email, password, role, name } = parsed.data;

    if (await prisma.user.findUnique({ where: { email } })) {
      return reply.code(409).send({ error: "email already registered" });
    }
    const user = await prisma.user.create({
      data: { email, passwordHash: await hashPassword(password), role },
    });
    if (role === "coach") {
      await prisma.coach.create({ data: { userId: user.id, name: profileName(name, email) } });
    } else {
      const display = profileName(name, email);
      await prisma.athlete.create({
        data: { userId: user.id, nombre: display, iniciales: display.slice(0, 2).toUpperCase(), nivel: "beginner" },
      });
    }
    const { token, expiresAt } = await createSession(prisma, user.id);
    reply.setCookie(SESSION_COOKIE, token, cookieOpts(expiresAt));
    return reply.code(201).send({ id: user.id, email: user.email, role: user.role });
  });

  app.post("/auth/login", async (req, reply) => {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid input" });
    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
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
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return { ok: true };
  });

  app.get("/auth/me", async (req, reply) => {
    if (!req.userId) return reply.code(401).send({ error: "not authenticated" });
    return { id: req.userId, role: req.role, coachId: req.coachId ?? null, athleteId: req.athleteId ?? null };
  });
}
