import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "../db/client";

// Panel de admin SOLO-LECTURA (PII del owner) detrás de HTTP Basic Auth. "Desde cualquier lado":
// es una página server-rendered en el mismo app de prod (GET /admin), el navegador pide usuario+pass.
const ADMIN_RATE_LIMIT = { max: 30, timeWindow: "1 minute" } as const;
const ROW_CAP = 1000; // tope defensivo por tabla (hoy son pocos; evita una página gigante el día de mañana)

/** Comparación en tiempo constante (anti-timing) de strings de igual o distinto largo. */
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** HTTP Basic Auth contra ADMIN_USER/ADMIN_PASS. true = autorizado; si no, ya respondió 401/503. */
function authorized(req: FastifyRequest, reply: FastifyReply): boolean {
  const user = process.env.ADMIN_USER;
  const pass = process.env.ADMIN_PASS;
  if (!user || !pass) {
    reply.code(503).type("text/plain; charset=utf-8").send("Admin no configurado (faltan ADMIN_USER / ADMIN_PASS).");
    return false;
  }
  const m = /^Basic\s+(.+)$/i.exec(req.headers.authorization ?? "");
  const b64 = m?.[1];
  if (b64) {
    const decoded = Buffer.from(b64, "base64").toString("utf8");
    const i = decoded.indexOf(":");
    if (i >= 0) {
      const u = decoded.slice(0, i);
      const p = decoded.slice(i + 1);
      if (safeEqual(u, user) && safeEqual(p, pass)) return true;
    }
  }
  reply
    .code(401)
    .header("WWW-Authenticate", 'Basic realm="Holy Oly Admin", charset="UTF-8"')
    .type("text/plain; charset=utf-8")
    .send("Autenticación requerida.");
  return false;
}

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ESC[c] ?? c);
}
function fmt(d: Date): string {
  return d.toISOString().slice(0, 16).replace("T", " ");
}
const isSeed = (email: string): boolean => email.toLowerCase().endsWith("@holyoly.dev");

function page(body: string): string {
  return `<!doctype html><html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Holy Oly · Admin</title>
<style>
:root{--bg:#0A0B0E;--surface:#11151A;--hair:rgba(255,255,255,.08);--text:#EEF2F6;--muted:#6B7480;--gold:#E9C46A;--teal:#2EE6A0;}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:14px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:18px}
h1{font-size:20px;margin:0 0 4px}.sub{color:var(--muted);font-size:12px;margin:0 0 18px}
.cards{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:22px}
.card{flex:1;min-width:120px;border:1px solid var(--hair);border-radius:12px;padding:12px 14px;background:var(--surface)}
.card b{display:block;font-size:24px;font-weight:800;color:var(--gold)}.card span{color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.05em}
h2{font-size:15px;margin:22px 0 10px;display:flex;gap:8px;align-items:baseline}h2 small{color:var(--muted);font-weight:400;font-size:12px}
.wrap{overflow-x:auto;border:1px solid var(--hair);border-radius:12px}
table{border-collapse:collapse;width:100%;min-width:520px}
th,td{text-align:left;padding:9px 12px;border-bottom:1px solid var(--hair);white-space:nowrap;font-variant-numeric:tabular-nums}
th{color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.05em;position:sticky;top:0;background:var(--surface)}
td{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px}
tr.seed td{color:var(--muted)}
.tag{font-size:10px;color:#1a1205;background:var(--gold);border-radius:5px;padding:1px 6px;font-family:system-ui;font-weight:700}
.empty{color:var(--muted);padding:14px;font-style:italic}
a.refresh{color:var(--teal);font-size:12px;text-decoration:none}
</style></head><body>${body}</body></html>`;
}

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  app.get("/admin", { config: { rateLimit: ADMIN_RATE_LIMIT } }, async (req, reply) => {
    if (!authorized(req, reply)) return reply;

    const [users, leads, userTotal, leadTotal] = await Promise.all([
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        take: ROW_CAP,
        include: { coach: { select: { name: true } }, athlete: { select: { nombre: true } } },
      }),
      prisma.lead.findMany({ orderBy: { createdAt: "desc" }, take: ROW_CAP }),
      prisma.user.count(),
      prisma.lead.count(),
    ]);

    const real = users.filter((u) => !isSeed(u.email));
    const coaches = real.filter((u) => u.role === "coach").length;
    const athletes = real.filter((u) => u.role === "atleta").length;

    const userRows = users
      .map((u) => {
        const name = u.coach?.name ?? u.athlete?.nombre ?? "—";
        const seed = isSeed(u.email);
        return `<tr class="${seed ? "seed" : ""}"><td>${fmt(u.createdAt)}</td><td>${esc(u.email)}${seed ? ' <span class="tag">demo/seed</span>' : ""}</td><td>${esc(u.role)}</td><td>${esc(name)}</td><td>${u.emailVerified ? "✓" : "—"}</td></tr>`;
      })
      .join("");

    const leadRows = leads
      .map((l) => `<tr><td>${fmt(l.createdAt)}</td><td>${esc(l.email)}</td><td>${esc(l.athletes)}</td><td>${esc(l.country)}</td><td>${esc(l.source ?? "")}</td></tr>`)
      .join("");

    const body = `
<h1>Holy Oly · Admin</h1>
<p class="sub">Actualizado ${fmt(new Date())} UTC · <a class="refresh" href="/admin">↻ refrescar</a></p>
<div class="cards">
  <div class="card"><b>${real.length}</b><span>registrados reales</span></div>
  <div class="card"><b>${coaches}</b><span>coaches</span></div>
  <div class="card"><b>${athletes}</b><span>atletas</span></div>
  <div class="card"><b>${leadTotal}</b><span>leads (landing)</span></div>
</div>
<h2>Registrados <small>${userTotal} en total${userTotal > ROW_CAP ? ` · mostrando ${ROW_CAP}` : ""} (incluye cuentas demo/seed)</small></h2>
<div class="wrap"><table>
  <thead><tr><th>Alta (UTC)</th><th>Email</th><th>Rol</th><th>Nombre</th><th>Email ✓</th></tr></thead>
  <tbody>${userRows || '<tr><td colspan="5" class="empty">Sin registros todavía.</td></tr>'}</tbody>
</table></div>
<h2>Leads de la landing <small>${leadTotal} en total${leadTotal > ROW_CAP ? ` · mostrando ${ROW_CAP}` : ""}</small></h2>
<div class="wrap"><table>
  <thead><tr><th>Fecha (UTC)</th><th>Email</th><th>Atletas</th><th>País</th><th>Origen</th></tr></thead>
  <tbody>${leadRows || '<tr><td colspan="5" class="empty">Sin leads todavía.</td></tr>'}</tbody>
</table></div>`;

    return reply
      .header("Cache-Control", "no-store")
      .header("X-Robots-Tag", "noindex, nofollow")
      .type("text/html; charset=utf-8")
      .send(page(body));
  });
}
