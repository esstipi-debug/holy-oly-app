/**
 * Fase 3 end-to-end: the full auth + Vínculo flow over real HTTP against a real (embedded)
 * Postgres — real session cookies, no mocks. Proves the deployed contract end to end.
 *
 * Run:  pnpm --filter @holy-oly/api e2e
 */
import EmbeddedPostgres from "embedded-postgres";
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

const PG_PORT = 5434;
const API_PORT = 8799;
const DATA_DIR = "./.pgdata-e2e";
const URL = `postgresql://holyoly:holyoly@localhost:${PG_PORT}/holyoly?schema=public`;
const API = `http://127.0.0.1:${API_PORT}`;

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(`E2E assertion failed: ${msg}`);
}

function sessionCookie(res: Response): string {
  const all = res.headers.getSetCookie();
  const s = all.find((c) => c.startsWith("session="));
  if (!s) throw new Error("no session cookie set");
  return s.split(";")[0]!; // "session=<value>"
}

function post(path: string, body: unknown, cookie?: string): Promise<Response> {
  return fetch(`${API}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body ?? {}),
  });
}
function get(path: string, cookie?: string): Promise<Response> {
  return fetch(`${API}${path}`, { headers: cookie ? { cookie } : {} });
}

async function main(): Promise<void> {
  rmSync(DATA_DIR, { recursive: true, force: true });
  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR, user: "holyoly", password: "holyoly", port: PG_PORT,
    persistent: false, initdbFlags: ["--encoding=UTF8", "--locale=C"],
  });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("holyoly");

  const env = { ...process.env, DATABASE_URL: URL };
  execSync("pnpm exec prisma migrate deploy", { env, stdio: "inherit" });
  execSync("pnpm exec tsx prisma/seed.ts", { env, stdio: "inherit" });

  process.env.DATABASE_URL = URL;
  const { buildServer } = await import("../src/server");
  const app = buildServer();
  await app.listen({ port: API_PORT, host: "127.0.0.1" });
  try {
    // 1) unauthenticated read is rejected
    assert((await get("/roster")).status === 401, "unauthenticated /roster → 401");

    // 2) demo coach logs in → session cookie → reads
    const login = await post("/auth/login", { email: "coach@holyoly.dev", password: "holyoly-demo" });
    assert(login.status === 200, "coach login 200");
    const coach = sessionCookie(login);

    const roster = (await (await get("/roster", coach)).json()) as Array<{ nombre: string }>;
    assert(roster.length === 8, `seeded roster 8 (got ${roster.length})`);

    const cycle = (await (await get("/athletes/mv/cycle", coach)).json()) as Record<string, unknown>;
    assert(cycle.share === "full" && !("state" in cycle), "cycle redacted (no raw state)");

    const code = ((await (await get("/invite", coach)).json()) as { inviteCode: string }).inviteCode;
    assert(typeof code === "string" && code.length > 0, "coach has an invite code");

    // 3) a new athlete signs up, enters the code → pending
    const signup = await post("/auth/signup", {
      email: `e2e-ath-${Date.now()}@x.dev`, password: "athlete-pass-1", role: "atleta", name: "E2E Atleta",
    });
    assert(signup.status === 201, "athlete signup 201");
    const athlete = sessionCookie(signup);

    const accept = await post("/vinculos/accept", { code }, athlete);
    assert(accept.status === 201, "accept 201");
    assert(((await accept.json()) as { estado: string }).estado === "pendiente", "estado pendiente");

    // 4) coach sees the pending request and confirms it
    const vinculos = (await (await get("/vinculos", coach)).json()) as Array<{ id: string; estado: string; athlete: { nombre: string } }>;
    const pend = vinculos.find((v) => v.estado === "pendiente" && v.athlete.nombre === "E2E Atleta");
    assert(pend, "pending vínculo listed for the coach");
    const confirm = await post(`/vinculos/${pend!.id}/confirm`, {}, coach);
    assert(confirm.status === 200 && ((await confirm.json()) as { estado: string }).estado === "activo", "confirmed → activo");

    // 5) the athlete now appears in the coach's roster (9 = 8 seeded + 1 new)
    const roster2 = (await (await get("/roster", coach)).json()) as Array<{ nombre: string }>;
    assert(roster2.length === 9, `roster grew to 9 (got ${roster2.length})`);
    assert(roster2.some((a) => a.nombre === "E2E Atleta"), "new athlete now in roster");

    console.log("\n✅ Fase 3 e2e OK: auth + Vínculo flow over real HTTP + Postgres");
    console.log("   401 unauth · login → roster 8 · cycle redacted · signup→accept(pendiente)→confirm(activo) → roster 9");
  } finally {
    await app.close();
    await pg.stop();
    rmSync(DATA_DIR, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
