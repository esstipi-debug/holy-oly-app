import { AuthUserSchema } from "@holy-oly/core";

export type Role = "coach" | "atleta";

export interface AuthUser {
  id: string;
  role: Role;
  coachId: string | null;
  athleteId: string | null;
  email?: string | null;
  emailVerified?: boolean;
}

const BASE = import.meta.env.VITE_API_URL ?? "";

async function throwIfNotOk(res: Response): Promise<void> {
  if (res.ok) return;
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  throw new Error(body?.error ?? `request failed (${res.status})`);
}

/** Current user, or null when unauthenticated (401). */
export async function me(): Promise<AuthUser | null> {
  const res = await fetch(`${BASE}/auth/me`, { credentials: "include" });
  if (!res.ok) return null;
  return AuthUserSchema.parse(await res.json());
}

async function authPost(path: string, body: unknown): Promise<void> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  await throwIfNotOk(res);
}

export function login(email: string, password: string): Promise<void> {
  return authPost("/auth/login", { email, password });
}

export function signup(email: string, password: string, role: Role, name?: string, website?: string, acceptTerms?: boolean, sexo?: "M" | "F", weightKg?: number): Promise<void> {
  return authPost("/auth/signup", { email, password, role, name, website: website ?? "", acceptTerms: acceptTerms === true, sexo, weightKg });
}

export function logout(): Promise<void> {
  return authPost("/auth/logout", {});
}

export function forgotPassword(email: string): Promise<void> {
  return authPost("/auth/password/forgot", { email });
}

export function resetPassword(token: string, password: string): Promise<void> {
  return authPost("/auth/password/reset", { token, password });
}

export function verifyEmail(token: string): Promise<void> {
  return authPost("/auth/email/verify", { token });
}

export function resendVerificationEmail(): Promise<void> {
  return authPost("/auth/email/resend", {});
}

export async function googleAuthEnabled(): Promise<boolean> {
  const res = await fetch(`${BASE}/auth/google/config`, { credentials: "include" });
  if (!res.ok) return false;
  const body = (await res.json()) as { enabled?: boolean };
  return body.enabled === true;
}

export function googleAuthStart(params: { intent: "login" | "signup"; role?: Role; name?: string; accept?: boolean; sexo?: "M" | "F"; weightKg?: number }): void {
  const q = new URLSearchParams({ intent: params.intent });
  if (params.role) q.set("role", params.role);
  if (params.name?.trim()) q.set("name", params.name.trim());
  // PR-L1: signup carries explicit legal acceptance into the signed OAuth context (server-enforced).
  if (params.accept) q.set("accept", "1");
  // Onboarding del atleta: sexo/peso viajan al contexto firmado para el auto-provision del callback.
  if (params.sexo) q.set("sexo", params.sexo);
  if (params.weightKg != null) q.set("weightKg", String(params.weightKg));
  window.location.href = `${BASE}/auth/google/start?${q}`;
}

export function completeGoogleSignup(role: Role, name?: string, acceptTerms?: boolean, sexo?: "M" | "F", weightKg?: number): Promise<void> {
  return authPost("/auth/google/complete", { role, name, acceptTerms: acceptTerms === true, sexo, weightKg });
}
