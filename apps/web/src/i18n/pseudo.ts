/**
 * Pseudo-localization for QA. Turns translated output into an accented, padded, bracketed variant so
 * that (a) any string that DIDN'T go through i18n stays plain ASCII and visually pops, and
 * (b) ~40% length padding surfaces layout truncation/overflow before real translations land.
 *
 * Preserves ICU placeholders (`{name}`) and <Trans> tag markers (`<0>…</0>`) untouched, so the
 * pseudo build stays interpolatable and rich-text-safe.
 */

const ACCENTS: Record<string, string> = {
  a: "á", b: "ƀ", c: "ç", d: "đ", e: "é", f: "ƒ", g: "ĝ", h: "ĥ", i: "í", j: "ĵ",
  k: "ķ", l: "ļ", m: "ɱ", n: "ñ", o: "ó", p: "þ", q: "ɋ", r: "ŕ", s: "š", t: "ţ",
  u: "ú", v: "ṽ", w: "ŵ", x: "ẋ", y: "ý", z: "ž",
  A: "Á", B: "Ɓ", C: "Ç", D: "Đ", E: "É", F: "Ƒ", G: "Ĝ", H: "Ĥ", I: "Í", J: "Ĵ",
  K: "Ķ", L: "Ļ", M: "Ϻ", N: "Ñ", O: "Ó", P: "Þ", Q: "Ɋ", R: "Ŕ", S: "Š", T: "Ţ",
  U: "Ú", V: "Ṽ", W: "Ŵ", X: "Ẋ", Y: "Ý", Z: "Ž",
};

/** A react-i18next <Trans> tag marker: `<0>`, `</0>`, `<12>`, … (digit-indexed only). */
const TRANS_TAG = /^<\/?\d+>/;

/**
 * Accent + pad + bracket a string while leaving ICU args (`{…}`, nested) and `<Trans>` tag markers
 * (`<0>…</0>`) intact. Bare `<` / `>` (comparisons like "< 80%", "> 3 series") are treated as plain
 * text and accented normally — only digit-indexed tags are skipped. Pure.
 */
export function pseudoize(input: string): string {
  let out = "";
  let braceDepth = 0; // inside an ICU {…} arg (supports nesting) → pass through verbatim
  let i = 0;
  while (i < input.length) {
    const ch = input[i]!;
    if (ch === "{") {
      braceDepth++;
      out += ch;
      i++;
      continue;
    }
    if (ch === "}") {
      if (braceDepth > 0) braceDepth--;
      out += ch;
      i++;
      continue;
    }
    if (braceDepth > 0) {
      out += ch;
      i++;
      continue;
    }
    if (ch === "<") {
      const tag = TRANS_TAG.exec(input.slice(i));
      if (tag) {
        out += tag[0];
        i += tag[0].length;
        continue;
      }
    }
    out += ACCENTS[ch] ?? ch;
    i++;
  }
  const pad = "·".repeat(Math.max(1, Math.round(out.length * 0.4)));
  return `⟦${out} ${pad}⟧`;
}
