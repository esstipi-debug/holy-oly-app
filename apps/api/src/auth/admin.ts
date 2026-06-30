import type { FastifyReply, FastifyRequest } from "fastify";
import type { PrismaClient } from "@prisma/client";

/**
 * Admin authorization (panel del dueño). No hay rol "admin" en el esquema: el set de admins vive en
 * la env `ADMIN_EMAILS` (lista separada por comas, case-insensitive). Vacío = sin admins (cerrado
 * por defecto). Seguro por diseño: nunca confiamos en un flag del cliente — el chequeo es server-side
 * en cada endpoint admin, igual que `requireCoach`.
 */
export function adminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** ¿Este email es admin? Case-insensitive. Vacío/no-configurado → false. */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().has(email.trim().toLowerCase());
}

/**
 * Gate de endpoints admin: exige sesión cuyo email ∈ ADMIN_EMAILS. Responde 401 (sin sesión) o 403
 * (logueado pero no admin) y devuelve false. No revela la lista ni la existencia de cuentas.
 */
export async function requireAdmin(
  prisma: PrismaClient,
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<boolean> {
  if (!req.userId) {
    reply.code(401).send({ error: "not authenticated" });
    return false;
  }
  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { email: true } });
  if (!isAdminEmail(user?.email)) {
    reply.code(403).send({ error: "forbidden" });
    return false;
  }
  return true;
}
