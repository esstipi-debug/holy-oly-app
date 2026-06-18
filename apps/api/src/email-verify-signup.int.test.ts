import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "./server";
import { prisma } from "./db/client";

// Verificación de email para TODOS los roles (2026-06-15): antes sólo el coach recibía el link y el
// atleta nacía auto-verificado (nunca le llegaba correo). Ahora coach y atleta nacen SIN verificar,
// reciben el link al alta y pueden reenviarlo desde el banner. El envío real depende de EMAIL_PROVIDER
// (en test = "console", no-op), pero el TOKEN sí se crea — eso es lo que estos tests fijan.
describe("API integration — verificación de email por rol", () => {
  let app: FastifyInstance;
  beforeAll(async () => { app = buildServer(); await app.ready(); });
  afterAll(async () => { await app.close(); await prisma.$disconnect(); });

  const userByEmail = (email: string) => prisma.user.findUnique({ where: { email } });
  const tokenCountFor = (userId: string) => prisma.emailVerificationToken.count({ where: { userId } });
  const sessionCookie = (res: { cookies: Array<{ name: string; value: string }> }) => {
    const c = res.cookies.find((x) => x.name === "session");
    if (!c) throw new Error("no session cookie");
    return `session=${c.value}`;
  };

  it("atleta: alta sin verificar (emailVerified=false) + token de verificación creado", async () => {
    const email = `ev-atleta-${Date.now()}@x.dev`;
    const res = await app.inject({ method: "POST", url: "/auth/signup",
      payload: { email, password: "lawful-pass-9", role: "atleta", acceptTerms: true, sexo: "M" } });
    expect(res.statusCode).toBe(201);
    expect(res.json().emailVerified).toBe(false);
    const u = await userByEmail(email);
    expect(u!.emailVerified).toBe(false);
    expect(await tokenCountFor(u!.id)).toBe(1);
  });

  it("coach: alta sin verificar + token de verificación creado", async () => {
    const email = `ev-coach-${Date.now()}@x.dev`;
    const res = await app.inject({ method: "POST", url: "/auth/signup",
      payload: { email, password: "lawful-pass-9", role: "coach", acceptTerms: true } });
    expect(res.statusCode).toBe(201);
    expect(res.json().emailVerified).toBe(false);
    const u = await userByEmail(email);
    expect(await tokenCountFor(u!.id)).toBe(1);
  });

  it("reenvío: el atleta (no sólo el coach) puede reenviar el link → crea un token nuevo", async () => {
    const email = `ev-resend-${Date.now()}@x.dev`;
    const signup = await app.inject({ method: "POST", url: "/auth/signup",
      payload: { email, password: "lawful-pass-9", role: "atleta", acceptTerms: true, sexo: "M" } });
    expect(signup.statusCode).toBe(201);
    const u = await userByEmail(email);
    expect(await tokenCountFor(u!.id)).toBe(1);

    const resend = await app.inject({ method: "POST", url: "/auth/email/resend",
      headers: { cookie: sessionCookie(signup) }, payload: {} });
    expect(resend.statusCode).toBe(200);
    expect(await tokenCountFor(u!.id)).toBe(2);
  });

  it("reenvío anónimo (sin sesión) → 401", async () => {
    const res = await app.inject({ method: "POST", url: "/auth/email/resend", payload: {} });
    expect(res.statusCode).toBe(401);
  });
});
