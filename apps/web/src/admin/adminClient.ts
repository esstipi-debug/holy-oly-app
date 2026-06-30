/** Cliente del panel del dueño. El acceso lo decide el server (ADMIN_EMAILS); acá solo pedimos. */

export interface AdminAthlete {
  id: string;
  nombre: string;
  nivel: string;
  compite: boolean;
  email: string | null;
  country: string | null;
  emailVerified: boolean | null;
}

export interface AdminCoachGroup {
  id: string;
  name: string;
  email: string | null;
  country: string | null;
  athleteCount: number;
  athletes: AdminAthlete[];
}

export interface AdminUser {
  id: string;
  email: string;
  role: "coach" | "atleta";
  country: string | null;
  emailVerified: boolean;
  createdAt: string;
}

export interface AdminOverview {
  users: AdminUser[];
  coaches: AdminCoachGroup[];
  unlinkedAthletes: AdminAthlete[];
  totals: { users: number; coaches: number; athletes: number; linkedAthletes: number };
}

const BASE = import.meta.env.VITE_API_URL ?? "";

export async function getAdminOverview(): Promise<AdminOverview> {
  const res = await fetch(`${BASE}/admin/overview`, { credentials: "include" });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `request failed (${res.status})`);
  }
  return (await res.json()) as AdminOverview;
}
