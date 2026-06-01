import { AuthUserSchema } from "@holy-oly/core";

export type Role = "coach" | "atleta";

export interface AuthUser {
  id: string;
  role: Role;
  coachId: string | null;
  athleteId: string | null;
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

export function signup(email: string, password: string, role: Role, name?: string): Promise<void> {
  return authPost("/auth/signup", { email, password, role, name });
}

export function logout(): Promise<void> {
  return authPost("/auth/logout", {});
}
