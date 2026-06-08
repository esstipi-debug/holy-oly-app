import { buildServer } from "./server";
import { prisma } from "./db/client";
import { purgeExpiredSessions } from "./auth/session";

const PORT = Number(process.env.PORT ?? 8787);
const PURGE_INTERVAL_MS = 60 * 60 * 1000;

const app = buildServer();
app
  .listen({ port: PORT, host: "0.0.0.0" })
  .then(() => {
    console.log(`[api] listening on :${PORT}`);
    // D5: clean expired sessions on boot + hourly (Render/Railway free have no cron).
    void purgeExpiredSessions(prisma).catch(() => undefined);
    setInterval(() => void purgeExpiredSessions(prisma).catch(() => undefined), PURGE_INTERVAL_MS).unref();
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
