import { z } from "zod";

// A small block-list of the most common passwords (B5). Not exhaustive — a defense-in-depth
// layer on top of the 8-char minimum + Argon2id. Extend or swap for zxcvbn if needed.
// Includes common short (8–11 char) passwords so the block stays meaningful at the 8-char floor.
const COMMON_PASSWORDS = new Set([
  "123456789012", "password1234", "qwertyuiop12", "111111111111", "000000000000",
  "123123123123", "abcabcabcabc", "passwordword", "qwerty123456", "1q2w3e4r5t6y",
  "iloveyou1234", "admin1234567", "welcome12345", "letmein12345", "monkey123456",
  "dragon123456", "football1234", "baseball1234", "superman1234", "trustno12345",
  "password", "12345678", "123456789", "1234567890", "qwerty123", "password1",
  "11111111", "00000000", "abc12345", "iloveyou", "welcome1", "admin123",
  "letmein123", "football", "baseball", "sunshine", "princess", "qwertyui",
  "1q2w3e4r", "zaq12wsx",
]);

const passwordField = z
  .string()
  .min(8)
  .max(200)
  .refine((p) => !COMMON_PASSWORDS.has(p.toLowerCase()), "password is too common");

// Onboarding del atleta (2026-06-14): sexo gatea el ciclo (female-only) y la barra (15/20 kg);
// el peso corporal es opcional. El sexo es obligatorio para atletas (lo exige la ruta).
const SexoSchema = z.enum(["M", "F"]);
const WeightKgSchema = z.number().min(20).max(300);

export const SignupSchema = z.object({
  email: z.string().email(),
  password: passwordField,
  role: z.enum(["coach", "atleta"]),
  name: z.string().min(1).max(120).optional(),
  // PR-L1: the user must explicitly accept Terms + Privacy. The route enforces `=== true`; the
  // accepted VERSION is stamped server-side (core constants), never read from the client.
  acceptTerms: z.boolean().optional(),
  // Onboarding del atleta: sexo (obligatorio para atleta, lo valida la ruta) + peso corporal opcional.
  sexo: SexoSchema.optional(),
  weightKg: WeightKgSchema.optional(),
  // E1 honeypot — bots fill hidden fields; humans leave empty.
  website: z.string().max(200).optional(),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  password: passwordField,
});

export const VerifyEmailSchema = z.object({
  token: z.string().min(20).max(200),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});

export const GoogleCompleteSchema = z.object({
  role: z.enum(["coach", "atleta"]),
  name: z.string().min(1).max(120).optional(),
  // PR-L1: OAuth signup must also accept Terms + Privacy (informed-consent parity with password).
  acceptTerms: z.boolean().optional(),
  // Mismo onboarding del atleta que el signup con contraseña.
  sexo: SexoSchema.optional(),
  weightKg: WeightKgSchema.optional(),
});

// Exact 12-char format (A6): rejects malformed input before the DB lookup, so a wrong-format
// guess returns 400 (not 404) — removing the 400-vs-404 oracle that confirms code shape.
export const AcceptCodeSchema = z.object({
  // Exact 12-char, matching the generator alphabet (no I/O/0/1) — consistent with genInviteCode.
  code: z.string().regex(/^[A-HJ-NP-Z2-9]{12}$/),
});
