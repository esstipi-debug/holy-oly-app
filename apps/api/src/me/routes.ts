import type { FastifyInstance } from "fastify";
import { DayLogInputSchema, PutMeCycleInputSchema, PutMeSessionInputSchema, validateFechaEntreno } from "@holy-oly/core";
import { prisma } from "../db/client";
import { requireAthlete } from "../auth/guards";
import { SESSION_COOKIE, cookieOpts } from "../auth/routes";
import { recordAudit } from "../audit";
import * as repo from "../repo";

/** Server's calendar date (UTC). A1 anchors the athlete loop to this; per-athlete timezones are a
 *  later refinement. */
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Athlete-self surface (Proyecto A). The principal is the athlete's own session: `req.athleteId`
 * comes from the session cookie, NEVER from the body or path — so there is no cross-athlete write.
 * No Vínculo is required (the athlete owns their data).
 */
export async function meRoutes(app: FastifyInstance): Promise<void> {
  app.get("/me/plan", async (req, reply) => {
    const athleteId = requireAthlete(req, reply);
    if (!athleteId) return;
    const view = await repo.getMePlanView(prisma, athleteId, todayISO());
    if (!view) return reply.code(404).send({ error: "no athlete" });
    return view;
  });

  app.get("/me/series", async (req, reply) => {
    const athleteId = requireAthlete(req, reply);
    if (!athleteId) return;
    const s = await repo.getSeries(prisma, athleteId);
    if (!s) return reply.code(404).send({ error: "no series" });
    return s;
  });

  app.get<{ Querystring: { date?: string } }>("/me/daylog", async (req, reply) => {
    const athleteId = requireAthlete(req, reply);
    if (!athleteId) return;
    const { date } = req.query;
    if (date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return reply.code(400).send({ error: "invalid date format" });
    }
    return repo.getDayLogView(prisma, athleteId, todayISO(), date);
  });

  app.put("/me/daylog", async (req, reply) => {
    const athleteId = requireAthlete(req, reply);
    if (!athleteId) return;
    const parsed = DayLogInputSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid daylog" });
    return repo.upsertDayLog(prisma, athleteId, todayISO(), parsed.data);
  });

  app.get<{ Querystring: { week?: string } }>("/me/sessions", async (req, reply) => {
    const athleteId = requireAthlete(req, reply);
    if (!athleteId) return;
    const week = Number(req.query.week);
    if (!Number.isInteger(week) || week < 1 || week > 104) return reply.code(400).send({ error: "week required (1..104)" });
    return repo.getPrescriptionWeek(prisma, athleteId, week);
  });

  app.get("/me/heat", async (req, reply) => {
    const athleteId = requireAthlete(req, reply);
    if (!athleteId) return;
    return repo.getPlanHeat(prisma, athleteId);
  });

  // Recorrido (slice recorrido-ciclos): lo HECHO acumulado por semana — carga PROPIA en kg,
  // jamás RM/RPE/ACWR (HR-1). { semanas: [] } sin plan.
  app.get("/me/recorrido", async (req, reply) => {
    const athleteId = requireAthlete(req, reply);
    if (!athleteId) return;
    return repo.getMeRecorrido(prisma, athleteId);
  });

  // Historial de macrociclos (slice macro-history): los ciclos cerrados del propio atleta —
  // su constancia (adherencia %). Sin RPE/ACWR; el RM del cierre es dato propio (HR-1 ok).
  app.get("/me/macro-history", async (req, reply) => {
    const athleteId = requireAthlete(req, reply);
    if (!athleteId) return;
    return repo.getMacroHistory(prisma, athleteId);
  });

  // ── Ciclo (slice ciclo-visible): la verdad de la atleta — JAMÁS viaja al coach por acá. ──
  app.get("/me/cycle", async (req, reply) => {
    const athleteId = requireAthlete(req, reply);
    if (!athleteId) return;
    return repo.getMyCycle(prisma, athleteId);
  });

  app.put("/me/cycle", async (req, reply) => {
    const athleteId = requireAthlete(req, reply);
    if (!athleteId) return;
    const parsed = PutMeCycleInputSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid cycle" });
    const { consent, ...data } = parsed.data;
    let firstConsent = false;
    try {
      // PR-L2: la 1ª activación exige el acto de consentimiento informado (§3 opt-in por elección).
      ({ firstConsent } = await repo.putMyCycle(prisma, athleteId, data, consent === true));
    } catch (e) {
      if (e instanceof repo.ConsentRequiredError) return reply.code(400).send({ error: "consent required" });
      throw e;
    }
    // Audit SIN payload de salud (sólo ids+acción+ip). Sólo la activación REAL es cycle.consent.
    await recordAudit(prisma, { action: firstConsent ? "cycle.consent" : "cycle.write", actorUserId: req.userId, actorRole: req.role, targetAthleteId: athleteId, ip: req.ip });
    return reply.code(200).send({ ok: true });
  });

  // PR-L2: revocación — la atleta borra su registro entero (dueña del dato); el coach deja de ver contexto.
  app.delete("/me/cycle", async (req, reply) => {
    const athleteId = requireAthlete(req, reply);
    if (!athleteId) return;
    await repo.deleteMyCycle(prisma, athleteId);
    await recordAudit(prisma, { action: "cycle.revoke", actorUserId: req.userId, actorRole: req.role, targetAthleteId: athleteId, ip: req.ip });
    return reply.code(200).send({ ok: true });
  });

  // Spec 2026-06-12: envelope { fecha?, actuals } — fecha real del entreno (default hoy, jamás
  // futura, D2/D4) + regla 1×fecha en el repo (409 identificado, D1/D5).
  app.put<{ Params: { week: string; idx: string } }>("/me/session/:week/:idx", async (req, reply) => {
    const athleteId = requireAthlete(req, reply);
    if (!athleteId) return;
    const week = Number(req.params.week);
    const idx = Number(req.params.idx);
    if (!Number.isInteger(week) || week < 1 || week > 104 || !Number.isInteger(idx) || idx < 0 || idx > 13) {
      return reply.code(400).send({ error: "bad week/idx" });
    }
    const parsed = PutMeSessionInputSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid actuals" });
    const hoy = todayISO();
    const fecha = parsed.data.fecha ?? hoy;
    if (validateFechaEntreno(fecha, hoy) === "futuro") return reply.code(400).send({ error: "fecha futura" });
    try {
      await repo.setSessionActuals(prisma, athleteId, week, idx, parsed.data.actuals, fecha);
    } catch (e) {
      if (e instanceof repo.FechaOcupadaError) {
        return reply.code(409).send({ error: "fecha_ocupada", conflicto: e.conflicto });
      }
      if (e instanceof repo.DiaBloqueadoError) {
        return reply.code(409).send({ error: "dia_bloqueado", faltan: e.faltan });
      }
      throw e;
    }
    return reply.code(200).send({ ok: true });
  });

  // Secuencia de días (2026-06-13): ANULAR un entreno (falló/canceló). Mismo gate que completar
  // (los días anteriores deben estar resueltos) → 409 dia_bloqueado. Sin volumen, no ocupa fecha.
  app.post<{ Params: { week: string; idx: string } }>("/me/session/:week/:idx/anular", async (req, reply) => {
    const athleteId = requireAthlete(req, reply);
    if (!athleteId) return;
    const week = Number(req.params.week);
    const idx = Number(req.params.idx);
    if (!Number.isInteger(week) || week < 1 || week > 104 || !Number.isInteger(idx) || idx < 0 || idx > 13) {
      return reply.code(400).send({ error: "bad week/idx" });
    }
    try {
      await repo.anularSession(prisma, athleteId, week, idx, todayISO());
    } catch (e) {
      if (e instanceof repo.DiaBloqueadoError) {
        return reply.code(409).send({ error: "dia_bloqueado", faltan: e.faltan });
      }
      throw e;
    }
    return reply.code(200).send({ ok: true });
  });

  // Secuencia de días: DES-ANULAR (reactivar) → el día vuelve a pendiente. Idempotente.
  app.delete<{ Params: { week: string; idx: string } }>("/me/session/:week/:idx/anular", async (req, reply) => {
    const athleteId = requireAthlete(req, reply);
    if (!athleteId) return;
    const week = Number(req.params.week);
    const idx = Number(req.params.idx);
    if (!Number.isInteger(week) || week < 1 || week > 104 || !Number.isInteger(idx) || idx < 0 || idx > 13) {
      return reply.code(400).send({ error: "bad week/idx" });
    }
    await repo.desanularSession(prisma, athleteId, week, idx);
    return reply.code(200).send({ ok: true });
  });

  // D3: the athlete downloads everything they own (RGPD-style). They get their RAW cycle (it's theirs).
  app.get("/me/export", async (req, reply) => {
    const athleteId = requireAthlete(req, reply);
    if (!athleteId) return;
    const data = await repo.exportAthleteData(prisma, athleteId);
    await recordAudit(prisma, { action: "data.export", actorUserId: req.userId ?? null, actorRole: req.role ?? null, targetAthleteId: athleteId, ip: req.ip });
    reply.header("Content-Disposition", 'attachment; filename="holy-oly-export.json"');
    return data;
  });

  // D4: the athlete deletes their own account. Cascades all their data; no orphaned health data.
  app.delete("/me/account", async (req, reply) => {
    const athleteId = requireAthlete(req, reply);
    if (!athleteId) return;
    const userId = req.userId;
    if (!userId) return reply.code(401).send({ error: "not authenticated" });
    await repo.deleteAthleteAccount(prisma, athleteId, userId);
    await recordAudit(prisma, { action: "account.delete", actorUserId: userId, actorRole: "atleta", targetAthleteId: athleteId, ip: req.ip });
    reply.clearCookie(SESSION_COOKIE, cookieOpts());
    return reply.code(200).send({ ok: true });
  });
}
