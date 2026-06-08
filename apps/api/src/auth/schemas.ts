import { z } from "zod";

export const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  role: z.enum(["coach", "atleta"]),
  name: z.string().min(1).max(120).optional(),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});

// Exact 12-char format (A6): rejects malformed input before the DB lookup, so a wrong-format
// guess returns 400 (not 404) — removing the 400-vs-404 oracle that confirms code shape.
export const AcceptCodeSchema = z.object({
  code: z.string().regex(/^[A-Z2-9]{12}$/),
});
