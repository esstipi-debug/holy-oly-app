import { rmSync } from "node:fs";
import { handle } from "./server-handle";

export default async function globalTeardown(): Promise<void> {
  if (handle.app) await handle.app.close();
  // Disconnect the Prisma singleton before stopping Postgres (else a benign reset is logged).
  const { prisma } = await import("../src/db/client");
  await prisma.$disconnect().catch(() => undefined);
  if (handle.pg) await handle.pg.stop();
  if (handle.dataDir) rmSync(handle.dataDir, { recursive: true, force: true });
}
