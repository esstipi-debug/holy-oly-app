import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

// Espejo del contrato ContentDoc publicado por huermn (content/published/*.yaml).
// Por ahora la corpus se vendoriza acá como markdown; luego se sincroniza desde huermn.
const blog = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/blog" }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    category: z.string(),
    topic: z.string(),
    tags: z.array(z.string()).default([]),
    primary_sources: z
      .array(
        z.object({
          title: z.string(),
          authors: z.string().optional(),
          journal: z.string().optional(),
          year: z.number().optional(),
          doi: z.string().optional(),
        }),
      )
      .default([]),
    applications: z.record(z.string(), z.array(z.string())).default({}),
    contraindications: z.array(z.string()).default([]),
    readingMinutes: z.number().default(3),
    publishDate: z.coerce.date(),
  }),
});

export const collections = { blog };
