export interface PrimarySource {
  title: string;
  authors?: string;
  journal?: string;
  year?: number;
  doi?: string;
}

/** Contrato wire (snake_case) — igual que el YAML publicado por huermn. */
export interface ContentDoc {
  id: string;
  slug: string;
  lang: string;
  title: string;
  summary: string;
  topic: string;
  tags: string[];
  states: string[];
  items: string[];
  body: string;
  primary_sources: PrimarySource[];
  applications: Record<string, string[]>;
  contraindications: string[];
}

const BANNED: RegExp[] = [/huberman/i, /\brpe\b/i];
const REQUIRED: ReadonlyArray<keyof ContentDoc> = ["id", "slug", "title", "summary", "body"];

/** Devuelve la lista de violaciones de contrato; arreglo vacío = doc publicado válido. */
export function validatePublishedContentDoc(raw: unknown): string[] {
  const errors: string[] = [];
  if (typeof raw !== "object" || raw === null) return ["not an object"];
  const doc = raw as Record<string, unknown>;

  if ("_provenance" in doc || "provenance" in doc) {
    errors.push("must not contain provenance");
  }
  for (const field of REQUIRED) {
    const value = doc[field];
    if (typeof value !== "string" || value.length === 0) {
      errors.push(`missing/empty field: ${field}`);
    }
  }

  const haystack: string[] = [String(doc.title ?? ""), String(doc.summary ?? ""), String(doc.body ?? "")];
  const apps = doc.applications as Record<string, string[]> | undefined;
  if (apps) for (const lines of Object.values(apps)) haystack.push(...lines.map(String));
  const sources = doc.primary_sources as PrimarySource[] | undefined;
  if (sources) for (const s of sources) haystack.push(Object.values(s).join(" "));

  const text = haystack.join(" ");
  for (const pat of BANNED) {
    if (pat.test(text)) errors.push(`matches banned pattern ${String(pat)}`);
  }
  return errors;
}
