import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

// Mismo dominio que la landing → el blog hereda autoridad SEO.
export default defineConfig({
  site: "https://holy-oly.com",
  integrations: [sitemap()],
});
