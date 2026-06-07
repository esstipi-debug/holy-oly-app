/**
 * Demo-only (T5): capture a prospect lead offline. No backend — leads append to `ho:leads` in
 * localStorage (exportable later) so the demo "gana el sí" AND lo deja registrado. If a contact
 * target is configured, the caller can also open a wa.me/mailto deep link; by default it just saves.
 *
 * `DEMO_LEAD_WHATSAPP` / `DEMO_LEAD_EMAIL` are intentionally empty — set them to YOUR contact so the
 * CTA also opens WhatsApp/mail prellenado. Empty = capture-only (still fully works offline).
 */
export const LEADS_KEY = "ho:leads";
export const DEMO_LEAD_WHATSAPP = ""; // e.g. "5491122334455" (sin +, sin espacios)
export const DEMO_LEAD_EMAIL = "";    // e.g. "hola@holyoly.app"

export interface Lead {
  nombre: string;
  contacto: string; // WhatsApp o email del prospecto
  ts: string;       // ISO timestamp de captura
}

export function readLeads(storage: Storage): Lead[] {
  try {
    const raw = storage.getItem(LEADS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Lead[]) : [];
  } catch {
    return [];
  }
}

/** Append a lead (immutably) and persist. Returns the full updated list. */
export function saveLead(storage: Storage, input: { nombre: string; contacto: string }, ts: string): Lead[] {
  const lead: Lead = { nombre: input.nombre.trim(), contacto: input.contacto.trim(), ts };
  const next = [...readLeads(storage), lead];
  storage.setItem(LEADS_KEY, JSON.stringify(next));
  return next;
}

/** wa.me deep link to the configured contact with the lead prefilled — or undefined if unconfigured. */
export function whatsappUrl(lead: { nombre: string; contacto: string }): string | undefined {
  if (!DEMO_LEAD_WHATSAPP) return undefined;
  const text = `Hola, soy ${lead.nombre} (${lead.contacto}). Me interesa Holy Oly para mi equipo.`;
  return `https://wa.me/${DEMO_LEAD_WHATSAPP}?text=${encodeURIComponent(text)}`;
}

export function mailtoUrl(lead: { nombre: string; contacto: string }): string | undefined {
  if (!DEMO_LEAD_EMAIL) return undefined;
  const body = `Soy ${lead.nombre} (${lead.contacto}). Me interesa Holy Oly para mi equipo.`;
  return `mailto:${DEMO_LEAD_EMAIL}?subject=${encodeURIComponent("Me interesa Holy Oly")}&body=${encodeURIComponent(body)}`;
}
