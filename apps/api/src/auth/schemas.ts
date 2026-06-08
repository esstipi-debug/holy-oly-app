import { z } from "zod";

// A small block-list of the most common passwords (B5). Not exhaustive — a defense-in-depth
// layer on top of the 12-char minimum + Argon2id. Extend or swap for zxcvbn if needed.
const COMMON_PASSWORDS = new Set([
  "123456789012", "password1234", "qwertyuiop12", "111111111111", "000000000000",
  "123123123123", "abcabcabcabc", "passwordword", "qwerty123456", "1q2w3e4r5t6y",
  "iloveyou1234", "admin1234567", "welcome12345", "letmein12345", "monkey123456",
  "dragon123456", "football1234", "baseball1234", "superman1234", "trustno12345",
]);

const passwordField = z
  .string()
  .min(12)
  .max(200)
  .refine((p) => !COMMON_PASSWORDS.has(p.toLowerCase()), "password is too common");

export const SignupSchema = z.object({
  email: z.string().email(),
  password: passwordField,
  role: z.enum(["coach", "atleta"]),
  name: z.string().min(1).max(120).optional(),
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
});

// Exact 12-char format (A6): rejects malformed input before the DB lookup, so a wrong-format
// guess returns 400 (not 404) — removing the 400-vs-404 oracle that confirms code shape.
export const AcceptCodeSchema = z.object({
  // Exact 12-char, matching the generator alphabet (no I/O/0/1) — consistent with genInviteCode.
  code: z.string().regex(/^[A-HJ-NP-Z2-9]{12}$/),
});
