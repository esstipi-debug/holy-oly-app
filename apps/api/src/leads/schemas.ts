import { z } from "zod";

/**
 * Public lead-capture payload from the marketing landing. Intentionally minimal: a contact
 * email, how many athletes the coach manages, and their country. `website` is a honeypot — a
 * hidden field real users never fill; bots do.
 */
export const LeadInputSchema = z
  .object({
    email: z.string().trim().email().max(254),
    athletes: z.number().int().min(1).max(10_000),
    country: z.string().trim().min(2).max(64),
    website: z.string().max(120).optional(),
  })
  .strict();

export type LeadInput = z.infer<typeof LeadInputSchema>;
