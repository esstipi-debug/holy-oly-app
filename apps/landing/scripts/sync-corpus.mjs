// Adaptador de corpus: huermn ContentDoc (YAML) → markdown de Astro.
// Fuente única = repo huermn (content/published/*.yaml). Acá NO se edita contenido a mano:
// se regenera. Valida el no-name del lado consumidor antes de escribir.
//
// Override del origen: HUERMN_CONTENT_DIR=/ruta/a/huermn/content/published
import { readdir, readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

const here = dirname(fileURLToPath(import.meta.url));
const DEST = resolve(here, "../src/content/blog");
const SRC = process.env.HUERMN_CONTENT_DIR
  ? resolve(process.env.HUERMN_CONTENT_DIR)
  : resolve(here, "../../../../volta-atlas/packages/huermn/content/published");

const BANNED = [/huberman/i, /\brpe\b/i];
const CATEGORY_FALLBACK = "Ciencia";

function readingMinutes(body) {
  const words = String(body || "").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function violations(raw) {
  const errs = [];
  if ("_provenance" in raw || "provenance" in raw) errs.push("provenance embarcada");
  const hay = [
    raw.title,
    raw.summary,
    raw.body,
    ...(raw.primary_sources ?? []).flatMap((s) => Object.values(s).map(String)),
    ...Object.values(raw.applications ?? {}).flat().map(String),
  ].join(" ");
  for (const p of BANNED) if (p.test(hay)) errs.push(`patrón prohibido ${p}`);
  return errs;
}

function toMarkdown(raw) {
  const fm = {
    title: raw.title,
    summary: raw.summary,
    category: raw.category ?? CATEGORY_FALLBACK,
    topic: raw.topic ?? "",
    tags: raw.tags ?? [],
    primary_sources: raw.primary_sources ?? [],
    applications: raw.applications ?? {},
    contraindications: raw.contraindications ?? [],
    readingMinutes: readingMinutes(raw.body),
    publishDate: raw.publish_date ?? "2026-01-01",
  };
  return `---\n${stringifyYaml(fm).trimEnd()}\n---\n\n${String(raw.body ?? "").trim()}\n`;
}

async function main() {
  if (!existsSync(SRC)) {
    console.warn(`[sync-corpus] fuente no encontrada (${SRC}); conservo el contenido vendorizado.`);
    return;
  }
  await mkdir(DEST, { recursive: true });

  // DEST es 100% generado desde la corpus: limpio markdown previo.
  for (const f of await readdir(DEST)) {
    if (f.endsWith(".md")) await unlink(join(DEST, f));
  }

  const files = (await readdir(SRC)).filter((f) => /\.ya?ml$/.test(f));
  let synced = 0;
  const errors = [];
  for (const f of files) {
    const raw = parseYaml(await readFile(join(SRC, f), "utf8"));
    if (!raw || !raw.slug) {
      errors.push(`${f}: falta slug`);
      continue;
    }
    const errs = violations(raw);
    if (errs.length) {
      errors.push(`${f}: ${errs.join(", ")}`);
      continue;
    }
    await writeFile(join(DEST, `${raw.slug}.md`), toMarkdown(raw), "utf8");
    synced += 1;
  }

  console.log(`[sync-corpus] ${synced} ContentDoc(s) → ${DEST}`);
  if (errors.length) {
    for (const e of errors) console.error(`[sync-corpus] ${e}`);
    throw new Error("sync abortado por violaciones de contrato");
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
