#!/usr/bin/env node
/**
 * Authoring bridge: huermn (RAG de Huberman, local) → borrador para `WELLNESS_TIPS` de Holy Oly.
 *
 * huermn es SÓLO herramienta de autoría OFFLINE. Holy Oly NUNCA la consulta en runtime: embarca un
 * catálogo estático (`packages/core/src/data/wellnessTips.ts`). Este script consulta el RAG local y
 * emite un BORRADOR (hechos + procedencia interna) para que vos PARAFRASEES a mano en tips nuevos.
 *
 * 🔴 REGLA INTOCABLE DEL OWNER (la blinda `wellnessTips.test.ts`):
 *   - Los tips son HECHOS/protocolos en palabras propias — NUNCA texto copiado.
 *   - La fuente es real pero JAMÁS se nombra en el producto: nada de "Huberman" en title/body/source.
 *   - Atribución GENÉRICA (constante `SRC` de wellnessTips.ts). Sin RPE. Advisory, no prescriptivo.
 *   → La procedencia (URL/episodio) vive sólo en el borrador de autoría, jamás en el tip embarcado.
 *
 * Por eso este script NO escribe `wellnessTips.ts`: produce un .md para tu revisión + parafraseo.
 *
 * Uso:
 *   node scripts/wellness/huberman-tips-draft.mjs --dry-run   # muestra las queries planeadas (sin huermn)
 *   node scripts/wellness/huberman-tips-draft.mjs             # consulta huermn y escribe el borrador
 *   HUERMN=http://127.0.0.1:8000 node scripts/wellness/huberman-tips-draft.mjs
 *
 * Requiere huermn levantada:  cd C:\\volta-atlas\\packages\\huermn && uvicorn api.main:app --port 8000
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const HUERMN = process.env.HUERMN ?? "http://127.0.0.1:8000";
const DRY = process.argv.includes("--dry-run");
const OUT = "docs/wellness/huberman-drafts.md";
const SRC = "Basado en divulgación científica sobre sueño, estrés y recuperación"; // == SRC de wellnessTips.ts

// Señales que el atleta registra (check-in) → query Huberman. `states`/`items` = cómo enruta
// `pickWellnessTip` (estado de recuperación ok/warn/alert + ítem más flojo del check-in).
const TOPICS = [
  { topic: "Sueño",         q: "sleep toolkit consistency light temperature wind down", states: ["warn", "alert", "ok"], items: ["sueno"] },
  { topic: "Recuperación",  q: "NSDR non-sleep deep rest nap recover lost sleep",        states: ["warn", "alert"],       items: ["sueno", "fatiga"] },
  { topic: "Estrés",        q: "physiological sigh reduce acute stress real time breathing", states: ["ok", "warn", "alert"], items: ["estres"] },
  { topic: "Luz y ánimo",   q: "morning sunlight viewing circadian mood cortisol",       states: ["warn", "alert"],       items: ["estres", "humor"] },
  { topic: "Energía",       q: "caffeine timing afternoon dopamine stacking motivation", states: ["ok", "warn", "alert"], items: ["fatiga", "motivacion"] },
  { topic: "Recuperación",  q: "deliberate cold heat exposure timing around training adaptation", states: ["warn", "alert"], items: ["dolor"] },
  { topic: "Ánimo",         q: "exercise movement low mood behavioral activation",       states: ["warn", "alert"],       items: ["humor"] },
  { topic: "Motivación",    q: "overcoming friction starting action limbic friction",    states: ["ok", "warn", "alert"], items: ["motivacion"] },
];

const fmtArr = (a) => `[${a.map((x) => `"${x}"`).join(", ")}]`;

function hitLine(h) {
  // El shape del hit de huermn puede variar; tomamos campos comunes de las protocol cards de defensa.
  const title = h.topic ?? h.id ?? "(sin topic)";
  const summary = h.summary ?? h.text ?? h.document ?? "";
  const url = h.source_url ?? h.url ?? h.source ?? "(sin url)";
  const snip = String(summary).replace(/\s+/g, " ").trim().slice(0, 280);
  return `  - **${title}** — ${snip}${snip.length >= 280 ? "…" : ""}\n    · procedencia (INTERNA, no embarcar): ${url}`;
}

function section(t, hits) {
  const provenance = hits.length ? hits.map(hitLine).join("\n") : "  - (sin hits — revisá la query o el índice de huermn)";
  return [
    `### ${t.topic} · states=${fmtArr(t.states)} items=${fmtArr(t.items)}`,
    `_query huermn:_ \`${t.q}\``,
    ``,
    `**Hechos candidatos (parafrasear, NO copiar):**`,
    provenance,
    ``,
    `**Stub para \`WELLNESS_TIPS\` (completá title/body en palabras propias):**`,
    "```ts",
    `{`,
    `  id: "TODO-id", topic: ${JSON.stringify(t.topic)}, states: ${fmtArr(t.states)}, items: ${fmtArr(t.items)},`,
    `  title: "PARAFRASEAR — el QUÉ, corto",`,
    `  body: "PARAFRASEAR — el protocolo en palabras propias; sin nombrar la fuente, sin RPE.",`,
    `  source: SRC,`,
    `},`,
    "```",
  ].join("\n");
}

const HEADER = [
  `# Borrador de tips de wellness (huermn → Holy Oly) — AUTORÍA, no producto`,
  ``,
  `> ⚠️ Generado por \`scripts/wellness/huberman-tips-draft.mjs\` desde el RAG local. Esto es material`,
  `> de AUTORÍA: **parafraseá** los hechos a tips nuevos en \`packages/core/src/data/wellnessTips.ts\`,`,
  `> con **fuente genérica** (\`SRC\`) y **sin nombrar la fuente jamás** (lo blinda \`wellnessTips.test.ts\`).`,
  `> La procedencia de abajo es interna — NO la embarques en el producto.`,
  ``,
].join("\n");

if (DRY) {
  console.log("Queries planeadas (dry-run — huermn NO consultado):\n");
  for (const t of TOPICS) console.log(`  [${t.topic}] states=${fmtArr(t.states)} items=${fmtArr(t.items)}\n    q: ${t.q}\n`);
  console.log(`Run real → ${HUERMN}/huberman/search?q=…&top_k=5 . Levantá huermn primero.`);
  process.exit(0);
}

async function search(q) {
  const res = await fetch(`${HUERMN}/huberman/search?q=${encodeURIComponent(q)}&top_k=5`);
  if (!res.ok) throw new Error(`huermn ${res.status}`);
  const data = await res.json();
  return Array.isArray(data.hits) ? data.hits : [];
}

try {
  const h = await fetch(`${HUERMN}/health`);
  if (!h.ok) throw new Error(String(h.status));
} catch {
  console.error(`No pude alcanzar huermn en ${HUERMN}.\nLevantala:  cd C:\\volta-atlas\\packages\\huermn && uvicorn api.main:app --port 8000`);
  process.exit(1);
}

const sections = [];
for (const t of TOPICS) {
  let hits = [];
  try { hits = await search(t.q); } catch (e) { console.error(`! ${t.topic}: ${e.message}`); }
  sections.push(section(t, hits));
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${HEADER}\n${sections.join("\n\n")}\n`, "utf8");
console.log(`Borrador escrito en ${OUT}.\nParafraseá los hechos a WELLNESS_TIPS (fuente genérica, NUNCA "Huberman", sin RPE) y corré el test de regresión.`);
