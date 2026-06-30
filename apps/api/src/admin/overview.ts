import type { PrismaClient } from "@prisma/client";

/**
 * Vista del panel del dueño: usuarios registrados (con país) + atletas agrupados por coach + atletas
 * sin coach. El armado es una función PURA (`buildAdminOverview`) testeable con fixtures; la query a
 * Prisma solo trae filas y se la pasa. Todo dato derivado (totales, agrupación) se calcula al leer.
 */

export type AdminRole = "coach" | "atleta";

interface UserAccount {
  email: string;
  signupCountry: string | null;
  emailVerified: boolean;
}

/** Atleta tal como lo lee el panel (sin sus vínculos). Lo usa la agrupación por coach. */
export interface AthleteCore {
  id: string;
  nombre: string;
  nivel: string;
  compite: boolean;
  user: UserAccount | null;
}

/** Atleta + sus vínculos ACTIVOS (M:N). Largo 0 ⇒ atleta sin coach. Lo usa el cálculo de "sin coach". */
export interface AthleteWithLinks extends AthleteCore {
  vinculos: { id: string }[];
}

export interface UserRow {
  id: string;
  email: string;
  role: AdminRole;
  signupCountry: string | null;
  emailVerified: boolean;
  createdAt: Date;
}

export interface CoachRow {
  id: string;
  name: string;
  user: { email: string; signupCountry: string | null } | null;
  vinculos: { athlete: AthleteCore }[];
}

export interface AdminAthlete {
  id: string;
  nombre: string;
  nivel: string;
  compite: boolean;
  email: string | null;
  country: string | null;
  /** null = el atleta no tiene cuenta de usuario propia (atleta seed/sin login). */
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
  role: AdminRole;
  country: string | null;
  emailVerified: boolean;
  createdAt: string; // ISO — JSON-friendly para el web
}

export interface AdminOverview {
  users: AdminUser[];
  coaches: AdminCoachGroup[];
  unlinkedAthletes: AdminAthlete[];
  totals: { users: number; coaches: number; athletes: number; linkedAthletes: number };
}

function toAdminAthlete(a: AthleteCore): AdminAthlete {
  return {
    id: a.id,
    nombre: a.nombre,
    nivel: a.nivel,
    compite: a.compite,
    email: a.user?.email ?? null,
    country: a.user?.signupCountry ?? null,
    emailVerified: a.user ? a.user.emailVerified : null,
  };
}

/** Arma la vista admin a partir de filas crudas. Pura: sin I/O ni dependencia de Prisma. */
export function buildAdminOverview(users: UserRow[], coaches: CoachRow[], athletes: AthleteWithLinks[]): AdminOverview {
  const coachGroups: AdminCoachGroup[] = coaches.map((c) => {
    const list = c.vinculos.map((v) => toAdminAthlete(v.athlete));
    return {
      id: c.id,
      name: c.name,
      email: c.user?.email ?? null,
      country: c.user?.signupCountry ?? null,
      athleteCount: list.length,
      athletes: list,
    };
  });

  const unlinked = athletes.filter((a) => a.vinculos.length === 0);

  return {
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      country: u.signupCountry,
      emailVerified: u.emailVerified,
      createdAt: u.createdAt.toISOString(),
    })),
    coaches: coachGroups,
    unlinkedAthletes: unlinked.map(toAdminAthlete),
    totals: {
      users: users.length,
      coaches: coaches.length,
      athletes: athletes.length,
      linkedAthletes: athletes.length - unlinked.length,
    },
  };
}

/** Trae las filas y arma la vista. Read-only; sin scope multi-tenant (es el panel del dueño). */
export async function getAdminOverview(prisma: PrismaClient): Promise<AdminOverview> {
  const userSelect = { email: true, signupCountry: true, emailVerified: true } as const;

  const [users, coaches, athletes] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, email: true, role: true, signupCountry: true, emailVerified: true, createdAt: true },
    }),
    prisma.coach.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        user: { select: { email: true, signupCountry: true } },
        vinculos: {
          where: { estado: "activo" },
          include: { athlete: { include: { user: { select: userSelect } } } },
        },
      },
    }),
    prisma.athlete.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        user: { select: userSelect },
        vinculos: { where: { estado: "activo" }, select: { id: true } },
      },
    }),
  ]);

  // Las formas seleccionadas coinciden estructuralmente con las interfaces puras de arriba.
  return buildAdminOverview(users as UserRow[], coaches as CoachRow[], athletes as AthleteWithLinks[]);
}
