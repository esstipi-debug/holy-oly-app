import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "./server";
import { prisma } from "./db/client";

// Onboarding del atleta (2026-06-14): el signup acepta `sexo` + `weightKg` y los persiste. La API es
// TOLERANTE (sin sexo → default "M", para no romper integraciones/seed); el FORM es el que EXIGE el
// sexo (validación en el cliente). El sexo gatea el ciclo (female-only) y la barra (15/20 kg).
describe("API integration — onboarding del atleta (sexo + peso)", () => {
  let app: FastifyInstance;
  beforeAll(async () => { app = buildServer(); await app.ready(); });
  afterAll(async () => { await app.close(); await prisma.$disconnect(); });

  const athleteByEmail = async (email: string) => {
    const u = await prisma.user.findUnique({ where: { email } });
    return u ? prisma.athlete.findFirst({ where: { userId: u.id } }) : null;
  };

  it("atleta con sexo F + peso → 201 y persiste sexo='F' y weightKg", async () => {
    const email = `onb-f-${Date.now()}@x.dev`;
    const res = await app.inject({ method: "POST", url: "/auth/signup",
      payload: { email, password: "lawful-pass-9", role: "atleta", acceptTerms: true, sexo: "F", weightKg: 63.5 } });
    expect(res.statusCode).toBe(201);
    const a = await athleteByEmail(email);
    expect(a!.sexo).toBe("F");
    expect(a!.weightKg).toBe(63.5);
  });

  it("atleta sin sexo → 201 con default 'M' (API tolerante; el form exige sexo)", async () => {
    const email = `onb-default-${Date.now()}@x.dev`;
    const res = await app.inject({ method: "POST", url: "/auth/signup",
      payload: { email, password: "lawful-pass-9", role: "atleta", acceptTerms: true } });
    expect(res.statusCode).toBe(201);
    const a = await athleteByEmail(email);
    expect(a!.sexo).toBe("M");
    expect(a!.weightKg).toBeNull();
  });

  it("peso fuera de rango (10 kg) → 400 (validación de schema)", async () => {
    const email = `onb-badw-${Date.now()}@x.dev`;
    const res = await app.inject({ method: "POST", url: "/auth/signup",
      payload: { email, password: "lawful-pass-9", role: "atleta", acceptTerms: true, sexo: "M", weightKg: 10 } });
    expect(res.statusCode).toBe(400);
  });
});
