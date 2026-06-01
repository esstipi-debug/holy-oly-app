import { buildServer } from "./server";

const PORT = Number(process.env.PORT ?? 8787);

const app = buildServer();
app
  .listen({ port: PORT, host: "0.0.0.0" })
  .then(() => console.log(`[api] listening on :${PORT}`))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
