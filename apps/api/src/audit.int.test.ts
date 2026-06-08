import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "./server";
import { prisma } from "./db/client";

interface Res {
  cookies: Array<{ name: string; value: string }>;
  statusCode: number;
}
const sess = (r: Res): { cookie: string } => {
  const c = r.cookies.find((x) => x.name === "session");
  if (!c) throw new Error("no session cookie");
  return { cookie: `session=${c.value}` };
};

describe("audit log (A9)", () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = buildServer();
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it("records a failed login without storing the attempted email/password", async () => {
    const before = await prisma.auditEvent.count({ where: { action: "login.fail" } });
    await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "ghost-attacker@x.dev", password: "definitely-wrong-9" },
    });
    expect(await prisma.auditEvent.count({ where: { action: "login.fail" } })).toBe(before + 1);
    const ev = await prisma.auditEvent.findFirst({ where: { action: "login.fail" }, orderBy: { ts: "desc" } });
    expect(ev?.ts).toBeInstanceOf(Date);
    const dump = JSON.stringify(ev);
    expect(dump).not.toContain("ghost-attacker@x.dev");
    expect(dump).not.toContain("definitely-wrong-9");
  });

  it("records a coach cycle read with actor + target, never the raw cycle state", async () => {
    const coach = sess(
      (await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { email: "coach@holyoly.dev", password: "holyoly-demo" },
      })) as unknown as Res,
    );
    await app.inject({ method: "GET", url: "/athletes/mv/cycle", headers: coach });
    const ev = await prisma.auditEvent.findFirst({
      where: { action: "cycle.read", targetAthleteId: "mv" },
      orderBy: { ts: "desc" },
    });
    expect(ev).toBeTruthy();
    expect(ev?.actorUserId).toBeTruthy();
    expect(ev?.actorRole).toBe("coach");
    const dump = JSON.stringify(ev);
    expect(dump).not.toContain("regular");
    expect(dump).not.toContain("amenorrhea");
  });
});
