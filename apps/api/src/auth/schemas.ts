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

export const AcceptCodeSchema = z.object({
  code: z.string().min(1).max(64),
});
