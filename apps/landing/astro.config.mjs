import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

// TODO: cambiar a https://holyoly.app cuando se conecte el dominio propio (hoy parqueado).
export default defineConfig({
  site: "https://holy-oly-landing.onrender.com",
  integrations: [sitemap()],
});
