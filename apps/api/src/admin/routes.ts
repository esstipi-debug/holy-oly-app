import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "../db/client";

// Panel de admin SOLO-LECTURA (PII del owner) detrás de HTTP Basic Auth. "Desde cualquier lado":
// páginas server-rendered en el app de prod (GET /admin lista, GET /admin/u/:id detalle).
const ADMIN_RATE_LIMIT = { max: 60, timeWindow: "1 minute" } as const;
const ROW_CAP = 1000;

/** Comparación en tiempo constante (anti-timing). */
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
    if (i >= 0 && safeEqual(decoded.slice(0, i), user) && safeEqual(decoded.slice(i + 1), pass)) return true;
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
function fmt(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 16).replace("T", " ") : "—";
}
function fmtDay(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : "—";
}
const isSeed = (email: string): boolean => {
  const e = email.toLowerCase();
  return e.endsWith("@holyoly.dev") || e.endsWith("@holy-oly.test");
};

let regionNames: Intl.DisplayNames | null = null;
function countryName(code: string | null | undefined): string {
  if (!code) return "—";
  if (code === "ZZ") return "Otro";
  try {
    if (!regionNames) regionNames = new Intl.DisplayNames(["es"], { type: "region" });
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

type Sub = { status: string; planId: string | null; currentPeriodEnd: Date | null; provider: string } | null | undefined;

/** Etiqueta de pago a partir del estado de la suscripción del coach. */
function payBadge(sub: Sub): string {
  if (!sub || sub.status === "none") return '<span class="b b-no">sin pago</span>';
  if (sub.status === "active") return '<span class="b b-yes">PAGÓ</span>';
  if (sub.status === "past_due") return '<span class="b b-warn">vencido</span>';
  if (sub.status === "canceled") return '<span class="b b-no">cancelado</span>';
  return `<span class="b b-no">${esc(sub.status)}</span>`;
}

/** Período inferido del currentPeriodEnd (la app vende mensual + semestral, no anual). */
function periodLabel(sub: Sub): string {
  if (!sub || sub.status === "none" || !sub.currentPeriodEnd) return "—";
  const days = Math.round((sub.currentPeriodEnd.getTime() - Date.now()) / 86_400_000);
  if (days <= 0) return "vencido";
  return days <= 45 ? "mensual" : "semestral";
}

function page(title: string, body: string): string {
  return `<!doctype html><html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>${esc(title)}</title>
<style>
:root{--bg:#0A0B0E;--surface:#11151A;--surface2:#181d24;--hair:rgba(255,255,255,.08);--text:#EEF2F6;--muted:#6B7480;--gold:#E9C46A;--teal:#2EE6A0}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:14px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:18px}
a{color:var(--teal);text-decoration:none}a:hover{text-decoration:underline}
h1{font-size:20px;margin:0 0 4px}.sub{color:var(--muted);font-size:12px;margin:0 0 18px}
.cards{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:22px}
.card{flex:1;min-width:120px;border:1px solid var(--hair);border-radius:12px;padding:12px 14px;background:var(--surface)}
.card b{display:block;font-size:24px;font-weight:800;color:var(--gold)}.card span{color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.05em}
h2{font-size:15px;margin:22px 0 10px;display:flex;gap:8px;align-items:baseline}h2 small{color:var(--muted);font-weight:400;font-size:12px}
.wrap{overflow-x:auto;border:1px solid var(--hair);border-radius:12px}
table{border-collapse:collapse;width:100%;min-width:680px}
th,td{text-align:left;padding:9px 12px;border-bottom:1px solid var(--hair);white-space:nowrap;font-variant-numeric:tabular-nums}
th{color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.05em;position:sticky;top:0;background:var(--surface)}
td{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px}
tr.seed td{color:var(--muted)}
tr.clk:hover{background:var(--surface2);cursor:pointer}
.tag{font-size:10px;color:#1a1205;background:var(--gold);border-radius:5px;padding:1px 6px;font-family:system-ui;font-weight:700}
.b{font-size:10.5px;font-family:system-ui;font-weight:700;border-radius:6px;padding:2px 8px;white-space:nowrap}
.b-yes{color:#06210f;background:var(--teal)}.b-warn{color:#1a1205;background:var(--gold)}.b-no{color:var(--muted);background:rgba(255,255,255,.06)}
.empty{color:var(--muted);padding:14px;font-style:italic}
.box{border:1px solid var(--hair);border-radius:12px;background:var(--surface);padding:14px 16px;margin-bottom:16px}
.kv{display:grid;grid-template-columns:auto 1fr;gap:6px 16px;font-size:13px;margin:0}.kv dt{color:var(--muted)}.kv dd{margin:0;font-family:ui-monospace,monospace}
</style></head><body>${body}</body></html>`;
}

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  // ── Lista: registrados (con suscripción + país + #atletas) y leads ──
  app.get("/admin", { config: { rateLimit: ADMIN_RATE_LIMIT } }, async (req, reply) => {
    if (!authorized(req, reply)) return reply;

    const [users, leads, userTotal, leadTotal] = await Promise.all([
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        take: ROW_CAP,
        include: {
          coach: { include: { subscription: true, vinculos: { select: { estado: true } } } },
          athlete: { select: { nombre: true } },
        },
      }),
      prisma.lead.findMany({ orderBy: { createdAt: "desc" }, take: ROW_CAP }),
      prisma.user.count(),
      prisma.lead.count(),
    ]);

    // País por email: lo único que tiene país es el Lead (formulario de la landing).
    const leadCountry = new Map<string, string>();
    for (const l of leads) leadCountry.set(l.email.toLowerCase(), l.country);

    const real = users.filter((u) => !isSeed(u.email));
    const coaches = real.filter((u) => u.role === "coach").length;
    const athletes = real.filter((u) => u.role === "atleta").length;
    const paying = real.filter((u) => u.coach?.subscription?.status === "active").length;

    const userRows = users
      .map((u) => {
        const seed = isSeed(u.email);
        const name = u.coach?.name ?? u.athlete?.nombre ?? "—";
        const country = countryName(leadCountry.get(u.email.toLowerCase()));
        const sub = u.coach?.subscription as Sub;
        let suscripcion = '<span class="b b-no">atleta · gratis</span>';
        let atletas = "—";
        if (u.role === "coach") {
          const per = periodLabel(sub);
          suscripcion = `${payBadge(sub)}${sub?.planId ? " · " + esc(sub.planId) : ""}${per !== "—" ? " · " + per : ""}`;
          atletas = String((u.coach?.vinculos ?? []).filter((v) => v.estado === "activo").length);
        }
        return `<tr class="clk ${seed ? "seed" : ""}" onclick="location='/admin/u/${esc(u.id)}'"><td>${fmt(u.createdAt)}</td><td><a href="/admin/u/${esc(u.id)}">${esc(u.email)}</a>${seed ? ' <span class="tag">demo/seed</span>' : ""}</td><td>${esc(u.role)}</td><td>${esc(name)}</td><td>${esc(country)}</td><td>${suscripcion}</td><td>${atletas}</td><td>${u.emailVerified ? "✓" : "—"}</td></tr>`;
      })
      .join("");

    const leadRows = leads
      .map((l) => `<tr><td>${fmt(l.createdAt)}</td><td>${esc(l.email)}</td><td>${esc(l.athletes)}</td><td>${esc(countryName(l.country))}</td><td>${esc(l.source ?? "")}</td></tr>`)
      .join("");

    const body = `
<h1>Holy Oly · Admin</h1>
<p class="sub">Actualizado ${fmt(new Date())} UTC · <a href="/admin">↻ refrescar</a> · tocá una fila para ver el detalle de la cuenta</p>
<div class="cards">
  <div class="card"><b>${real.length}</b><span>registrados reales</span></div>
  <div class="card"><b>${coaches}</b><span>coaches</span></div>
  <div class="card"><b>${athletes}</b><span>atletas</span></div>
  <div class="card"><b>${paying}</b><span>coaches pagando</span></div>
  <div class="card"><b>${leadTotal}</b><span>leads (landing)</span></div>
</div>
<h2>Registrados <small>${userTotal} en total${userTotal > ROW_CAP ? ` · mostrando ${ROW_CAP}` : ""} (incluye cuentas demo/seed)</small></h2>
<div class="wrap"><table>
  <thead><tr><th>Alta (UTC)</th><th>Email</th><th>Rol</th><th>Nombre</th><th>País</th><th>Suscripción</th><th>Atletas</th><th>✓</th></tr></thead>
  <tbody>${userRows || '<tr><td colspan="8" class="empty">Sin registros todavía.</td></tr>'}</tbody>
</table></div>
<h2>Leads de la landing <small>${leadTotal} en total</small></h2>
<div class="wrap"><table>
  <thead><tr><th>Fecha (UTC)</th><th>Email</th><th>Atletas</th><th>País</th><th>Origen</th></tr></thead>
  <tbody>${leadRows || '<tr><td colspan="5" class="empty">Sin leads todavía.</td></tr>'}</tbody>
</table></div>`;

    return reply.header("Cache-Control", "no-store").header("X-Robots-Tag", "noindex, nofollow").type("text/html; charset=utf-8").send(page("Holy Oly · Admin", body));
  });

  // ── Detalle de una cuenta ──
  app.get<{ Params: { id: string } }>("/admin/u/:id", { config: { rateLimit: ADMIN_RATE_LIMIT } }, async (req, reply) => {
    if (!authorized(req, reply)) return reply;

    const u = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: {
        coach: {
          include: {
            subscription: true,
            vinculos: { include: { athlete: { select: { id: true, nombre: true, nivel: true, sexo: true, createdAt: true, plan: { select: { macroId: true } } } } } },
          },
        },
        athlete: { include: { plan: true, vinculos: { include: { coach: { select: { name: true } } } } } },
      },
    });

    if (!u) {
      return reply.code(404).type("text/html; charset=utf-8").send(page("No encontrado", '<h1>Cuenta no encontrada</h1><p><a href="/admin">← volver</a></p>'));
    }

    const lead = await prisma.lead.findFirst({ where: { email: u.email }, orderBy: { createdAt: "desc" } });
    const name = u.coach?.name ?? u.athlete?.nombre ?? "—";

    let detail = "";
    if (u.coach) {
      const sub = u.coach.subscription as Sub;
      const vinc = u.coach.vinculos;
      const rows = vinc
        .map((v) => `<tr class="clk" onclick="location='/admin/u/${esc(v.athlete.id)}'"><td>${esc(v.athlete.nombre)}</td><td>${esc(v.estado)}</td><td>${esc(v.athlete.plan?.macroId ?? "—")}</td><td>${esc(v.athlete.nivel)}</td><td>${esc(v.athlete.sexo)}</td><td>${fmtDay(v.athlete.createdAt)}</td></tr>`)
        .join("");
      detail = `
<div class="box"><h2 style="margin:0 0 10px">Suscripción</h2><dl class="kv">
  <dt>Estado</dt><dd>${payBadge(sub)} (${esc(sub?.status ?? "none")})</dd>
  <dt>Plan</dt><dd>${esc(sub?.planId ?? "—")}</dd>
  <dt>Período</dt><dd>${periodLabel(sub)}</dd>
  <dt>Vence</dt><dd>${fmt(sub?.currentPeriodEnd ?? null)}</dd>
  <dt>Proveedor</dt><dd>${esc(sub?.provider ?? "—")}</dd>
</dl></div>
<h2>Atletas del coach <small>${vinc.length}</small></h2>
<div class="wrap"><table>
  <thead><tr><th>Nombre</th><th>Vínculo</th><th>Macro</th><th>Nivel</th><th>Sexo</th><th>Alta</th></tr></thead>
  <tbody>${rows || '<tr><td colspan="6" class="empty">Sin atletas vinculados.</td></tr>'}</tbody>
</table></div>`;
    } else if (u.athlete) {
      const a = u.athlete;
      const coachNames = a.vinculos.map((v) => `${esc(v.coach.name)} (${esc(v.estado)})`).join(", ") || "—";
      detail = `
<div class="box"><h2 style="margin:0 0 10px">Atleta</h2><dl class="kv">
  <dt>Sexo</dt><dd>${esc(a.sexo)}</dd>
  <dt>Nivel</dt><dd>${esc(a.nivel)}</dd>
  <dt>Peso</dt><dd>${a.weightKg != null ? esc(a.weightKg) + " kg" : "—"}</dd>
  <dt>Macrociclo</dt><dd>${esc(a.plan?.macroId ?? "— (sin plan)")}</dd>
  <dt>Inicio plan</dt><dd>${esc(a.plan?.startDate ?? "—")}</dd>
  <dt>Coach(es)</dt><dd>${coachNames}</dd>
</dl></div>`;
    }

    const body = `
<p class="sub"><a href="/admin">← volver al listado</a></p>
<h1>${esc(name)} <small style="color:var(--muted);font-size:13px;font-weight:400">· ${esc(u.role)}</small></h1>
<div class="box"><dl class="kv">
  <dt>Email</dt><dd>${esc(u.email)}${isSeed(u.email) ? ' <span class="tag">demo/seed</span>' : ""}</dd>
  <dt>Email verificado</dt><dd>${u.emailVerified ? "✓ sí" : "— no"}</dd>
  <dt>Alta</dt><dd>${fmt(u.createdAt)} UTC</dd>
  <dt>País</dt><dd>${esc(countryName(lead?.country))}${lead ? " (del lead de la landing)" : " (no dejó lead)"}</dd>
  <dt>Aceptó términos</dt><dd>${u.termsAcceptedAt ? fmtDay(u.termsAcceptedAt) + (u.termsVersion ? " · v" + esc(u.termsVersion) : "") : "—"}</dd>
  <dt>ID</dt><dd>${esc(u.id)}</dd>
</dl></div>
${detail}`;

    return reply.header("Cache-Control", "no-store").header("X-Robots-Tag", "noindex, nofollow").type("text/html; charset=utf-8").send(page(`${name} · Admin`, body));
  });
}
