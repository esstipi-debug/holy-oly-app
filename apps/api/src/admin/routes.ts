import type { FastifyInstance } from "fastify";
import { prisma } from "../db/client";
import { requireAdmin } from "../auth/admin";
import { recordAudit } from "../audit";
import { getAdminOverview } from "./overview";

/**
 * Panel del dueño (admin). Toda ruta pasa por `requireAdmin` (email ∈ ADMIN_EMAILS) — el gate del web
 * es solo cosmético, la autoridad vive acá. Read-only: expone usuarios registrados (con país) y el
 * mapa atletas↔coaches. La lectura queda asentada en el audit trail.
 */
export async function adminRoutes(app: FastifyInstance): Promise<void> {
  app.get("/admin/overview", async (req, reply) => {
    if (!(await requireAdmin(prisma, req, reply))) return;
    const overview = await getAdminOverview(prisma);
    await recordAudit(prisma, { action: "admin.overview", actorUserId: req.userId ?? null, actorRole: req.role ?? null, ip: req.ip });
    return overview;
  });
}
